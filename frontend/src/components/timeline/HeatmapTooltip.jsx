import React from 'react';
import { format } from 'date-fns';
import { Flame, Clock, Target, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';

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

const PRIORITY_ICONS = { low: '▾', medium: '◆', high: '▲', critical: '🔥' };
const PRIORITY_COLORS = {
  low:      'var(--priority-low)',
  medium:   'var(--priority-medium)',
  high:     'var(--priority-high)',
  critical: 'var(--priority-critical)',
};
const STATUS_COLORS = {
  Completed: 'var(--status-completed)',
  Missed:    'var(--status-missed)',
  Delayed:   'var(--status-delayed)',
  Pending:   'var(--text-muted)',
};

// ── Mini donut ring ───────────────────────────────────────────────────────────
function MiniDonut({ pct = 0, size = 36 }) {
  const r    = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  const color = pct >= 80 ? 'var(--status-completed)'
              : pct >= 50 ? 'var(--priority-high)'
              : 'var(--status-missed)';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--tl-chart-bg)" strokeWidth={5} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

// ── Tooltip Component ─────────────────────────────────────────────────────────
export default function HeatmapTooltip({ dateStr, tasks = [], position = 'above' }) {
  if (!dateStr) return null;

  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const missed    = tasks.filter(t => t.status === 'Missed').length;
  const delayed   = tasks.filter(t => t.status === 'Delayed').length;
  const critical  = tasks.filter(t => t.priority === 'critical').length;
  const high      = tasks.filter(t => t.priority === 'high').length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
  const score     = computeScore(tasks);
  const timeMins  = tasks.reduce((acc, t) => acc + (parseInt(t.duration) || 0), 0);
  const timeHours = Math.floor(timeMins / 60);
  const timeMinsR = timeMins % 60;
  const previewTasks = tasks.slice(0, 4);

  const formattedDate = (() => {
    try { return format(new Date(dateStr + 'T12:00:00'), 'EEEE, MMMM d'); }
    catch { return dateStr; }
  })();

  return (
    <div className={`heatmap-tooltip heatmap-tooltip--${position}`} role="tooltip">
      {/* Date header */}
      <div className="ht-header">
        <span className="ht-date">{formattedDate}</span>
        {score !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MiniDonut pct={score} size={30} />
            <span className="ht-score">{score}</span>
          </div>
        )}
      </div>

      {total === 0 ? (
        <p className="ht-empty">No tasks recorded</p>
      ) : (
        <>
          {/* Completion */}
          <div className="ht-stat-row">
            <CheckCircle2 size={11} color="var(--status-completed)" />
            <span>{completed} / {total} completed</span>
            <span className="ht-pct">{pct}%</span>
          </div>

          {/* Time spent */}
          {timeMins > 0 && (
            <div className="ht-stat-row">
              <Clock size={11} color="var(--accent-blue)" />
              <span>Time: {timeHours > 0 ? `${timeHours}h ` : ''}{timeMinsR > 0 ? `${timeMinsR}m` : ''}</span>
            </div>
          )}

          {/* Priority breakdown */}
          {(critical > 0 || high > 0) && (
            <div className="ht-priority-row">
              {critical > 0 && (
                <span className="ht-priority-chip" style={{ color: PRIORITY_COLORS.critical }}>
                  🔥 {critical} critical
                </span>
              )}
              {high > 0 && (
                <span className="ht-priority-chip" style={{ color: PRIORITY_COLORS.high }}>
                  ▲ {high} high
                </span>
              )}
              {missed > 0 && (
                <span className="ht-priority-chip" style={{ color: STATUS_COLORS.Missed }}>
                  ✗ {missed} missed
                </span>
              )}
              {delayed > 0 && (
                <span className="ht-priority-chip" style={{ color: STATUS_COLORS.Delayed }}>
                  ⏩ {delayed} delayed
                </span>
              )}
            </div>
          )}

          {/* Task preview */}
          <div className="ht-divider" />
          <div className="ht-task-list">
            {previewTasks.map((t, i) => (
              <div key={t.id || i} className="ht-task-item">
                <span
                  className="ht-task-dot"
                  style={{ background: STATUS_COLORS[t.status] || STATUS_COLORS.Pending }}
                />
                <span className="ht-task-title" title={t.title}>
                  {PRIORITY_ICONS[t.priority] || ''} {t.title}
                </span>
              </div>
            ))}
            {tasks.length > 4 && (
              <span className="ht-task-more">+{tasks.length - 4} more</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
