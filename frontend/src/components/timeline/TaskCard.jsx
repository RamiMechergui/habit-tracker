import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Clock, Bell, CheckCircle, XCircle, GripVertical, AlertTriangle, RefreshCw, Flame, Zap } from 'lucide-react';

const PRIORITY_COLORS = {
  low:      'var(--priority-low)',
  medium:   'var(--priority-medium)',
  high:     'var(--priority-high)',
  critical: 'var(--priority-critical)',
};

const CATEGORY_COLORS = {
  Work:     'var(--cat-work)',
  Health:   'var(--cat-health)',
  Personal: 'var(--cat-personal)',
  Learning: 'var(--cat-learning)',
  Finance:  'var(--cat-finance)',
  Social:   'var(--cat-social)',
  Other:    'var(--cat-other)',
};

const STATUS_META = {
  Completed: { label: '✓ Done',     cls: 'completed' },
  Delayed:   { label: '⏩ Delayed', cls: 'delayed'   },
  Missed:    { label: '✗ Missed',  cls: 'missed'    },
  Pending:   { label: '● Pending', cls: 'pending'   },
  Skipped:   { label: '⤳ Skipped', cls: 'skipped'   },
};

function getTimeProgress(taskTime, duration) {
  if (!taskTime || !duration) return 0;
  const [h, m] = taskTime.split(':').map(Number);
  const startMs = new Date().setHours(h, m, 0, 0);
  const endMs   = startMs + parseInt(duration) * 60_000;
  return Math.max(0, Math.min(100, (Date.now() - startMs) / (endMs - startMs) * 100));
}

// Priority visual config
const PRIORITY_VISUALS = {
  critical: {
    glowClass: 'task-card--critical',
    badge: <Flame size={10} aria-label="Critical priority" />,
    borderAnim: true,
  },
  high: {
    glowClass: 'task-card--high',
    badge: <Zap size={10} aria-label="High priority" />,
    borderAnim: false,
  },
  medium: { glowClass: '', badge: null, borderAnim: false },
  low:    { glowClass: '', badge: null, borderAnim: false },
};

