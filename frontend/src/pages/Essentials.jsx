import { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Trash2, ShieldCheck, Loader } from 'lucide-react';
import { useHabits } from '../Store';

// Preset emoji icons for hygiene items
const PRESET_ICONS = [
  '🧴', '🪥', '🦷', '🪒', '🧼', '🧽', '🫧', '🧻', '🤧', '🪮',
  '💊', '🩹', '🧹', '🧺', '🪣', '🫙', '💉', '🩺', '✨', '💨',
  '🧖', '💆', '🛁', '🚿', '🪑', '🪟', '🌿', '✂️'
];

// Status configuration
const STATUS_CONFIG = {
  A:  { label: 'Available',      next: 'BS', color: 'var(--accent-emerald)', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.4)',  emoji: '✅' },
  BS: { label: 'Buy Soon',       next: 'NA', color: 'var(--accent-amber)',   bg: 'rgba(245,166,35,0.12)',  border: 'rgba(245,166,35,0.4)',  emoji: '🛒' },
  NA: { label: 'Not Available',  next: 'A',  color: 'var(--accent-rose)',    bg: 'rgba(244,63,94,0.12)',   border: 'rgba(244,63,94,0.4)',   emoji: '❌' }
};

const FILTERS = ['All', 'Available', 'Buy Soon', 'Not Available'];
const FILTER_MAP = { 'All': null, 'Available': 'A', 'Buy Soon': 'BS', 'Not Available': 'NA' };

