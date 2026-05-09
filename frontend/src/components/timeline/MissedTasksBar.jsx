import React, { useState } from 'react';
import { AlertCircle, Clock, CheckCircle, X, MessageSquare, ChevronDown } from 'lucide-react';

export default function MissedTasksBar({ tasks, onUpdateTaskStatus }) {
  const [missedOpen,  setMissedOpen]  = useState(false);
  const [delayedOpen, setDelayedOpen] = useState(false);
  const [reasons, setReasons] = useState({});

  const now = new Date();
  const currentHM = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

  const missedTasks = tasks
    .map((t, i) => ({ ...t, originalIndex: i }))
    .filter(t => {
      if (t.status === 'Missed') return true;
      if (t.status === 'Pending' && t.time < currentHM) return true;
      return false;
    });

  const delayedTasks = tasks
    .map((t, i) => ({ ...t, originalIndex: i }))
    .filter(t => t.status === 'Delayed');

  const handleAction = (originalIndex, status, taskId) => {
    onUpdateTaskStatus(originalIndex, status);
    setReasons(prev => ({ ...prev, [taskId]: '' }));
  };

  if (missedTasks.length === 0 && delayedTasks.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>

      {/* Missed bar */}
      {missedTasks.length > 0 && (
        <>
          <div className="alert-bar-v2 alert-bar-missed" onClick={() => setMissedOpen(o => !o)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={18} color="#ef4444" />
              <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.9rem' }}>
                {missedTasks.length} missed task{missedTasks.length > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: '#ef4444' }}>Review</span>
              <ChevronDown size={14} color="#ef4444" style={{ transition: 'transform 0.2s', transform: missedOpen ? 'rotate(180deg)' : 'none' }} />
            </div>
          </div>

          {missedOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4, animation: 'pageSlideIn 0.25s ease' }}>
              {missedTasks.map(t => (
                <TaskAlertCard
                  key={t.id}
                  task={t}
                  accentColor="#ef4444"
                  reason={reasons[t.id] || ''}
                  onReasonChange={r => setReasons(prev => ({ ...prev, [t.id]: r }))}
                  onComplete={() => handleAction(t.originalIndex, 'Completed', t.id)}
                  onMark={() => handleAction(t.originalIndex, 'Missed', t.id)}
                  markLabel="Mark Missed"
                  markIcon={<X size={13} />}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Delayed bar */}
      {delayedTasks.length > 0 && (
        <>
          <div className="alert-bar-v2 alert-bar-delayed" onClick={() => setDelayedOpen(o => !o)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={18} color="#f59e0b" />
              <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.9rem' }}>
                {delayedTasks.length} delayed task{delayedTasks.length > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: '#f59e0b' }}>Review</span>
              <ChevronDown size={14} color="#f59e0b" style={{ transition: 'transform 0.2s', transform: delayedOpen ? 'rotate(180deg)' : 'none' }} />
            </div>
          </div>

          {delayedOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4, animation: 'pageSlideIn 0.25s ease' }}>
              {delayedTasks.map(t => (
                <TaskAlertCard
                  key={t.id}
                  task={t}
                  accentColor="#f59e0b"
                  reason={reasons[t.id] || t.delayReason || ''}
                  onReasonChange={r => setReasons(prev => ({ ...prev, [t.id]: r }))}
                  onComplete={() => handleAction(t.originalIndex, 'Completed', t.id)}
                  onMark={() => handleAction(t.originalIndex, 'Missed', t.id)}
                  markLabel="Mark Missed"
                  markIcon={<X size={13} />}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Individual task alert card ────────────────────────────────────────────────
function TaskAlertCard({ task, accentColor, reason, onReasonChange, onComplete, onMark, markLabel, markIcon }) {
  const CATEGORY_COLORS = {
    Work:'#6366f1', Health:'#10b981', Personal:'#f59e0b',
    Learning:'#3b82f6', Finance:'#22c55e', Social:'#ec4899', Other:'#94a3b8'
  };
  const catColor = CATEGORY_COLORS[task.category] || CATEGORY_COLORS.Other;

  return (
    <div className="glass-card" style={{
      padding: '14px 16px',
      borderLeft: `4px solid ${accentColor}`,
      borderRadius: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div>
          <h4 style={{ margin: '0 0 4px', fontSize: '0.9rem', fontWeight: 700 }}>{task.title}</h4>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={11} /> Scheduled {task.time}
            </span>
            {task.category && (
              <span style={{
                fontSize: '0.68rem', fontWeight: 600, padding: '1px 7px', borderRadius: 20,
                background: `${catColor}20`, color: catColor, border: `1px solid ${catColor}30`
              }}>
                {task.category}
              </span>
            )}
            {task.priority && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'capitalize' }}>
                {task.priority} priority
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Delay/missed reason */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <MessageSquare size={12} color="var(--text-muted)" />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {task.delayReason ? 'Previous reason:' : 'Add a reason (optional)'}
          </span>
        </div>
        {task.delayReason && (
          <p style={{ margin: '0 0 4px', fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            "{task.delayReason}"
          </p>
        )}
        <textarea
          style={{ width: '100%', resize: 'none', minHeight: 52, fontSize: '0.82rem', padding: '8px 10px', borderRadius: 8 }}
          placeholder="Why wasn't this completed?"
          value={reason}
          onChange={e => onReasonChange(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn"
          style={{ flex: 1, padding: '8px', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.8rem', fontWeight: 700 }}
          onClick={onComplete}
        >
          <CheckCircle size={13} /> Completed Late
        </button>
        <button
          className="btn"
          style={{ flex: 1, padding: '8px', background: `rgba(239,68,68,0.1)`, color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.8rem', fontWeight: 700 }}
          onClick={onMark}
        >
          {markIcon} {markLabel}
        </button>
      </div>
    </div>
  );
}
