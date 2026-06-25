import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ChevronDown, Plus, ZoomIn, ZoomOut, GripVertical } from 'lucide-react';
import './DailyTimeline.css';
import TaskCard from './TaskCard';
import { useHabits } from '../../Store';

// ── Mobile detection hook ─────────────────────────────────────────────────────
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ZOOM_OPTIONS = [
  { label: '60m', factor: 1,   granularity: 60 },
  { label: '30m', factor: 1.5, granularity: 30 },
  { label: '15m', factor: 2,   granularity: 15 },
];

const granularityToZoom = (g) => {
  if (g <= 15) return 2;
  if (g <= 30) return 1;
  return 0;
};

const BASE_HOUR_DESKTOP = 90;
const BASE_HOUR_MOBILE  = 68;

const TIME_SECTIONS = [
  { key: 'morning',   label: 'Morning',   icon: '🌅', start: 5,  end: 11, defaultColor: '#f59e0b' },
  { key: 'afternoon', label: 'Afternoon', icon: '☀️', start: 12, end: 17, defaultColor: '#3b82f6' },
  { key: 'evening',   label: 'Evening',   icon: '🌙', start: 18, end: 23, defaultColor: '#8b5cf6' },
  { key: 'overnight', label: 'Night',     icon: '⭐', start: 0,  end: 4,  defaultColor: '#6366f1' },
];

const getMins = (t) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };

// ── #8: Persist section collapse state ────────────────────────────────────────
const COLLAPSE_KEY = 'tl_section_collapse';

function loadCollapseState() {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCollapseState(state) {
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state)); } catch {}
}

// Default: all open, overnight auto-collapses only when empty
const DEFAULT_COLLAPSE = { morning: true, afternoon: true, evening: true, overnight: true };

// ── Layout clustering ─────────────────────────────────────────────────────────
function clusterTasks(tasks) {
  if (!tasks || tasks.length === 0) return [];

  const sorted = [...tasks].map(t => ({
    ...t,
    startMins: getMins(t.time),
    endMins:   getMins(t.time) + (parseInt(t.duration) || 30),
  })).sort((a, b) => a.startMins !== b.startMins ? a.startMins - b.startMins : b.endMins - a.endMins);

  const clusters = [];
  let cur = [], clusterEnd = 0;

  for (const task of sorted) {
    if (cur.length === 0) {
      cur.push([task]); clusterEnd = task.endMins;
    } else if (task.startMins < clusterEnd) {
      let placed = false;
      for (const col of cur) {
        if (task.startMins >= col[col.length - 1].endMins) {
          col.push(task); placed = true; break;
        }
      }
      if (!placed) cur.push([task]);
      clusterEnd = Math.max(clusterEnd, task.endMins);
    } else {
      clusters.push(cur); cur = [[task]]; clusterEnd = task.endMins;
    }
  }
  if (cur.length > 0) clusters.push(cur);

  const result = [];
  for (const cluster of clusters) {
    const numCols = cluster.length;
    cluster.forEach((col, colIndex) => col.forEach(task =>
      result.push({ ...task, layout: { colIndex, numCols } })
    ));
  }
  return result;
}

