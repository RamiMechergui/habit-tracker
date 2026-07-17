import React, { useRef, useState, useEffect, useCallback } from 'react';
import './TaskCard.css';
import { Clock, CheckCircle, XCircle, GripVertical, AlertTriangle, RefreshCw, Flame, Zap } from 'lucide-react';

// ── Completion confetti particles ─────────────────
function createConfetti(container) {
  if (!container) return;
  const colors = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
  for (let i = 0; i < 30; i++) {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;width:${4+Math.random()*6}px;height:${4+Math.random()*6}px;border-radius:${Math.random()>0.5?'50%':'2px'};background:${colors[i%colors.length]};top:${40+Math.random()*60}%;left:${Math.random()*100}%;pointer-events:none;z-index:20;animation:confettiFall ${0.6+Math.random()*0.8}s ease-out forwards;--dx:${(Math.random()-0.5)*120}px;--dy:${-(40+Math.random()*80)}px`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }
}

const PRIORITY_COLORS = {
  low:      'var(--priority-low)',
  medium:   'var(--priority-medium)',
  high:     'var(--priority-high)',
  critical: 'var(--priority-critical)',
};

const CATEGORY_COLORS = {
  Work:          'var(--cat-work)',
  Health:        'var(--cat-health)',
  Personal:      'var(--cat-personal)',
  Learning:      'var(--cat-learning)',
  Finance:       'var(--cat-finance)',
  Social:        'var(--cat-social)',
  'Video Editing': 'var(--cat-video-editing)',
  'Side Hustle':   'var(--cat-side-hustle)',
  Other:         'var(--cat-other)',
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
  task, onUpdateStatus, onEdit, onDragTime, isFutureDate, zoomFactor = 1, sectionOffsetMins = 0, hourHeight = 90,
  bulkMode, isSelected, onBulkSelect, onDragStart, onDragEnd, blocked = false, onReorder, onMoveToDate,
}) {
  const [swipeOffset,    setSwipeOffset]    = useState(0);
  const [dragY,          setDragY]          = useState(0);
  const [isSwiping,      setIsSwiping]      = useState(false);
  const [isDraggingTime, setIsDraggingTime] = useState(false);
  const [pop,            setPop]            = useState(false);
  const [progress,       setProgress]       = useState(() => getTimeProgress(task.time, task.duration));
  const [timerOn,        setTimerOn]        = useState(false);
  const [timerSeconds,   setTimerSeconds]   = useState(0);
  const [completionFlash, setCompletionFlash] = useState(false);

  // ── Deep focus ring calculation ──
  const RING_CIRCUMFERENCE = 2 * Math.PI * 11; // r=11
  const targetDurationMins = task.targetDuration || 0;               // minutes
  const accumulatedMins    = (task.deepWorkHours || 0) * 60;         // deepWorkHours is in hours
  const deepFocusPct = targetDurationMins > 0
    ? Math.min(100, (accumulatedMins / targetDurationMins) * 100)
    : 0;
  const ringState = targetDurationMins === 0 ? 'none'
    : deepFocusPct >= 100 ? 'done'
    : deepFocusPct > 0    ? 'progressing'
    : 'planned';
  const dashOffset = RING_CIRCUMFERENCE * (1 - deepFocusPct / 100);
  const ringBadgeLabel = targetDurationMins > 0
    ? `${Math.round(accumulatedMins)}/${targetDurationMins}m`
    : '';

  // #27 — Ambient timer tick
  useEffect(() => {
    if (!timerOn) return;
    const id = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerOn]);

  const startX    = useRef(0);
  const startY    = useRef(0);
  const longPress = useRef(null);
  const cardRef   = useRef(null);

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
    if (status === 'Completed' && task.status !== 'Completed') {
      setPop(true); setTimeout(() => setPop(false), 600);
      setTimeout(() => createConfetti(cardRef.current), 50);
      window.dispatchEvent(new CustomEvent('task-completed', { detail: { title: task.title } }));
    }
    try { navigator.vibrate?.(10); } catch {}
    onUpdateStatus(status);
  }, [task.status, task.title, onUpdateStatus]);

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
    onDragStart?.();
  }, [onDragStart]);

  const handleDragMove = useCallback((e) => {
    if (!isDraggingTime) return;
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragY(clientY - startY.current);
  }, [isDraggingTime]);

  const handleDragEnd = useCallback(() => {
    if (!isDraggingTime || isFutureDate) return;
    setIsDraggingTime(false);
    onDragEnd?.();
    const pxPerMin  = hourHeight / 60;
    const [hours, minutes] = (task.time || '00:00').split(':').map(Number);
    const baseTop   = (hours * 60 + minutes) * pxPerMin;
    const totalMins = Math.round((baseTop + dragY) / pxPerMin);
    const snapped   = Math.round(totalMins / 15) * 15;
    const safe      = Math.max(0, Math.min(24 * 60 - 15, snapped));
    const hh = Math.floor(safe / 60).toString().padStart(2, '0');
    const mm = (safe % 60).toString().padStart(2, '0');
    const newTime = `${hh}:${mm}`;
    if (newTime !== task.time) onDragTime(newTime);
    setDragY(0);
  }, [isDraggingTime, isFutureDate, task.time, dragY, hourHeight, onDragTime]);

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
  const taskCats = Array.isArray(task.categories) ? task.categories : (task.category ? [task.category] : ['Other']);
  const catColor = CATEGORY_COLORS[taskCats[0]] ?? CATEGORY_COLORS.Other;
  const pVisual       = PRIORITY_VISUALS[task.priority] || PRIORITY_VISUALS.medium;

  const showProgress = task.status === 'Pending' && progress > 0 && progress < 100;
  const isActive     = isSwiping || isDraggingTime || bulkMode;
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
      <div ref={cardRef}
        className={`task-card-v2 ${statusKey.toLowerCase()} ${pVisual.glowClass} ${pop ? 'task-card-pop' : ''}`}
        onTouchStart={bulkMode ? undefined : handleTouchStart}
        onTouchMove={bulkMode ? undefined : handleTouchMove}
        onTouchEnd={bulkMode ? undefined : handleTouchEnd}
        onClick={() => { if (bulkMode) { onBulkSelect?.(); return; } if (!isDraggingTime) onEdit?.(); }}
        style={{
          boxShadow:              isDraggingTime ? '0 12px 28px rgba(0,0,0,0.35)' : undefined,
          cursor:                 bulkMode ? 'pointer' : 'pointer',
          touchAction:            bulkMode ? 'auto' : 'pan-y',
          WebkitTapHighlightColor:'transparent',
          textDecoration:          isSkipped ? 'line-through' : undefined,
          outline:                 isSelected ? '2px solid var(--priority-medium)' : undefined,
        }}
        role="button"
        tabIndex={0}
        aria-label={`Task: ${task.title}, Status: ${statusKey}, Priority: ${task.priority}`}
        onKeyDown={e => { if (e.key === 'Enter') bulkMode ? onBulkSelect?.() : onEdit?.(); }}
      >
        {/* Priority stripe */}
        <div className="priority-stripe" style={{ background: priorityColor }} aria-hidden="true" />

        {/* Critical pulse ring */}
        {task.priority === 'critical' && statusKey !== 'Completed' && (
          <div className="critical-pulse-ring" aria-hidden="true" />
        )}

        {/* Deep Focus progress ring */}
        {ringState !== 'none' && (
          <div className={`focus-ring-wrap focus-ring--${ringState}`} aria-hidden="true">
            <svg className="focus-ring-svg" viewBox="0 0 28 28">
              <circle className="focus-ring-track" cx="14" cy="14" r="11" />
              <circle
                className="focus-ring-fill"
                cx="14" cy="14" r="11"
                style={{ strokeDashoffset: dashOffset }}
              />
            </svg>
            {durationH >= 56 && (
              <div className={`focus-ring-badge ${ringState}`}>{ringBadgeLabel}</div>
            )}
          </div>
        )}

        {/* Completion flash overlay */}
        {completionFlash && <div className="focus-ring-complete-flash" aria-hidden="true" />}

        <div className="task-card-body">
          {/* Title row */}
          <div className="task-card-title-row">
                <h4 className="task-card-title">
              {/* #33 — Blocked indicator */}
              {blocked && <span style={{ color:'var(--priority-critical)', marginRight:4 }} title="Blocked by another task">🔒</span>}
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
            </h4>
            <div className="task-card-drag-handle"
              onMouseDown={isFutureDate ? undefined : handleDragStart}
              onTouchStart={isFutureDate ? undefined : handleDragStart}
              onClick={e => e.stopPropagation()}
              aria-label={isFutureDate ? 'Future task — cannot drag' : 'Drag to reschedule'}
              title={isFutureDate ? 'Cannot drag tasks in the future' : 'Drag to change time'}
              style={{ opacity: isFutureDate ? 0.35 : 0.7, cursor: isFutureDate ? 'not-allowed' : 'grab' }}
            >
              <GripVertical size={13} aria-hidden="true" />
            </div>
            {onReorder && (
              <div style={{ display:'flex', flexDirection:'column', gap:1, marginLeft:2 }}>
                <button onClick={e => { e.stopPropagation(); onReorder(task.id, -1); }} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:0, lineHeight:1, fontSize:'0.55rem', opacity:0.4 }} title="Move up">▲</button>
                <button onClick={e => { e.stopPropagation(); onReorder(task.id, 1); }} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:0, lineHeight:1, fontSize:'0.55rem', opacity:0.4 }} title="Move down">▼</button>
              </div>
            )}
          </div>

          {/* #55 — Inline note preview */}
          {task.notes && durationH >= 56 && (
            <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', padding:'4px 0 6px', lineHeight:1.4, opacity:0.85, fontStyle:'italic' }}>
              {task.notes.length > 60 ? task.notes.slice(0,60)+'…' : task.notes}
            </div>
          )}

          {/* #39 — Tags */}
          {task.tags && task.tags.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, padding:'0 0 6px' }}>
              {task.tags.map(tag => (
                <span key={tag} style={{ background:'rgba(59,130,246,0.1)', color:'var(--accent-blue)', borderRadius:3, padding:'1px 6px', fontSize:'0.6rem', fontWeight:600 }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* #32 — Subtasks summary */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, padding:'0 0 6px', fontSize:'0.65rem', color:'var(--text-muted)' }}>
              {task.subtasks.map(st => (
                <span key={st.id} style={{ opacity:st.done?0.4:0.8 }}>
                  {st.done ? '✓' : '○'} {st.title.length > 20 ? st.title.slice(0,20)+'…' : st.title}
                </span>
              ))}
            </div>
          )}

          {/* Meta row */}
          {durationH >= 56 && (
            <div className="task-card-meta-row">
              <span className="task-card-time">
                <Clock size={9} aria-hidden="true" />
                {task.time}{task.duration ? ` · ${task.duration}m` : ''}
                {/* #27 — Ambient timer */}
                {timerOn && (
                  <span style={{ marginLeft:6, color:'var(--status-completed)', fontWeight:600 }}>
                    {String(Math.floor(timerSeconds/60)).padStart(2,'0')}:{String(timerSeconds%60).padStart(2,'0')}
                  </span>
                )}
              </span>
              <button onClick={e => { e.stopPropagation(); setTimerOn(p => !p); if (!timerOn) setTimerSeconds(0); }}
                style={{ background:'none', border:'none', color:timerOn?'var(--status-completed)':'var(--text-muted)', cursor:'pointer', padding:'2px 4px', fontSize:'0.6rem', fontWeight:600, fontFamily:'var(--font-sans)' }}
                title={timerOn ? 'Stop timer' : 'Start timer'}>{timerOn ? '■' : '▶'}</button>
              <span className={`task-status-pill ${statusMeta.cls}`}>{statusMeta.label}</span>
              {taskCats.map(cat => {
                if (cat === 'Other') return null;
                const cc = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other;
                return (
                  <span key={cat} className="category-chip"
                    style={{ background:`color-mix(in srgb, ${cc} 15%, transparent)`, border:`1px solid color-mix(in srgb, ${cc} 35%, transparent)`, color:cc }}>
                    <span className="category-chip-dot" style={{ background:cc }} aria-hidden="true" />
                    {cat}
                  </span>
                );
              })}
              {task.delayReason && (
                <AlertTriangle size={10} className="task-card-delay-icon" title={`Reason: ${task.delayReason}`} aria-label={`Delay reason: ${task.delayReason}`} />
              )}
              {/* #45 — Linked page */}
              {task.linkedPage && (
                <span style={{ background:'rgba(139,92,246,0.1)', color:'#8b5cf6', borderRadius:3, padding:'1px 6px', fontSize:'0.6rem', fontWeight:600 }}>
                  📘 {task.linkedPage.split('/').pop()}
                </span>
              )}
              {/* Deep Work hours badge */}
              {task.deepWorkHours > 0 && (
                <span style={{ background:'rgba(249,115,22,0.12)', color:'#f97316', borderRadius:3, padding:'1px 6px', fontSize:'0.6rem', fontWeight:700 }}>
                  🧠 {task.deepWorkHours}h
                </span>
              )}
              {/* #38 — Skip this occurrence for recurring tasks */}
              {(task.recurrence || task.recurringId) && task.status !== 'Skipped' && (
                <button onClick={e => { e.stopPropagation(); onUpdateStatus(task.id, 'Skipped'); }}
                  style={{ background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', borderRadius:4, padding:'1px 6px', color:'var(--text-muted)', fontSize:'0.6rem', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)', lineHeight:'16px' }}
                  title="Skip this occurrence"
                >Skip</button>
              )}
              {/* #44 — Overdue escalation badge */}
              {task.status === 'Missed' && (
                <span style={{ background:'var(--priority-critical)', color:'#fff', borderRadius:4, padding:'1px 6px', fontSize:'0.6rem', fontWeight:700, lineHeight:'16px', whiteSpace:'nowrap' }}>
                  OVERDUE
                </span>
              )}
              {onMoveToDate && (
                <span style={{ position:'relative', display:'inline-flex', alignItems:'center' }}>
                  <button onClick={e => { e.stopPropagation(); const inp = e.currentTarget.nextElementSibling; if (inp) { try { inp.showPicker?.(); inp.click?.(); } catch {} } }}
                    style={{ background:'none', border:'none', color:'var(--text-muted)', opacity:0.4, cursor:'pointer', padding:0, lineHeight:1, fontSize:'0.65rem', fontFamily:'var(--font-sans)' }}
                    title="Move to another day">↳</button>
                  <input type="date" style={{ position:'absolute', top:'100%', right:0, width:0, height:0, padding:0, border:'none', opacity:0, pointerEvents:'none' }}
                    onChange={e => { if (e.target.value) { onMoveToDate(task, e.target.value); e.target.value = ''; } }} />
                </span>
              )}
              <button onClick={e => { e.stopPropagation(); const txt = `${task.title} (${task.time}${task.duration ? ', '+task.duration+'m' : ''})${task.notes ? '\n'+task.notes : ''}`; navigator.clipboard?.writeText(txt).catch(() => {}); }}
                style={{ background:'none', border:'none', color:'var(--text-muted)', opacity:0.5, cursor:'pointer', padding:0, lineHeight:1, fontSize:'0.65rem', fontFamily:'var(--font-sans)', marginLeft:'auto' }}
                title="Copy task details" aria-label="Copy task details"
              >Share</button>
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
