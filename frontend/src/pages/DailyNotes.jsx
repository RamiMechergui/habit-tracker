import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { useHabits } from '../Store';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
  Plus, Trash2, Edit2, Check, X, Clock, StickyNote,
  WifiOff, CloudOff, Folder, Settings, FolderPlus, ChevronDown,
  ChevronUp, Send, BookOpen, Tag, MoreHorizontal, AlertTriangle, Pencil
} from 'lucide-react';

/* ─── Helpers ────────────────────────────────────────────────────── */
const formatTimestamp = (iso) => {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${hh}:${mm}  ${mo}/${dd}/${yyyy}`;
  } catch { return iso; }
};

const formatDateHeader = (dateStr) => {
  try {
    return format(new Date(dateStr + 'T12:00:00'), 'EEEE, MMMM d, yyyy');
  } catch { return dateStr; }
};

// Stable section colors (cycling through a palette)
const SECTION_COLORS = [
  '#f97316', // amber
  '#2563eb', // blue
  '#10b981', // emerald
  '#a855f7', // purple
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#eab308', // yellow
  '#84cc16', // lime
];

function getSectionColor(name, sections) {
  if (name === 'General') return 'var(--text-muted)';
  const idx = sections.indexOf(name);
  return SECTION_COLORS[idx % SECTION_COLORS.length];
}

/* ─── Sub-components ──────────────────────────────────────────────── */

function NoteCard({ note, onEdit, onDelete, deleteConfirmId, setDeleteConfirmId, editingId, editContent, setEditContent, editSection, setEditSection, editSaving, onSaveEdit, onCancelEdit, noteSections, sectionColor }) {
  const isEditing = editingId === note._id;
  const isConfirming = deleteConfirmId === note._id;

  return (
    <div
      className="dn-note-card"
      style={{
        borderLeft: `3px solid ${sectionColor}`,
        borderRadius: '0 10px 10px 0',
        padding: '12px 14px',
        transition: 'background 0.15s ease, box-shadow 0.15s ease',
        animation: 'noteSlideIn 0.2s ease',
      }}
    >
      {isConfirming ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
            <AlertTriangle size={14} />
            Delete this note?
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', borderLeft: '2px solid var(--border)', paddingLeft: '10px', whiteSpace: 'pre-wrap' }}>
            {note.content.length > 80 ? note.content.slice(0, 80) + '…' : note.content}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => setDeleteConfirmId(null)} style={{ padding: '5px 12px', fontSize: '0.8rem' }}>Cancel</button>
            <button className="btn" onClick={() => onDelete(note)} style={{ background: '#ef4444', color: '#fff', padding: '5px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      ) : isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <textarea
            className="w-full"
            style={{ minHeight: '90px', resize: 'vertical', padding: '10px', fontSize: '0.9rem', borderRadius: '8px' }}
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Tag size={13} style={{ color: 'var(--text-muted)' }} />
              <select
                value={editSection}
                onChange={e => setEditSection(e.target.value)}
                style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}
              >
                {noteSections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn btn-secondary" onClick={onCancelEdit} disabled={editSaving} style={{ padding: '5px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <X size={12} /> Cancel
              </button>
              <button className="btn" onClick={() => onSaveEdit(note)} disabled={!editContent.trim() || editSaving} style={{ background: 'var(--accent-emerald)', color: '#fff', padding: '5px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', opacity: editSaving ? 0.7 : 1 }}>
                {editSaving ? <div className="spinner" style={{ width: '12px', height: '12px' }} /> : <Check size={12} />}
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--text-primary)', marginBottom: '10px' }}>
            {note.content}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'monospace' }}>
              <Clock size={10} />
              {formatTimestamp(note.createdAt)}
              {note.createdAt !== note.updatedAt && <span style={{ fontStyle: 'italic', opacity: 0.65 }}>(edited)</span>}
              {note.pendingSync && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#eab308' }} title="Pending sync">
                  <CloudOff size={10} /> syncing
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '2px', opacity: 0, transition: 'opacity 0.15s' }} className="note-actions">
              <button
                title="Edit"
                onClick={() => onEdit(note)}
                className="dn-action-btn"
              >
                <Pencil size={12} />
              </button>
              <button
                title="Delete"
                onClick={() => setDeleteConfirmId(note._id)}
                className="dn-action-btn dn-action-btn-danger"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


/* ─── Main component ─────────────────────────────────────────────── */
export default function DailyNotes() {
  const {
    allNotes, fetchAllNotes, addDailyNote, updateDailyNote, deleteDailyNote,
    noteSections, setNoteSections, isOnline
  } = useHabits();

  const [loading, setLoading] = useState(false);
  const [savingSection, setSavingSection] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editSection, setEditSection] = useState('General');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [localMessage, setLocalMessage] = useState({ text: '', type: '' });

  // Section management
  const [showManageSections, setShowManageSections] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [sectionDeleteConfirmName, setSectionDeleteConfirmName] = useState(null);

  // Active section tab (for Today's view)
  const [activeSection, setActiveSection] = useState('General');

  // Quick-compose for each section
  const [composeContent, setComposeContent] = useState('');
  const [composeFocused, setComposeFocused] = useState(false);
  const textareaRef = useRef(null);

  // Collapsed past-day cards
  const [collapsedDates, setCollapsedDates] = useState({});

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isMobile = useMediaQuery('(max-width: 768px)');

  const showMessage = (text, type = 'success') => {
    setLocalMessage({ text, type });
    setTimeout(() => setLocalMessage({ text: '', type: '' }), 4000);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchAllNotes();
      setLoading(false);
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ensure active section stays valid when sections change
  useEffect(() => {
    if (!noteSections.includes(activeSection)) {
      setActiveSection(noteSections[0] || 'General');
    }
  }, [noteSections, activeSection]);

  /* ── Compose ── */
  const handleAddNote = async () => {
    const content = composeContent.trim();
    if (!content) return;
    setSavingSection(activeSection);
    try {
      const dbSection = activeSection === 'General' ? '' : activeSection;
      await addDailyNote(todayStr, content, dbSection);
      setComposeContent('');
      setComposeFocused(false);
      showMessage('Note saved ✓');
    } catch (error) {
      showMessage(error.message || 'Failed to save note.', 'error');
    } finally {
      setSavingSection(null);
    }
  };

  const handleComposeKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleAddNote();
    }
    if (e.key === 'Escape') {
      setComposeContent('');
      setComposeFocused(false);
    }
  };

  /* ── Edit ── */
  const handleStartEdit = (note) => {
    setEditingId(note._id);
    setEditContent(note.content);
    setEditSection(note.section || 'General');
    setDeleteConfirmId(null);
  };

  const handleSaveEdit = async (note) => {
    if (!editContent.trim()) return;
    setEditSaving(true);
    try {
      const dbSection = editSection === 'General' ? '' : editSection;
      await updateDailyNote(editingId, note.date, editContent.trim(), dbSection);
      setEditingId(null);
      setEditContent('');
      showMessage('Note updated ✓');
    } catch (error) {
      showMessage(error.message || 'Failed to update note.', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleCancelEdit = () => { setEditingId(null); setEditContent(''); };

  /* ── Delete note ── */
  const confirmDelete = async (note) => {
    try {
      await deleteDailyNote(note._id, note.date);
      showMessage('Note deleted');
    } catch (error) {
      showMessage(error.message || 'Failed to delete note.', 'error');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  /* ── Sections ── */
  const handleAddSection = (e) => {
    e.preventDefault();
    const name = newSectionName.trim();
    if (!name) return;
    if (noteSections.some(s => s.toLowerCase() === name.toLowerCase())) {
      showMessage('Section already exists', 'error');
      return;
    }
    const next = [...noteSections, name];
    setNoteSections(next);
    setNewSectionName('');
    showMessage(`Notebook "${name}" created`);
  };

  const handleDeleteSection = (secName) => {
    if (secName === 'General') { showMessage('Cannot delete the General notebook', 'error'); return; }
    setSectionDeleteConfirmName(secName);
  };

  const executeDeleteSection = (secName) => {
    const next = noteSections.filter(s => s !== secName);
    setNoteSections(next);
    setSectionDeleteConfirmName(null);
    if (activeSection === secName) setActiveSection('General');
    showMessage(`"${secName}" removed — notes moved to General`);
  };

  const toggleDateCollapse = (dateStr) => {
    setCollapsedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  /* ── Derived data ── */
  const todayNotes = allNotes.filter(n => n.date === todayStr);
  const activeSectionNotes = todayNotes.filter(n => (n.section || 'General') === activeSection);

  const pastGrouped = {};
  allNotes.forEach(n => {
    if (n.date === todayStr) return;
    if (!pastGrouped[n.date]) pastGrouped[n.date] = [];
    pastGrouped[n.date].push(n);
  });
  const pastDates = Object.keys(pastGrouped).sort((a, b) => b.localeCompare(a));

  const totalTodayCount = todayNotes.length;

  return (
    <>
      {/* ── Theme-adaptive styles ── */}
      <style>{`
        /* ─ Theme-adaptive CSS custom properties scoped to Daily Notes ─ */
        .daily-notes-root {
          --dn-surface: rgba(255,255,255,0.025);
          --dn-surface-hover: rgba(255,255,255,0.05);
          --dn-surface-elevated: rgba(0,0,0,0.15);
          --dn-header-gradient: linear-gradient(135deg, rgba(249,115,22,0.06), rgba(24,24,27,0.7));
          --dn-tab-bg: rgba(0,0,0,0.15);
          --dn-tab-inactive: rgba(255,255,255,0.04);
          --dn-badge-bg: rgba(255,255,255,0.06);
          --dn-compose-bg: rgba(255,255,255,0.02);
          --dn-compose-focus: rgba(249,115,22,0.04);
          --dn-compose-footer: rgba(0,0,0,0.08);
          --dn-disabled-bg: rgba(255,255,255,0.06);
          --dn-action-hover: rgba(255,255,255,0.08);
          --dn-past-hover-shadow: 0 8px 32px -8px rgba(0,0,0,0.35);
        }

        [data-theme='light'] .daily-notes-root {
          --dn-surface: rgba(0,0,0,0.024);
          --dn-surface-hover: rgba(0,0,0,0.045);
          --dn-surface-elevated: rgba(0,0,0,0.03);
          --dn-header-gradient: linear-gradient(135deg, rgba(249,115,22,0.06), rgba(255,255,255,0.85));
          --dn-tab-bg: rgba(0,0,0,0.028);
          --dn-tab-inactive: rgba(0,0,0,0.03);
          --dn-badge-bg: rgba(0,0,0,0.05);
          --dn-compose-bg: rgba(0,0,0,0.015);
          --dn-compose-focus: rgba(249,115,22,0.04);
          --dn-compose-footer: rgba(0,0,0,0.03);
          --dn-disabled-bg: rgba(0,0,0,0.05);
          --dn-action-hover: rgba(0,0,0,0.06);
          --dn-past-hover-shadow: 0 6px 24px -6px rgba(0,0,0,0.1);
        }

        .note-card-wrap:hover .note-actions { opacity: 1 !important; }

        @keyframes noteSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes panelSlideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .compose-textarea:focus { outline: none; }

        /* Note card */
        .dn-note-card {
          background: var(--dn-surface);
        }
        .dn-note-card:hover {
          background: var(--dn-surface-hover);
          box-shadow: 0 2px 8px -2px rgba(0,0,0,0.06);
        }

        /* Action buttons in note cards */
        .dn-action-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: color 0.15s, background 0.15s;
        }
        .dn-action-btn:hover {
          background: var(--dn-action-hover);
          color: var(--text-primary);
        }
        .dn-action-btn-danger:hover {
          background: rgba(239,68,68,0.08);
          color: #ef4444;
        }

        /* Section tabs */
        .section-tab {
          border: none;
          cursor: pointer;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.82rem;
          font-weight: 600;
          font-family: var(--font-sans);
          transition: background 0.15s, color 0.15s, box-shadow 0.15s;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .section-tab:hover { filter: brightness(1.1); }

        /* Manage Notebooks button */
        .dn-manage-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 16px;
          border-radius: 10px;
          border: 1px solid var(--border);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          font-family: var(--font-sans);
        }
        .dn-manage-btn:hover {
          background: var(--dn-action-hover);
          color: var(--text-primary);
        }

        /* Past day cards */
        .past-day-card { transition: box-shadow 0.2s; }
        .past-day-card:hover { box-shadow: var(--dn-past-hover-shadow); }

        /* Mobile-first: always show note actions */
        @media (max-width: 768px) {
          .note-actions { opacity: 1 !important; }
          .note-card-wrap .note-actions { opacity: 1 !important; }
          .dn-action-btn { padding: 8px 10px !important; }
          .section-tab { padding: 10px 16px !important; }
          .compose-textarea { font-size: 16px !important; }
        }
      `}</style>

      <div className="daily-notes-root" style={{ maxWidth: '860px', margin: '0 auto', paddingBottom: '60px', animation: 'pageSlideIn 0.3s ease' }}>

        {/* ══ HEADER ══ */}
          <div className="glass-card" style={{
            padding: isMobile ? '16px 16px' : '22px 24px',
            marginBottom: isMobile ? '16px' : '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: isMobile ? '12px' : '16px',
          background: 'var(--dn-header-gradient)',
          borderLeft: '3px solid var(--accent-amber)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: isMobile ? '40px' : '50px', height: isMobile ? '40px' : '50px', borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.08))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-amber)', flexShrink: 0,
            }}>
              <BookOpen size={isMobile ? 18 : 22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: isMobile ? '1.15rem' : '1.35rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>Daily Notes</h2>
                {!isOnline && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: '6px' }}>
                    <WifiOff size={11} /> Offline Mode
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {loading ? 'Loading…' : `${allNotes.length} note${allNotes.length !== 1 ? 's' : ''} across ${noteSections.length} notebook${noteSections.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowManageSections(v => !v)}
            className="dn-manage-btn"
            style={{
              background: showManageSections ? 'rgba(249,115,22,0.12)' : 'transparent',
              color: showManageSections ? 'var(--accent-amber)' : 'var(--text-secondary)',
            }}
          >
            <Settings size={15} />
            Manage Notebooks
          </button>
        </div>

        {/* ══ MANAGE SECTIONS PANEL ══ */}
        {showManageSections && (
          <div className="glass-card" style={{
            padding: isMobile ? '16px 16px' : '20px 24px',
            marginBottom: isMobile ? '16px' : '20px',
            animation: 'panelSlideDown 0.2s ease',
            borderTop: '2px solid var(--accent-amber)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <FolderPlus size={17} style={{ color: 'var(--accent-amber)' }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontFamily: 'var(--font-heading)' }}>Notebook Categories</h3>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Organize your notes into custom notebooks. <strong>General</strong> is always present and cannot be removed.
            </p>

            {/* Section chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
              {noteSections.map((sec, idx) => {
                const col = getSectionColor(sec, noteSections);
                return (
                  <div key={sec} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: `${col}14`,
                    border: `1px solid ${col}40`,
                    padding: '6px 12px', borderRadius: '20px', fontSize: '0.84rem', fontWeight: 500,
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col, flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-primary)' }}>{sec}</span>
                    {sec !== 'General' && (
                      <button
                        onClick={() => handleDeleteSection(sec)}
                        className="dn-action-btn dn-action-btn-danger"
                        style={{ padding: '1px 2px', marginLeft: '2px' }}
                        title={`Remove ${sec}`}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Delete confirmation */}
            {sectionDeleteConfirmName && (
              <div style={{
                background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '10px', padding: '14px 16px', marginBottom: '18px',
                animation: 'panelSlideDown 0.2s ease',
              }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    Are you sure you want to remove <strong>"{sectionDeleteConfirmName}"</strong>? Existing notes in this section will not be deleted, but will be categorized under <strong>General</strong> unless reassigned.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setSectionDeleteConfirmName(null)} style={{ padding: '5px 14px', fontSize: '0.8rem' }}>Cancel</button>
                  <button className="btn" onClick={() => executeDeleteSection(sectionDeleteConfirmName)} style={{ background: '#ef4444', color: '#fff', padding: '5px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Trash2 size={12} /> Confirm Remove
                  </button>
                </div>
              </div>
            )}

            {/* Add section */}
            <form onSubmit={handleAddSection} style={{ display: 'flex', gap: '10px', maxWidth: '440px', flexDirection: isMobile ? 'column' : 'row' }}>
              <input
                type="text"
                placeholder="New notebook name (e.g. Work Notes, Gym log…)"
                value={newSectionName}
                onChange={e => setNewSectionName(e.target.value)}
                style={{ flex: 1, padding: isMobile ? '12px 13px' : '9px 13px', fontSize: isMobile ? '16px' : '0.88rem', borderRadius: '8px' }}
              />
              <button
                type="submit"
                className="btn"
                disabled={!newSectionName.trim()}
                style={{ padding: isMobile ? '12px 18px' : '9px 18px', background: 'var(--accent-amber)', color: '#000', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px', whiteSpace: 'nowrap', justifyContent: 'center', minHeight: isMobile ? '44px' : 'auto' }}
              >
                <Plus size={14} /> Add
              </button>
            </form>
          </div>
        )}

        {/* ══ TOAST MESSAGE ══ */}
        {localMessage.text && (
          <div style={{
            padding: '11px 16px', borderRadius: '10px', marginBottom: '18px',
            background: localMessage.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            color: localMessage.type === 'error' ? '#ef4444' : '#10b981',
            border: `1px solid ${localMessage.type === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            animation: 'toastSlideIn 0.25s ease', fontWeight: 600, fontSize: '0.88rem',
          }}>
            <span>{localMessage.text}</span>
            <button onClick={() => setLocalMessage({ text: '', type: '' })} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex' }}>
              <X size={15} />
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ width: '36px', height: '36px', border: '3px solid var(--border)', borderTopColor: 'var(--accent-amber)', borderRadius: '50%', animation: 'evolvio-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            Loading your notebooks…
          </div>
        ) : (
          <>
            {/* ══ TODAY SECTION ══ */}
            <div className="glass-card" style={{
              padding: '0',
              marginBottom: '28px',
              overflow: 'hidden',
              border: '1px solid rgba(249,115,22,0.15)',
            }}>
              {/* Date header bar */}
              <div style={{
                padding: isMobile ? '12px 16px' : '14px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'linear-gradient(90deg, rgba(249,115,22,0.05), transparent)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '10px' }}>
                  <span style={{ fontSize: isMobile ? '0.9rem' : '1rem', fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatDateHeader(todayStr)}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'rgba(249,115,22,0.15)', color: 'var(--accent-amber)', padding: '2px 9px', borderRadius: '20px' }}>
                    Today
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {totalTodayCount} note{totalTodayCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Section tab bar */}
              {noteSections.length > 1 && (
                <div style={{
                  padding: isMobile ? '10px 12px' : '12px 20px',
                  display: 'flex', gap: '8px',
                  overflowX: 'auto', flexWrap: 'nowrap',
                  WebkitOverflowScrolling: 'touch',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--dn-tab-bg)',
                }}>
                  {noteSections.map(sec => {
                    const col = getSectionColor(sec, noteSections);
                    const isActive = activeSection === sec;
                    const count = todayNotes.filter(n => (n.section || 'General') === sec).length;
                    return (
                      <button
                        key={sec}
                        className="section-tab"
                        onClick={() => setActiveSection(sec)}
                        style={{
                          background: isActive ? `${col}22` : 'var(--dn-tab-inactive)',
                          color: isActive ? col : 'var(--text-muted)',
                          boxShadow: isActive ? `0 0 0 1.5px ${col}55` : 'none',
                        }}
                      >
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isActive ? col : 'var(--text-muted)', flexShrink: 0 }} />
                        {sec}
                        {count > 0 && (
                          <span style={{
                            background: isActive ? `${col}33` : 'var(--dn-badge-bg)',
                            color: isActive ? col : 'var(--text-muted)',
                            fontSize: '0.7rem', fontWeight: 700,
                            padding: '1px 6px', borderRadius: '10px',
                          }}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Notes list for active section */}
              <div style={{ padding: isMobile ? '12px 12px' : '16px 20px' }}>
                {activeSectionNotes.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <StickyNote size={28} style={{ opacity: 0.2, marginBottom: '10px', display: 'inline-block' }} />
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>No notes in <strong>{activeSection}</strong> today. Write one below!</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {activeSectionNotes.map(note => (
                      <div key={note._id} className="note-card-wrap">
                        <NoteCard
                          note={note}
                          onEdit={handleStartEdit}
                          onDelete={confirmDelete}
                          deleteConfirmId={deleteConfirmId}
                          setDeleteConfirmId={setDeleteConfirmId}
                          editingId={editingId}
                          editContent={editContent}
                          setEditContent={setEditContent}
                          editSection={editSection}
                          setEditSection={setEditSection}
                          editSaving={editSaving}
                          onSaveEdit={handleSaveEdit}
                          onCancelEdit={handleCancelEdit}
                          noteSections={noteSections}
                          sectionColor={getSectionColor(activeSection, noteSections)}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Compose box — always shows save button at bottom */}
                <div style={{
                  border: `1.5px solid ${composeContent ? 'rgba(249,115,22,0.35)' : composeFocused ? 'rgba(249,115,22,0.2)' : 'var(--border)'}`,
                  borderRadius: '12px',
                  background: composeFocused ? 'var(--dn-compose-focus)' : 'var(--dn-compose-bg)',
                  transition: 'border-color 0.2s, background 0.2s',
                }}>
                  <textarea
                    ref={textareaRef}
                    className="compose-textarea"
                    placeholder={`Write in ${activeSection}…`}
                    value={composeContent}
                    onChange={e => setComposeContent(e.target.value)}
                    onFocus={() => setComposeFocused(true)}
                    onBlur={() => { if (!composeContent) setComposeFocused(false); }}
                    onKeyDown={handleComposeKeyDown}
                    style={{
                      width: '100%',
                      minHeight: composeContent || composeFocused ? '90px' : '52px',
                      padding: isMobile ? '14px' : '12px 14px',
                      fontSize: '0.9rem', resize: 'vertical',
                      background: 'transparent', border: 'none', color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)', lineHeight: 1.6,
                      transition: 'min-height 0.2s ease',
                      boxSizing: 'border-box',
                    }}
                  />
                  {/* Always-visible footer bar */}
                  <div style={{
                    padding: isMobile ? '10px 14px' : '8px 14px',
                    borderTop: composeContent || composeFocused ? '1px solid var(--border)' : 'none',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'border-color 0.2s',
                  }}>
                    {composeContent ? (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Ctrl+Enter to save · Esc to cancel
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: 'transparent', userSelect: 'none' }}> </span>
                    )}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {composeContent && (
                        <button
                          onClick={() => { setComposeContent(''); setComposeFocused(false); }}
                          style={{
                            background: 'transparent', border: 'none', color: 'var(--text-muted)',
                            cursor: 'pointer', padding: isMobile ? '8px 12px' : '4px 10px',
                            fontSize: '0.8rem', borderRadius: '6px', fontFamily: 'var(--font-sans)',
                            display: 'flex', alignItems: 'center', gap: '4px',
                          }}
                        >
                          <X size={14} /> Cancel
                        </button>
                      )}
                      <button
                        onClick={handleAddNote}
                        disabled={!composeContent.trim() || !!savingSection}
                        style={{
                          padding: isMobile ? '10px 20px' : '6px 16px',
                          fontSize: '0.84rem', fontWeight: 700,
                          background: composeContent.trim() ? 'var(--accent-amber)' : 'var(--dn-disabled-bg)',
                          color: composeContent.trim() ? '#000' : 'var(--text-muted)',
                          border: 'none', borderRadius: '8px',
                          cursor: composeContent.trim() ? 'pointer' : 'not-allowed',
                          display: 'flex', alignItems: 'center', gap: '6px',
                          transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                          minHeight: isMobile ? '44px' : 'auto',
                        }}
                      >
                        {savingSection ? (
                          <div className="spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000' }} />
                        ) : (
                          <Send size={14} />
                        )}
                        {composeContent ? 'Save Note' : 'Add Note'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ══ PAST DAYS ══ */}
            {pastDates.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    Previous Entries
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pastDates.map(dateStr => {
                    const dateNotes = pastGrouped[dateStr] || [];
                    const isCollapsed = collapsedDates[dateStr] !== undefined ? collapsedDates[dateStr] : isMobile ? false : true;
                    const uniqueSections = Array.from(new Set(dateNotes.map(n => n.section || 'General')));

                    return (
                      <div
                        key={dateStr}
                        className="glass-card past-day-card"
                        style={{ overflow: 'hidden', padding: 0 }}
                      >
                        {/* Clickable header */}
                        <button
                          onClick={() => toggleDateCollapse(dateStr)}
                          style={{
                            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: isMobile ? '14px 16px' : '14px 20px', background: 'transparent', border: 'none',
                            cursor: 'pointer', color: 'var(--text-secondary)', textAlign: 'left',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: isMobile ? '0.85rem' : '0.95rem', color: 'var(--text-secondary)' }}>
                              {formatDateHeader(dateStr)}
                            </span>
                            {/* Section summary pills */}
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              {uniqueSections.map(sec => {
                                const col = getSectionColor(sec, noteSections);
                                const cnt = dateNotes.filter(n => (n.section || 'General') === sec).length;
                                return (
                                  <span key={sec} style={{
                                    fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px',
                                    borderRadius: '10px', background: `${col}18`, color: col,
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                  }}>
                                    {sec} · {cnt}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{dateNotes.length} note{dateNotes.length !== 1 ? 's' : ''}</span>
                            {isCollapsed ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />}
                          </div>
                        </button>

                        {/* Expanded content */}
                        {!isCollapsed && (
                          <div style={{ padding: isMobile ? '4px 14px 18px' : '4px 20px 18px', borderTop: '1px solid var(--border)', animation: 'panelSlideDown 0.2s ease' }}>
                            {uniqueSections.map(sec => {
                              const secNotes = dateNotes.filter(n => (n.section || 'General') === sec);
                              const col = getSectionColor(sec, noteSections);
                              return (
                                <div key={sec} style={{ marginTop: '16px' }}>
                                  {/* Section label */}
                                  {uniqueSections.length > 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col, flexShrink: 0 }} />
                                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{sec}</span>
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {secNotes.map(note => (
                                      <div key={note._id} className="note-card-wrap">
                                        <NoteCard
                                          note={note}
                                          onEdit={handleStartEdit}
                                          onDelete={confirmDelete}
                                          deleteConfirmId={deleteConfirmId}
                                          setDeleteConfirmId={setDeleteConfirmId}
                                          editingId={editingId}
                                          editContent={editContent}
                                          setEditContent={setEditContent}
                                          editSection={editSection}
                                          setEditSection={setEditSection}
                                          editSaving={editSaving}
                                          onSaveEdit={handleSaveEdit}
                                          onCancelEdit={handleCancelEdit}
                                          noteSections={noteSections}
                                          sectionColor={col}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state — no notes at all */}
            {allNotes.length === 0 && !loading && (
              <div className="glass-card" style={{ padding: isMobile ? '40px 16px' : '60px 20px', textAlign: 'center', color: 'var(--text-muted)', marginTop: '8px' }}>
                <BookOpen size={isMobile ? 32 : 42} style={{ opacity: 0.18, marginBottom: '16px', display: 'inline-block' }} />
                <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: isMobile ? '0.95rem' : '1.05rem', color: 'var(--text-secondary)' }}>Your notebook is empty</p>
                <p style={{ margin: 0, fontSize: '0.88rem' }}>Start writing your first note above!</p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
