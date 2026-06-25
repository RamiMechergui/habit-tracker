import React, { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { AlertTriangle, Flame, SkipForward, TrendingDown, X, Lightbulb } from 'lucide-react';
import './SmartAlerts.css';

const PRIORITY_WEIGHTS = { low: 1, medium: 2, high: 3, critical: 4 };

function computeScore(tasks = []) {
  let earned = 0, total = 0, penalty = 0;
  for (const t of tasks) {
    const w = PRIORITY_WEIGHTS[t.priority] || 1;
    total += w;
    if (t.status === 'Completed') earned += w;
    if (t.status === 'Missed')    penalty += w;
  }
  if (total === 0) return null;
  return Math.max(0, Math.min(100, Math.round(((earned - penalty) / total) * 100)));
}

// ── Alert type definitions ────────────────────────────────────────────────────
function detectAlerts(date, tasks, logs, recurringTasks) {
  const alerts = [];

  // 1. Overloaded day — more than 5 critical/high tasks
  const heavyTasks = tasks.filter(t => t.priority === 'critical' || t.priority === 'high');
  const criticalCount = tasks.filter(t => t.priority === 'critical').length;
  if (criticalCount >= 3) {
    alerts.push({
      id:      'overloaded',
      type:    'warning',
      icon:    <Flame size={14} />,
      title:   'Overloaded Schedule',
      message: `${criticalCount} critical tasks today. Consider spreading them across the week to avoid burnout.`,
    });
  }

  // 2. Burnout risk — 4+ consecutive days with score < 30
  let burnoutDays = 0;
  for (let i = 1; i <= 7; i++) {
    const d = format(subDays(new Date(date + 'T12:00:00'), i), 'yyyy-MM-dd');
    const t = logs[d]?.tasks || [];
    if (t.length === 0) continue;
    const s = computeScore(t);
    if (s !== null && s < 30) burnoutDays++;
    else break;
  }
  if (burnoutDays >= 4) {
    alerts.push({
      id:      'burnout',
      type:    'danger',
      icon:    <TrendingDown size={14} />,
      title:   'Burnout Risk Detected',
      message: `Productivity has been below 30% for ${burnoutDays} consecutive days. Take a recovery day or reschedule tasks.`,
    });
  }

  // 3. Repeated skipped recurrences — recurring task missed 3+ times in last 7 days
  Object.values(recurringTasks || {}).forEach(def => {
    if (def.isDisabled) return;
    let skippedCount = 0;
    for (let i = 1; i <= 7; i++) {
      const d = format(subDays(new Date(date + 'T12:00:00'), i), 'yyyy-MM-dd');
      const t = (logs[d]?.tasks || []).find(x => x.recurringId === def.id);
      if (t && (t.status === 'Missed' || t.status === 'Skipped')) skippedCount++;
    }
    if (skippedCount >= 3) {
      alerts.push({
        id:      `skip_${def.id}`,
        type:    'info',
        icon:    <SkipForward size={14} />,
        title:   'Recurring Task Often Skipped',
        message: `"${def.title}" has been skipped ${skippedCount} times this week. Consider rescheduling or disabling it.`,
      });
    }
  });

  // 4. Productivity drop — today's score is >40 pts below 7-day average
  const recent7Scores = [];
  for (let i = 1; i <= 7; i++) {
    const d = format(subDays(new Date(date + 'T12:00:00'), i), 'yyyy-MM-dd');
    const s = computeScore(logs[d]?.tasks || []);
    if (s !== null) recent7Scores.push(s);
  }
  if (recent7Scores.length >= 3) {
    const avg = Math.round(recent7Scores.reduce((a, b) => a + b, 0) / recent7Scores.length);
    const todayScore = computeScore(tasks);
    if (todayScore !== null && avg - todayScore > 40) {
      alerts.push({
        id:      'drop',
        type:    'info',
        icon:    <TrendingDown size={14} />,
        title:   'Productivity Drop',
        message: `Today's score is significantly below your 7-day average (${avg}%). Check if tasks are realistically scoped.`,
      });
    }
  }

  // 5. Per-task recurrence streaks
  Object.entries(recurringTasks || {}).forEach(([defId, def]) => {
    if (def.isDisabled) return;
    let streakCount = 0;
    for (let i = 1; i <= 30; i++) {
      const d = format(subDays(new Date(date + 'T12:00:00'), i), 'yyyy-MM-dd');
      const t = (logs[d]?.tasks || []).find(x => x.recurringId === defId);
      if (t && t.status === 'Completed') streakCount++;
      else if (t && (t.status === 'Missed' || t.status === 'Skipped')) { streakCount = 0; break; }
      else if (!t) break;
    }
    if (streakCount >= 5) {
      alerts.push({
        id:      `streak_${defId}`,
        type:    'streak',
        icon:    <Flame size={14} />,
        title:   `${streakCount}-Day Streak`,
        message: `"${def.title}" — completed ${streakCount} days in a row! Keep it up!`,
      });
    }
  });

  // 6. Weekly digest
  if (tasks.length > 0) {
    let totalTasks = 0, totalDone = 0, totalMissed = 0, daysWithTasks = 0;
    for (let i = 0; i < 7; i++) {
      const d = format(subDays(new Date(date + 'T12:00:00'), i), 'yyyy-MM-dd');
      const t = logs[d]?.tasks || [];
      if (t.length > 0) daysWithTasks++;
      t.forEach(x => { totalTasks++; if (x.status === 'Completed') totalDone++; if (x.status === 'Missed') totalMissed++; });
    }
    const completionPct = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
    if (daysWithTasks >= 3) {
      alerts.push({
        id:      'weekly_digest',
        type:    'tip',
        icon:    <Lightbulb size={14} />,
        title:   'Weekly Digest',
        message: `${completionPct}% completion rate this week (${totalDone}/${totalTasks} tasks, ${totalMissed} missed across ${daysWithTasks} days).`,
      });
    }
  }

  // 7. Suggestion: best time slots (lightweight heuristic)
  if (tasks.length >= 3 && alerts.length === 0) {
    const morningCompleted = tasks.filter(t => {
      const h = parseInt((t.time || '00:00').split(':')[0]);
      return h >= 6 && h <= 11 && t.status === 'Completed';
    }).length;
    const totalCompleted = tasks.filter(t => t.status === 'Completed').length;
    if (morningCompleted / Math.max(totalCompleted, 1) >= 0.7) {
      alerts.push({
        id:      'morning_person',
        type:    'tip',
        icon:    <Lightbulb size={14} />,
        title:   'Morning Productivity Pattern',
        message: 'You complete most tasks in the morning. Schedule your high-priority work before noon for best results.',
      });
    }
  }

  return alerts;
}

const TYPE_META = {
  warning: { color: 'var(--priority-critical)',  bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)'  },
  danger:  { color: '#ef4444',                   bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)'   },
  info:    { color: 'var(--accent-blue)',         bg: 'rgba(59,130,246,0.07)', border: 'rgba(59,130,246,0.2)'  },
  tip:     { color: 'var(--priority-high)',       bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)'  },
  streak:  { color: '#f59e0b',                    bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)'  },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function SmartAlerts({ date, tasks, logs, recurringTasks }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      const raw = sessionStorage.getItem('smart_alerts_dismissed');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { sessionStorage.setItem('smart_alerts_dismissed', JSON.stringify(next)); } catch {}
  };

  const alerts = useMemo(
    () => detectAlerts(date, tasks, logs, recurringTasks),
    [date, tasks, logs, recurringTasks]
  );

  const visible = alerts.filter(a => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="smart-alerts-stack" role="region" aria-label="Smart alerts">
      {visible.map(alert => {
        const meta = TYPE_META[alert.type] || TYPE_META.info;
        return (
          <div
            key={alert.id}
            className="smart-alert-banner"
            style={{ '--alert-color': meta.color, '--alert-bg': meta.bg, '--alert-border': meta.border }}
            role="alert"
          >
            <span className="smart-alert-icon" aria-hidden="true">{alert.icon}</span>
            <div className="smart-alert-text">
              <strong className="smart-alert-title">{alert.title}</strong>
              <span className="smart-alert-message">{alert.message}</span>
            </div>
            <button
              className="smart-alert-dismiss"
              onClick={() => dismiss(alert.id)}
              aria-label={`Dismiss alert: ${alert.title}`}
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
