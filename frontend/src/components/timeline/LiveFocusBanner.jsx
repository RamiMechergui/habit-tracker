import React, { useState, useEffect } from 'react';
import { PlayCircle, CheckCircle, Clock } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getActiveTask(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;

  const now = new Date();

  for (const task of tasks) {
    if (task.status !== 'Pending' || !task.time || !task.duration) continue;

    const [h, m] = task.time.split(':').map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + parseInt(task.duration) * 60_000);

    if (now >= start && now <= end) return { task, start, end };
  }

  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LiveFocusBanner({ tasks, onUpdateStatus }) {
  const [activeInfo, setActiveInfo] = useState(() => getActiveTask(tasks));
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      const next = new Date();
      setNow(next);
      setActiveInfo(getActiveTask(tasks));
    }, 1000);
    return () => clearInterval(timer);
  }, [tasks]);

  if (!activeInfo) return null;

  const { task, start, end } = activeInfo;
  const totalMs       = end - start;
  const elapsedMs     = now - start;
  const progressPct   = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
  const remainingMins = Math.max(0, Math.ceil((end - now) / 60_000));

  const handleComplete = () => onUpdateStatus(task.id, 'Completed');
  const handleDelay    = () => onUpdateStatus(task.id, 'Delayed');

  return (
    <div className="live-focus-banner">
      <div className="lfb-bg-pulse" />

      <div className="lfb-content">
        {/* Left: icon + info */}
        <div className="lfb-left">
          <div className="lfb-icon-wrap">
            <PlayCircle size={26} className="lfb-icon" aria-hidden="true" />
            <svg className="lfb-progress-ring" viewBox="0 0 44 44" aria-hidden="true">
              <circle className="lfb-ring-bg"   cx="22" cy="22" r="20" />
              <circle
                className="lfb-ring-fill"
                cx="22" cy="22" r="20"
                strokeDasharray="125.6"
                strokeDashoffset={125.6 - (progressPct / 100) * 125.6}
              />
            </svg>
          </div>

          <div className="lfb-info">
            <span className="lfb-label">
              LIVE FOCUS · {remainingMins} MIN LEFT
            </span>
            <h3 className="lfb-title">{task.title}</h3>
            <div className="lfb-meta">
              <span className="lfb-priority">{task.priority} Priority</span>
              <span className="lfb-dot" aria-hidden="true">•</span>
              <span>{task.category}</span>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="lfb-actions">
          <button
            className="lfb-btn lfb-btn--complete"
            onClick={handleComplete}
            title="Mark Completed"
            aria-label="Mark task as completed"
          >
            <CheckCircle size={18} />
          </button>
          <button
            className="lfb-btn lfb-btn--delay"
            onClick={handleDelay}
            title="Delay Task"
            aria-label="Delay task"
          >
            <Clock size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
