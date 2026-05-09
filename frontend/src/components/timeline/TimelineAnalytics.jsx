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

function computeStreak(logs, today) {
  let streak = 0;
  let d = today;
  for (let i = 0; i < 60; i++) {
    const tasks = logs[d]?.tasks || [];
    if (tasks.length === 0) break;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    if (completed === 0) break;
    streak++;
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
    return { d, pct: stats.productivityScore, day: days[new Date(d + 'T12:00:00').getDay()], isToday };
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function TimelineAnalytics({ date, tasks, logs }) {
  const [open, setOpen] = useState(false);

  const stats  = useMemo(() => computeDayStats(tasks), [tasks]);
  const streak = useMemo(() => computeStreak(logs, date), [logs, date]);
  const weekBars = useMemo(() => computeWeekBars(logs, date), [logs, date]);

  const donutColor = stats.pct >= 80 ? 'var(--status-completed)'
                   : stats.pct >= 50 ? 'var(--priority-high)'
                   : 'var(--status-missed)';

  return (
    <div className="analytics-panel">
      {/* Header (always visible) */}
      <div className={`analytics-panel-header ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BarChart2 size={17} color="var(--accent-blue)" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Daily Analytics</span>
          {streak > 0 && (
            <span className="analytics-streak-badge">
              <Flame size={13} /> {streak}-day streak
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Mini inline summary */}
          {!open && stats.total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {stats.completed}/{stats.total} done
              </span>
              <div style={{ width: 60, height: 6, borderRadius: 3, background: 'var(--tl-chart-bg)', overflow: 'hidden' }}>
                <div style={{
                  width: `${stats.pct}%`, height: '100%', borderRadius: 3,
                  background: donutColor, transition: 'width 0.6s ease'
                }} />
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: donutColor }}>{stats.pct}%</span>
            </div>
          )}
          <ChevronDown size={16} style={{ transition: 'transform 0.25s', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--text-muted)' }} />
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
                <div key={bar.d} className="week-bar-col">
                  <div
                    className={`week-bar ${bar.isToday ? 'today' : ''}`}
                    style={{ height: `${Math.max(4, bar.pct * 0.6)}px` }}
                    title={`${bar.d}: ${bar.pct}%`}
                  />
                  <span className="week-bar-day">{bar.day}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
