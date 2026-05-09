import React, { useState, useEffect } from 'react';
import { PlayCircle, CheckCircle, Clock, ChevronRight, XCircle } from 'lucide-react';

function getActiveTask(tasks) {
  if (!tasks || tasks.length === 0) return null;
  const now = new Date();
  
  for (const task of tasks) {
    if (task.status !== 'Pending') continue;
    if (!task.time || !task.duration) continue;
    
    const [h, m] = task.time.split(':').map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + parseInt(task.duration) * 60000);
    
    if (now >= start && now <= end) {
      return { task, start, end };
    }
  }
  return null;
}

export default function LiveFocusBanner({ tasks, onUpdateStatus }) {
  const [activeInfo, setActiveInfo] = useState(() => getActiveTask(tasks));
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      setActiveInfo(getActiveTask(tasks));
    }, 1000);
    return () => clearInterval(timer);
  }, [tasks]);

  if (!activeInfo) return null;

  const { task, start, end } = activeInfo;
  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = now.getTime() - start.getTime();
  const progressPct = Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100));
  const remainingMins = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 60000));

  return (
    <div className="live-focus-banner">
      <div className="lfb-bg-pulse" />
      <div className="lfb-content">
        <div className="lfb-left">
          <div className="lfb-icon-wrap">
            <PlayCircle size={28} className="lfb-icon" />
            <svg className="lfb-progress-ring" viewBox="0 0 44 44">
              <circle className="lfb-ring-bg" cx="22" cy="22" r="20" />
              <circle 
                className="lfb-ring-fill" 
                cx="22" cy="22" r="20" 
                strokeDasharray="125.6" 
                strokeDashoffset={125.6 - (progressPct / 100) * 125.6} 
              />
            </svg>
          </div>
          <div className="lfb-info">
            <div className="lfb-label">LIVE FOCUS • {remainingMins} MIN LEFT</div>
            <div className="lfb-title">{task.title}</div>
            <div className="lfb-meta">
              <span style={{ color: `var(--priority-${task.priority.toLowerCase()})`, fontWeight: 700 }}>
                {task.priority} Priority
              </span>
              <span className="lfb-dot">•</span>
              {task.category}
            </div>
          </div>
        </div>

        <div className="lfb-actions">
          <button 
            className="lfb-btn complete" 
            onClick={() => onUpdateStatus(task.id, 'Completed')}
            title="Mark Completed"
          >
            <CheckCircle size={18} />
          </button>
          <button 
            className="lfb-btn delay" 
            onClick={() => onUpdateStatus(task.id, 'Delayed')}
            title="Delay Task"
          >
            <Clock size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