export default function TaskCard({
  task, onUpdateStatus, onEdit, onDragTime, isFutureDate, zoomFactor = 1, sectionOffsetMins = 0,
}) {
  const [swipeOffset,    setSwipeOffset]    = useState(0);
  const [dragY,          setDragY]          = useState(0);
  const [isSwiping,      setIsSwiping]      = useState(false);
  const [isDraggingTime, setIsDraggingTime] = useState(false);
  const [pop,            setPop]            = useState(false);
  const [progress,       setProgress]       = useState(() => getTimeProgress(task.time, task.duration));

  const startX    = useRef(0);
  const startY    = useRef(0);
  const longPress = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setProgress(getTimeProgress(task.time, task.duration)), 30_000);
    return () => clearInterval(id);
  }, [task.time, task.duration]);

  const handleTouchStart = useCallback((e) => {
    if (isDraggingTime) return;
    startX.current = e.touches[0].clientX;
    setIsSwiping(true);
    longPress.current = setTimeout(() => { setIsSwiping(false); onEdit?.(); }, 500);
  }, [isDraggingTime, onEdit]);

  const handleTouchMove = useCallback((e) => {
    if (!isSwiping || isDraggingTime) return;
    const diff = e.touches[0].clientX - startX.current;
    if (Math.abs(diff) > 10 && longPress.current) { clearTimeout(longPress.current); longPress.current = null; }
    setSwipeOffset(Math.max(-110, Math.min(110, diff)));
  }, [isSwiping, isDraggingTime]);

  const triggerStatus = useCallback((status) => {
    if (status === 'Completed' && task.status !== 'Completed') { setPop(true); setTimeout(() => setPop(false), 600); }
    onUpdateStatus(status);
  }, [task.status, onUpdateStatus]);

  const handleTouchEnd = useCallback(() => {
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null; }
    if (!isSwiping) return;
    setIsSwiping(false);
    if      (swipeOffset >  80) triggerStatus('Completed');
    else if (swipeOffset < -80) triggerStatus('Missed');
    setSwipeOffset(0);
  }, [isSwiping, swipeOffset, triggerStatus]);

  const handleDragStart = useCallback((e) => {
    e.stopPropagation(); setIsDraggingTime(true);
    startY.current = e.touches ? e.touches[0].clientY : e.clientY;
  }, []);

  const handleDragMove = useCallback((e) => {
    if (!isDraggingTime) return;
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragY(clientY - startY.current);
  }, [isDraggingTime]);

  const handleDragEnd = useCallback(() => {
    if (!isDraggingTime || isFutureDate) return;
    setIsDraggingTime(false);
    const [hours, minutes] = (task.time || '00:00').split(':').map(Number);
    const baseTop   = (hours * 60 + minutes) * 1.5 * zoomFactor;
    const totalMins = Math.round((baseTop + dragY) / (1.5 * zoomFactor));
    const snapped   = Math.round(totalMins / 15) * 15;
    const safe      = Math.max(0, Math.min(24 * 60 - 15, snapped));
    const hh = Math.floor(safe / 60).toString().padStart(2, '0');
    const mm = (safe % 60).toString().padStart(2, '0');
    const newTime = `${hh}:${mm}`;
    if (newTime !== task.time) onDragTime(newTime);
    setDragY(0);
  }, [isDraggingTime, isFutureDate, task.time, dragY, zoomFactor, onDragTime]);

  useEffect(() => {
    if (!isDraggingTime) return;
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup',   handleDragEnd);
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend',  handleDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup',   handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend',  handleDragEnd);
    };
  }, [isDraggingTime, handleDragMove, handleDragEnd]);

  const [h, m]       = (task.time || '00:00').split(':').map(Number);
  const hourHeight   = 90 * zoomFactor;
  const absTop       = (h * 60 + m) * (hourHeight / 60);
  const sectionTopPx = sectionOffsetMins * (hourHeight / 60);
  const topPosition  = absTop - sectionTopPx + dragY;
  const durationH    = Math.max((parseInt(task.duration) || 30) * (hourHeight / 60), 44);

  const colIndex     = task.layout?.colIndex ?? 0;
  const numCols      = task.layout?.numCols  ?? 1;
  const widthPct     = 100 / numCols;
  const leftPct      = colIndex * widthPct;

  const statusKey    = task.status || 'Pending';
  const statusMeta   = STATUS_META[statusKey] ?? STATUS_META.Pending;
  const priorityColor = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium;
  const catColor      = CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.Other;
  const pVisual       = PRIORITY_VISUALS[task.priority] || PRIORITY_VISUALS.medium;

  const showProgress = task.status === 'Pending' && progress > 0 && progress < 100;
  const isActive     = isSwiping || isDraggingTime;
  const isSkipped    = statusKey === 'Skipped';

  return (
    <div
      className={`task-card-wrapper ${isActive ? 'is-active' : ''}`}
      style={{
        position:   'absolute',
        top:        `${topPosition}px`,
        left:       `calc(var(--tl-axis-width) + 8px + (100% - var(--tl-axis-width) - 16px) * ${leftPct / 100})`,
        width:      `calc((100% - var(--tl-axis-width) - 16px) * ${widthPct / 100} - 4px)`,
        height:     `${durationH}px`,
        minHeight:  '44px',
        zIndex:     isActive ? 10 : 1,
        transition: isActive ? 'none' : 'transform 0.3s ease, top 0.3s ease',
        transform:  `translateX(${swipeOffset}px)`,
        opacity:    isSkipped ? 0.55 : 1,
      }}
    >
      {/* Swipe bg */}
      <div className="swipe-action-bg"
        style={{ opacity: Math.abs(swipeOffset)/110, background: swipeOffset>0?'var(--swipe-complete-bg, rgba(255,255,255,0.15))':'var(--swipe-miss-bg, rgba(255,255,255,0.1))' }}
        aria-hidden="true">
        {swipeOffset > 0 ? <CheckCircle size={18} /> : <div />}
        {swipeOffset < 0 ? <XCircle    size={18} /> : <div />}
      </div>

      {/* Card */}
      <div
        className={`task-card-v2 ${statusKey.toLowerCase()} ${pVisual.glowClass} ${pop ? 'task-card-pop' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => { if (!isDraggingTime) onEdit?.(); }}
        style={{
          boxShadow:              isDraggingTime ? '0 12px 28px rgba(0,0,0,0.35)' : undefined,
          cursor:                 'pointer',
          touchAction:            'pan-y',
          WebkitTapHighlightColor:'transparent',
          textDecoration:          isSkipped ? 'line-through' : undefined,
        }}
        role="button"
        tabIndex={0}
        aria-label={`Task: ${task.title}, Status: ${statusKey}, Priority: ${task.priority}`}
        onKeyDown={e => { if (e.key === 'Enter') onEdit?.(); }}
      >
        {/* Priority stripe */}
        <div className="priority-stripe" style={{ background: priorityColor }} aria-hidden="true" />

        {/* Critical pulse ring */}
        {task.priority === 'critical' && statusKey !== 'Completed' && (
          <div className="critical-pulse-ring" aria-hidden="true" />
        )}

        <div className="task-card-body">
          {/* Title row */}
          <div className="task-card-title-row">
            <h4 className="task-card-title">
              {/* Recurring icon */}
              {task.recurrence && task.recurrence !== 'none' && (
                <RefreshCw size={9} className="task-card-recur-icon" aria-label="Recurring" />
              )}
              {/* Virtual recurring badge */}
              {task.isVirtual && (
                <span className="virtual-recur-badge" aria-label="Virtual recurring instance">↻</span>
              )}
              {task.title}
              {/* Priority badge */}
              {pVisual.badge && statusKey !== 'Completed' && (
                <span className="task-priority-badge" style={{ color: priorityColor }}>{pVisual.badge}</span>
              )}
              {/* Notification bell */}
              {task.notificationEnabled && (
                <Bell size={9} className="task-card-bell-icon" aria-label="Reminder set" />
              )}
            </h4>
            {!isFutureDate && (
              <div className="task-card-drag-handle"
                onMouseDown={handleDragStart} onTouchStart={handleDragStart}
                onClick={e => e.stopPropagation()} aria-label="Drag to reschedule">
                <GripVertical size={13} aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Meta row */}
          {durationH >= 56 && (
            <div className="task-card-meta-row">
              <span className="task-card-time">
                <Clock size={9} aria-hidden="true" />
                {task.time}{task.duration ? ` · ${task.duration}m` : ''}
              </span>
              <span className={`task-status-pill ${statusMeta.cls}`}>{statusMeta.label}</span>
              {task.category && task.category !== 'Other' && (
                <span className="category-chip"
                  style={{ background:`color-mix(in srgb, ${catColor} 15%, transparent)`, border:`1px solid color-mix(in srgb, ${catColor} 35%, transparent)`, color:catColor }}>
                  <span className="category-chip-dot" style={{ background:catColor }} aria-hidden="true" />
                  {task.category}
                </span>
              )}
              {task.delayReason && (
                <AlertTriangle size={10} className="task-card-delay-icon" title={`Reason: ${task.delayReason}`} aria-label={`Delay reason: ${task.delayReason}`} />
              )}
            </div>
          )}

          {/* Progress bar */}
          {showProgress && durationH >= 64 && (
            <div className="task-progress-bar" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
              <div className="task-progress-fill" style={{ width:`${progress}%` }} />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes taskCardPop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.06); box-shadow: 0 0 20px rgba(255,255,255,0.2); }
          100% { transform: scale(1); }
        }
        .task-card-pop { animation: taskCardPop 0.5s ease-out forwards; }
        @keyframes criticalPulse {
          0%,100% { opacity: 0.6; transform: scale(1); }
          50%     { opacity: 0.15; transform: scale(1.06); }
        }
        .critical-pulse-ring {
          position: absolute; inset: -2px; border-radius: 10px;
          border: 2px solid var(--priority-critical);
          animation: criticalPulse 2s ease-in-out infinite;
          pointer-events: none; z-index: 0;
        }
        .task-card--critical { box-shadow: 0 0 0 1px var(--priority-critical), 0 4px 16px color-mix(in srgb, var(--priority-critical) 30%, transparent) !important; }
        .task-card--high     { box-shadow: 0 0 0 1px color-mix(in srgb, var(--priority-high) 60%, transparent), 0 4px 12px color-mix(in srgb, var(--priority-high) 20%, transparent) !important; }
      `}</style>
    </div>
  );
}
