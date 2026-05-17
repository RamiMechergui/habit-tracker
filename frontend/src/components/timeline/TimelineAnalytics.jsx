import React, { useMemo, useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ChevronDown, BarChart2, Flame, Target, Award, TrendingUp } from 'lucide-react';

const PRIORITY_WEIGHTS = { low: 1, medium: 2, high: 3, critical: 4 };
const CAT_COLORS = { Work:'var(--cat-work)', Health:'var(--cat-health)', Personal:'var(--cat-personal)', Learning:'var(--cat-learning)', Finance:'var(--cat-finance)', Social:'var(--cat-social)', Other:'var(--cat-other)' };

function computeDayStats(tasks = []) {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const delayed   = tasks.filter(t => t.status === 'Delayed').length;
  const missed    = tasks.filter(t => t.status === 'Missed').length;
  const pending   = total - completed - delayed - missed;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
  let totalWeight = 0, earned = 0, penalty = 0;
  for (const t of tasks) {
    const weight = PRIORITY_WEIGHTS[t.priority] || 1;
    totalWeight += weight;
    if (t.status === 'Completed') earned  += weight;
    if (t.status === 'Missed')    penalty += weight;
  }
  const productivityScore = totalWeight > 0
    ? Math.max(0, Math.min(100, Math.round(((earned - penalty) / totalWeight) * 100)))
    : 0;
  return { total, completed, delayed, missed, pending, pct, productivityScore };
}

function computeStreak(logs, today) {
  let streak = 0;
  let d = today;
  for (let i = 0; i < 90; i++) {
    const tasks = logs[d]?.tasks || [];
    if (tasks.length > 0) {
      const completed = tasks.filter(t => t.status === 'Completed').length;
      if (completed === 0) break;
      streak++;
    }
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

function computeMonthlyStats(logs, date) {
  const viewDate = new Date(date + 'T12:00:00');
  const days = eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) });
  let totalTasks = 0, completedTasks = 0, criticalUnfinished = 0;
  const catMins = {};
  const dayScores = [];
  days.forEach(day => {
    const ds = format(day, 'yyyy-MM-dd');
    const tasks = logs[ds]?.tasks || [];
    if (!tasks.length) return;
    totalTasks     += tasks.length;
    completedTasks += tasks.filter(t => t.status === 'Completed').length;
    criticalUnfinished += tasks.filter(t => t.priority === 'critical' && t.status !== 'Completed').length;
    tasks.forEach(t => { const cat = t.category || 'Other'; catMins[cat] = (catMins[cat]||0) + (parseInt(t.duration)||0); });
    dayScores.push(computeDayStats(tasks).productivityScore);
  });
  const avgScore = dayScores.length ? Math.round(dayScores.reduce((a,b)=>a+b,0)/dayScores.length) : 0;
  const topCat = Object.entries(catMins).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) : 0;
  return { totalTasks, completedTasks, criticalUnfinished, avgScore, topCat, completionRate, catMins };
}

function detectBurnout(logs, today) {
  let streak = 0;
  for (let i = 1; i <= 7; i++) {
    const d = format(subDays(new Date(today + 'T12:00:00'), i), 'yyyy-MM-dd');
    const t = logs[d]?.tasks || [];
    if (t.length === 0) continue;
    if (computeDayStats(t).productivityScore < 25) streak++;
    else break;
  }
  return streak;
}

function DonutChart({ pct, size = 64, color = 'var(--accent-blue)' }) {
  const r    = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--tl-chart-bg)" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }} />
    </svg>
  );
}

function StatCard({ number, label, color }) {
  return (
    <div className="analytics-stat-card">
      <div className="analytics-stat-number" style={{ color }}>{number}</div>
      <div className="analytics-stat-label">{label}</div>
    </div>
  );
}

