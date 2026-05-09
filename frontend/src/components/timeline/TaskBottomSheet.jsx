import React, { useState, useEffect } from 'react';
import { X, Clock, Bell, AlignLeft, Target, Trash2, Copy, ChevronDown, RefreshCw } from 'lucide-react';

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

// ── Component ─────────────────────────────────────────────────────────────────
export default function TaskBottomSheet({
  isOpen, onClose, onSave, onDelete, onDuplicate, initialData, isFutureDate
}) {
  const [title,               setTitle]               = useState('');
  const [description,         setDescription]         = useState('');
  const [time,                setTime]                = useState('12:00');
  const [endTime,             setEndTime]             = useState('12:30');
  const [priority,            setPriority]            = useState('medium');
  const [category,            setCategory]            = useState('Other');
  const [status,              setStatus]              = useState('Pending');
  const [delayReason,         setDelayReason]         = useState('');
  const [recurrence,          setRecurrence]          = useState('none');
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [reminderMinutes,     setReminderMinutes]     = useState(15);

  // Derive duration from time → endTime
  const getDurationFromTimes = (start, end) => {
    const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const diff = toMins(end) - toMins(start);
    return Math.max(5, diff > 0 ? diff : 30);
  };

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setTime(initialData.time || '12:00');
      // Reconstruct endTime from duration
      const [h, m] = (initialData.time || '12:00').split(':').map(Number);
      const endMins = h * 60 + m + (parseInt(initialData.duration) || 30);
      const eh = Math.floor(endMins / 60) % 24;
      const em = endMins % 60;
      setEndTime(`${eh.toString().padStart(2,'0')}:${em.toString().padStart(2,'0')}`);
      setPriority(initialData.priority || 'medium');
      setCategory(initialData.category || 'Other');
      setStatus(initialData.status || 'Pending');
      setDelayReason(initialData.delayReason || '');
      setRecurrence(initialData.recurrence || 'none');
      setNotificationEnabled(initialData.notificationEnabled ?? true);
      setReminderMinutes(initialData.reminderMinutes ?? 15);
    } else {
      // Reset
      setTitle(''); setDescription(''); setTime('12:00'); setEndTime('12:30');
      setPriority('medium'); setCategory('Other'); setStatus('Pending');
      setDelayReason(''); setRecurrence('none');
      setNotificationEnabled(true); setReminderMinutes(15);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const duration = getDurationFromTimes(time, endTime);

  const handleSave = () => {
    if (!title.trim() || !time) return;
    onSave({
      id:                  initialData?.id || `task_${Date.now()}`,
      title:               title.trim(),
      description:         description.trim(),
      time,
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
            <button className="btn" style={{ background: 'transparent', padding: '8px' }} onClick={onClose}>
              <X size={20} />
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
              <span className="sheet-field-label">Time Range</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Clock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="time" className="w-full" style={{ paddingLeft: '2.5rem' }}
                    value={time} onChange={e => setTime(e.target.value)} />
                </div>
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>→</span>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Clock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="time" className="w-full" style={{ paddingLeft: '2.5rem' }}
                    value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
                <div style={{
                  padding: '8px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.1)',
                  color: 'var(--accent-blue)', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap'
                }}>
                  {duration}m
                </div>
              </div>
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
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
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
            disabled={!title.trim() || !time || isFutureDate}
          >
            {initialData ? 'Update Task' : 'Create Task'}
          </button>

          {initialData && onDelete && (
            <button
              className="btn w-full"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '11px', fontWeight: 600 }}
              onClick={() => { onDelete(initialData.id); onClose(); }}
              disabled={isFutureDate}
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
