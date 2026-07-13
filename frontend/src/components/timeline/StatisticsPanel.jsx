import React, { useMemo, useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import {
  ChevronDown, BarChart2, Flame, Target, TrendingUp, TrendingDown,
  Calendar, Clock, Award, AlertCircle, CheckCircle2, X
} from 'lucide-react';
import './StatisticsPanel.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const PRIORITY_WEIGHTS = { low: 1, medium: 2, high: 3, critical: 4 };

const CAT_COLORS = {
  Work:     'var(--cat-work)',
  Health:   'var(--cat-health)',
  Personal: 'var(--cat-personal)',
  Learning: 'var(--cat-learning)',
  Finance:  'var(--cat-finance)',
  Social:   'var(--cat-social)',
  Other:    'var(--cat-other)',
};

function computeScore(tasks = []) {
  let earned = 0, total = 0, penalty = 0;
  for (const t of tasks) {
    const w = PRIORITY_WEIGHTS[t.priority] || 1;
    total += w;
    if (t.status === 'Completed') earned += w;
    if (t.status === 'Missed')    penalty += w;
  }
  if (total === 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((earned - penalty) / total) * 100)));
}

function computeMonthlyStats(logs, viewDate) {
  const start = startOfMonth(viewDate);
  const end   = endOfMonth(viewDate);
  const days  = eachDayOfInterval({ start, end });

  let totalTasks = 0, completedTasks = 0, missedTasks = 0, delayedTasks = 0;
  let criticalUnfinished = 0, totalDurationMins = 0;
  const catMap = {};
  const dayScores = [];

  days.forEach(day => {
    const ds = format(day, 'yyyy-MM-dd');
    const tasks = logs[ds]?.tasks || [];
    if (tasks.length === 0) return;

    totalTasks    += tasks.length;
    completedTasks+= tasks.filter(t => t.status === 'Completed').length;
    missedTasks   += tasks.filter(t => t.status === 'Missed').length;
    delayedTasks  += tasks.filter(t => t.status === 'Delayed').length;
    criticalUnfinished += tasks.filter(t => t.priority === 'critical' && t.status !== 'Completed').length;

    tasks.forEach(t => {
      const mins = parseInt(t.duration) || 0;
      totalDurationMins += mins;
      const cats = Array.isArray(t.categories) ? t.categories : [t.category || 'Other'];
      cats.forEach(c => { catMap[c] = (catMap[c] || 0) + mins; });
    });

    dayScores.push({ date: ds, score: computeScore(tasks), total: tasks.length });
  });

  const daysWithTasks = dayScores.length;
  const avgScore = daysWithTasks > 0
    ? Math.round(dayScores.reduce((a, b) => a + b.score, 0) / daysWithTasks)
    : 0;

  const bestDay = dayScores.sort((a, b) => b.score - a.score)[0] || null;

  // Most delayed category
  const delayedByCategory = {};
  days.forEach(day => {
    const ds = format(day, 'yyyy-MM-dd');
    (logs[ds]?.tasks || []).filter(t => t.status === 'Delayed').forEach(t => {
      const cats = Array.isArray(t.categories) ? t.categories : [t.category || 'Other'];
      cats.forEach(c => { delayedByCategory[c] = (delayedByCategory[c] || 0) + 1; });
    });
  });
  const mostDelayedCat = Object.entries(delayedByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    totalTasks, completedTasks, missedTasks, delayedTasks,
    criticalUnfinished, totalDurationMins, avgScore, bestDay,
    mostDelayedCat, catMap,
    completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
  };
}

// ── Mini sparkline ────────────────────────────────────────────────────────────
function SparkBar({ val, max, color }) {
  const h = max > 0 ? Math.max(4, (val / max) * 40) : 4;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ width: 8, height: 40, display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ width: '100%', height: h, background: color, borderRadius: '2px 2px 0 0', transition: 'height 0.4s ease' }} />
      </div>
    </div>
  );
}

