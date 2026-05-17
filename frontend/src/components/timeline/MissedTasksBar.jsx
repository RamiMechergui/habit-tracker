import React, { useState, useCallback } from 'react';
import { AlertCircle, Clock, CheckCircle, X, MessageSquare, ChevronDown } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  Work:     'var(--cat-work)',
  Health:   'var(--cat-health)',
  Personal: 'var(--cat-personal)',
  Learning: 'var(--cat-learning)',
  Finance:  'var(--cat-finance)',
  Social:   'var(--cat-social)',
  Other:    'var(--cat-other)',
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function MissedTasksBar({ tasks, onUpdateTaskStatus }) {
  const [missedOpen,  setMissedOpen]  = useState(false);
  const [delayedOpen, setDelayedOpen] = useState(false);
  const [reasons, setReasons] = useState({});

  const now      = new Date();
  const currentHM = now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const missedTasks = tasks
    .map((t, i) => ({ ...t, originalIndex: i }))
    .filter(t => t.status === 'Missed' || (t.status === 'Pending' && t.time < currentHM));

  const delayedTasks = tasks
    .map((t, i) => ({ ...t, originalIndex: i }))
    .filter(t => t.status === 'Delayed');

  const handleAction = useCallback((originalIndex, status, taskId) => {
    onUpdateTaskStatus(originalIndex, status);
    setReasons(prev => ({ ...prev, [taskId]: '' }));
  }, [onUpdateTaskStatus]);

  const setReason = useCallback((id, value) => {
    setReasons(prev => ({ ...prev, [id]: value }));
  }, []);

  if (missedTasks.length === 0 && delayedTasks.length === 0) return null;

  return (
    <div className="alert-bars-wrap">
      {/* ── Missed bar ── */}
      {missedTasks.length > 0 && (
        <div className="alert-bar-group">
          <button
            className="alert-bar-v2 alert-bar-missed"
            onClick={() => setMissedOpen(o => !o)}
            aria-expanded={missedOpen}
          >
            <div className="alert-bar-left">
              <AlertCircle size={18} aria-hidden="true" />
              <span className="alert-bar-title">
                {missedTasks.length} missed task{missedTasks.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="alert-bar-right">
              <span className="alert-bar-action">Review</span>
              <ChevronDown
                size={14}
                className={`alert-bar-chevron ${missedOpen ? 'open' : ''}`}
                aria-hidden="true"
              />
            </div>
          </button>

          {missedOpen && (
            <div className="alert-card-list">
              {missedTasks.map(t => (
                <TaskAlertCard
                  key={t.id}
                  task={t}
                  variant="missed"
                  reason={reasons[t.id] ?? ''}
                  onReasonChange={r => setReason(t.id, r)}
                  onComplete={() => handleAction(t.originalIndex, 'Completed', t.id)}
                  onMark={() => handleAction(t.originalIndex, 'Missed', t.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Delayed bar ── */}
      {delayedTasks.length > 0 && (
        <div className="alert-bar-group">
          <button
            className="alert-bar-v2 alert-bar-delayed"
            onClick={() => setDelayedOpen(o => !o)}
            aria-expanded={delayedOpen}
          >
            <div className="alert-bar-left">
              <Clock size={18} aria-hidden="true" />
              <span className="alert-bar-title">
                {delayedTasks.length} delayed task{delayedTasks.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="alert-bar-right">
              <span className="alert-bar-action">Review</span>
              <ChevronDown
                size={14}
                className={`alert-bar-chevron ${delayedOpen ? 'open' : ''}`}
                aria-hidden="true"
              />
            </div>
          </button>

          {delayedOpen && (
            <div className="alert-card-list">
              {delayedTasks.map(t => (
                <TaskAlertCard
                  key={t.id}
                  task={t}
                  variant="delayed"
                  reason={reasons[t.id] ?? t.delayReason ?? ''}
                  onReasonChange={r => setReason(t.id, r)}
                  onComplete={() => handleAction(t.originalIndex, 'Completed', t.id)}
                  onMark={() => handleAction(t.originalIndex, 'Missed', t.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Task Alert Card ───────────────────────────────────────────────────────────
function TaskAlertCard({ task, variant, reason, onReasonChange, onComplete, onMark }) {
  const catColor = CATEGORY_COLORS[task.category] ?? CATEGORY_COLORS.Other;

  return (
    <div className={`task-alert-card task-alert-card--${variant}`}>
      {/* Header */}
      <div className="task-alert-header">
        <h4 className="task-alert-title">{task.title}</h4>
        <div className="task-alert-meta">
          <span className="task-alert-time">
            <Clock size={11} aria-hidden="true" />
            {task.time}{task.duration ? ` · ${task.duration}m` : ''}
          </span>
          {task.category && (
            <span
              className="task-alert-category"
              style={{
                background: `color-mix(in srgb, ${catColor} 15%, transparent)`,
                color:      catColor,
                border:     `1px solid color-mix(in srgb, ${catColor} 30%, transparent)`,
              }}
            >
              {task.category}
            </span>
          )}
          {task.priority && (
            <span className="task-alert-priority">
              {task.priority} priority
            </span>
          )}
        </div>
      </div>

      {/* Reason textarea */}
      <div className="task-alert-reason">
        <div className="task-alert-reason-label">
          <MessageSquare size={12} aria-hidden="true" />
          <span>{task.delayReason ? 'Previous reason:' : 'Add a reason (optional)'}</span>
        </div>
        {task.delayReason && (
          <p className="task-alert-prev-reason">"{task.delayReason}"</p>
        )}
        <textarea
          className="w-full task-alert-textarea"
          placeholder="Why wasn't this completed?"
          value={reason}
          onChange={e => onReasonChange(e.target.value)}
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="task-alert-actions">
        <button
          className="btn task-alert-btn task-alert-btn--complete"
          onClick={onComplete}
          aria-label="Mark as completed late"
        >
          <CheckCircle size={13} aria-hidden="true" />
          Completed Late
        </button>
        <button
          className="btn task-alert-btn task-alert-btn--miss"
          onClick={onMark}
          aria-label="Mark as missed"
        >
          <X size={13} aria-hidden="true" />
          Mark Missed
        </button>
      </div>
    </div>
  );
}
