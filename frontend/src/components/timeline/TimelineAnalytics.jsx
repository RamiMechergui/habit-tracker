import React, { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { ChevronDown, BarChart2, Flame, Target } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const PRIORITY_WEIGHTS = { Low: 1, Medium: 2, High: 3, Critical: 4 };

function computeDayStats(tasks = []) {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const delayed   = tasks.filter(t => t.status === 'Delayed').length;
  const missed    = tasks.filter(t => t.status === 'Missed').length;
  const pending   = total - completed - delayed - missed;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  let totalWeight = 0;
  let earned = 0;
  let penalty = 0;

  for (const t of tasks) {
    const weight = PRIORITY_WEIGHTS[t.priority] || 1;
    totalWeight += weight;
    if (t.status === 'Completed') earned += weight;
    if (t.status === 'Missed') penalty += weight;
  }

  let productivityScore = 0;
  if (totalWeight > 0) {
    const raw = ((earned - penalty) / totalWeight) * 100;
    productivityScore = Math.max(0, Math.min(100, Math.round(raw)));
  }

  return { total, completed, delayed, missed, pending, pct, productivityScore };
}

// #13 — Fixed streak: only resets if tasks exist AND none were completed.
// A day with zero tasks is treated as a rest day (streak continues).
function computeStreak(logs, today) {
  let streak = 0;
  let d = today;
  for (let i = 0; i < 90; i++) {
    const tasks = logs[d]?.tasks || [];
    if (tasks.length > 0) {
      const completed = tasks.filter(t => t.status === 'Completed').length;
      if (completed === 0) break; // had tasks but completed none — streak ends
      streak++;
    }
    // tasks.length === 0 → rest day, do NOT break, just don't increment
    d = format(subDays(new Date(d + 'T12:00:00'), 1), 'yyyy-MM-dd');
  }
  return streak;
}

function computeWeekBars(logs, today) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(today + 'T12:00:00'), 6 - i), 'yyyy-MM-dd');
    const tasks = logs[d]?.tasks || [];
    const stats = computeDayStats(tasks);
    const isToday = d === today;
    return { d, pct: stats.productivityScore, total: stats.total, completed: stats.completed, day: days[new Date(d + 'T12:00:00').getDay()], isToday };
  });
}

// ── SVG Donut ─────────────────────────────────────────────────────────────────
function DonutChart({ pct, size = 64, color = 'var(--accent-blue)' }) {
  const r   = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--tl-chart-bg)" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ number, label, color }) {
  return (
    <div className="analytics-stat-card">
      <div className="analytics-stat-number" style={{ color }}>{number}</div>
      <div className="analytics-stat-label">{label}</div>
    </div>
  );
}

// #7 — Bar with tooltip ───────────────────────────────────────────────────────
function WeekBar({ bar }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="week-bar-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative' }}
    >
      {/* Tooltip */}
      {hovered && (
        <div className="week-bar-tooltip" role="tooltip">
          <span className="week-bar-tooltip-date">{format(new Date(bar.d + 'T12:00:00'), 'EEE, MMM d')}</span>
          {bar.total > 0 ? (
            <>
              <span className="week-bar-tooltip-stat">{bar.completed}/{bar.total} done</span>
              <span className="week-bar-tooltip-pct">{bar.pct}%</span>
            </>
          ) : (
            <span className="week-bar-tooltip-stat" style={{ opacity: 0.6 }}>No tasks</span>
          )}
        </div>
      )}
      <div
        className={`week-bar ${bar.isToday ? 'today' : ''}`}
        style={{ height: `${Math.max(4, bar.pct * 0.6)}px` }}
        aria-label={`${bar.d}: ${bar.total > 0 ? `${bar.completed}/${bar.total} done, ${bar.pct}%` : 'no tasks'}`}
      />
      <span className="week-bar-day">{bar.day}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TimelineAnalytics({ date, tasks, logs }) {
  // #4 — Open by default
  const [open, setOpen] = useState(true);

  const stats    = useMemo(() => computeDayStats(tasks), [tasks]);
  const streak   = useMemo(() => computeStreak(logs, date), [logs, date]);
  const weekBars = useMemo(() => computeWeekBars(logs, date), [logs, date]);

  const donutColor = stats.pct >= 80 ? 'var(--status-completed)'
                   : stats.pct >= 50 ? 'var(--priority-high)'
                   : 'var(--status-missed)';

  return (
    <div className="analytics-panel">
      {/* Header (always visible) */}
      <div
        className={`analytics-panel-header ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        aria-expanded={open}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
          <BarChart2 size={16} color="var(--accent-blue)" aria-hidden="true" />
          <span style={{ fontWeight: 700, fontSize: '0.88rem', whiteSpace: 'nowrap' }}>Daily Analytics</span>
          {streak > 0 && (
            <span className="analytics-streak-badge" aria-label={`${streak}-day streak`}>
              <Flame size={12} aria-hidden="true" /> {streak}d streak
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Mini inline summary — shown when collapsed */}
          {!open && stats.total > 0 && (
            <div
              className="mini-bar"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              aria-label={`${stats.completed} of ${stats.total} tasks done, ${stats.pct}%`}
            >
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {stats.completed}/{stats.total}
              </span>
              <div style={{ width: 48, height: 5, borderRadius: 3, background: 'var(--tl-chart-bg)', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{
                  width: `${stats.pct}%`, height: '100%', borderRadius: 3,
                  background: donutColor, transition: 'width 0.6s ease',
                }} />
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: donutColor, whiteSpace: 'nowrap' }}>{stats.pct}%</span>
            </div>
          )}
          <ChevronDown
            size={15}
            style={{ transition: 'transform 0.25s', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--text-muted)', flexShrink: 0 }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Body */}
      {open && (
        <>
          <div className="analytics-panel-body">
            {/* Donut */}
            <div className="analytics-stat-card" style={{ gridColumn: 'span 1', gridRow: 'span 2', justifyContent: 'center' }}>
              <div className="productivity-donut-wrap" style={{ position: 'relative' }}>
                <DonutChart pct={stats.productivityScore} color={donutColor} />
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  fontSize: '1rem', fontWeight: 800, color: donutColor,
                  textShadow: `0 0 10px ${donutColor}40`
                }}>
                  {stats.productivityScore}
                </div>
              </div>
              <div className="analytics-stat-label">Productivity Score</div>
            </div>

            <StatCard number={stats.total}     label="Total"     color="var(--text-primary)" />
            <StatCard number={stats.completed} label="Completed" color="var(--status-completed)" />
            <StatCard number={stats.delayed}   label="Delayed"   color="var(--status-delayed)" />
            <StatCard number={stats.missed}    label="Missed"    color="var(--status-missed)" />
          </div>

          {/* Weekly bar chart */}
          <div className="week-chart-wrap">
            <div className="week-chart-label">📊 Last 7 Days</div>
            <div className="week-bars">
              {weekBars.map(bar => (
                <WeekBar key={bar.d} bar={bar} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
