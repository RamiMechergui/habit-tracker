import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Clock, Bell, CheckCircle, XCircle, GripVertical,
  AlertTriangle, RefreshCw, ChevronRight
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────
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
};

function getTimeProgress(taskTime, duration) {
  if (!taskTime || !duration) return 0;
  const now = new Date();
  const [h, m] = taskTime.split(':').map(Number);
  const startMs = new Date().setHours(h, m, 0, 0);
  const endMs   = startMs + parseInt(duration) * 60000;
  const pct = (Date.now() - startMs) / (endMs - startMs) * 100;
  return Math.max(0, Math.min(100, pct));
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TaskCard({ task, onUpdateStatus, onEdit, onDragTime, isFutureDate, zoomFactor = 1, sectionOffsetMins = 0 }) {
  const [swipeOffset, setSwipeOffset]     = useState(0);
  const [dragY, setDragY]                 = useState(0);
  const [isSwiping, setIsSwiping]         = useState(false);
  const [isDraggingTime, setIsDraggingTime] = useState(false);
  const [pop, setPop]                     = useState(false);
  const [progress, setProgress]           = useState(() => getTimeProgress(task.time, task.duration));

  const startX   = useRef(0);
  const startY   = useRef(0);
  const longPress = useRef(null);

  // Live progress update every 30s
  useEffect(() => {
    const tick = () => setProgress(getTimeProgress(task.time, task.duration));
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [task.time, task.duration]);

  // ── Swipe gestures (status) ──────────────────────────────────────────────
  const handleTouchStart = (e) => {
    if (isFutureDate || isDraggingTime) return;
    startX.current = e.touches[0].clientX;
    setIsSwiping(true);
    // Long-press to edit
    longPress.current = setTimeout(() => {
      setIsSwiping(false);
      onEdit && onEdit();
    }, 500);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping || isFutureDate || isDraggingTime) return;
    const diff = e.touches[0].clientX - startX.current;
    if (Math.abs(diff) > 10 && longPress.current) {
      clearTimeout(longPress.current);
      longPress.current = null;
    }
    setSwipeOffset(Math.max(-110, Math.min(110, diff)));
  };

  const handleTouchEnd = () => {
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null; }
    if (!isSwiping || isFutureDate) return;
    setIsSwiping(false);
    if      (swipeOffset > 80) { triggerStatus('Completed'); }
    else if (swipeOffset < -80) { triggerStatus('Missed'); }
    setSwipeOffset(0);
  };

  const triggerStatus = (status) => {
    if (status === 'Completed' && task.status !== 'Completed') {
      setPop(true);
      setTimeout(() => setPop(false), 600);
    }
    onUpdateStatus(status);
  };

  // ── Drag (time change) ────────────────────────────────────────────────────
  const handleDragStart = (e) => {
    if (isFutureDate) return;
    e.stopPropagation();
    setIsDraggingTime(true);
    startY.current = e.touches ? e.touches[0].clientY : e.clientY;
  };

  const handleDragMove = useCallback((e) => {
    if (!isDraggingTime || isFutureDate) return;
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragY(clientY - startY.current);
  }, [isDraggingTime, isFutureDate]);

  const handleDragEnd = useCallback((e) => {
    if (!isDraggingTime || isFutureDate) return;
    e.stopPropagation();
    setIsDraggingTime(false);

    const [hours, minutes] = (task.time || '00:00').split(':').map(Number);
    const baseTop = (hours * 60 + minutes) * 1.5 * zoomFactor;
    const totalMins = Math.round((baseTop + dragY) / (1.5 * zoomFactor));
    const snapped   = Math.round(totalMins / 15) * 15;
    const safe      = Math.max(0, Math.min(24 * 60 - 15, snapped));
    const hh = Math.floor(safe / 60).toString().padStart(2, '0');
    const mm = (safe % 60).toString().padStart(2, '0');
    if (`${hh}:${mm}` !== task.time) onDragTime(`${hh}:${mm}`);
    setDragY(0);
  }, [isDraggingTime, isFutureDate, task.time, dragY, zoomFactor, onDragTime]);

  useEffect(() => {
    if (isDraggingTime) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup',   handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend',  handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup',   handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend',  handleDragEnd);
    };
  }, [isDraggingTime, handleDragMove, handleDragEnd]);

  // ── Layout calculations ───────────────────────────────────────────────────
  const [h, m]       = (task.time || '00:00').split(':').map(Number);
  const hourHeight   = 90 * zoomFactor;
  const absTop       = (h * 60 + m) * (hourHeight / 60);
  const sectionTopPx = sectionOffsetMins * (hourHeight / 60);
  const topPosition  = absTop - sectionTopPx + dragY;
  const durationH    = Math.max((parseInt(task.duration) || 30) * (hourHeight / 60), 44);

  const colIndex     = task.layout?.colIndex || 0;
  const numCols      = task.layout?.numCols  || 1;
  const widthPct     = 100 / numCols;
  const leftPct      = colIndex * widthPct;

  const statusKey    = task.status || 'Pending';
  const statusMeta   = STATUS_META[statusKey] || STATUS_META.Pending;
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  const catColor      = CATEGORY_COLORS[task.category] || CATEGORY_COLORS.Other;

  const showProgress = task.status === 'Pending' && progress > 0 && progress < 100;

  return (
    <div style={{
      position:   'absolute',
      top:        `${topPosition}px`,
      left:       `calc(var(--tl-axis-width) + 8px + (100% - var(--tl-axis-width) - 16px) * ${leftPct / 100})`,
      width:      `calc((100% - var(--tl-axis-width) - 16px) * ${widthPct / 100} - 4px)`,
      height:     `${durationH}px`,
      zIndex:     isSwiping || isDraggingTime ? 10 : 1,
      transition: isSwiping || isDraggingTime
        ? 'none'
        : 'transform 0.3s ease, top 0.3s ease, left 0.3s ease, width 0.3s ease',
      transform:  `translateX(${swipeOffset}px)`,
    }}>

      {/* Swipe action background */}
      <div className="swipe-action-bg" style={{
        opacity:    Math.abs(swipeOffset) / 110,
        background: swipeOffset > 0 ? '#10b981' : '#ef4444',
      }}>
        {swipeOffset > 0  ? <CheckCircle color="#fff" size={18} /> : <div />}
        {swipeOffset < 0 ? <XCircle color="#fff" size={18} />     : <div />}
      </div>

      {/* Card */}
      <div
        className={`task-card-v2 ${statusKey.toLowerCase()} ${pop ? 'confetti-pop' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (isFutureDate || isDraggingTime) return;
          onEdit && onEdit();
        }}
        style={{
          boxShadow: isDraggingTime ? '0 12px 28px rgba(0,0,0,0.35)' : undefined,
          cursor:    isFutureDate ? 'default' : 'pointer',
        }}
      >
        {/* Priority stripe */}
        <div className="priority-stripe" style={{ background: priorityColor }} />

        <div style={{ padding: '7px 10px 7px 14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, minHeight: 0 }}>

          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
            <h4 style={{
              margin: 0, fontSize: '0.82rem', fontWeight: 700,
              color: 'var(--text-primary)', lineHeight: 1.2,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              flex: 1,
            }}>
              {task.recurrence && task.recurrence !== 'none' && (
                <RefreshCw size={9} style={{ marginRight: 3, opacity: 0.6, flexShrink: 0 }} />
              )}
              {task.title}
              {task.notificationEnabled && (
                <Bell size={9} style={{ marginLeft: 4, opacity: 0.6 }} />
              )}
            </h4>

            {/* Drag handle */}
            {!isFutureDate && (
              <div
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                onClick={e => e.stopPropagation()}
                style={{ cursor: 'grab', padding: '2px', color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0 }}
              >
                <GripVertical size={13} />
              </div>
            )}
          </div>

          {/* Time + chips row */}
          {durationH >= 56 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                <Clock size={9} />
                {task.time}{task.duration ? ` · ${task.duration}m` : ''}
              </div>

              {/* Status pill */}
              <span className={`task-status-pill ${statusMeta.cls}`}>{statusMeta.label}</span>

              {/* Category chip */}
              {task.category && task.category !== 'Other' && (
                <span className="category-chip" style={{
                  background: `${catColor}20`,
                  border:     `1px solid ${catColor}40`,
                  color:      catColor,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: catColor, display: 'inline-block' }} />
                  {task.category}
                </span>
              )}

              {/* Delay reason indicator */}
              {task.delayReason && (
                <AlertTriangle size={10} color="var(--priority-high)" title={`Reason: ${task.delayReason}`} />
              )}
            </div>
          )}

          {/* Progress bar */}
          {showProgress && durationH >= 64 && (
            <div className="task-progress-bar">
              <div className="task-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes popConfetti {
          0%   { transform: scale(1);    box-shadow: 0 0 0 rgba(16,185,129,0.4); }
          50%  { transform: scale(1.06); box-shadow: 0 0 18px rgba(16,185,129,0.7); }
          100% { transform: scale(1);   box-shadow: 0 0 0 rgba(16,185,129,0); }
        }
        .confetti-pop { animation: popConfetti 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}
