import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Trash2, Languages, Save, X, ChevronDown, ChevronUp, MessageSquare, Volume2, AlertTriangle, Camera, Image } from 'lucide-react';
import { AVATAR_COLORS, generateAvatarDataUri, isDataUri } from '../utils/avatar';

const C = { gold: '#eab308', red: '#dc2626', blue: '#3b82f6', green: '#10b981', purple: '#8b5cf6', orange: '#f97316' };

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

const GENDER_COLORS = { male: '#3b82f6', female: '#ec4899', other: '#8b5cf6' };

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

const inputBase = {
  width: '100%', marginTop: 4, padding: '0.55rem 0.8rem',
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem',
  boxSizing: 'border-box', outline: 'none',
};

const GENDER_CYCLE = ['male', 'female', 'other'];

function nextGender(current) {
  const idx = GENDER_CYCLE.indexOf(current);
  return GENDER_CYCLE[(idx + 1) % GENDER_CYCLE.length];
}

function AvatarSVG({ gender, name, size = 40, onClick, photoUrl }) {
  const color = GENDER_COLORS[gender] || GENDER_COLORS.other;
  const initial = (name || '?').charAt(0).toUpperCase();
  if (photoUrl) {
    return (
      <div onClick={onClick} style={{
        width: size, height: size, borderRadius: '50%',
        overflow: 'hidden', flexShrink: 0,
        border: `2px solid ${color}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
      }}>
        <img src={photoUrl} alt={name || 'participant'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  return (
    <div onClick={onClick} style={{
      width: size, height: size, borderRadius: '50%',
      background: `${color}20`, border: `2px solid ${color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontSize: size * 0.4, fontWeight: 800, color,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s ease',
    }}>
      {initial}
    </div>
  );
}

function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE'; u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

function DialogueCard({ dialogue, onEdit, onDelete }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${C.orange}30`,
      borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '0.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: `${C.orange}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={18} style={{ color: C.orange }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{dialogue.title}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
              {dialogue.participants?.map(p => p.name).join(' & ')} · Level {dialogue.level} · {dialogue.exchanges?.length || 0} exchanges
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onEdit(dialogue)} style={{ background: `${C.blue}15`, border: `1px solid ${C.blue}40`, borderRadius: '8px', cursor: 'pointer', color: C.blue, padding: '6px 10px', fontSize: '0.75rem', fontWeight: 600 }}>Edit</button>
          <button onClick={() => onDelete(dialogue.recordId)} style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: '8px', cursor: 'pointer', color: C.red, padding: '6px 10px', fontSize: '0.75rem', fontWeight: 600 }}><Trash2 size={13} /></button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {dialogue.exchanges?.slice(0, 3).map((ex, i) => {
          const p = dialogue.participants[ex.speakerIndex];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '0.4rem 0.6rem', background: 'var(--bg)', borderRadius: '8px' }}>
              <AvatarSVG gender={p?.gender} name={p?.name} size={24} photoUrl={p?.photoUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.75rem', color: GENDER_COLORS[p?.gender] || C.orange }}>{p?.name}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginTop: 1 }}>{ex.german}</div>
              </div>
            </div>
          );
        })}
        {dialogue.exchanges?.length > 3 && (
          <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', padding: '0.3rem' }}>
            +{dialogue.exchanges.length - 3} more exchanges
          </div>
        )}
      </div>
    </div>
  );
}

