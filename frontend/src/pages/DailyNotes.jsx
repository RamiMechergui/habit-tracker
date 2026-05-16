import React, { useState, useEffect } from 'react';
import { format, addDays, subDays, isToday } from 'date-fns';
import { useHabits } from '../Store';
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2, Check, X, Clock, StickyNote } from 'lucide-react';

export default function DailyNotes() {
  const { dailyNotes, fetchNotesForDate, addDailyNote, updateDailyNote, deleteDailyNote } = useHabits();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const notesForDate = dailyNotes[dateStr] || [];

  useEffect(() => {
    const loadNotes = async () => {
      setLoading(true);
      await fetchNotesForDate(dateStr);
      setLoading(false);
    };
    loadNotes();
  }, [dateStr, fetchNotesForDate]);

  const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const handleToday = () => setSelectedDate(new Date());

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    
    setSaving(true);
    try {
      await addDailyNote(dateStr, newNoteContent.trim());
      setNewNoteContent('');
      setIsAdding(false);
    } catch (error) {
      alert(error.message || 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (note) => {
    setEditingId(note._id);
    setEditContent(note.content);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    setEditSaving(true);
    try {
      await updateDailyNote(editingId, dateStr, editContent.trim());
      setEditingId(null);
      setEditContent('');
    } catch (error) {
      alert(error.message || 'Failed to update note.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        await deleteDailyNote(id, dateStr);
      } catch (error) {
        alert(error.message || 'Failed to delete note.');
      }
    }
  };

  return (
    <div className="daily-notes-page" style={{ animation: 'pageSlideIn 0.3s ease', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* ── Header & Date Navigation ── */}
      <div className="notes-header glass-card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="settings-icon-badge" style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.05))', color: 'var(--accent-yellow, #eab308)' }}>
            <StickyNote size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Daily Notes</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Capture your thoughts for the day</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <button onClick={handlePrevDay} className="btn" style={{ padding: '6px', background: 'transparent', border: 'none', color: 'var(--text-primary)' }}>
            <ChevronLeft size={18} />
          </button>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '120px' }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{format(selectedDate, 'MMM d, yyyy')}</span>
            <span style={{ fontSize: '0.7rem', color: isToday(selectedDate) ? 'var(--accent-blue)' : 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE')}
            </span>
          </div>

          <button onClick={handleNextDay} className="btn" style={{ padding: '6px', background: 'transparent', border: 'none', color: 'var(--text-primary)' }}>
            <ChevronRight size={18} />
          </button>
          
          {!isToday(selectedDate) && (
            <button onClick={handleToday} className="btn" style={{ marginLeft: '4px', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, background: 'var(--accent-blue)', color: '#fff' }}>
              Today
            </button>
          )}
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Add Note Button / Input Area */}
        {isAdding ? (
          <div className="glass-card" style={{ padding: '16px', animation: 'fadeInDown 0.2s ease' }}>
            <textarea
              className="w-full"
              style={{ minHeight: '100px', resize: 'vertical', padding: '12px', fontSize: '0.95rem' }}
              placeholder="Write your note here..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button className="btn" onClick={() => setIsAdding(false)} disabled={saving} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
                Cancel
              </button>
              <button className="btn" onClick={handleAddNote} disabled={!newNoteContent.trim() || saving} style={{ background: 'var(--accent-blue)', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.7 : 1 }}>
                {saving ? <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Plus size={16} />} 
                {saving ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: '1px dashed var(--border)',
              background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)', fontSize: '0.9rem',
              fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <Plus size={18} /> Add a note for {isToday(selectedDate) ? 'today' : format(selectedDate, 'MMM d')}
          </button>
        )}

        {/* Notes List */}
        {loading && notesForDate.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading notes...</div>
        ) : notesForDate.length === 0 ? (
          <div className="glass-card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <StickyNote size={32} style={{ opacity: 0.3, marginBottom: '12px', display: 'inline-block' }} />
            <p style={{ margin: 0 }}>No notes found for this day.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notesForDate.map(note => (
              <div key={note._id} className="glass-card note-card" style={{ padding: '16px' }}>
                {editingId === note._id ? (
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
                      <button className="btn" onClick={handleSaveEdit} disabled={!editContent.trim() || editContent === note.content || editSaving} style={{ background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', opacity: editSaving ? 0.7 : 1 }}>
                        {editSaving ? <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Check size={14} />} 
                        {editSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                        <Clock size={12} />
                        {format(new Date(note.createdAt), 'h:mm a')}
                        {note.createdAt !== note.updatedAt && <span style={{ fontStyle: 'italic', opacity: 0.7, marginLeft: '4px' }}>(edited)</span>}
                      </div>
                      <div className="note-actions" style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn-icon" onClick={() => handleStartEdit(note)} title="Edit" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-icon" onClick={() => handleDelete(note._id)} title="Delete" style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                      {note.content}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        
      </div>
    </div>
  );
}