// ── Section block component ───────────────────────────────────────────────────
function TimeSection({ section, tasks, clustered, zoomFactor, hourHeight, isFutureDate, isToday, onUpdateStatus, onEditTask, onDragTime, onAddClick, openState, onToggle, draggedTaskId, dragOverSection, onSetDraggedTaskId, onSetDragOverSection, sectionColors, onSetSectionColors, onMoveToDate, bulkMode, selectedIds, onBulkSelect, handleReorder }) {
  const open = openState;
  const accentColor = sectionColors[section.key] || section.defaultColor;

  const sectionTasks = tasks.filter(t => {
    const h = parseInt((t.time || '00:00').split(':')[0]);
    return h >= section.start && h <= section.end;
  });

  // #10 — Hide Overnight section if it has no tasks
  if (section.key === 'overnight' && sectionTasks.length === 0) return null;

  const spanHours = section.end - section.start + 1;
  const heightPx  = spanHours * hourHeight;
  const hours     = Array.from({ length: spanHours + 1 }, (_, i) => section.start + i);

  const now = new Date();
  const currentHour = now.getHours();
  const isCurrentSection = isToday && currentHour >= section.start && currentHour <= section.end;

  return (
    <div style={{ marginBottom: 10 }}>
      {/* Section header */}
      <div
        className={`tl-section-header tl-section-header--${section.key}`}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onToggle()}
        aria-expanded={open}
        style={{ position:'sticky', top:0, zIndex:6, background:'var(--bg-card, #151520)', borderLeft:`3px solid ${accentColor}` }}
        onContextMenu={e => {
          e.preventDefault();
          const cycle = ['#f59e0b','#3b82f6','#8b5cf6','#10b981','#ef4444','#ec4899','#6366f1', section.defaultColor];
          const next = cycle[(cycle.indexOf(accentColor) + 1) % cycle.length];
          onSetSectionColors({ ...sectionColors, [section.key]: next });
        }}
      >
        <span className="tl-section-icon">{section.icon}</span>
        <span className="tl-section-title">{section.label}</span>
        <span className="tl-section-badge">{sectionTasks.length} task{sectionTasks.length !== 1 ? 's' : ''}</span>
        <ChevronDown size={15} className={`tl-section-chevron ${open ? 'open' : ''}`} aria-hidden="true" />
      </div>

      {/* Section body */}
      {open && (
        <div style={{ position: 'relative', height: `${heightPx}px`, overflow: 'hidden' }}>

          {/* Axis line */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `calc(var(--tl-axis-width) - 1px)`,
            width: '1px', background: 'var(--border)', zIndex: 0,
          }} />

          {/* Hour rows */}
          {hours.map((h, i) => (
            <div key={h} style={{
              position: 'absolute', top: `${i * hourHeight}px`,
              left: 0, right: 0, display: 'flex', alignItems: 'center', zIndex: 0,
            }}>
              <div style={{
                width: 'var(--tl-axis-width)', textAlign: 'right',
                fontSize: '0.68rem', color: 'var(--text-muted)',
                paddingRight: '8px', flexShrink: 0, lineHeight: 1,
              }}>
                {`${h.toString().padStart(2,'0')}:00`}
              </div>
              <div style={{ width: 8, height: 1, background: 'var(--border)', flexShrink: 0 }} />
              {/* Half-hour tick */}
              {zoomFactor >= 1.5 && (
                <div style={{
                  position: 'absolute',
                  top: `${hourHeight / 2}px`,
                  left: `calc(var(--tl-axis-width) - 4px)`,
                  width: 6, height: 1, background: 'var(--tl-tick-maj)',
                }} />
              )}
              {/* Half-hour label */}
              {zoomFactor >= 1.5 && (
                <div style={{
                  position: 'absolute',
                  top: `${hourHeight / 2}px`,
                  left: 0,
                  width: 'calc(var(--tl-axis-width) - 8px)',
                  textAlign: 'right',
                  fontSize: '0.6rem',
                  color: 'var(--tl-tick-maj)',
                  lineHeight: 1,
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}>
                  :{String(30).padStart(2,'0')}
                </div>
              )}
              {/* 15min ticks */}
              {zoomFactor >= 2 && [1, 2, 3].map(q => (
                <div key={q} style={{
                  position: 'absolute',
                  top: `${(hourHeight / 4) * q}px`,
                  left: `calc(var(--tl-axis-width) - 3px)`,
                  width: 4, height: 1, background: 'var(--tl-tick-min)',
                }} />
              ))}
              <div style={{ flex: 1, height: '1px', background: 'var(--tl-divider)' }} />
            </div>
          ))}

          {/* Drop zone overlay when dragging across sections */}
          {draggedTaskId && section.key !== dragOverSection && (
            <div
              onMouseEnter={() => onSetDragOverSection(section.key)}
              onTouchStart={() => onSetDragOverSection(section.key)}
              onClick={() => {
                const task = tasks.find(t => t.id === draggedTaskId);
                if (task) {
                  const dropTime = `${section.start.toString().padStart(2,'0')}:00`;
                  onDragTime(draggedTaskId, dropTime);
                }
                onSetDraggedTaskId(null);
                onSetDragOverSection(null);
              }}
              style={{
                position: 'absolute', inset: 0, zIndex: 10,
                border: '2px dashed rgba(99,102,241,0.3)',
                borderRadius: 12,
                background: 'rgba(99,102,241,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                opacity: draggedTaskId && !dragOverSection ? 1 : 0.5,
              }}
            >
              <span style={{ color: 'var(--accent-blue)', fontSize: '0.78rem', fontWeight: 700, background: 'var(--bg-card)', padding: '6px 14px', borderRadius: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                Drop to {section.label} at {section.start.toString().padStart(2,'0')}:00
              </span>
            </div>
          )}

          {/* Tasks in this section */}
          {clustered.filter(t => {
            const h = parseInt((t.time || '00:00').split(':')[0]);
            return h >= section.start && h <= section.end;
          }).map((task, i) => {
            const [th, tm] = (task.time || '00:00').split(':').map(Number);
            const offsetMins = (th * 60 + tm) - (section.start * 60);
            const relativeTop = offsetMins * (hourHeight / 60);
            return (
              <TaskCard
                key={task.id || i}
                task={{ ...task, _relativeTop: relativeTop }}
                isFutureDate={isFutureDate}
                zoomFactor={zoomFactor}
                hourHeight={hourHeight}
                onUpdateStatus={s => onUpdateStatus(task.id, s)}
                onEdit={() => onEditTask && onEditTask(task)}
                onDragTime={t => onDragTime(task.id, t)}
                sectionOffsetMins={section.start * 60}
                bulkMode={bulkMode}
                isSelected={selectedIds?.has(task.id)}
                onBulkSelect={() => onBulkSelect?.(task.id)}
                onDragStart={() => { onSetDraggedTaskId?.(task.id); onSetDragOverSection?.(section.key); }}
                onDragEnd={() => { onSetDraggedTaskId?.(null); onSetDragOverSection?.(null); }}
                onReorder={handleReorder}
                onMoveToDate={onMoveToDate}
                blocked={task.dependsOn?.length > 0 && task.dependsOn.some(depId => {
                  const dep = tasks.find(t => t.id === depId);
                  return dep && dep.status !== 'Completed';
                })}
              />
            );
          })}

          {/* Empty section prompt */}
          {sectionTasks.length === 0 && (
            <button
              className="tl-empty-section"
              onClick={() => onAddClick?.(section.start)}
              style={{
                position: 'absolute',
                top: 12,
                left: 'calc(var(--tl-axis-width) + 10px)',
                right: 8,
              }}
              aria-label={`Add task to ${section.label}`}
            >
              <Plus size={13} aria-hidden="true" />
              Plan something for this time…
            </button>
          )}

          {/* Current time indicator */}
          {isCurrentSection && (
            <CurrentTimeIndicator hourHeight={hourHeight} sectionStart={section.start} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DailyTimeline({ date, tasks, onUpdateTask, onEditTask, onAddClick, isFutureDate, onSelectDate, filters = {}, bulkMode, selectedIds, onBulkSelect, onMoveToDate }) {
  const { timelinePrefs } = useHabits();
  const initialZoom = granularityToZoom(timelinePrefs.intervalGranularity);
  const [zoom, setZoom] = useState(initialZoom);
  const timelineRef = useRef(null);
  const isMobile = useIsMobile();
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverSection, setDragOverSection] = useState(null);

  // #8 — Persist section collapse state
  const [sectionOpen, setSectionOpen] = useState(() => loadCollapseState() ?? DEFAULT_COLLAPSE);
  const allCollapsed = Object.values(sectionOpen).every(v => !v);

  // #52 — Per-section color overrides
  const [sectionColors, setSectionColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tl_section_colors') || '{}'); } catch { return {}; }
  });
  const saveSectionColors = (colors) => {
    setSectionColors(colors);
    try { localStorage.setItem('tl_section_colors', JSON.stringify(colors)); } catch {}
  };

  const toggleSection = useCallback((key) => {
    setSectionOpen(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveCollapseState(next);
      return next;
    });
  }, []);

  // Sync zoom if preference changes externally
  useEffect(() => {
    setZoom(granularityToZoom(timelinePrefs.intervalGranularity));
  }, [timelinePrefs.intervalGranularity]);

  const zoomFactor = ZOOM_OPTIONS[zoom].factor;
  const baseHour   = isMobile ? BASE_HOUR_MOBILE : BASE_HOUR_DESKTOP;
  const hourHeight = baseHour * zoomFactor;

  // Apply filters (including #11 search)
  const filteredTasks = useMemo(() => {
    let t = tasks || [];
    if (filters.status   && filters.status   !== 'all') t = t.filter(x => x.status   === filters.status);
    if (filters.priority && filters.priority !== 'all') t = t.filter(x => x.priority === filters.priority);
    if (filters.category && filters.category !== 'all') t = t.filter(x => x.category === filters.category);
    if (filters.search   && filters.search.trim())      t = t.filter(x => x.title?.toLowerCase().includes(filters.search.toLowerCase()));
    return t;
  }, [tasks, filters]);

  const clustered = useMemo(() => clusterTasks(filteredTasks), [filteredTasks]);

  const handleUpdateStatus = (taskId, newStatus) => {
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx < 0) return;
    const updated = [...tasks];
    updated[idx] = { ...updated[idx], status: newStatus };
    onUpdateTask(updated);
  };

  const handleDragTime = (taskId, newTime) => {
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx < 0) return;
    const updated = [...tasks];
    updated[idx] = { ...updated[idx], time: newTime };
    onUpdateTask(updated);
  };

  // #25 — Reorder tasks (drag within same time slot)
  const handleReorder = useCallback((taskId, direction) => {
    const sameTime = tasks.filter(t => t.time === tasks.find(x => x.id === taskId)?.time);
    if (sameTime.length < 2) return;
    sameTime.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const idx = sameTime.findIndex(t => t.id === taskId);
    if (idx < 0 || (direction === -1 && idx === 0) || (direction === 1 && idx === sameTime.length - 1)) return;
    const swap = sameTime[idx + direction];
    const updated = tasks.map(t => {
      if (t.id === taskId) return { ...t, sortOrder: swap.sortOrder ?? 0 };
      if (t.id === swap.id) return { ...swap, sortOrder: t.sortOrder ?? 0 };
      return t;
    });
    onUpdateTask(updated);
  }, [tasks, onUpdateTask]);

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (!timelineRef.current || isFutureDate || date !== format(new Date(), 'yyyy-MM-dd')) return;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const targetPx = mins * (hourHeight / 60) - 150;
    setTimeout(() => {
      try {
        timelineRef.current?.closest('.main-content')?.scrollTo({ top: targetPx, behavior: 'smooth' });
      } catch {}
    }, 400);
  }, [date, isFutureDate, hourHeight]);

  // #9 — Drag affordance hint (shown once, then dismissed)
  const [showDragHint, setShowDragHint] = useState(() => {
    try { return !localStorage.getItem('tl_drag_hint_seen'); } catch { return true; }
  });

  const dismissDragHint = () => {
    try { localStorage.setItem('tl_drag_hint_seen', '1'); } catch {}
    setShowDragHint(false);
  };

  const hasTasks = tasks.length > 0;

  // #50 — Quick-add state & handler
  const [quickAddText, setQuickAddText] = useState('');
  const quickInputRef = useRef(null);
  const handleQuickAdd = useCallback(() => {
    const raw = quickAddText.trim();
    if (!raw) return;
    let text = raw;
    let time = null, priority = 'medium', tags = [], notes = '';

    // Parse time: @HH:MM or at 2pm / at 14:30
    const timeMatch = text.match(/@(\d{1,2})(?::(\d{2}))?\s*$/i) || text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(pm|am)?\s*$/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1]);
      const m = parseInt(timeMatch[2]) || 0;
      if (timeMatch[3]?.toLowerCase() === 'pm' && h < 12) h += 12;
      if (timeMatch[3]?.toLowerCase() === 'am' && h === 12) h = 0;
      time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      text = text.replace(timeMatch[0], '').trim();
    }

    // Parse priority: !high, !low, !critical, !medium
    const prioMatch = text.match(/!(high|low|medium|critical)\b/i);
    if (prioMatch) { priority = prioMatch[1].toLowerCase(); text = text.replace(prioMatch[0], '').trim(); }

    // Parse tags: #tag
    const tagMatches = text.match(/#(\w[\w-]*)/g);
    if (tagMatches) { tags = tagMatches.map(t => t.slice(1).toLowerCase()); text = text.replace(/#\w[\w-]*/g, '').trim(); }

    // Parse notes after period or |
    const noteSep = text.match(/[.·|]\s*(.+)/);
    if (noteSep) { notes = noteSep[1].trim(); text = text.replace(noteSep[0], '').trim(); }

    // Create task directly
    const newTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      title: text || 'Untitled',
      time: time || format(new Date(), 'HH:mm'),
      status: 'Pending',
      priority,
      category: 'Other',
      duration: 30,
      tags: tags.length > 0 ? tags : undefined,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };
    onUpdateTask([...(tasks || []), newTask]);
    setQuickAddText('');
    quickInputRef.current?.focus();
  }, [quickAddText, onUpdateTask, tasks]);

  return (
    <div style={{ marginTop: 12 }}>
      {/* Toolbar row */}
      <div className="tl-toolbar-row" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        flexWrap: 'wrap',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
      }}>
        <h3 className="tl-date-heading" style={{
          margin: 0,
          fontSize: isMobile ? '0.88rem' : '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: 1,
          minWidth: 0,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '-0.01em',
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.25)',
            fontSize: '0.9rem',
            flexShrink: 0,
            cursor: onSelectDate ? 'pointer' : 'default',
          }} 
          onClick={onSelectDate ? () => {
            const el = document.getElementById('tl-native-date-picker');
            if (el) {
              try { el.showPicker(); } catch (_) { el.click(); }
            }
          } : undefined}
          title={onSelectDate ? "Choose a specific day" : undefined}
          aria-hidden="true">📅</span>
          <span 
            style={{ 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: isMobile ? 'normal' : 'nowrap', 
              color: 'var(--text-primary)', 
              fontWeight: 700,
              cursor: onSelectDate ? 'pointer' : 'default',
              position: 'relative'
            }}
            onClick={onSelectDate ? () => {
              const el = document.getElementById('tl-native-date-picker');
              if (el) {
                try { el.showPicker(); } catch (_) { el.click(); }
              }
            } : undefined}
            title={onSelectDate ? "Choose a specific day" : undefined}
          >
            {format(new Date(date + 'T12:00:00'), isMobile ? 'EEE, MMM d' : 'EEEE, MMMM d')}
            {/* #54 — Progress ring */}
            {(() => {
              const total = tasks.filter(t => !t.isVirtual).length;
              const done  = tasks.filter(t => t.status === 'Completed').length;
              const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
              const r = 9, circ = 2 * Math.PI * r;
              return total > 0 ? (
                <svg width={24} height={24} viewBox="0 0 24 24" style={{ flexShrink:0 }} aria-label={`${pct}% completed`}>
                  <circle cx={12} cy={12} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
                  <circle cx={12} cy={12} r={r} fill="none" stroke="var(--accent-blue)" strokeWidth={3}
                    strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
                    transform="rotate(-90 12 12)" strokeLinecap="round" />
                  <text x={12} y={12.5} textAnchor="middle" fill="var(--text-muted)" fontSize="6.5" fontWeight={700}>{pct}</text>
                </svg>
              ) : null;
            })()}
            {onSelectDate && (
              <input
                id="tl-native-date-picker"
                type="date"
                value={date}
                onChange={(e) => {
                  if (e.target.value) {
                    onSelectDate(e.target.value);
                  }
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />
            )}
          </span>
        </h3>

        {/* Zoom controls */}
        {isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 10, border: '1px solid var(--border)', padding: '2px 4px' }}>
            <button
              className="zoom-pill"
              style={{ padding: '5px 10px', minHeight: 32 }}
              onClick={() => setZoom(z => Math.max(0, z - 1))}
              disabled={zoom === 0}
              aria-label="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 700, minWidth: 28, textAlign: 'center' }}>
              {ZOOM_OPTIONS[zoom].label}
            </span>
            <button
              className="zoom-pill"
              style={{ padding: '5px 10px', minHeight: 32 }}
              onClick={() => setZoom(z => Math.min(ZOOM_OPTIONS.length - 1, z + 1))}
              disabled={zoom === ZOOM_OPTIONS.length - 1}
              aria-label="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        ) : (
          <div className="zoom-pill-group" role="group" aria-label="Timeline zoom">
            {ZOOM_OPTIONS.map((o, i) => (
              <button
                key={o.label}
                className={`zoom-pill ${zoom === i ? 'active' : ''}`}
                onClick={() => setZoom(i)}
                aria-pressed={zoom === i}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => { const val = allCollapsed; const next = Object.fromEntries(TIME_SECTIONS.map(s => [s.key, val])); setSectionOpen(next); saveCollapseState(next); }}
          style={{ background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', color:'var(--text-muted)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontFamily:'var(--font-sans)', marginLeft:4, whiteSpace:'nowrap' }}
          title={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
        >
          {allCollapsed ? 'Expand all' : 'Collapse all'}
        </button>
      </div>

      {/* #50 — Quick-add bar */}
      <div style={{ display:'flex', gap:8, padding:'8px 0', alignItems:'center' }}>
        <input ref={quickInputRef} type="text" placeholder='Quick-add task… (e.g. "Buy groceries @14:30")'
          style={{ flex:1, background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', color:'var(--text)', fontSize:'0.78rem', fontFamily:'var(--font-sans)', outline:'none' }}
          value={quickAddText} onChange={e => setQuickAddText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); }}
        />
        <button onClick={handleQuickAdd} style={{ background:'var(--accent)', border:'none', borderRadius:8, padding:'8px 14px', color:'#fff', fontWeight:600, fontSize:'0.75rem', cursor:'pointer', fontFamily:'var(--font-sans)', whiteSpace:'nowrap' }}>Add</button>
      </div>

      {/* #9 — Drag-to-reschedule affordance hint */}
      {showDragHint && hasTasks && !isFutureDate && (
        <div className="tl-drag-hint" role="status">
          <GripVertical size={13} aria-hidden="true" />
          <span>Drag the <strong>⠿</strong> handle on any task to reschedule it</span>
          <button className="tl-drag-hint-dismiss" onClick={dismissDragHint} aria-label="Dismiss tip">✕</button>
        </div>
      )}

      {/* Timeline sections */}
      <div
        ref={timelineRef}
        style={{ position: 'relative', overflowX: 'hidden' }}
      >
        {filteredTasks.length === 0 ? (
          <div style={{ padding:'60px 20px', textAlign:'center', color:'var(--text-muted)' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:12, opacity:0.3 }}>📋</div>
            <p style={{ margin:0, fontSize:'0.85rem', fontWeight:500 }}>No tasks for this day</p>
            <p style={{ margin:'6px 0 0', fontSize:'0.72rem', opacity:0.6 }}>Tap + to add one</p>
          </div>
        ) : (
          TIME_SECTIONS.map(section => (
          <TimeSection
            key={section.key}
            section={section}
            tasks={filteredTasks}
            clustered={clustered}
            zoomFactor={zoomFactor}
            hourHeight={hourHeight}
            isFutureDate={isFutureDate}
            isToday={!isFutureDate && date === format(new Date(), 'yyyy-MM-dd')}
            onUpdateStatus={handleUpdateStatus}
            onEditTask={onEditTask}
            onDragTime={handleDragTime}
            onAddClick={onAddClick}
            openState={sectionOpen[section.key] ?? true}
            onToggle={() => toggleSection(section.key)}
            draggedTaskId={draggedTaskId}
            dragOverSection={dragOverSection}
            onSetDraggedTaskId={setDraggedTaskId}
            onSetDragOverSection={setDragOverSection}
            sectionColors={sectionColors}
            onSetSectionColors={saveSectionColors}
            onMoveToDate={onMoveToDate}
            bulkMode={bulkMode}
            selectedIds={selectedIds}
            onBulkSelect={onBulkSelect}
            handleReorder={handleReorder}
          />
        )))}
      </div>
    </div>
  );
}

// ── Current Time Indicator ────────────────────────────────────────────────────
function CurrentTimeIndicator({ hourHeight, sectionStart }) {
  const [topPx, setTopPx] = useState(0);
  const [timeLabel, setTimeLabel] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const minsSinceStart = (h * 60 + m) - (sectionStart * 60);
      setTopPx(minsSinceStart * (hourHeight / 60));
      const hh = h.toString().padStart(2, '0');
      const mm = m.toString().padStart(2, '0');
      setTimeLabel(`${hh}:${mm}`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [hourHeight, sectionStart]);

  return (
    <div className="current-time-line" style={{ top: `${topPx}px`, position: 'absolute', zIndex: 5 }}>
      <div className="current-time-label">{timeLabel}</div>
      <div className="current-time-dot" />
      <div className="current-time-dash" />
    </div>
  );
}