function WeekBar({ bar }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="week-bar-col" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ position: 'relative' }}>
      {hovered && (
        <div className="week-bar-tooltip" role="tooltip">
          <span className="week-bar-tooltip-date">{format(new Date(bar.d + 'T12:00:00'), 'EEE, MMM d')}</span>
          {bar.total > 0
            ? <><span className="week-bar-tooltip-stat">{bar.completed}/{bar.total} done</span><span className="week-bar-tooltip-pct">{bar.pct}%</span></>
            : <span className="week-bar-tooltip-stat" style={{ opacity:0.6 }}>No tasks</span>
          }
        </div>
      )}
      <div className={`week-bar ${bar.isToday ? 'today' : ''}`} style={{ height: `${Math.max(4, bar.pct * 0.6)}px` }}
        aria-label={`${bar.d}: ${bar.total > 0 ? `${bar.completed}/${bar.total} done, ${bar.pct}%` : 'no tasks'}`} />
      <span className="week-bar-day">{bar.day}</span>
    </div>
  );
}

// ── Mini category chart ───────────────────────────────────────────────────────
function CatMiniBar({ name, mins, maxMins }) {
  const pct = maxMins > 0 ? (mins / maxMins) * 100 : 0;
  const color = CAT_COLORS[name] || 'var(--accent-blue)';
  const h = Math.floor(mins / 60), m = mins % 60;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
      <span style={{ fontSize:'0.72rem', color, fontWeight:700, width:60, flexShrink:0 }}>{name}</span>
      <div style={{ flex:1, height:5, borderRadius:3, background:'var(--tl-chart-bg)', overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:3, transition:'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize:'0.68rem', color:'var(--text-muted)', width:36, textAlign:'right', flexShrink:0 }}>
        {h>0?`${h}h`:`${m}m`}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TimelineAnalytics({ date, tasks, logs }) {
  const [open,      setOpen]      = useState(true);
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'monthly'

  const stats      = useMemo(() => computeDayStats(tasks),      [tasks]);
  const streak     = useMemo(() => computeStreak(logs, date),   [logs, date]);
  const weekBars   = useMemo(() => computeWeekBars(logs, date), [logs, date]);
  const monthly    = useMemo(() => computeMonthlyStats(logs, date), [logs, date]);
  const burnoutDays = useMemo(() => detectBurnout(logs, date),  [logs, date]);

  const donutColor = stats.pct >= 80 ? 'var(--status-completed)'
                   : stats.pct >= 50 ? 'var(--priority-high)'
                   : 'var(--status-missed)';

  const catEntries = Object.entries(monthly.catMins).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxCatMins = catEntries[0]?.[1] || 1;

  return (
    <div className="analytics-panel">
      {/* Header */}
      <div className={`analytics-panel-header ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)} aria-expanded={open}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0, flexWrap:'wrap' }}>
          <BarChart2 size={16} color="var(--accent-blue)" aria-hidden="true" />
          <span style={{ fontWeight:700, fontSize:'0.88rem', whiteSpace:'nowrap' }}>Analytics</span>
          {streak > 0 && (
            <span className="analytics-streak-badge" aria-label={`${streak}-day streak`}>
              <Flame size={12} aria-hidden="true" /> {streak}d streak
            </span>
          )}
          {burnoutDays >= 4 && (
            <span className="burnout-badge" role="alert" aria-label="Burnout risk">⚠️ Burnout risk</span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {!open && stats.total > 0 && (
            <div className="mini-bar" style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{stats.completed}/{stats.total}</span>
              <div style={{ width:48, height:5, borderRadius:3, background:'var(--tl-chart-bg)', overflow:'hidden', flexShrink:0 }}>
                <div style={{ width:`${stats.pct}%`, height:'100%', borderRadius:3, background:donutColor, transition:'width 0.6s ease' }} />
              </div>
              <span style={{ fontSize:'0.78rem', fontWeight:700, color:donutColor, whiteSpace:'nowrap' }}>{stats.pct}%</span>
            </div>
          )}
          <ChevronDown size={15} style={{ transition:'transform 0.25s', transform: open?'rotate(180deg)':'none', color:'var(--text-muted)', flexShrink:0 }} aria-hidden="true" />
        </div>
      </div>

      {/* Body */}
      {open && (
        <>
          {/* Tabs */}
          <div className="analytics-tabs">
            {[['daily','📅 Today'],['monthly','📊 Month']].map(([k,l]) => (
              <button key={k} className={`analytics-tab ${activeTab===k?'active':''}`} onClick={() => setActiveTab(k)}>{l}</button>
            ))}
          </div>

          {activeTab === 'daily' && (
            <>
              <div className="analytics-panel-body">
                {/* Donut */}
                <div className="analytics-stat-card" style={{ gridColumn:'span 1', gridRow:'span 2', justifyContent:'center' }}>
                  <div className="productivity-donut-wrap" style={{ position:'relative' }}>
                    <DonutChart pct={stats.productivityScore} color={donutColor} />
                    <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontSize:'1rem', fontWeight:800, color:donutColor, textShadow:`0 0 10px ${donutColor}40` }}>
                      {stats.productivityScore}
                    </div>
                  </div>
                  <div className="analytics-stat-label">Score</div>
                </div>
                <StatCard number={stats.total}     label="Total"     color="var(--text-primary)"    />
                <StatCard number={stats.completed} label="Done"      color="var(--status-completed)" />
                <StatCard number={stats.delayed}   label="Delayed"   color="var(--status-delayed)"  />
                <StatCard number={stats.missed}    label="Missed"    color="var(--status-missed)"   />
              </div>

              {/* Burnout warning */}
              {burnoutDays >= 4 && (
                <div className="analytics-burnout-row">
                  ⚠️ Productivity below 25% for {burnoutDays} consecutive days. Consider a recovery break.
                </div>
              )}

              {/* Weekly bars */}
              <div className="week-chart-wrap">
                <div className="week-chart-label">📊 Last 7 Days</div>
                <div className="week-bars">
                  {weekBars.map(bar => <WeekBar key={bar.d} bar={bar} />)}
                </div>
              </div>
            </>
          )}

          {activeTab === 'monthly' && (
            <div className="analytics-monthly-body">
              {/* KPI tiles */}
              <div className="analytics-monthly-grid">
                <div className="analytics-monthly-tile">
                  <Target size={14} color="var(--status-completed)" />
                  <span className="amt-value" style={{ color:'var(--status-completed)' }}>{monthly.completedTasks}</span>
                  <span className="amt-label">Completed</span>
                </div>
                <div className="analytics-monthly-tile">
                  <TrendingUp size={14} color="var(--accent-blue)" />
                  <span className="amt-value" style={{ color:'var(--accent-blue)' }}>{monthly.completionRate}%</span>
                  <span className="amt-label">Rate</span>
                </div>
                <div className="analytics-monthly-tile">
                  <Flame size={14} color="var(--priority-high)" />
                  <span className="amt-value" style={{ color:'var(--priority-high)' }}>{monthly.avgScore}</span>
                  <span className="amt-label">Avg Score</span>
                </div>
                <div className="analytics-monthly-tile">
                  <Award size={14} color="var(--priority-critical)" />
                  <span className="amt-value" style={{ color: monthly.criticalUnfinished>0?'var(--priority-critical)':'var(--text-muted)' }}>{monthly.criticalUnfinished}</span>
                  <span className="amt-label">Crit. Left</span>
                </div>
              </div>

              {/* Top category */}
              {monthly.topCat && (
                <div className="analytics-top-cat">
                  🏆 Top category this month: <strong style={{ color: CAT_COLORS[monthly.topCat] }}>{monthly.topCat}</strong>
                </div>
              )}

              {/* Category bars */}
              {catEntries.length > 0 && (
                <div className="analytics-cat-section">
                  <div className="week-chart-label">⏱ Time by Category</div>
                  {catEntries.map(([name, mins]) => (
                    <CatMiniBar key={name} name={name} mins={mins} maxMins={maxCatMins} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