export default function DialogueBuilder({ onSave, onUpdate, onDelete, editDialogue, onCancelEdit, translating, isMobile, onTranslate, onUploadParticipantPhoto, onDeleteParticipantPhoto }) {
  const [participants, setParticipants] = useState(editDialogue ? editDialogue.participants : [
    { name: '', gender: 'male', photoUrl: '' },
    { name: '', gender: 'female', photoUrl: '' },
  ]);
  const [exchanges, setExchanges] = useState(editDialogue ? editDialogue.exchanges : []);
  const [title, setTitle] = useState(editDialogue?.title || '');
  const [level, setLevel] = useState(editDialogue?.level || 'A2');
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [translatingIdx, setTranslatingIdx] = useState(null);
  const [bulkTranslating, setBulkTranslating] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [pendingPhotoFiles, setPendingPhotoFiles] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(null);
  const [avatarPickerFor, setAvatarPickerFor] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const exchangeRef = useRef(null);
  const autoTranslateTimers = useRef({});
  const photoInputRefs = useRef({});
  const avatarPickerRef = useRef(null);

  const markDirty = () => setDirty(true);

  const setParticipant = (idx, field, value) => {
    setParticipants(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
    markDirty();
  };

  useEffect(() => {
    if (!avatarPickerFor) return;
    const handleClickOutside = (e) => {
      if (avatarPickerRef.current && !avatarPickerRef.current.contains(e.target)) {
        setAvatarPickerFor(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [avatarPickerFor]);

  const validateFile = (file) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setPhotoError('Only JPEG, PNG, WebP and GIF images are allowed');
      return false;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setPhotoError('Image must be smaller than 5 MB');
      return false;
    }
    return true;
  };

  const handleParticipantPhotoSelect = (idx, file) => {
    setPhotoError(null);
    if (!file) return;
    if (!validateFile(file)) return;
    if (editDialogue) {
      setUploadingPhoto(idx);
      onUploadParticipantPhoto(editDialogue.recordId, idx, file)
        .then(({ photoUrl }) => {
          setParticipant(idx, 'photoUrl', photoUrl);
          setAvatarPickerFor(null);
        })
        .catch(err => {
          setPhotoError(err.message || 'Failed to upload photo');
        })
        .finally(() => setUploadingPhoto(null));
    } else {
      setPendingPhotoFiles(prev => ({ ...prev, [idx]: file }));
      const blobUrl = URL.createObjectURL(file);
      setParticipant(idx, 'photoUrl', blobUrl);
      setAvatarPickerFor(null);
    }
    if (photoInputRefs.current[idx]) photoInputRefs.current[idx].value = '';
  };

  const handleSelectPresetAvatar = (idx, color) => {
    const name = participants[idx]?.name || '?';
    const dataUri = generateAvatarDataUri(name, color);
    setParticipant(idx, 'photoUrl', dataUri);
    setAvatarPickerFor(null);
    markDirty();
  };

  const handleRemoveParticipantPhoto = async (idx) => {
    setPhotoError(null);
    const url = participants[idx]?.photoUrl;
    if (editDialogue && url && !url.startsWith('blob:') && !isDataUri(url)) {
      try {
        await onDeleteParticipantPhoto(editDialogue.recordId, idx);
      } catch (err) {
        setPhotoError(err.message || 'Failed to remove photo');
      }
    }
    setParticipant(idx, 'photoUrl', '');
    setPendingPhotoFiles(prev => { const n = { ...prev }; delete n[idx]; return n; });
    setAvatarPickerFor(null);
  };

  const addParticipant = () => {
    if (participants.length >= 3) return;
    setParticipants(prev => [...prev, { name: '', gender: 'male', photoUrl: '' }]);
    markDirty();
  };

  const removeParticipant = (idx) => {
    if (participants.length <= 2) return;
    setParticipants(prev => prev.filter((_, i) => i !== idx));
    setExchanges(prev => prev.filter(ex => ex.speakerIndex !== idx).map(ex => ({
      ...ex,
      speakerIndex: ex.speakerIndex > idx ? ex.speakerIndex - 1 : ex.speakerIndex,
    })));
    markDirty();
  };

  const addExchange = (speakerIndex) => {
    setExchanges(prev => [...prev, { speakerIndex, original: '', german: '' }]);
    markDirty();
    setTimeout(() => exchangeRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const updateExchange = (idx, field, value) => {
    setExchanges(prev => prev.map((ex, i) => i === idx ? { ...ex, [field]: value } : ex));
    markDirty();
  };

  const removeExchange = (idx) => {
    if (autoTranslateTimers.current[idx]) { clearTimeout(autoTranslateTimers.current[idx]); delete autoTranslateTimers.current[idx]; }
    setExchanges(prev => prev.filter((_, i) => i !== idx));
    markDirty();
  };

  const doTranslate = onTranslate || (async (text, target) => { console.warn('No onTranslate provided'); return text; });

  const translateExchange = async (idx) => {
    const ex = exchanges[idx];
    if (!ex || !ex.german?.trim() || ex.original) return;
    setTranslatingIdx(idx);
    try {
      const translated = await doTranslate(ex.german, 'en');
      updateExchange(idx, 'original', translated);
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setTranslatingIdx(null);
    }
  };

  const translateAll = async () => {
    const untranslated = exchanges.filter(ex => ex.german?.trim() && !ex.original);
    if (untranslated.length === 0) return;
    setBulkTranslating(true);
    for (let i = 0; i < exchanges.length; i++) {
      const ex = exchanges[i];
      if (ex.german?.trim() && !ex.original) {
        try {
          const translated = await doTranslate(ex.german, 'en');
          updateExchange(i, 'original', translated);
        } catch (err) {
          console.error(`Translation error for exchange ${i}:`, err);
        }
      }
    }
    setBulkTranslating(false);
  };

  const handleSave = async () => {
    if (!title.trim() || participants.some(p => !p.name.trim()) || exchanges.length === 0) return;
    let finalParticipants = participants.map(p => ({ ...p, photoUrl: p.photoUrl?.startsWith('blob:') ? '' : p.photoUrl }));
    const payload = {
      title: title.trim(),
      level,
      participants: finalParticipants,
      exchanges,
    };
    if (editDialogue) {
      await onUpdate(editDialogue.recordId, payload);
      const pending = Object.entries(pendingPhotoFiles);
      if (pending.length > 0 && onUploadParticipantPhoto) {
        const updatedParticipants = [...finalParticipants];
        for (const [idx, file] of pending) {
          try {
            const { photoUrl } = await onUploadParticipantPhoto(editDialogue.recordId, parseInt(idx), file);
            updatedParticipants[parseInt(idx)] = { ...updatedParticipants[parseInt(idx)], photoUrl };
          } catch (err) {
            console.error(`Failed to upload photo for participant ${idx}:`, err);
          }
        }
        await onUpdate(editDialogue.recordId, { participants: updatedParticipants });
      }
    } else {
      const created = await onSave(payload);
      const recordId = created.recordId;
      const pending = Object.entries(pendingPhotoFiles);
      if (pending.length > 0 && onUploadParticipantPhoto) {
        const updatedParticipants = [...finalParticipants];
        for (const [idx, file] of pending) {
          try {
            const { photoUrl } = await onUploadParticipantPhoto(recordId, parseInt(idx), file);
            updatedParticipants[parseInt(idx)] = { ...updatedParticipants[parseInt(idx)], photoUrl };
          } catch (err) {
            console.error(`Failed to upload photo for participant ${idx}:`, err);
          }
        }
        await onUpdate(recordId, { participants: updatedParticipants });
      }
    }
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setLevel('A2');
    setParticipants([{ name: '', gender: 'male', photoUrl: '' }, { name: '', gender: 'female', photoUrl: '' }]);
    setExchanges([]);
    setPendingPhotoFiles({});
    setDirty(false);
    setOpen(false);
    if (onCancelEdit) onCancelEdit();
  };

  const handleCancel = () => {
    if (dirty) {
      setShowCancelConfirm(true);
      return;
    }
    resetForm();
  };

  const confirmCancel = () => {
    setShowCancelConfirm(false);
    resetForm();
  };

  const allTranslated = exchanges.every(ex => !ex.german?.trim() || ex.original);
  const anyUntranslated = exchanges.some(ex => ex.german?.trim() && !ex.original);
  const isValid = title.trim() && participants.every(p => p.name.trim()) && exchanges.length > 0 && allTranslated;

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <button onClick={() => { if (!open) setOpen(true); else handleCancel(); }} style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        background: `linear-gradient(135deg, ${C.orange}, ${C.red})`,
        color: '#fff', border: 'none', borderRadius: '10px',
        padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
        boxShadow: `0 4px 14px ${C.orange}40`,
      }}>
        {editDialogue ? <MessageSquare size={16} /> : <Plus size={16} />}
        {editDialogue ? 'Edit Dialogue' : 'New Dialogue'}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div style={{
          marginTop: '0.85rem', background: 'var(--bg-card)',
          border: `1px solid ${C.orange}40`, borderRadius: '14px', padding: '1.25rem',
        }}>
          {/* Title & Level */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Dialogue Title *</label>
              <input value={title} onChange={e => { setTitle(e.target.value); markDirty(); }} placeholder="e.g. Ordering at a restaurant" style={inputBase} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Language Level</label>
              <select value={level} onChange={e => setLevel(e.target.value)} style={{ ...inputBase, padding: '0.5rem 0.7rem' }}>
                {CEFR_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Participants */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Participants ({participants.length}/3)</label>
              {participants.length < 3 && (
                <button onClick={addParticipant} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.blue, fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={13} /> Add Person
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {participants.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.75rem', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)', position: 'relative' }}>
                    <AvatarSVG gender={p.gender} name={p.name} size={32} photoUrl={p.photoUrl} onClick={() => setParticipant(i, 'gender', nextGender(p.gender))} />
                    <input
                      ref={el => photoInputRefs.current[i] = el}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleParticipantPhotoSelect(i, f); }}
                    />
                    <button onClick={() => setAvatarPickerFor(avatarPickerFor === i ? null : i)} disabled={uploadingPhoto === i} style={{
                      background: p.photoUrl ? `${C.green}20` : `${C.blue}15`,
                      border: `1px solid ${p.photoUrl ? `${C.green}40` : `${C.blue}40`}`,
                      borderRadius: '8px', cursor: 'pointer', color: p.photoUrl ? C.green : C.blue,
                      padding: '5px 8px', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                      opacity: uploadingPhoto === i ? 0.5 : 1, flexShrink: 0,
                    }}>
                      <Image size={13} /> {uploadingPhoto === i ? '...' : p.photoUrl ? 'Avatar' : 'Avatar'}
                    </button>

                    {/* Avatar Picker Popover */}
                    {avatarPickerFor === i && (
                      <div ref={avatarPickerRef} style={{
                        position: 'absolute', top: '100%', left: 50, zIndex: 50,
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: '12px', padding: '0.75rem', width: 240,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.15)', marginTop: 4,
                      }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                          Choose avatar for {p.name || `Person ${i + 1}`}
                        </div>
                        {/* Preset color grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: 10 }}>
                          {AVATAR_COLORS.map(color => {
                            const dataUri = generateAvatarDataUri(p.name || '?', color);
                            const isActive = p.photoUrl === dataUri;
                            return (
                              <button key={color} onClick={() => handleSelectPresetAvatar(i, color)} style={{
                                width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                                border: isActive ? '3px solid #fff' : '2px solid transparent',
                                outline: isActive ? `2px solid ${color}` : 'none',
                                padding: 0, background: `url(${dataUri}) center/cover`,
                                boxShadow: isActive ? `0 0 0 1px ${color}` : 'none',
                                transition: 'all 0.15s ease',
                              }} />
                            );
                          })}
                        </div>
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <button onClick={() => photoInputRefs.current[i]?.click()} style={{
                            background: 'none', border: 'none', cursor: 'pointer', color: C.blue,
                            padding: '6px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                          }}>
                            <Camera size={14} /> Upload photo
                          </button>
                          {p.photoUrl && (
                            <button onClick={() => handleRemoveParticipantPhoto(i)} style={{
                              background: 'none', border: 'none', cursor: 'pointer', color: C.red,
                              padding: '6px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
                              display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                            }}>
                              <Trash2 size={14} /> Remove avatar
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <input value={p.name} onChange={e => setParticipant(i, 'name', e.target.value)} placeholder={`Person ${i + 1} name`} style={{ ...inputBase, marginTop: 0, flex: 1, minWidth: 100 }} />
                  <select value={p.gender} onChange={e => setParticipant(i, 'gender', e.target.value)} style={{ ...inputBase, marginTop: 0, width: 80, padding: '0.4rem 0.5rem', fontSize: '0.78rem' }}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {participants.length > 2 && (
                    <button onClick={() => removeParticipant(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 4 }}><X size={14} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Photo error toast */}
          {photoError && (
            <div style={{
              background: `${C.red}10`, border: `1px solid ${C.red}40`,
              borderRadius: '10px', padding: '0.55rem 0.85rem', marginBottom: '0.85rem',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={14} color={C.red} />
              <span style={{ fontSize: '0.8rem', color: C.red, flex: 1 }}>{photoError}</span>
              <button onClick={() => setPhotoError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 2, fontSize: '0.8rem', fontWeight: 700 }}>OK</button>
            </div>
          )}

          {/* Exchanges */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Dialogue Exchanges</label>
              {anyUntranslated && (
                <button onClick={translateAll} disabled={bulkTranslating} style={{
                  background: `linear-gradient(135deg, ${C.green}, #059669)`, border: 'none', borderRadius: '8px',
                  cursor: 'pointer', color: '#fff', padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 5, opacity: bulkTranslating ? 0.6 : 1,
                }}>
                  <Languages size={13} /> {bulkTranslating ? 'Translating…' : 'Translate All to English'}
                </button>
              )}
            </div>

            {exchanges.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem' }}>
                Add exchanges by clicking a participant button below.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {exchanges.map((ex, i) => {
                const p = participants[ex.speakerIndex] || { name: '?', gender: 'other' };
                const isTranslating = translatingIdx === i;
                const pColor = GENDER_COLORS[p.gender] || C.orange;
                return (
                  <div key={i} style={{ padding: '0.65rem 0.75rem', background: 'var(--bg)', borderRadius: '10px', border: `1px solid ${pColor}20`, borderLeft: `3px solid ${pColor}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <AvatarSVG gender={p.gender} name={p.name} size={26} photoUrl={p.photoUrl} />
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: pColor, flex: 1 }}>{p.name}</span>
                      <button onClick={() => removeExchange(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}><X size={13} /></button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>German</label>
                        <div style={{ position: 'relative' }}>
                          <textarea value={ex.german} onChange={e => { updateExchange(i, 'german', e.target.value); if (e.target.value.trim() && !ex.original) { if (autoTranslateTimers.current[i]) clearTimeout(autoTranslateTimers.current[i]); autoTranslateTimers.current[i] = setTimeout(() => translateExchange(i), 900); } }} placeholder="Type in German..." rows={2} style={{ ...inputBase, resize: 'vertical', fontSize: '0.82rem', padding: '0.45rem 0.65rem', borderColor: ex.german ? C.blue + '60' : 'var(--border)' }} />
                          <div style={{ position: 'absolute', bottom: 6, right: 6, display: 'flex', gap: 4 }}>
                            {ex.german && (
                              <button onClick={() => speakText(ex.german)} title="Listen" style={{ background: `${C.blue}15`, border: 'none', borderRadius: '4px', cursor: 'pointer', color: C.blue, padding: 2, display: 'flex' }}>
                                <Volume2 size={12} />
                              </button>
                            )}
                            {ex.german?.trim() && !ex.original && (
                              <button onClick={() => translateExchange(i)} disabled={isTranslating} style={{
                                background: `${C.green}20`, border: 'none', borderRadius: '4px', cursor: 'pointer',
                                color: C.green, padding: '3px 6px', fontSize: '0.65rem', fontWeight: 700, opacity: isTranslating ? 0.5 : 1,
                              }}>
                                {isTranslating ? '...' : 'Translate'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>English</label>
                        <textarea value={ex.original} onChange={e => updateExchange(i, 'original', e.target.value)} placeholder="Auto-translated from German" rows={2} style={{ ...inputBase, resize: 'vertical', fontSize: '0.82rem', padding: '0.45rem 0.65rem', borderColor: ex.original ? C.green + '60' : 'var(--border)' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div ref={exchangeRef} />
          </div>

          {/* Add Exchange Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {participants.map((p, i) => (
              <button key={i} onClick={() => addExchange(i)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0.5rem 0.9rem', borderRadius: '8px', cursor: 'pointer',
                background: `${GENDER_COLORS[p.gender]}15`, border: `1px solid ${GENDER_COLORS[p.gender]}40`,
                color: GENDER_COLORS[p.gender], fontWeight: 600, fontSize: '0.78rem',
              }}>
                <AvatarSVG gender={p.gender} name={p.name} size={18} photoUrl={p.photoUrl} />
                {p.name?.trim() || `Person ${i + 1}`}
              </button>
            ))}
          </div>

          {/* Unsaved changes confirmation */}
          {showCancelConfirm && (
            <div style={{
              background: `${C.orange}10`, border: `1px solid ${C.orange}40`,
              borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '0.85rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} color={C.orange} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Discard unsaved changes?</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setShowCancelConfirm(false)} style={{
                  padding: '0.35rem 0.9rem', borderRadius: '8px', cursor: 'pointer',
                  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600,
                }}>Keep editing</button>
                <button onClick={confirmCancel} style={{
                  padding: '0.35rem 0.9rem', borderRadius: '8px', cursor: 'pointer',
                  background: C.orange, border: 'none', color: '#fff', fontSize: '0.8rem', fontWeight: 700,
                }}>Discard</button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button onClick={handleCancel} style={{
              padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
            }}>Cancel</button>
            <button onClick={handleSave} disabled={!isValid || translating || bulkTranslating} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.5rem 1.2rem', borderRadius: '8px', cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.orange}, ${C.red})`,
              border: 'none', color: '#fff', fontWeight: 700, opacity: (!isValid || translating || bulkTranslating) ? 0.6 : 1,
            }}>
              <Save size={15} /> {translating || bulkTranslating ? 'Translating…' : editDialogue ? 'Update Dialogue' : 'Save Dialogue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { DialogueCard, AvatarSVG };