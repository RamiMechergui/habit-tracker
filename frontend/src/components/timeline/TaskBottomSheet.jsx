import React, { useState, useEffect, useCallback } from 'react';
import { X, Clock, Bell, AlignLeft, Target, Trash2, Copy, ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
import { useHabits } from '../../Store';

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIORITIES = [
  { key: 'low',      label: '▾ Low',     cls: 'active-low'      },
  { key: 'medium',   label: '◆ Med',     cls: 'active-medium'   },
  { key: 'high',     label: '▲ High',    cls: 'active-high'     },
  { key: 'critical', label: '🔥 Crit',   cls: 'active-critical' },
];

const CATEGORIES = [
  { key: 'Work',     color: 'var(--cat-work)',     icon: '💼' },
  { key: 'Health',   color: 'var(--cat-health)',   icon: '🏃' },
  { key: 'Personal', color: 'var(--cat-personal)', icon: '🌟' },
  { key: 'Learning', color: 'var(--cat-learning)', icon: '📚' },
  { key: 'Finance',  color: 'var(--cat-finance)',  icon: '💰' },
  { key: 'Social',   color: 'var(--cat-social)',   icon: '👥' },
  { key: 'Other',    color: 'var(--cat-other)',    icon: '📌' },
];

const STATUSES = ['Pending', 'Completed', 'Delayed', 'Missed'];

const RECURRENCES = [
  { key: 'none',     label: 'None'      },
  { key: 'daily',    label: '🔄 Daily'  },
  { key: 'weekdays', label: '📅 Weekdays'},
  { key: 'weekly',   label: '📆 Weekly' },
  { key: 'monthly',  label: '🗓 Monthly' },
];

const REMINDER_OPTIONS = [
  { value: 0,  label: 'At task time' },
  { value: 5,  label: '5 min before' },
  { value: 15, label: '15 min before'},
  { value: 30, label: '30 min before'},
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const toMins  = (hh, mm) => hh * 60 + mm;
const fromStr = (str = '00:00') => {
  const [h, m] = str.split(':').map(Number);
  return { h: h || 0, m: m || 0 };
};
const toStr = (h, m) => `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

// Clamp minute to nearest valid step
const snapMin = (m, granularity) => {
  if (granularity >= 60) return 0;
  return Math.round(m / granularity) * granularity % 60;
};

// Build minute options list from granularity
const buildMinuteOptions = (granularity) => {
  if (granularity >= 60) return [0];
  const opts = [];
  for (let m = 0; m < 60; m += granularity) opts.push(m);
  return opts;
};

// Add duration to a time, returns { h, m }
const addDuration = (h, m, durationMins) => {
  const total = toMins(h, m) + durationMins;
  return { h: Math.floor(total / 60) % 24, m: total % 60 };
};

// ── Custom 24h Time Picker ─────────────────────────────────────────────────────
function TimePicker24h({ id, value, onChange, granularity = 30, label, endMinutesFull = false }) {
  const { h, m } = fromStr(value);
  const minuteOptions = endMinutesFull
    ? Array.from({ length: 12 }, (_, i) => i * 5)   // end time: every 5-min for flexibility
    : buildMinuteOptions(granularity);

  const handleHourChange = (e) => {
    const newH = parseInt(e.target.value);
    // Snap minute to closest valid option
    const snapped = endMinutesFull ? m : snapMin(m, granularity);
    const validMin = minuteOptions.includes(snapped) ? snapped : minuteOptions[0];
    onChange(toStr(newH, validMin));
  };

  const handleMinChange = (e) => {
    onChange(toStr(h, parseInt(e.target.value)));
  };

  const selectStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    fontWeight: 700,
    fontFamily: 'var(--font-sans)',
    padding: '8px 6px',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    textAlign: 'center',
    flex: 1,
    minWidth: 0,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <select
        id={`${id}-h`}
        value={h}
        onChange={handleHourChange}
        aria-label={`${label} hour`}
        style={selectStyle}
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
        ))}
      </select>

      <span style={{ color: 'var(--text-muted)', fontWeight: 900, fontSize: '1.1rem', flexShrink: 0, lineHeight: 1 }}>
        :
      </span>

      <select
        id={`${id}-m`}
        value={minuteOptions.includes(m) ? m : minuteOptions[0]}
        onChange={handleMinChange}
        aria-label={`${label} minute`}
        style={selectStyle}
      >
        {minuteOptions.map(min => (
          <option key={min} value={min}>{String(min).padStart(2, '0')}</option>
        ))}
      </select>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TaskBottomSheet({
  isOpen, onClose, onSave, onDelete, onDuplicate, initialData, isFutureDate, suggestedHour
}) {
  const { timelinePrefs } = useHabits();
  const { defaultDuration, intervalGranularity } = timelinePrefs;

  const [title,               setTitle]               = useState('');
  const [description,         setDescription]         = useState('');
  const [startTime,           setStartTimeRaw]        = useState('09:00');
  const [endTime,             setEndTimeRaw]          = useState('09:30');
  const [userEditedEnd,       setUserEditedEnd]       = useState(false);
  const [priority,            setPriority]            = useState('medium');
  const [category,            setCategory]            = useState('Other');
  const [status,              setStatus]              = useState('Pending');
  const [delayReason,         setDelayReason]         = useState('');
  const [recurrence,          setRecurrence]          = useState('none');
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [reminderMinutes,     setReminderMinutes]     = useState(15);

  // ── Derived calculations ──────────────────────────────────────────────────
  const startH = fromStr(startTime).h;
  const startM = fromStr(startTime).m;
  const endH   = fromStr(endTime).h;
  const endM   = fromStr(endTime).m;

  const startTotal = toMins(startH, startM);
  const endTotal   = toMins(endH, endM);
  const duration   = endTotal > startTotal ? endTotal - startTotal : 0;
  const isInvalid  = endTotal <= startTotal;

  // ── Smart start time setter: auto-updates end unless user manually changed it ──
  const setStartTime = useCallback((val) => {
    setStartTimeRaw(val);
    if (!userEditedEnd) {
      const { h, m } = fromStr(val);
      const end = addDuration(h, m, defaultDuration);
      setEndTimeRaw(toStr(end.h, end.m));
    }
  }, [userEditedEnd, defaultDuration]);

  const setEndTime = useCallback((val) => {
    setEndTimeRaw(val);
    setUserEditedEnd(true);
  }, []);

  // ── Initialize from data or defaults ─────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      const st = initialData.time || '09:00';
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setStartTimeRaw(st);
      // Reconstruct endTime from duration
      const { h, m } = fromStr(st);
      const end = addDuration(h, m, parseInt(initialData.duration) || defaultDuration);
      setEndTimeRaw(toStr(end.h, end.m));
      setUserEditedEnd(false);
      setPriority(initialData.priority || 'medium');
      setCategory(initialData.category || 'Other');
      setStatus(initialData.status || 'Pending');
      setDelayReason(initialData.delayReason || '');
      setRecurrence(initialData.recurrence || 'none');
      setNotificationEnabled(initialData.notificationEnabled ?? true);
      setReminderMinutes(initialData.reminderMinutes ?? 15);
    } else {
      // Reset for new task
      const h = suggestedHour ?? 9;
      // Snap suggested minute to granularity
      const minuteOpts = buildMinuteOptions(intervalGranularity);
      const m = minuteOpts[0];
      const st = toStr(h, m);
      const end = addDuration(h, m, defaultDuration);
      setTitle(''); setDescription('');
      setStartTimeRaw(st);
      setEndTimeRaw(toStr(end.h, end.m));
      setUserEditedEnd(false);
      setPriority('medium'); setCategory('Other'); setStatus('Pending');
      setDelayReason(''); setRecurrence('none');
      setNotificationEnabled(true); setReminderMinutes(15);
    }
  }, [initialData, isOpen, suggestedHour, defaultDuration, intervalGranularity]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!title.trim() || !startTime || isInvalid) return;
    onSave({
      id:                  initialData?.id || `task_${Date.now()}`,
      title:               title.trim(),
      description:         description.trim(),
      time:                startTime,
      endTime,
      duration:            String(duration),
      priority,
      category,
      status,
      delayReason:         (['Delayed','Missed'].includes(status)) ? delayReason.trim() : '',
      recurrence,
      notificationEnabled,
      reminderMinutes,
      notificationSent:    initialData?.notificationSent || false,
      createdAt:           initialData?.createdAt || new Date().toISOString(),
    });
    onClose();
  };

  const showDelayReason = ['Delayed', 'Missed'].includes(status);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)', zIndex: 999, backdropFilter: 'blur(4px)'
      }} />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
        padding: '0 0 env(safe-area-inset-bottom,0px) 0',
        zIndex: 1000, boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
        animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
              {initialData ? '✏️ Edit Task' : '✚ New Task'}
            </h3>
            {initialData?.createdAt && (
              <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Created {new Date(initialData.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {initialData && onDuplicate && (
              <button className="btn" title="Duplicate"
                style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-blue)', padding: '8px 12px', fontSize: '0.78rem', fontWeight: 600 }}
                onClick={() => { onDuplicate(initialData); onClose(); }}
              >
                <Copy size={14} /> Duplicate
              </button>
            )}
            <button
              className="btn"
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                padding: '8px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div className="evolvia-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Title */}
            <div>
              <span className="sheet-field-label">Task Title *</span>
              <div style={{ position: 'relative' }}>
                <Target size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  className="w-full" style={{ paddingLeft: '2.5rem' }}
                  placeholder="What do you need to do?" value={title}
                  onChange={e => setTitle(e.target.value)} autoFocus
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <span className="sheet-field-label">Notes (optional)</span>
              <div style={{ position: 'relative' }}>
                <AlignLeft size={15} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-muted)' }} />
                <textarea className="w-full"
                  style={{ paddingLeft: '2.5rem', paddingTop: '10px', minHeight: '70px', resize: 'none' }}
                  placeholder="Add description or notes..."
                  value={description} onChange={e => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Time range */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="sheet-field-label" style={{ margin: 0 }}>Time Range</span>
                {/* Duration badge */}
                <div style={{
                  padding: '4px 10px', borderRadius: 20,
                  background: isInvalid ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.1)',
                  color: isInvalid ? '#ef4444' : 'var(--accent-blue)',
                  fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
                  transition: 'all 0.2s',
                }}>
                  <Clock size={11} />
                  {isInvalid ? 'Invalid range' : `${duration} min`}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
                {/* Start time */}
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.04em' }}>START</div>
                  <TimePicker24h
                    id="task-start"
                    label="Start time"
                    value={startTime}
                    onChange={setStartTime}
                    granularity={intervalGranularity}
                  />
                </div>

                <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '1.1rem', textAlign: 'center', paddingTop: 18 }}>→</span>

                {/* End time */}
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.04em' }}>
                    END {!userEditedEnd && <span style={{ color: 'var(--accent-blue)', fontSize: '0.62rem' }}>AUTO</span>}
                  </div>
                  <TimePicker24h
                    id="task-end"
                    label="End time"
                    value={endTime}
                    onChange={setEndTime}
                    granularity={intervalGranularity}
                    endMinutesFull={true}
                  />
                </div>
              </div>

              {/* Invalid time range warning */}
              {isInvalid && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  marginTop: 8, padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  color: '#ef4444', fontSize: '0.78rem', fontWeight: 600,
                }}>
                  <AlertCircle size={13} />
                  End time must be after start time
                </div>
              )}

              {/* Reset end time hint */}
              {userEditedEnd && !isInvalid && (
                <button
                  onClick={() => {
                    const { h, m } = fromStr(startTime);
                    const end = addDuration(h, m, defaultDuration);
                    setEndTimeRaw(toStr(end.h, end.m));
                    setUserEditedEnd(false);
                  }}
                  style={{
                    marginTop: 6, background: 'none', border: 'none', padding: 0,
                    color: 'var(--accent-blue)', fontSize: '0.72rem', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <RefreshCw size={10} /> Reset to auto (+{defaultDuration} min)
                </button>
              )}
            </div>

            {/* Priority */}
            <div>
              <span className="sheet-field-label">Priority</span>
              <div className="priority-selector">
                {PRIORITIES.map(p => (
                  <button key={p.key} className={`priority-btn ${priority === p.key ? p.cls : ''}`}
                    onClick={() => setPriority(p.key)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <span className="sheet-field-label">Category</span>
              <div className="category-picker">
                {CATEGORIES.map(c => (
                  <button key={c.key}
                    className={`cat-btn ${category === c.key ? 'active' : ''}`}
                    onClick={() => setCategory(c.key)}
                    style={category === c.key ? { background: c.color, borderColor: c.color } : {}}
                  >
                    {c.icon} {c.key}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <span className="sheet-field-label">Status</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {STATUSES.map(s => (
                  <button key={s}
                    onClick={() => setStatus(s)}
                    style={{
                      flex: 1, padding: '7px 4px', borderRadius: 8, border: '1px solid var(--border)',
                      background: status === s ? 'var(--accent-blue)' : 'transparent',
                      color: status === s ? '#fff' : 'var(--text-muted)',
                      fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.2s', fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Delay reason */}
            {showDelayReason && (
              <div className="delay-reason-field">
                <span className="sheet-field-label">
                  {status === 'Delayed' ? '⏩ Delay Reason' : '✗ Missed Reason'}
                </span>
                <textarea className="w-full"
                  style={{ resize: 'none', minHeight: 70 }}
                  placeholder={`Why was this task ${status.toLowerCase()}?`}
                  value={delayReason} onChange={e => setDelayReason(e.target.value)}
                />
              </div>
            )}

            {/* Recurrence */}
            <div>
              <span className="sheet-field-label"><RefreshCw size={10} style={{ marginRight: 4 }} />Recurrence</span>
              <div className="recurrence-row">
                {RECURRENCES.map(r => (
                  <button key={r.key} className={`recurrence-chip ${recurrence === r.key ? 'active' : ''}`}
                    onClick={() => setRecurrence(r.key)}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div style={{ background: 'var(--tl-panel-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Bell size={17} color={notificationEnabled ? 'var(--accent-blue)' : 'var(--text-muted)'} />
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Reminder</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Notify before task starts</div>
                  </div>
                </div>
                <input type="checkbox" className="habit-checkbox"
                  checked={notificationEnabled} onChange={e => setNotificationEnabled(e.target.checked)} />
              </label>

              {notificationEnabled && (
                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {REMINDER_OPTIONS.map(o => (
                    <button key={o.value}
                      onClick={() => setReminderMinutes(o.value)}
                      style={{
                        padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)',
                        background: reminderMinutes === o.value ? 'rgba(59,130,246,0.15)' : 'transparent',
                        borderColor: reminderMinutes === o.value ? 'var(--accent-blue)' : 'var(--border)',
                        color: reminderMinutes === o.value ? 'var(--accent-blue)' : 'var(--text-muted)',
                        fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.2s', fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <button
            className="btn w-full"
            style={{ background: 'var(--accent-blue)', color: '#fff', padding: '13px', fontWeight: 700, fontSize: '0.95rem' }}
            onClick={handleSave}
            disabled={!title.trim() || !startTime || isInvalid}
          >
            {initialData ? 'Update Task' : 'Create Task'}
          </button>

          {initialData && onDelete && (
            <button
              className="btn w-full"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '11px', fontWeight: 600 }}
              onClick={() => { onDelete(initialData.id); onClose(); }}
            >
              <Trash2 size={15} /> Delete Task
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
