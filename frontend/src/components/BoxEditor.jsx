import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, HelpCircle, AlertTriangle, FileText, GripVertical } from 'lucide-react';

const C = { gold: '#eab308', red: '#dc2626', green: '#10b981', purple: '#8b5cf6' };

const BOX_TYPES = [
  { type: 'info', icon: HelpCircle, label: 'Info Box', color: C.green, desc: 'Key takeaways & tips' },
  { type: 'warning', icon: AlertTriangle, label: 'Warning Box', color: C.red, desc: 'Mistakes & watch-outs' },
  { type: 'quote', icon: FileText, label: 'Quote Box', color: C.purple, desc: 'Memorable quotes' },
];

const BOX_STYLES = {
  info: { bg: 'rgba(16, 185, 129, 0.06)', border: 'rgba(16, 185, 129, 0.25)', color: C.green, icon: HelpCircle, label: 'Info Box', placeholder: 'Add key takeaways, definitions, or helpful tips...' },
  warning: { bg: 'rgba(220, 38, 38, 0.06)', border: 'rgba(220, 38, 38, 0.25)', color: C.red, icon: AlertTriangle, label: 'Warning Box', placeholder: 'Common mistakes, things to watch out for, or tricky grammar...' },
  quote: { bg: 'rgba(139, 92, 246, 0.06)', border: 'rgba(139, 92, 246, 0.25)', color: C.purple, icon: FileText, label: 'Quote Box', placeholder: 'A memorable quote, phrase, or sentence...' },
};

export default function BoxEditor({ boxes = [], onChange }) {
  const [showMenu, setShowMenu] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const addBox = (type) => {
    const newBox = { id: `box-${Date.now()}`, type, content: '', author: '' };
    const updated = [...boxes, newBox];
    onChange(updated);
    setShowMenu(false);
    setSelectedId(newBox.id);
  };

  const updateBox = (id, updates) => {
    const updated = boxes.map(b => b.id === id ? { ...b, ...updates } : b);
    onChange(updated);
  };

  const deleteBox = (id) => {
    const updated = boxes.filter(b => b.id !== id);
    onChange(updated);
    setSelectedId(null);
    setConfirmDeleteId(null);
  };

  const onDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e, id) => {
    e.preventDefault();
    if (!draggedId || draggedId === id) return;
    const fromIdx = boxes.findIndex(b => b.id === draggedId);
    const toIdx = boxes.findIndex(b => b.id === id);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...boxes];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onChange(reordered);
  };

  const onDragEnd = () => {
    setDraggedId(null);
  };

  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: boxes.length > 0 ? '0.65rem' : 0 }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowMenu(p => !p)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0.45rem 0.85rem', borderRadius: '8px',
            background: showMenu ? `${C.gold}20` : 'var(--bg-card)',
            border: `1px solid ${showMenu ? C.gold + '60' : 'var(--border)'}`,
            color: showMenu ? C.gold : 'var(--text-primary)',
            cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
            transition: 'all 0.2s ease',
          }}>
            <Plus size={14} /> Add Box
            <ChevronDown size={13} style={{ transform: showMenu ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </button>
          {showMenu && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 20,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '0.35rem', minWidth: 180,
              boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
            }}>
              {BOX_TYPES.map(opt => (
                <button key={opt.type} onClick={() => addBox(opt.type)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '0.55rem 0.75rem', borderRadius: '8px', border: 'none',
                  background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = `${opt.color}12`}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 30, height: 30, borderRadius: '8px', background: `${opt.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <opt.icon size={15} style={{ color: opt.color }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {boxes.map((box) => {
        const s = BOX_STYLES[box.type];
        if (!s) return null;
        const isSelected = selectedId === box.id;
        return (
          <div key={box.id}
            draggable
            onDragStart={e => onDragStart(e, box.id)}
            onDragOver={e => onDragOver(e, box.id)}
            onDragEnd={onDragEnd}
            onClick={() => { setSelectedId(isSelected ? null : box.id); setConfirmDeleteId(null); }}
            style={{
              marginBottom: '0.65rem', borderRadius: '10px',
              background: s.bg,
              border: `1px solid ${isSelected ? s.color : s.border}`,
              padding: '0.65rem 0.85rem',
              cursor: 'pointer', transition: 'all 0.2s ease',
              opacity: draggedId === box.id ? 0.5 : 1,
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <GripVertical size={14} style={{ color: 'var(--text-muted)', cursor: 'grab', opacity: 0.5 }} />
                <s.icon size={14} style={{ color: s.color }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: s.color }}>{s.label}</span>
              </div>
              {isSelected && (
                confirmDeleteId === box.id ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: '0.72rem', color: C.red, fontWeight: 600 }}>Delete?</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteBox(box.id); }} style={{
                      padding: '2px 7px', borderRadius: '5px', border: 'none',
                      background: C.red, color: '#fff', cursor: 'pointer',
                      fontSize: '0.7rem', fontWeight: 600,
                    }}>Yes</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }} style={{
                      padding: '2px 7px', borderRadius: '5px',
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--text-muted)', cursor: 'pointer',
                      fontSize: '0.7rem', fontWeight: 600,
                    }}>No</button>
                  </span>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(box.id); }} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: '6px', border: 'none',
                    background: `${C.red}20`, color: C.red, cursor: 'pointer',
                    fontSize: '0.72rem', fontWeight: 600,
                  }}>
                    <Trash2 size={12} /> Delete
                  </button>
                )
              )}
            </div>
            <textarea value={box.content} onChange={e => updateBox(box.id, { content: e.target.value })}
              placeholder={s.placeholder}
              rows={3} onClick={e => e.stopPropagation()}
              style={{
                width: '100%', resize: 'vertical', minHeight: 60,
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: '0.88rem',
                fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />
            {box.type === 'quote' && (
              <input value={box.author || ''} onChange={e => updateBox(box.id, { author: e.target.value })}
                placeholder="Author name (required for quotes)"
                onClick={e => e.stopPropagation()}
                style={{
                  width: '100%', marginTop: 6, padding: '0.35rem 0.6rem',
                  background: 'transparent', border: `1px solid ${s.border}`,
                  borderRadius: '8px', color: 'var(--text-primary)',
                  fontSize: '0.82rem', outline: 'none',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
