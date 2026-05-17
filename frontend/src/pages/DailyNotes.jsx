import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useHabits } from '../Store';
import { Plus, Trash2, Edit2, Check, X, Clock, StickyNote } from 'lucide-react';

// Format: HH:mm MM/DD/YYYY
const formatTimestamp = (iso) => {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${hh}:${mm}  ${mo}/${dd}/${yyyy}`;
  } catch {
    return iso;
  }
};

export default function DailyNotes() {
  const { allNotes, fetchAllNotes, addDailyNote, updateDailyNote, deleteDailyNote } = useHabits();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [localMessage, setLocalMessage] = useState({ text: '', type: '' });

  const showMessage = (text, type = 'success') => {
    setLocalMessage({ text, type });
    setTimeout(() => setLocalMessage({ text: '', type: '' }), 4000);
  };

  // Load all notes on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchAllNotes();
      setLoading(false);
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    setSaving(true);
    try {
      await addDailyNote(todayStr, newNoteContent.trim());
      setNewNoteContent('');
      setIsAdding(false);
      showMessage('Note saved successfully');
    } catch (error) {
      showMessage(error.message || 'Failed to save note.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (note) => {
    setEditingId(note._id);
    setEditContent(note.content);
  };

  const handleSaveEdit = async (note) => {
    if (!editContent.trim()) return;
    setEditSaving(true);
    try {
      await updateDailyNote(editingId, note.date, editContent.trim());
      setEditingId(null);
      setEditContent('');
      showMessage('Note updated successfully');
    } catch (error) {
      showMessage(error.message || 'Failed to update note.', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const confirmDelete = async (note) => {
    try {
      await deleteDailyNote(note._id, note.date);
      showMessage('Note deleted successfully');
    } catch (error) {
      showMessage(error.message || 'Failed to delete note.', 'error');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="daily-notes-page" style={{ animation: 'pageSlideIn 0.3s ease', maxWidth: '800px', margin: '0 auto' }}>

      {/* ── Header ── */}
      <div className="notes-header glass-card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="settings-icon-badge" style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.05))', color: 'var(--accent-yellow, #eab308)' }}>
            <StickyNote size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>All Notes</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {loading ? 'Loading…' : `${allNotes.length} note${allNotes.length !== 1 ? 's' : ''} — newest first`}
            </span>
          </div>
        </div>

        {/* Quick add button in header */}
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="btn"
            style={{ background: 'var(--accent-yellow, #eab308)', color: '#000', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}
          >
            <Plus size={16} /> New Note
          </button>
        )}
      </div>

      {/* ── Local Messages ── */}
      {localMessage.text && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          background: localMessage.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          color: localMessage.type === 'error' ? '#ef4444' : '#10b981',
          border: `1px solid ${localMessage.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          animation: 'fadeInDown 0.3s ease'
        }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{localMessage.text}</span>
          <button onClick={() => setLocalMessage({ text: '', type: '' })} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Add Note Input Area ── */}
      {isAdding && (
        <div className="glass-card" style={{ padding: '16px', marginBottom: '16px', animation: 'fadeInDown 0.2s ease' }}>
          <textarea
            className="w-full"
            style={{ minHeight: '100px', resize: 'vertical', padding: '12px', fontSize: '0.95rem' }}
            placeholder="Write your note here…"
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button className="btn" onClick={() => { setIsAdding(false); setNewNoteContent(''); }} disabled={saving} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
              Cancel
            </button>
            <button className="btn" onClick={handleAddNote} disabled={!newNoteContent.trim() || saving} style={{ background: 'var(--accent-blue)', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.7 : 1 }}>
              {saving ? <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Plus size={16} />}
              {saving ? 'Saving…' : 'Save Note'}
            </button>
          </div>
        </div>
      )}

      {/* ── Notes List ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--accent-yellow, #eab308)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            Loading notes…
          </div>
        ) : allNotes.length === 0 ? (
          <div className="glass-card" style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <StickyNote size={36} style={{ opacity: 0.25, marginBottom: '14px', display: 'inline-block' }} />
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>No notes yet</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Hit "New Note" above to capture your first thought.</p>
          </div>
        ) : (
          allNotes.map(note => (
            <div key={note._id} className="glass-card note-card" style={{ padding: '16px' }}>
              {deleteConfirmId === note._id ? (
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <p style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', fontWeight: 600 }}>Delete this note?</p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn" onClick={() => setDeleteConfirmId(null)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>Cancel</button>
                    <button className="btn" onClick={() => confirmDelete(note)} style={{ background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              ) : editingId === note._id ? (
                <div>
                  <textarea
                    className="w-full"
                    style={{ minHeight: '80px', resize: 'vertical', padding: '12px', fontSize: '0.95rem' }}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    autoFocus
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                    <button className="btn" onClick={handleCancelEdit} disabled={editSaving} style={{ background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <X size={14} /> Cancel
                    </button>
                    <button className="btn" onClick={() => handleSaveEdit(note)} disabled={!editContent.trim() || editContent === note.content || editSaving} style={{ background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', opacity: editSaving ? 0.7 : 1 }}>
                      {editSaving ? <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Timestamp row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'monospace' }}>
                      <Clock size={12} />
                      {formatTimestamp(note.createdAt)}
                      {note.createdAt !== note.updatedAt && (
                        <span style={{ fontStyle: 'italic', opacity: 0.65, marginLeft: '4px', fontFamily: 'inherit' }}>(edited)</span>
                      )}
                    </div>
                    <div className="note-actions" style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-icon" onClick={() => handleStartEdit(note)} title="Edit" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn-icon" onClick={() => setDeleteConfirmId(note._id)} title="Delete" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Note content */}
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                    {note.content}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