export default function Essentials() {
  const { essentials, addEssential, updateEssential, deleteEssential, essentialsLoading } = useHabits();

  // Add-item form state
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('🧴');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const iconBtnRef = useRef(null);
  const [adding, setAdding] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingIconId, setEditingIconId] = useState(null);
  const [formError, setFormError] = useState('');

  // Close picker on outside click
  useEffect(() => {
    if (!showIconPicker && !editingIconId) return;
    const handler = (e) => {
      if (iconBtnRef.current && !iconBtnRef.current.contains(e.target)) {
        setShowIconPicker(false);
        setEditingIconId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showIconPicker, editingIconId]);

  // Filtered items
  const filtered = useMemo(() => {
    const statusKey = FILTER_MAP[activeFilter];
    if (!statusKey) return essentials;
    return essentials.filter(item => item.status === statusKey);
  }, [essentials, activeFilter]);

  // Stats
  const stats = useMemo(() => ({
    total:  essentials.length,
    avail:  essentials.filter(i => i.status === 'A').length,
    soon:   essentials.filter(i => i.status === 'BS').length,
    out:    essentials.filter(i => i.status === 'NA').length,
  }), [essentials]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    const name = newName.trim();
    if (!name) { setFormError('Item name is required'); return; }
    if (essentials.some(i => i.name.toLowerCase() === name.toLowerCase())) {
      setFormError('An item with this name already exists');
      return;
    }
    setAdding(true);
    try {
      await addEssential(name, newIcon);
      setNewName('');
      setNewIcon('🧴');
    } catch (err) {
      setFormError(err.message || 'Failed to add item');
    } finally {
      setAdding(false);
    }
  };

  const handleStatusCycle = async (item) => {
    setUpdatingId(item._id);
    try {
      const nextStatus = STATUS_CONFIG[item.status].next;
      await updateEssential(item._id, { status: nextStatus });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleIconChange = async (id, icon) => {
    setEditingIconId(null);
    try {
      await updateEssential(id, { icon });
    } catch (err) {
      console.error('Failed to change icon:', err);
    }
  };

  const handleDelete = async (id) => {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await deleteEssential(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="essentials-page">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="essentials-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="essentials-icon-badge">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Essentials</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Track your personal hygiene products
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="essentials-stats-row">
          <div className="essentials-stat">
            <span className="essentials-stat-num" style={{ color: 'var(--text-primary)' }}>{stats.total}</span>
            <span className="essentials-stat-label">Total</span>
          </div>
          <div className="essentials-stat">
            <span className="essentials-stat-num" style={{ color: 'var(--accent-emerald)' }}>{stats.avail}</span>
            <span className="essentials-stat-label">Available</span>
          </div>
          <div className="essentials-stat">
            <span className="essentials-stat-num" style={{ color: 'var(--accent-amber)' }}>{stats.soon}</span>
            <span className="essentials-stat-label">Buy Soon</span>
          </div>
          <div className="essentials-stat">
            <span className="essentials-stat-num" style={{ color: 'var(--accent-rose)' }}>{stats.out}</span>
            <span className="essentials-stat-label">Out of Stock</span>
          </div>
        </div>
      </div>

      {/* ── Add Item Form ────────────────────────────────────── */}
      <div className="glass-card essentials-add-card">
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700 }}>
          <Plus size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Add New Item
        </h3>
        <form onSubmit={handleAdd} className="essentials-add-form">
          {/* Icon Picker */}
          <div style={{ position: 'relative' }} ref={iconBtnRef}>
            <button
              type="button"
              className="essentials-icon-btn"
              onClick={() => {
                if (!showIconPicker && iconBtnRef.current) {
                  const rect = iconBtnRef.current.getBoundingClientRect();
                  setPickerPos({
                    top: rect.bottom + 8,
                    left: rect.left,
                  });
                }
                setShowIconPicker(p => !p);
              }}
              title="Choose icon"
            >
              <span style={{ fontSize: '1.5rem' }}>{newIcon}</span>
            </button>
            {showIconPicker && (
              <div
                className="essentials-icon-picker"
                style={{ top: pickerPos.top, left: pickerPos.left }}
              >
                {PRESET_ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    className={`essentials-icon-option ${newIcon === icon ? 'selected' : ''}`}
                    onClick={() => { setNewIcon(icon); setShowIconPicker(false); }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Name Input */}
          <input
            id="essentials-new-item-name"
            type="text"
            placeholder="Item name (e.g. Shampoo, Toothpaste…)"
            value={newName}
            onChange={e => { setNewName(e.target.value); setFormError(''); }}
            className="essentials-name-input"
            maxLength={60}
          />

          <button
            type="submit"
            className="btn essentials-add-btn"
            disabled={adding || !newName.trim()}
            style={{ background: 'linear-gradient(135deg, var(--accent-emerald), #059669)', color: '#fff', border: 'none' }}
          >
            {adding ? <span className="spinner" /> : <Plus size={16} />}
            {adding ? 'Adding…' : 'Add Item'}
          </button>
        </form>
        {formError && (
          <p style={{ color: 'var(--accent-rose)', fontSize: '0.82rem', margin: '0.5rem 0 0 0' }}>
            {formError}
          </p>
        )}
      </div>

      {/* ── Filter Tabs ──────────────────────────────────────── */}
      <div className="essentials-filter-tabs">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`essentials-filter-tab ${activeFilter === f ? 'active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f}
            {FILTER_MAP[f] && (
              <span className="essentials-filter-count">
                {essentials.filter(i => i.status === FILTER_MAP[f]).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Item Grid ────────────────────────────────────────── */}
      {essentialsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader size={32} style={{ animation: 'evolvia-spin 1s linear infinite', color: 'var(--text-muted)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="essentials-empty">
          <div className="essentials-empty-icon">
            {activeFilter === 'All' ? '🧴' : STATUS_CONFIG[FILTER_MAP[activeFilter]]?.emoji}
          </div>
          <h3>
            {activeFilter === 'All'
              ? 'No items yet'
              : `No "${activeFilter}" items`}
          </h3>
          <p>
            {activeFilter === 'All'
              ? 'Add your first hygiene item using the form above.'
              : 'All items in this category look good!'}
          </p>
        </div>
      ) : (
        <div className="essentials-grid">
          {filtered.map(item => {
            const cfg = STATUS_CONFIG[item.status];
            const isUpdating = updatingId === item._id;
            const isDeleting = deletingId === item._id;
            return (
              <div
                key={item._id}
                className={`essential-card glass-card ${item.status === 'NA' ? 'essential-card-urgent' : ''}`}
                style={{ borderColor: cfg.border }}
              >
                {/* Icon (Clickable to change) */}
                <div style={{ position: 'relative' }}>
                  <button
                    className="essential-card-icon"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPickerPos({ top: rect.bottom + 8, left: rect.left });
                      setEditingIconId(item._id);
                    }}
                    title="Change icon"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {item.icon || '🧴'}
                  </button>
                  {editingIconId === item._id && (
                    <div
                      className="essentials-icon-picker"
                      style={{ 
                        position: 'fixed', 
                        top: pickerPos.top, 
                        left: Math.min(pickerPos.left, window.innerWidth - 200),
                        zIndex: 1000 
                      }}
                    >
                      {PRESET_ICONS.map(icon => (
                        <button
                          key={icon}
                          type="button"
                          className={`essentials-icon-option ${item.icon === icon ? 'selected' : ''}`}
                          onClick={() => handleIconChange(item._id, icon)}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Name */}
                <h3 className="essential-card-name">{item.name}</h3>

                {/* Status toggle button */}
                <button
                  className="essential-status-btn"
                  style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                  onClick={() => handleStatusCycle(item)}
                  disabled={isUpdating}
                  title="Click to change status"
                >
                  {isUpdating ? (
                    <span className="spinner" style={{ borderTopColor: cfg.color, borderColor: `${cfg.color}33` }} />
                  ) : (
                    <>
                      <span>{cfg.emoji}</span>
                      <span>{cfg.label}</span>
                      <span className="essential-status-hint">→ {STATUS_CONFIG[cfg.next].label}</span>
                    </>
                  )}
                </button>

                {/* Urgent pulse for NA */}
                {item.status === 'NA' && (
                  <div className="essential-urgent-ring" />
                )}

                {/* Delete button — first click asks for confirmation */}
                {confirmDeleteId === item._id ? (
                  <div className="essential-confirm-overlay">
                    <span className="essential-confirm-text">Delete this item?</span>
                    <div className="essential-confirm-actions">
                      <button
                        className="essential-confirm-cancel"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="essential-confirm-delete"
                        onClick={() => handleDelete(item._id)}
                        disabled={isDeleting}
                      >
                        {isDeleting
                          ? <span className="spinner" style={{ width: '10px', height: '10px', borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
                          : 'Delete'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="essential-delete-btn"
                    onClick={() => setConfirmDeleteId(item._id)}
                    disabled={isDeleting}
                    title="Delete item"
                  >
                    {isDeleting
                      ? <span className="spinner" style={{ width: '12px', height: '12px' }} />
                      : <Trash2 size={13} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Status Legend ─────────────────────────────────────── */}
      <div className="essentials-legend glass-card">
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '1rem' }}>
          Status guide:
        </span>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="legend-item">
            <span className="legend-dot" style={{ background: cfg.color }} />
            <span style={{ fontWeight: 700, color: cfg.color, fontSize: '0.75rem' }}>{key}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> — {cfg.label}</span>
          </div>
        ))}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          💡 Click a status badge to cycle forward
        </span>
      </div>
    </div>
  );
}
