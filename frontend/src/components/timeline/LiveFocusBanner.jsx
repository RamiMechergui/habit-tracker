import React, { useState, useEffect } from 'react';
import { PlayCircle, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import './LiveFocusBanner.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getActiveTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];

  const now = new Date();
  const active = [];

  for (const task of tasks) {
    if (task.status !== 'Pending' || !task.time || !task.duration) continue;

    const [h, m] = task.time.split(':').map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + parseInt(task.duration) * 60_000);

    if (now >= start && now <= end) active.push({ task, start, end });
  }

  return active;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LiveFocusBanner({ tasks, onUpdateStatus }) {
  const [activeList, setActiveList] = useState(() => getActiveTasks(tasks));
  const [now,        setNow]        = useState(new Date());
  const [activeIdx,  setActiveIdx]  = useState(0);   // which active task is shown

  useEffect(() => {
    const timer = setInterval(() => {
      const next = new Date();
      setNow(next);
      setActiveList(getActiveTasks(tasks));
    }, 1000);
    return () => clearInterval(timer);
  }, [tasks]);

  // Keep index in bounds when list changes
  useEffect(() => {
    setActiveIdx(i => Math.min(i, Math.max(0, activeList.length - 1)));
  }, [activeList.length]);

  if (activeList.length === 0) return null;

  const { task, start, end } = activeList[activeIdx] ?? activeList[0];
  const totalMs       = end - start;
  const elapsedMs     = now - start;
  const progressPct   = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
  const remainingMins = Math.max(0, Math.ceil((end - now) / 60_000));
  const count         = activeList.length;

  const handleComplete = () => onUpdateStatus(task.id, 'Completed');
  const handleDelay    = () => onUpdateStatus(task.id, 'Delayed');

  const prevTask = () => setActiveIdx(i => (i - 1 + count) % count);
  const nextTask = () => setActiveIdx(i => (i + 1) % count);

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
              {count > 1 && (
                <span className="lfb-multi-badge" aria-label={`Task ${activeIdx + 1} of ${count} active tasks`}>
                  {' '}· {activeIdx + 1}/{count}
                </span>
              )}
            </span>
            <h3 className="lfb-title">{task.title}</h3>
            <div className="lfb-meta">
              <span className="lfb-priority">{task.priority} Priority</span>
              <span className="lfb-dot" aria-hidden="true">•</span>
              <span>{(Array.isArray(task.categories) ? task.categories : [task.category].filter(Boolean)).join(', ')}</span>
            </div>
          </div>
        </div>

        {/* Right: multi-nav + actions */}
        <div className="lfb-right">
          {/* Navigation arrows when multiple tasks overlap */}
          {count > 1 && (
            <div className="lfb-nav" aria-label="Navigate active tasks">
              <button
                className="lfb-nav-btn"
                onClick={prevTask}
                aria-label="Previous active task"
                title="Previous active task"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                className="lfb-nav-btn"
                onClick={nextTask}
                aria-label="Next active task"
                title="Next active task"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}

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
    </div>
  );
}
