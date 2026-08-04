import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, BookA, Camera, Edit3, Trash2, ArrowLeft } from 'lucide-react';
import { useHabits } from '../Store';

const C = {
  blue: '#3b82f6', green: '#10b981', gold: '#eab308',
  red: '#dc2626', border: 'var(--border)',
};

const inputStyle = {
  padding: '0.6rem 0.75rem',
  borderRadius: '8px',
  border: `1px solid ${C.border}`,
  background: 'var(--bg)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
  flex: 1,
  minWidth: 0,
};

export default function Alphabets() {
  const nav = useNavigate();
  const {
    germanData, addGermanAlphabet, updateGermanAlphabet,
    uploadGermanAlphabetPhoto, deleteGermanRecord,
    fetchGermanData,
  } = useHabits();

  const [letter, setLetter] = useState('');
  const [example, setExample] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editLetter, setEditLetter] = useState('');
  const [editExample, setEditExample] = useState('');
  const [editPronunciation, setEditPronunciation] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [pendingUploadId, setPendingUploadId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const fileRef = useRef(null);
  const [newPhoto, setNewPhoto] = useState(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState('');
  const addFileRef = useRef(null);

  useEffect(() => { fetchGermanData(); }, []);

  const alphabets = useMemo(() => {
    const filtered = (germanData || []).filter(r => r.type === 'alphabet');
    return [...filtered].sort((a, b) => {
      const la = (a.letter || '').toLowerCase();
      const lb = (b.letter || '').toLowerCase();
      return la.localeCompare(lb);
    });
  }, [germanData]);

  const handleAdd = async () => {
    if (letter.trim().length !== 1 || !example.trim()) return;
    const created = await addGermanAlphabet({
      type: 'alphabet',
      letter: letter.trim(),
      example: example.trim(),
      pronunciation: pronunciation.trim(),
      photoUrl: '',
      sortOrder: alphabets.length,
    });
    if (created?.recordId && newPhoto) {
      try { await uploadGermanAlphabetPhoto(created.recordId, newPhoto); } catch (e) { console.error(e); }
    }
    setLetter(''); setExample(''); setPronunciation(''); setNewPhoto(null); setNewPhotoPreview(''); setShowAdd(false);
  };

  const startEdit = (a) => {
    setEditingId(a.recordId);
    setConfirmDeleteId(null);
    setEditLetter(a.letter);
    setEditExample(a.example);
    setEditPronunciation(a.pronunciation || '');
  };

  const saveEdit = async (recordId) => {
    if (editLetter.trim().length !== 1 || !editExample.trim()) return;
    await updateGermanAlphabet(recordId, {
      letter: editLetter.trim(),
      example: editExample.trim(),
      pronunciation: editPronunciation.trim(),
    });
    setEditingId(null);
    setConfirmDeleteId(null);
  };

  const handlePhotoUpload = async (recordId, file) => {
    if (!file) return;
    setUploadingId(recordId);
    try { await uploadGermanAlphabetPhoto(recordId, file); } catch (e) { console.error(e); }
    finally { setUploadingId(null); }
  };

  return (
    <div style={{ padding: '0 0.5rem', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button onClick={() => nav('/german')} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '10px', cursor: 'pointer', padding: '0.5rem 0.6rem',
          display: 'flex', color: 'var(--text-muted)',
        }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <BookA size={22} style={{ color: C.blue }} /> German Alphabets
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Learn the German alphabet — {alphabets.length} letter{alphabets.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
          background: `linear-gradient(135deg, ${C.blue}, #2563eb)`,
          color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
        }}>
          {showAdd ? <X size={14} /> : <Plus size={14} />}
          {showAdd ? 'Cancel' : 'Add Letter'}
        </button>
      </div>

      {showAdd && (
        <div style={{
          padding: '1rem', borderRadius: '12px', border: `1px solid ${C.blue}40`,
          background: `${C.blue}08`, marginBottom: '1.25rem',
          display: 'flex', flexDirection: 'column', gap: '0.6rem',
        }}>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 56, height: 56, borderRadius: '10px', overflow: 'hidden', border: `2px dashed ${C.blue}40`, background: `${C.blue}08`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              onClick={() => addFileRef.current?.click()} title="Click to upload photo">
              {newPhotoPreview ? (
                <img src={newPhotoPreview} alt="new" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Camera size={20} style={{ color: `${C.blue}60` }} />
              )}
            </div>
            {newPhotoPreview && (
              <button type="button" onClick={() => { setNewPhoto(null); setNewPhotoPreview(''); }} style={{ fontSize: '0.7rem', background: 'transparent', border: 'none', color: C.red, cursor: 'pointer', padding: 0, fontWeight: 600 }}>Remove photo</button>
            )}
            <input ref={addFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setNewPhoto(f); setNewPhotoPreview(URL.createObjectURL(f)); }
              e.target.value = '';
            }} />
            <div style={{ flex: 0, minWidth: 80 }}>
              <label style={{ fontSize: '0.72rem', color: C.blue, fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Letter</label>
              <input value={letter} onChange={e => setLetter(e.target.value)} placeholder="A" maxLength={1} style={{ ...inputStyle, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem' }} />
            </div>
            <div style={{ flex: 2, minWidth: 150 }}>
              <label style={{ fontSize: '0.72rem', color: C.green, fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Example Word</label>
              <input value={example} onChange={e => setExample(e.target.value)} placeholder="Apfel (Apple)" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            </div>
            <div style={{ flex: 2, minWidth: 150 }}>
              <label style={{ fontSize: '0.72rem', color: C.gold, fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Pronunciation</label>
              <input value={pronunciation} onChange={e => setPronunciation(e.target.value)} placeholder="ah-pel" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            </div>
          </div>
          <button onClick={handleAdd} disabled={letter.trim().length !== 1 || !example.trim()} style={{
            padding: '0.55rem', borderRadius: '8px', border: 'none',
            background: (letter.trim().length !== 1 || !example.trim()) ? 'var(--bg)' : `linear-gradient(135deg, ${C.blue}, #2563eb)`,
            color: (letter.trim().length !== 1 || !example.trim()) ? 'var(--text-muted)' : '#fff',
            fontWeight: 700, fontSize: '0.82rem',
            cursor: (letter.trim().length !== 1 || !example.trim()) ? 'not-allowed' : 'pointer',
            opacity: (letter.trim().length !== 1 || !example.trim()) ? 0.5 : 1,
          }}>
            Save Alphabet
          </button>
        </div>
      )}

      {alphabets.length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
          <BookA size={48} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '0.95rem', margin: 0 }}>No alphabets yet. Add your first German letter!</p>
        </div>
      )}

      {alphabets.length > 0 && (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Photo', 'Letter', 'Example Word', 'Pronunciation', ''].map(h => (
                    <th key={h} style={{
                      padding: '0.7rem 1rem', fontSize: '0.72rem', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: 'var(--text-muted)', background: 'var(--bg)',
                      textAlign: 'left', borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alphabets.map(a => (
                  <tr key={a.recordId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                      <div style={{
                        position: 'relative', width: 56, height: 56, borderRadius: '10px',
                        overflow: 'hidden', border: `2px dashed ${a.photoUrl ? 'transparent' : C.blue + '40'}`,
                        background: a.photoUrl ? 'none' : `${C.blue}08`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', flexShrink: 0,
                      }}
                        onClick={() => { setPendingUploadId(a.recordId); fileRef.current?.click(); }}
                        title="Click to upload photo">
                        {a.photoUrl ? (
                          <img src={a.photoUrl} alt={a.letter} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Camera size={20} style={{ color: `${C.blue}60` }} />
                        )}
                        {uploadingId === a.recordId && (
                          <div style={{
                            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: '50%',
                              border: '2px solid #fff', borderTopColor: 'transparent',
                              animation: 'evolvio-spin 0.8s linear infinite',
                            }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                      {editingId === a.recordId ? (
                        <input value={editLetter} onChange={e => setEditLetter(e.target.value)} maxLength={1} style={{ ...inputStyle, textAlign: 'center', fontWeight: 700, fontSize: '1.1rem', width: 60 }} />
                      ) : (
                        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: C.blue }}>{a.letter}</span>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                      {editingId === a.recordId ? (
                        <input value={editExample} onChange={e => setEditExample(e.target.value)} style={{ ...inputStyle }} />
                      ) : (
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{a.example}</span>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                      {editingId === a.recordId ? (
                        <input value={editPronunciation} onChange={e => setEditPronunciation(e.target.value)} style={{ ...inputStyle }} />
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: C.gold, fontStyle: 'italic' }}>{a.pronunciation || '—'}</span>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      {editingId === a.recordId ? (
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button onClick={() => { setEditingId(null); setConfirmDeleteId(null); }} style={{
                            padding: '0.3rem 0.6rem', borderRadius: '6px',
                            border: `1px solid ${C.border}`, background: 'var(--bg)',
                            color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600,
                          }}>Cancel</button>
                          <button onClick={() => saveEdit(a.recordId)} style={{
                            padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none',
                            background: C.blue, color: '#fff', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700,
                          }}>Save</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button onClick={() => startEdit(a)} style={{
                            padding: '0.3rem', borderRadius: '6px', border: 'none',
                            background: 'transparent', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)',
                          }} title="Edit"><Edit3 size={14} /></button>
                          {confirmDeleteId === a.recordId ? (
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button onClick={() => setConfirmDeleteId(null)} style={{
                                padding: '0.3rem 0.6rem', borderRadius: '6px',
                                border: `1px solid ${C.border}`, background: 'var(--bg)',
                                color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600,
                              }}>No</button>
                              <button onClick={async () => { await deleteGermanRecord(a.recordId); setConfirmDeleteId(null); }} style={{
                                padding: '0.3rem 0.6rem', borderRadius: '6px', border: 'none',
                                background: C.red, color: '#fff', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700,
                              }}>Delete</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(a.recordId)} style={{
                              padding: '0.3rem', borderRadius: '6px', border: 'none',
                              background: 'transparent', cursor: 'pointer', display: 'flex', color: C.red,
                            }} title="Delete"><Trash2 size={14} /></button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hidden file input for photo upload */}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
        const file = e.target.files?.[0];
        if (file && pendingUploadId) await handlePhotoUpload(pendingUploadId, file);
        e.target.value = '';
        setPendingUploadId(null);
      }} />
    </div>
  );
}
