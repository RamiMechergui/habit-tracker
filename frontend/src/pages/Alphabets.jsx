import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, BookA, Camera, Edit3, Trash2, ArrowLeft, Sparkles, NotebookPen } from 'lucide-react';
import { useHabits } from '../Store';
import { germanImageUrl } from '../utils/germanImageUrl';
import RichTextEditor from '../components/RichTextEditor';

const SPECIAL_CHARS = [
  { letter: 'ä', example: 'Apfel', english: 'Apple', pronunciation: 'ah' },
  { letter: 'ö', example: 'öffnen', english: 'to open', pronunciation: 'uh-fnen' },
  { letter: 'ü', example: 'über', english: 'over', pronunciation: 'oo-ber' },
  { letter: 'ß', example: 'Straße', english: 'Street', pronunciation: 'shtrah-se' },
  { letter: 'Ä', example: 'Ärger', english: 'Anger', pronunciation: 'air-ger' },
  { letter: 'Ö', example: 'Öl', english: 'Oil', pronunciation: 'uhl' },
  { letter: 'Ü', example: 'Übung', english: 'Exercise', pronunciation: 'oo-boong' },
];

const C = {
  blue: '#3b82f6', green: '#10b981', gold: '#eab308',
  red: '#dc2626', teal: '#14b8a6', border: 'var(--border)',
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
    uploadGermanAlphabetPhoto, deleteGermanRecord, saveGermanAlphabetNote,
    uploadGermanNotePhoto, fetchGermanData,
  } = useHabits();

  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionNote, setSectionNote] = useState('');
  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionSaved, setSectionSaved] = useState(false);
  const [letter, setLetter] = useState('');
  const [example, setExample] = useState('');
  const [english, setEnglish] = useState('');
  const [pronunciation, setPronunciation] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editLetter, setEditLetter] = useState('');
  const [editExample, setEditExample] = useState('');
  const [editEnglish, setEditEnglish] = useState('');
  const [editPronunciation, setEditPronunciation] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [pendingUploadId, setPendingUploadId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const fileRef = useRef(null);
  const [newPhoto, setNewPhoto] = useState(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState('');
  const addFileRef = useRef(null);
  const [subTab, setSubTab] = useState('letters');
  const [addingSpecialId, setAddingSpecialId] = useState(null);
  const [editSpecialId, setEditSpecialId] = useState(null);
  const [editSpecialExample, setEditSpecialExample] = useState('');
  const [editSpecialEnglish, setEditSpecialEnglish] = useState('');
  const [editSpecialPronunciation, setEditSpecialPronunciation] = useState('');
  const [uploadingSpecialId, setUploadingSpecialId] = useState(null);
  const [pendingSpecialUploadId, setPendingSpecialUploadId] = useState(null);
  const specialFileRef = useRef(null);

  useEffect(() => { fetchGermanData(); }, []);

  const alphabetNote = useMemo(() => (germanData || []).find(r => r.type === 'alphabetNote'), [germanData]);

  useEffect(() => {
    if (alphabetNote) {
      setSectionTitle(alphabetNote.title || '');
      setSectionNote(alphabetNote.note || '');
    }
  }, [alphabetNote]);

  const handleSaveSectionNote = async () => {
    setSectionSaving(true);
    setSectionSaved(false);
    try {
      await saveGermanAlphabetNote({ note: sectionNote, title: sectionTitle.trim() });
      setSectionSaved(true);
    } catch (e) { console.error(e); }
    finally { setSectionSaving(false); }
  };

  const handleUploadNotePhoto = async (file) => {
    if (!file) return null;
    try {
      const result = await uploadGermanNotePhoto(file);
      return result.url;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const alphabets = useMemo(() => {
    const filtered = (germanData || []).filter(r => r.type === 'alphabet');
    return [...filtered].sort((a, b) => {
      const la = (a.letter || '').toLowerCase();
      const lb = (b.letter || '').toLowerCase();
      return la.localeCompare(lb);
    });
  }, [germanData]);

  const addedLetters = useMemo(() => {
    return new Set(alphabets.map(a => a.letter));
  }, [alphabets]);

  const alphabetByLetter = useMemo(() => {
    const map = {};
    for (const a of alphabets) {
      map[a.letter] = a;
    }
    return map;
  }, [alphabets]);

  const specialChars = useMemo(() => {
    return SPECIAL_CHARS.map(sc => {
      const record = alphabetByLetter[sc.letter];
      return {
        ...sc,
        added: !!record,
        recordId: record?.recordId || null,
        photoUrl: record?.photoUrl || '',
        dbExample: record?.example || sc.example,
        dbEnglish: record?.english || sc.english,
        dbPronunciation: record?.pronunciation || sc.pronunciation,
      };
    });
  }, [alphabetByLetter]);

  const handleAdd = async () => {
    if (letter.trim().length !== 1 || !example.trim()) return;
    const created = await addGermanAlphabet({
      type: 'alphabet',
      letter: letter.trim(),
      example: example.trim(),
      english: english.trim(),
      pronunciation: pronunciation.trim(),
      photoUrl: '',
      sortOrder: alphabets.length,
    });
    if (created?.recordId && newPhoto) {
      try { await uploadGermanAlphabetPhoto(created.recordId, newPhoto); } catch (e) { console.error(e); }
    }
    setLetter(''); setExample(''); setEnglish(''); setPronunciation(''); setNewPhoto(null); setNewPhotoPreview(''); setShowAdd(false);
  };

  const handleAddSpecial = async (sc) => {
    if (addedLetters.has(sc.letter)) return;
    setAddingSpecialId(sc.letter);
    try {
      await addGermanAlphabet({
        type: 'alphabet',
        letter: sc.letter,
        example: sc.example,
        english: sc.english,
        pronunciation: sc.pronunciation,
        photoUrl: '',
        sortOrder: alphabets.length + SPECIAL_CHARS.findIndex(s => s.letter === sc.letter),
      });
    } catch (e) { console.error(e); }
    finally { setAddingSpecialId(null); }
  };

  const handleAddAllSpecial = async () => {
    const toAdd = SPECIAL_CHARS.filter(sc => !addedLetters.has(sc.letter));
    for (const sc of toAdd) {
      await handleAddSpecial(sc);
    }
  };

  const startEditSpecial = (sc) => {
    setEditSpecialId(sc.recordId);
    setEditSpecialExample(sc.dbExample);
    setEditSpecialEnglish(sc.dbEnglish);
    setEditSpecialPronunciation(sc.dbPronunciation);
  };

  const saveEditSpecial = async (recordId) => {
    if (!editSpecialExample.trim()) return;
    await updateGermanAlphabet(recordId, {
      example: editSpecialExample.trim(),
      english: editSpecialEnglish.trim(),
      pronunciation: editSpecialPronunciation.trim(),
    });
    setEditSpecialId(null);
  };

  const handleSpecialPhotoUpload = async (recordId, file) => {
    if (!file) return;
    setUploadingSpecialId(recordId);
    try { await uploadGermanAlphabetPhoto(recordId, file); } catch (e) { console.error(e); }
    finally { setUploadingSpecialId(null); }
  };

  const startEdit = (a) => {
    setEditingId(a.recordId);
    setConfirmDeleteId(null);
    setEditLetter(a.letter);
    setEditExample(a.example);
    setEditEnglish(a.english || '');
    setEditPronunciation(a.pronunciation || '');
  };

  const saveEdit = async (recordId) => {
    if (editLetter.trim().length !== 1 || !editExample.trim()) return;
    await updateGermanAlphabet(recordId, {
      letter: editLetter.trim(),
      example: editExample.trim(),
      english: editEnglish.trim(),
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
      </div>

      {/* Sub-tab selector */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.35rem' }}>
        <button onClick={() => setSubTab('letters')} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
          background: subTab === 'letters' ? `linear-gradient(135deg, ${C.blue}, #2563eb)` : 'transparent',
          color: subTab === 'letters' ? '#fff' : 'var(--text-muted)',
          fontWeight: subTab === 'letters' ? 700 : 600, fontSize: '0.82rem',
          transition: 'all 0.2s',
        }}>
          <BookA size={15} /> Regular Letters
        </button>
        <button onClick={() => setSubTab('special')} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          padding: '0.55rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
          background: subTab === 'special' ? `linear-gradient(135deg, ${C.gold}, #d97706)` : 'transparent',
          color: subTab === 'special' ? '#fff' : 'var(--text-muted)',
          fontWeight: subTab === 'special' ? 700 : 600, fontSize: '0.82rem',
          transition: 'all 0.2s',
        }}>
          <Sparkles size={15} /> Special Characters
        </button>
      </div>

      {subTab === 'letters' && (
        <button onClick={() => setShowAdd(!showAdd)} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
          background: `linear-gradient(135deg, ${C.blue}, #2563eb)`,
          color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
          marginBottom: '1rem',
        }}>
          {showAdd ? <X size={14} /> : <Plus size={14} />}
          {showAdd ? 'Cancel' : 'Add Letter'}
        </button>
      )}

      {showAdd && subTab === 'letters' && (
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
              <input value={example} onChange={e => setExample(e.target.value)} placeholder="Apfel" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            </div>
            <div style={{ flex: 2, minWidth: 150 }}>
              <label style={{ fontSize: '0.72rem', color: C.teal, fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>English Translation</label>
              <input value={english} onChange={e => setEnglish(e.target.value)} placeholder="Apple" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
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

      {subTab === 'letters' && alphabets.length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
          <BookA size={48} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '0.95rem', margin: 0 }}>No alphabets yet. Add your first German letter!</p>
        </div>
      )}

      {subTab === 'letters' && alphabets.length > 0 && (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Photo', 'Letter', 'Example Word', 'English', 'Pronunciation', ''].map(h => (
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
                          <img src={germanImageUrl(a.photoUrl)} alt={a.letter} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                        <>
                          <input value={editExample} onChange={e => setEditExample(e.target.value)} style={{ ...inputStyle }} />
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{a.example}</span>
                        </>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                      {editingId === a.recordId ? (
                        <input value={editEnglish} onChange={e => setEditEnglish(e.target.value)} placeholder="English" style={{ ...inputStyle }} />
                      ) : (
                        <span style={{ fontSize: '0.9rem', color: C.teal }}>{a.english || '—'}</span>
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

      {subTab === 'special' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <Sparkles size={20} style={{ color: C.gold }} /> Special Characters (Umlaute)
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                German umlauts and special characters — {specialChars.filter(s => s.added).length}/{SPECIAL_CHARS.length} added
              </p>
            </div>
            {specialChars.some(s => !s.added) && (
              <button onClick={handleAddAllSpecial} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
                background: `linear-gradient(135deg, ${C.gold}, #d97706)`,
                color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
              }}>
                <Plus size={14} /> Add All Missing
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.85rem' }}>
            {specialChars.map((sc) => (
              <div key={sc.letter} style={{
                background: 'var(--bg-card)', border: `1px solid ${sc.added ? C.green + '40' : 'var(--border)'}`,
                borderRadius: '14px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
                transition: 'all 0.2s',
              }}>
                {/* Photo area */}
                <div
                  style={{
                    position: 'relative', width: 72, height: 72, borderRadius: '12px',
                    overflow: 'hidden', border: `2px dashed ${sc.photoUrl ? 'transparent' : C.gold + '40'}`,
                    background: sc.photoUrl ? 'none' : `${C.gold}10`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: sc.added ? 'pointer' : 'default', flexShrink: 0,
                  }}
                  onClick={() => {
                    if (sc.added && sc.recordId) {
                      setPendingSpecialUploadId(sc.recordId);
                      specialFileRef.current?.click();
                    }
                  }}
                  title={sc.added ? 'Click to upload photo' : ''}>
                  {sc.photoUrl ? (
                    <img src={germanImageUrl(sc.photoUrl)} alt={sc.letter} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '2.2rem', fontWeight: 900, color: sc.added ? C.green : C.gold, lineHeight: 1 }}>{sc.letter}</span>
                  )}
                  {sc.photoUrl && (
                    <span style={{
                      position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
                      fontSize: '1.8rem', fontWeight: 900, color: '#fff',
                      textShadow: '0 2px 8px rgba(0,0,0,0.6)', lineHeight: 1,
                    }}>{sc.letter}</span>
                  )}
                  {uploadingSpecialId === sc.recordId && (
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

                {/* Info / Edit mode */}
                {editSpecialId === sc.recordId ? (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: C.green, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Example Word</label>
                      <input value={editSpecialExample} onChange={e => setEditSpecialExample(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} onKeyDown={e => e.key === 'Enter' && saveEditSpecial(sc.recordId)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: C.teal, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>English Translation</label>
                      <input value={editSpecialEnglish} onChange={e => setEditSpecialEnglish(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} onKeyDown={e => e.key === 'Enter' && saveEditSpecial(sc.recordId)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: C.gold, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pronunciation</label>
                      <input value={editSpecialPronunciation} onChange={e => setEditSpecialPronunciation(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} onKeyDown={e => e.key === 'Enter' && saveEditSpecial(sc.recordId)} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button onClick={() => setEditSpecialId(null)} style={{
                        flex: 1, padding: '0.35rem', borderRadius: '6px',
                        border: `1px solid ${C.border}`, background: 'var(--bg)',
                        color: 'var(--text-secondary)', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600,
                      }}>Cancel</button>
                      <button onClick={() => saveEditSpecial(sc.recordId)} disabled={!editSpecialExample.trim()} style={{
                        flex: 1, padding: '0.35rem', borderRadius: '6px', border: 'none',
                        background: !editSpecialExample.trim() ? 'var(--bg)' : C.green,
                        color: !editSpecialExample.trim() ? 'var(--text-muted)' : '#fff',
                        fontSize: '0.72rem', cursor: !editSpecialExample.trim() ? 'not-allowed' : 'pointer',
                        fontWeight: 700, opacity: !editSpecialExample.trim() ? 0.5 : 1,
                      }}>Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{sc.dbExample}</div>
                      <div style={{ fontSize: '0.78rem', color: C.teal, fontWeight: 500 }}>{sc.dbEnglish}</div>
                      <div style={{ fontSize: '0.75rem', color: C.gold, fontStyle: 'italic' }}>{sc.dbPronunciation || '—'}</div>
                    </div>
                    {sc.added ? (
                      <div style={{ display: 'flex', gap: '0.3rem', width: '100%' }}>
                        <button onClick={() => startEditSpecial(sc)} style={{
                          flex: 1, padding: '0.35rem', borderRadius: '6px', border: 'none',
                          background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600,
                        }} title="Edit"><Edit3 size={12} /> Edit</button>
                        <button onClick={() => { setPendingSpecialUploadId(sc.recordId); specialFileRef.current?.click(); }} style={{
                          flex: 1, padding: '0.35rem', borderRadius: '6px', border: 'none',
                          background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600,
                        }} title="Upload photo"><Camera size={12} /> Photo</button>
                        <button onClick={async () => {
                          if (confirm(`Delete "${sc.letter}" from your alphabet?`)) {
                            await deleteGermanRecord(sc.recordId);
                          }
                        }} style={{
                          padding: '0.35rem 0.5rem', borderRadius: '6px', border: 'none',
                          background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center',
                          color: C.red, fontSize: '0.72rem', fontWeight: 600,
                        }} title="Delete"><Trash2 size={12} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddSpecial(sc)}
                        disabled={addingSpecialId === sc.letter}
                        style={{
                          padding: '0.4rem 1rem', borderRadius: '8px', border: 'none',
                          background: `linear-gradient(135deg, ${C.gold}, #d97706)`,
                          color: '#fff', fontWeight: 700, fontSize: '0.78rem',
                          cursor: addingSpecialId === sc.letter ? 'wait' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: '0.3rem', width: '100%', justifyContent: 'center',
                        }}
                      >
                        {addingSpecialId === sc.letter ? 'Adding...' : 'Add'}
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden file input for regular photo upload */}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
        const file = e.target.files?.[0];
        if (file && pendingUploadId) await handlePhotoUpload(pendingUploadId, file);
        e.target.value = '';
        setPendingUploadId(null);
      }} />
      {/* Hidden file input for special character photo upload */}
      <input ref={specialFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
        const file = e.target.files?.[0];
        if (file && pendingSpecialUploadId) await handleSpecialPhotoUpload(pendingSpecialUploadId, file);
        e.target.value = '';
        setPendingSpecialUploadId(null);
      }} />

      {/* Section-level note for the whole Alphabets section (below the alphabets list) */}
      <div style={{
        padding: '1.1rem', borderRadius: '14px', border: `1px solid ${C.teal}40`,
        background: `${C.teal}08`, marginTop: '1.5rem',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.72rem', color: C.teal, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <NotebookPen size={15} /> Alphabets Note
          </label>
          {sectionSaved && <span style={{ fontSize: '0.72rem', color: C.green, fontWeight: 700 }}>Saved ✓</span>}
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Note Title <span style={{ fontWeight: 400, opacity: 0.7 }}>— optional</span>
          </label>
          <input
            value={sectionTitle}
            onChange={e => { setSectionTitle(e.target.value); setSectionSaved(false); }}
            placeholder="e.g. Why German letters are easy for me"
            style={{ ...inputStyle, background: 'var(--bg-card)', fontWeight: 600, fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Study Notes &amp; Reflections
            <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.7 }}>— paste or drag images directly into the editor, click any image to resize &amp; position it</span>
          </label>
          <RichTextEditor
            value={sectionNote}
            onChange={v => { setSectionNote(v); setSectionSaved(false); }}
            placeholder={`Add notes about the whole Alphabets section.\n\nThis note is exported to your PDF report.`}
            minHeight={220}
            onUploadImage={handleUploadNotePhoto}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSaveSectionNote} disabled={sectionSaving} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.5rem 1.1rem', borderRadius: '8px', border: 'none',
            background: sectionSaving ? 'var(--bg)' : `linear-gradient(135deg, ${C.teal}, #0d9488)`,
            color: sectionSaving ? 'var(--text-muted)' : '#fff',
            fontWeight: 700, fontSize: '0.82rem', cursor: sectionSaving ? 'wait' : 'pointer',
          }}>
            {sectionSaving ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}
