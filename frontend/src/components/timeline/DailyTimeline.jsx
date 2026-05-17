import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ChevronDown, Plus, ZoomIn, ZoomOut, GripVertical } from 'lucide-react';
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
  { key: 'morning',   label: 'Morning',   icon: '🌅', start: 5,  end: 11 },
  { key: 'afternoon', label: 'Afternoon', icon: '☀️', start: 12, end: 17 },
  { key: 'evening',   label: 'Evening',   icon: '🌙', start: 18, end: 23 },
  { key: 'overnight', label: 'Night',     icon: '⭐', start: 0,  end: 4  },
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

// Default: overnight closed, others open
const DEFAULT_COLLAPSE = { morning: true, afternoon: true, evening: true, overnight: false };

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
function TimeSection({ section, tasks, clustered, zoomFactor, hourHeight, isFutureDate, isToday, onUpdateStatus, onEditTask, onDragTime, onAddClick, openState, onToggle }) {
  const open = openState;

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
        className="tl-section-header"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onToggle()}
        aria-expanded={open}
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
                onUpdateStatus={s => onUpdateStatus(task.id, s)}
                onEdit={() => onEditTask && onEditTask(task)}
                onDragTime={t => onDragTime(task.id, t)}
                sectionOffsetMins={section.start * 60}
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
export default function DailyTimeline({ date, tasks, onUpdateTask, onEditTask, onAddClick, isFutureDate, filters = {} }) {
  const { timelinePrefs } = useHabits();
  const initialZoom = granularityToZoom(timelinePrefs.intervalGranularity);
  const [zoom, setZoom] = useState(initialZoom);
  const timelineRef = useRef(null);
  const isMobile = useIsMobile();

  // #8 — Persist section collapse state
  const [sectionOpen, setSectionOpen] = useState(() => loadCollapseState() ?? DEFAULT_COLLAPSE);

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

  return (
    <div style={{ marginTop: 12 }}>
      {/* Toolbar row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <h3 style={{
          margin: 0,
          fontSize: isMobile ? '0.9rem' : '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: 1,
          minWidth: 0,
        }}>
          <span aria-hidden="true">📅</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>
            {format(new Date(date + 'T12:00:00'), isMobile ? 'EEE, MMM d' : 'EEEE, MMMM d')}
          </span>
        </h3>

        {/* Zoom controls */}
        {isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              className="zoom-pill"
              style={{ padding: '5px 10px', minHeight: 32 }}
              onClick={() => setZoom(z => Math.max(0, z - 1))}
              disabled={zoom === 0}
              aria-label="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, minWidth: 30, textAlign: 'center' }}>
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
        {TIME_SECTIONS.map(section => (
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
          />
        ))}
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