// ── Category time bar ─────────────────────────────────────────────────────────
function CategoryBar({ name, mins, maxMins }) {
  const pct = maxMins > 0 ? (mins / maxMins) * 100 : 0;
  const color = CAT_COLORS[name] || 'var(--accent-blue)';
  const hours = Math.floor(mins / 60);
  const m     = mins % 60;
  return (
    <div className="stats-cat-row">
      <span className="stats-cat-name" style={{ color }}>{name}</span>
      <div className="stats-cat-bar-track">
        <div className="stats-cat-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="stats-cat-time">{hours > 0 ? `${hours}h ` : ''}{m > 0 ? `${m}m` : hours > 0 ? '' : '0m'}</span>
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ icon, label, value, sub, color = 'var(--text-primary)', accent }) {
  return (
    <div className="stats-tile" style={accent ? { borderColor: accent, background: `color-mix(in srgb, ${accent} 6%, var(--bg-card))` } : {}}>
      <div className="stats-tile-icon" style={{ color: color }}>{icon}</div>
      <div className="stats-tile-value" style={{ color }}>{value}</div>
      <div className="stats-tile-label">{label}</div>
      {sub && <div className="stats-tile-sub">{sub}</div>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StatisticsPanel({ open, onClose, logs, viewDate }) {
  const [activeTab, setActiveTab] = useState('overview');

  const stats = useMemo(() => computeMonthlyStats(logs, viewDate), [logs, viewDate]);

  // Weekly comparison: this week vs last week total completed
  const thisWeekCompleted = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      count += (logs[d]?.tasks || []).filter(t => t.status === 'Completed').length;
    }
    return count;
  }, [logs]);

  const lastWeekCompleted = useMemo(() => {
    let count = 0;
    for (let i = 7; i < 14; i++) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      count += (logs[d]?.tasks || []).filter(t => t.status === 'Completed').length;
    }
    return count;
  }, [logs]);

  const weeklyDelta = thisWeekCompleted - lastWeekCompleted;

  const catEntries = Object.entries(stats.catMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCatMins = catEntries[0]?.[1] || 1;

  const totalHours = Math.floor(stats.totalDurationMins / 60);
  const totalMinsRem = stats.totalDurationMins % 60;

  if (!open) return null;

  return (
    <>
      <div className="stats-panel-backdrop" onClick={onClose} />
      <div className="stats-panel" role="dialog" aria-label="Monthly Statistics" aria-modal="true">
        {/* Header */}
        <div className="stats-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={18} color="var(--accent-blue)" />
            <h2 className="stats-panel-title">Monthly Analytics</h2>
            <span className="stats-panel-month">{format(viewDate, 'MMMM yyyy')}</span>
          </div>
          <button className="stats-panel-close" onClick={onClose} aria-label="Close statistics panel">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="stats-tabs">
          {[['overview','Overview'],['categories','Categories'],['weekly','Weekly']].map(([k,l]) => (
            <button key={k} className={`stats-tab ${activeTab === k ? 'active' : ''}`} onClick={() => setActiveTab(k)}>{l}</button>
          ))}
        </div>

        {/* Body */}
        <div className="stats-panel-body evolvia-scrollbar">

          {activeTab === 'overview' && (
            <div className="stats-overview-grid">
              <StatTile
                icon={<CheckCircle2 size={18} />}
                label="Completed"
                value={stats.completedTasks}
                sub={`of ${stats.totalTasks} total`}
                color="var(--status-completed)"
                accent="var(--status-completed)"
              />
              <StatTile
                icon={<Target size={18} />}
                label="Completion Rate"
                value={`${stats.completionRate}%`}
                color={stats.completionRate >= 70 ? 'var(--status-completed)' : stats.completionRate >= 40 ? 'var(--priority-high)' : 'var(--status-missed)'}
              />
              <StatTile
                icon={<Flame size={18} />}
                label="Avg Daily Score"
                value={`${stats.avgScore}`}
                sub="productivity"
                color="var(--accent-blue)"
              />
              <StatTile
                icon={<AlertCircle size={18} />}
                label="Critical Unfinished"
                value={stats.criticalUnfinished}
                color={stats.criticalUnfinished > 0 ? 'var(--priority-critical)' : 'var(--text-muted)'}
                accent={stats.criticalUnfinished > 0 ? 'var(--priority-critical)' : undefined}
              />
              <StatTile
                icon={<Clock size={18} />}
                label="Time Logged"
                value={`${totalHours}h ${totalMinsRem}m`}
                color="var(--text-primary)"
              />
              <StatTile
                icon={<TrendingDown size={18} />}
                label="Most Delayed"
                value={stats.mostDelayedCat || '—'}
                color="var(--status-delayed)"
              />

              {/* Weekly comparison */}
              <div className="stats-weekly-compare">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Calendar size={15} color="var(--text-muted)" />
                  <span className="stats-weekly-label">This Week vs Last Week</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <span className="stats-weekly-num">{thisWeekCompleted}</span>
                  <span className={`stats-weekly-delta ${weeklyDelta >= 0 ? 'positive' : 'negative'}`}>
                    {weeklyDelta >= 0
                      ? <><TrendingUp size={12} /> +{weeklyDelta}</>
                      : <><TrendingDown size={12} /> {weeklyDelta}</>
                    }
                  </span>
                  <span className="stats-weekly-last">vs {lastWeekCompleted} last week</span>
                </div>
              </div>

              {/* Best day */}
              {stats.bestDay && (
                <div className="stats-best-day">
                  <Award size={14} color="var(--priority-high)" />
                  <span>Best day: <strong>{format(new Date(stats.bestDay.date + 'T12:00:00'), 'EEE, MMM d')}</strong> — {stats.bestDay.score}% productivity</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="stats-categories-section">
              <p className="stats-section-hint">Time distribution across task categories this month</p>
              {catEntries.length === 0
                ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No category data yet for this month.</p>
                : catEntries.map(([name, mins]) => (
                    <CategoryBar key={name} name={name} mins={mins} maxMins={maxCatMins} />
                  ))
              }
            </div>
          )}

          {activeTab === 'weekly' && (
            <WeeklyTrend logs={logs} />
          )}
        </div>
      </div>
    </>
  );
}

// ── Weekly Trend (last 4 weeks) ───────────────────────────────────────────────
function WeeklyTrend({ logs }) {
  const weeks = useMemo(() => {
    return Array.from({ length: 4 }, (_, wi) => {
      const days = Array.from({ length: 7 }, (_, di) => {
        const d = format(subDays(new Date(), wi * 7 + di), 'yyyy-MM-dd');
        const tasks = logs[d]?.tasks || [];
        return { date: d, score: tasks.length > 0 ? computeScore(tasks) : null };
      }).reverse();
      const validScores = days.filter(d => d.score !== null).map(d => d.score);
      const avg = validScores.length > 0
        ? Math.round(validScores.reduce((a,b) => a+b, 0) / validScores.length)
        : 0;
      const label = wi === 0 ? 'This week' : wi === 1 ? 'Last week' : `${wi} weeks ago`;
      return { days, avg, label };
    }).reverse();
  }, [logs]);

  const maxAvg = Math.max(...weeks.map(w => w.avg), 1);

  return (
    <div className="stats-weekly-section">
      <p className="stats-section-hint">Average productivity score per week (last 4 weeks)</p>
      {weeks.map((week, i) => (
        <div key={i} className="stats-week-row">
          <span className="stats-week-label">{week.label}</span>
          <div className="stats-week-bar-track">
            <div
              className="stats-week-bar-fill"
              style={{
                width: `${(week.avg / maxAvg) * 100}%`,
                background: week.avg >= 70 ? 'var(--status-completed)'
                           : week.avg >= 40 ? 'var(--priority-high)'
                           : 'var(--status-missed)',
              }}
            />
          </div>
          <span className="stats-week-pct">{week.avg}%</span>
        </div>
      ))}
    </div>
  );
}
