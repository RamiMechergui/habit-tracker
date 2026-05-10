import React, { useMemo, useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import TaskCard from './TaskCard';

// ── Constants ─────────────────────────────────────────────────────────────────
const ZOOM_OPTIONS = [
  { label: '60m', factor: 1   },
  { label: '30m', factor: 1.5 },
  { label: '15m', factor: 2   },
];

const TIME_SECTIONS = [
  { key: 'morning',   label: 'Morning',   icon: '🌅', start: 5,  end: 11 },
  { key: 'afternoon', label: 'Afternoon', icon: '☀️', start: 12, end: 17 },
  { key: 'evening',   label: 'Evening',   icon: '🌙', start: 18, end: 23 },
  { key: 'overnight', label: 'Night',     icon: '⭐', start: 0,  end: 4  },
];

const getMins = (t) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };

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
function TimeSection({ section, tasks, clustered, zoomFactor, hourHeight, isFutureDate, isToday, onUpdateStatus, onEditTask, onDragTime, onAddTask }) {
  const [open, setOpen] = useState(section.key !== 'overnight');

  const sectionTasks = tasks.filter(t => {
    const h = parseInt((t.time || '00:00').split(':')[0]);
    return h >= section.start && h <= section.end;
  });

  const startPx  = section.start * hourHeight;
  const spanHours = section.end - section.start + 1;
  const heightPx  = spanHours * hourHeight;

  const hours = Array.from({ length: spanHours + 1 }, (_, i) => section.start + i);

  const now = new Date();
  const currentHour = now.getHours();
  const isCurrentSection = isToday && currentHour >= section.start && currentHour <= section.end;

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Section header */}
      <div className="tl-section-header" onClick={() => setOpen(o => !o)}>
        <span className="tl-section-icon">{section.icon}</span>
        <span className="tl-section-title">{section.label}</span>
        <span className="tl-section-badge">{sectionTasks.length} task{sectionTasks.length !== 1 ? 's' : ''}</span>
        <ChevronDown size={15} className={`tl-section-chevron ${open ? 'open' : ''}`} />
      </div>

      {/* Section body */}
      {open && (
        <div style={{ position: 'relative', height: `${heightPx}px`, marginLeft: 0 }}>

          {/* Axis line */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `calc(var(--tl-axis-width) - 1px)`,
            width: '1px', background: 'var(--border)', zIndex: 0
          }} />

          {/* Hour rows */}
          {hours.map((h, i) => (
            <div key={h} style={{
              position: 'absolute', top: `${i * hourHeight}px`,
              left: 0, right: 0, display: 'flex', alignItems: 'center', zIndex: 0
            }}>
              <div style={{
                width: 'var(--tl-axis-width)', textAlign: 'right',
                fontSize: '0.72rem', color: 'var(--text-muted)',
                paddingRight: '10px', flexShrink: 0,
              }}>
                {`${h.toString().padStart(2,'0')}:00`}
              </div>
              <div style={{ width: 10, height: 1, background: 'var(--border)' }} />
              {/* Half-hour tick if zoom allows */}
              {zoomFactor >= 1.5 && (
                <div style={{
                  position: 'absolute',
                  top: `${hourHeight / 2}px`,
                  left: `calc(var(--tl-axis-width) - 4px)`,
                  width: 6, height: 1, background: 'var(--tl-tick-maj)',
                }} />
              )}
              {/* 15min ticks */}
              {zoomFactor >= 2 && [1,2,3].map(q => (
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

          {/* Tasks in this section (positioned relative to section top) */}
          {clustered.filter(t => {
            const h = parseInt((t.time || '00:00').split(':')[0]);
            return h >= section.start && h <= section.end;
          }).map((task, i) => {
            // Re-offset top relative to section start
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
          {sectionTasks.length === 0 && !isFutureDate && (
            <div className="tl-empty-section" style={{ position: 'absolute', top: 20, left: 'calc(var(--tl-axis-width) + 12px)', right: 0 }}>
              <Plus size={14} /> No tasks yet for this period
            </div>
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
export default function DailyTimeline({ date, tasks, onUpdateTask, onEditTask, isFutureDate, filters = {} }) {
  const [zoom, setZoom] = useState(0); // index into ZOOM_OPTIONS
  const timelineRef = useRef(null);

  const zoomFactor = ZOOM_OPTIONS[zoom].factor;
  const hourHeight = 90 * zoomFactor;

  // Apply filters
  const filteredTasks = useMemo(() => {
    let t = tasks || [];
    if (filters.status   && filters.status   !== 'all') t = t.filter(x => x.status   === filters.status);
    if (filters.priority && filters.priority !== 'all') t = t.filter(x => x.priority === filters.priority);
    if (filters.category && filters.category !== 'all') t = t.filter(x => x.category === filters.category);
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

  return (
    <div style={{ marginTop: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📅</span>
          <span>{format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d')}</span>
        </h3>
        <div className="zoom-pill-group">
          {ZOOM_OPTIONS.map((o, i) => (
            <button key={o.label} className={`zoom-pill ${zoom === i ? 'active' : ''}`} onClick={() => setZoom(i)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline sections */}
      <div ref={timelineRef} style={{ position: 'relative' }}>
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
      const mins = (now.getHours() * 60 + now.getMinutes()) - (sectionStart * 60);
      setTopPx(mins * (hourHeight / 60));
      setTimeLabel(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [hourHeight, sectionStart]);

  return (
    <div className="current-time-line" style={{ top: `${topPx}px`, position: 'absolute' }}>
      <div className="current-time-label">{timeLabel}</div>
      <div className="current-time-dot" />
      <div className="current-time-dash" />
    </div>
  );
}
