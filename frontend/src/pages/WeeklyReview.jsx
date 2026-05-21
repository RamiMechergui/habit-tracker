import React, { useState, useMemo } from 'react';
import { useHabits } from '../Store';
import { Line, Bar } from 'react-chartjs-2';
import CircularTracker from '../components/CircularTracker';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, DollarSign, Clock, CheckSquare } from 'lucide-react';
import { format, addDays, subDays, isToday } from 'date-fns';

// ── Shared chart defaults (dark-mode aware) ──────────────────────
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: 'rgba(255,255,255,0.7)',
        font: { family: 'Inter, sans-serif', size: 12 },
        boxWidth: 12,
        boxHeight: 12,
        borderRadius: 4,
      }
    },
    tooltip: {
      backgroundColor: 'rgba(15,15,20,0.95)',
      titleColor: '#fff',
      bodyColor: 'rgba(255,255,255,0.8)',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      cornerRadius: 8,
      padding: 10,
    }
  },
  scales: {
    x: {
      ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 12 } },
      grid: { color: 'rgba(255,255,255,0.05)' }
    },
    y: {
      ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 12 } },
      grid: { color: 'rgba(255,255,255,0.05)' }
    }
  }
};

const mergeChartOptions = (extra) => {
  const merged = {
    ...CHART_DEFAULTS,
    plugins: {
      ...CHART_DEFAULTS.plugins,
      ...(extra.plugins || {}),
      legend: { ...CHART_DEFAULTS.plugins.legend, ...(extra.plugins?.legend || {}) },
      tooltip: { ...CHART_DEFAULTS.plugins.tooltip, ...(extra.plugins?.tooltip || {}) },
    },
    scales: {
      x: { ...CHART_DEFAULTS.scales.x, ...(extra.scales?.x || {}) },
      y: { ...CHART_DEFAULTS.scales.y, ...(extra.scales?.y || {}) },
    }
  };
  return merged;
};

// ── Helper ─────────────────────────────────────────────────────────
const safeStartOfWeek = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

const getRankColor = (rank) => {
  if (rank === 'S') return '#10b981';
  if (rank === 'A') return '#3b82f6';
  if (rank === 'B') return '#f59e0b';
  if (rank === 'C') return '#fb923c';
  return '#ef4444';
};

const getScoreColor = (score) => {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
};

// ── Summary Stat Card ────────────────────────────────────────────
function StatBadge({ icon: Icon, label, value, color }) {
  return (
    <div style={{
      background: `rgba(${color},0.08)`,
      border: `1px solid rgba(${color},0.2)`,
      borderRadius: '14px',
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      flex: '1 1 0',
      minWidth: 0,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '10px',
        background: `rgba(${color},0.15)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} style={{ color: `rgb(${color})` }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '1.25rem', fontWeight: '800', color: `rgb(${color})`, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.2rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      </div>
    </div>
  );
}

// ── Chart Section Wrapper ────────────────────────────────────────
function ChartCard({ title, color, icon, height = 300, children }) {
  return (
    <div className="glass-card mb-6" style={{ overflow: 'hidden', padding: 0 }}>
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: '0.65rem',
        background: 'rgba(0,0,0,0.15)',
      }}>
        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
        <h3 style={{
          margin: 0, fontSize: '1rem', fontWeight: '700',
          background: color, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>{title}</h3>
      </div>
      <div style={{ padding: '1.5rem' }}>
        <div style={{ position: 'relative', height, width: '100%' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
export default function WeeklyReview() {
  const { getWeeklyData } = useHabits();
  const [date, setDate] = useState(new Date());

  const goPrevWeek = () => setDate(d => subDays(d, 7));
  const goNextWeek = () => setDate(d => addDays(d, 7));
  const goToday = () => setDate(new Date());

  const weekStart = safeStartOfWeek(date);
  const weekEnd = addDays(weekStart, 6);

  const weeklyData = getWeeklyData(date);
  const labels = weeklyData.map(d => d.dayName);

  const isCurrentWeek = useMemo(() => {
    const today = new Date();
    const todayWeekStart = safeStartOfWeek(today);
    return format(weekStart, 'yyyy-MM-dd') === format(todayWeekStart, 'yyyy-MM-dd');
  }, [weekStart]);

  // ── Summary stats ────────────────────────────────────────────
  const submittedDays = weeklyData.filter(d => d.log.isSubmitted || d.log.totalScore > 0);
  const avgScore = submittedDays.length
    ? Math.round(submittedDays.reduce((s, d) => s + d.log.totalScore, 0) / submittedDays.length)
    : 0;
  const bestScore = Math.max(...weeklyData.map(d => d.log.totalScore), 0);
  const totalExpenses = weeklyData.reduce(
    (t, d) => t + (Array.isArray(d.log.expenses) ? d.log.expenses : []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
    0
  ).toFixed(3);

  const parseWakeTime = (timeStr) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':');
    return parseInt(h, 10) + parseInt(m, 10) / 60;
  };

  // ── Chart Datasets ───────────────────────────────────────────
  const disciplineData = {
    labels,
    datasets: [{
      label: 'Daily Score',
      data: weeklyData.map(d => d.log.totalScore),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.12)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: weeklyData.map(d => getScoreColor(d.log.totalScore)),
      pointRadius: 5,
      pointHoverRadius: 8,
    }]
  };

  const disciplineOptions = mergeChartOptions({
    scales: {
      x: { ...CHART_DEFAULTS.scales.x },
      y: {
        ...CHART_DEFAULTS.scales.y,
        min: 0, max: 100,
        ticks: { ...CHART_DEFAULTS.scales.y.ticks, stepSize: 20 }
      }
    }
  });

  const expensesData = {
    labels,
    datasets: [{
      label: 'Expense (TND)',
      data: weeklyData.map(d =>
        parseFloat((Array.isArray(d.log.expenses) ? d.log.expenses : [])
          .reduce((t, e) => t + (parseFloat(e.amount) || 0), 0).toFixed(3))
      ),
      backgroundColor: weeklyData.map((_, i) =>
        i % 2 === 0 ? 'rgba(245,158,11,0.7)' : 'rgba(245,158,11,0.5)'
      ),
      borderColor: 'rgba(245,158,11,0.9)',
      borderWidth: 1,
      borderRadius: 6,
    }]
  };

  const expensesOptions = mergeChartOptions({
    scales: {
      x: { ...CHART_DEFAULTS.scales.x },
      y: { ...CHART_DEFAULTS.scales.y, beginAtZero: true }
    },
    plugins: { legend: { display: false } }
  });

  const wakingData = {
    labels,
    datasets: [{
      label: 'Wake-Up Time',
      data: weeklyData.map(d => parseWakeTime(d.log.morning.wakeTime)),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.12)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#3b82f6',
      pointRadius: 5,
      pointHoverRadius: 8,
      spanGaps: true,
    }]
  };

  const wakingOptions = mergeChartOptions({
    scales: {
      x: { ...CHART_DEFAULTS.scales.x },
      y: {
        ...CHART_DEFAULTS.scales.y,
        reverse: true,
        min: 3, max: 12,
        ticks: {
          ...CHART_DEFAULTS.scales.y.ticks,
          stepSize: 1,
          callback: (value) => {
            const h = Math.floor(value);
            const m = Math.round((value - h) * 60);
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
          }
        }
      }
    }
  });

  const satDuty = weeklyData.find(d => d.dayName === 'Sat')?.log?.weekend?.saturday;
  const sunDuty = weeklyData.find(d => d.dayName === 'Sun')?.log?.weekend?.sunday;

  const weekendData = {
    labels: ['Pre-laundry (Sat)', 'Clean Room (Sun)', 'Laundry (Sun)', 'Share Bought (Sun)'],
    datasets: [{
      label: 'Done',
      data: [
        satDuty?.preLaundry ? 1 : 0,
        sunDuty?.cleanRoom ? 1 : 0,
        sunDuty?.regularLaundry ? 1 : 0,
        sunDuty?.shareBought ? 1 : 0
      ],
      backgroundColor: [
        satDuty?.preLaundry ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.5)',
        sunDuty?.cleanRoom ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.5)',
        sunDuty?.regularLaundry ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.5)',
        sunDuty?.shareBought ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.5)',
      ],
      borderColor: [
        satDuty?.preLaundry ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.8)',
        sunDuty?.cleanRoom ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.8)',
        sunDuty?.regularLaundry ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.8)',
        sunDuty?.shareBought ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.8)',
      ],
      borderWidth: 1,
      borderRadius: 6,
    }]
  };

  const weekendOptions = mergeChartOptions({
    scales: {
      x: { ...CHART_DEFAULTS.scales.x },
      y: {
        ...CHART_DEFAULTS.scales.y,
        min: 0, max: 1,
        ticks: { ...CHART_DEFAULTS.scales.y.ticks, stepSize: 1, callback: v => v === 1 ? '✓ Done' : '✗ Not Done' }
      }
    },
    plugins: { legend: { display: false } }
  });

  const systemData = {
    labels,
    datasets: [
      {
        label: 'Timeline Updated',
        data: weeklyData.map(d => d.log.system?.todo ? 1 : 0),
        backgroundColor: 'rgba(59,130,246,0.6)',
        borderColor: 'rgba(59,130,246,0.9)',
        borderWidth: 1, borderRadius: 6,
      },
      {
        label: 'Expense Tracker',
        data: weeklyData.map(d => d.log.system?.money ? 1 : 0),
        backgroundColor: 'rgba(16,185,129,0.6)',
        borderColor: 'rgba(16,185,129,0.9)',
        borderWidth: 1, borderRadius: 6,
      }
    ]
  };

  const systemOptions = mergeChartOptions({
    scales: {
      x: { ...CHART_DEFAULTS.scales.x },
      y: {
        ...CHART_DEFAULTS.scales.y,
        min: 0, max: 1,
        ticks: { ...CHART_DEFAULTS.scales.y.ticks, stepSize: 1, callback: v => v === 1 ? 'Done' : '' }
      }
    }
  });

  return (
    <div style={{ paddingBottom: '2rem', animation: 'pageSlideIn 0.4s ease' }}>

      {/* ── Header Navigation ─────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(245,158,11,0.08) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <Calendar size={18} style={{ color: 'rgba(245,158,11,0.85)' }} />
            <h2 style={{
              margin: 0, fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #3b82f6 0%, #f59e0b 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
            </h2>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Weekly Review
            </span>
            {isCurrentWeek && (
              <span style={{
                background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)',
                borderRadius: '20px', padding: '0.15rem 0.65rem',
                color: '#10b981', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.04em',
              }}>● THIS WEEK</span>
            )}
          </div>
        </div>

        {/* Navigation row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <button
            id="weekly-prev-btn"
            onClick={goPrevWeek}
            style={{
              background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: '12px', padding: '0.65rem 1.1rem', color: '#fff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
              transition: 'all 0.25s ease', fontSize: '0.88rem', fontWeight: '600',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.28)'; e.currentTarget.style.transform = 'translateX(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.15)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            aria-label="Previous week"
          >
            <ChevronLeft size={16} /> Prev
          </button>

          <button
            id="weekly-today-btn"
            onClick={goToday}
            style={{
              flex: 1,
              background: isCurrentWeek
                ? 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0.1) 100%)'
                : 'rgba(255,255,255,0.05)',
              border: isCurrentWeek ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px', padding: '0.65rem 1rem', color: '#fff',
              cursor: 'pointer', transition: 'all 0.25s ease',
              fontSize: '0.88rem', fontWeight: '600',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.25)'; e.currentTarget.style.border = '1px solid rgba(16,185,129,0.5)'; }}
            onMouseLeave={e => {
              e.currentTarget.style.background = isCurrentWeek
                ? 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0.1) 100%)'
                : 'rgba(255,255,255,0.05)';
              e.currentTarget.style.border = isCurrentWeek ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.1)';
            }}
            aria-label="Jump to today"
          >
            ✨ Today
          </button>

          <button
            id="weekly-next-btn"
            onClick={goNextWeek}
            style={{
              background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: '12px', padding: '0.65rem 1.1rem', color: '#fff',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
              transition: 'all 0.25s ease', fontSize: '0.88rem', fontWeight: '600',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.28)'; e.currentTarget.style.transform = 'translateX(3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.15)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            aria-label="Next week"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Summary Stats Row ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <StatBadge icon={TrendingUp} label="Avg Score" value={`${avgScore}`} color="245,158,11" />
        <StatBadge icon={TrendingUp} label="Best Score" value={`${bestScore}`} color="16,185,129" />
        <StatBadge icon={DollarSign} label="Total (TND)" value={totalExpenses} color="59,130,246" />
        <StatBadge icon={CheckSquare} label="Days Logged" value={`${submittedDays.length}/7`} color="139,92,246" />
      </div>

      {/* ── Day Pills ─────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '0.5rem', marginBottom: '1.5rem',
      }}>
        {weeklyData.map((d, i) => {
          const dayDate = addDays(weekStart, i);
          const isDayToday = isToday(dayDate);
          const score = d.log.totalScore;
          const hasData = d.log.isSubmitted || score > 0;
          return (
            <div
              key={i}
              style={{
                background: isDayToday
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.08) 100%)'
                  : hasData ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                border: isDayToday
                  ? '1.5px solid rgba(16,185,129,0.45)'
                  : '1px solid rgba(255,255,255,0.07)',
                borderRadius: '12px', padding: '0.75rem 0.4rem',
                textAlign: 'center', transition: 'all 0.25s ease',
                cursor: 'default',
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: '700', color: isDayToday ? '#10b981' : 'rgba(255,255,255,0.5)', marginBottom: '0.3rem', letterSpacing: '0.05em' }}>
                {d.dayName.toUpperCase()}
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: '800', color: isDayToday ? '#fff' : 'rgba(255,255,255,0.85)', marginBottom: '0.3rem' }}>
                {format(dayDate, 'd')}
              </div>
              {hasData ? (
                <div style={{
                  fontSize: '0.7rem', fontWeight: '700',
                  color: getScoreColor(score),
                  background: `${getScoreColor(score)}18`,
                  borderRadius: '6px', padding: '0.15rem 0.2rem',
                }}>
                  {score}
                </div>
              ) : (
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>—</div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Score Table ───────────────────────────────────────── */}
      <div className="glass-card mb-6" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.15)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'rgba(255,255,255,0.9)' }}>📋 Weekly Score Table</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'center', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.25)' }}>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: '700', color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Metric</th>
                {weeklyData.map((d, i) => {
                  const dayDate = addDays(weekStart, i);
                  const isDayToday = isToday(dayDate);
                  return (
                    <th key={i} style={{
                      padding: '0.85rem 0.6rem',
                      background: isDayToday ? 'rgba(16,185,129,0.1)' : 'transparent',
                      borderBottom: isDayToday ? '2px solid rgba(16,185,129,0.4)' : '2px solid transparent',
                      fontWeight: '700', color: isDayToday ? '#10b981' : 'rgba(255,255,255,0.7)',
                    }}>
                      <div style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>{d.dayName.toUpperCase()}</div>
                      <div style={{ fontSize: '1rem', fontWeight: '800', marginTop: '0.2rem' }}>{format(dayDate, 'd')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: '600', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Score</td>
                {weeklyData.map((d, i) => (
                  <td key={i} style={{ padding: '0.85rem 0.6rem', fontWeight: '700', fontSize: '1rem', color: getScoreColor(d.log.totalScore) }}>
                    {d.log.totalScore}
                  </td>
                ))}
              </tr>
              <tr style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: '600', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Rank</td>
                {weeklyData.map((d, i) => (
                  <td key={i} style={{ padding: '0.75rem 0.6rem' }}>
                    <span style={{
                      padding: '0.35rem 0.6rem', borderRadius: '8px',
                      fontSize: '0.85rem', fontWeight: '800',
                      background: `${getRankColor(d.log.rank)}1a`,
                      color: getRankColor(d.log.rank),
                      border: `1px solid ${getRankColor(d.log.rank)}40`,
                    }}>
                      {d.log.rank}
                    </span>
                  </td>
                ))}
              </tr>
              <tr style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: '600', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>Wake-Up</td>
                {weeklyData.map((d, i) => (
                  <td key={i} style={{ padding: '0.85rem 0.6rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>
                    {d.log.morning.wakeTime || '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Circular Tracker ─────────────────────────────────── */}
      <div className="glass-card mb-6" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.15)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'rgba(255,255,255,0.9)' }}>🎯 Habit Completion Rings</h3>
        </div>
        <div style={{ padding: '1rem', background: 'var(--bg-card)' }}>
          <CircularTracker data={weeklyData} />
        </div>
      </div>

      {/* ── Charts ───────────────────────────────────────────── */}
      <ChartCard title="Discipline Tracker (0–100)" color="linear-gradient(135deg,#f59e0b,#f97316)" icon="📊" height={280}>
        <Line data={disciplineData} options={disciplineOptions} />
      </ChartCard>

      <ChartCard title="Weekly Wake-Up Time" color="linear-gradient(135deg,#3b82f6,#06b6d4)" icon="⏰" height={260}>
        <Line data={wakingData} options={wakingOptions} />
      </ChartCard>

      <ChartCard title="Weekly Expenses" color="linear-gradient(135deg,#f59e0b,#d97706)" icon="💰" height={260}>
        <Bar data={expensesData} options={expensesOptions} />
      </ChartCard>

      {/* ── Expense Total Banner ─────────────────────────────── */}
      <div style={{
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: '14px', padding: '1rem 1.5rem', marginBottom: '1.5rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: '0.9rem' }}>Total Weekly Expenses</span>
        <span style={{ color: '#f59e0b', fontWeight: '800', fontSize: '1.2rem' }}>{totalExpenses} <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>TND</span></span>
      </div>

      <ChartCard title="Weekend Duties Completion" color="linear-gradient(135deg,#10b981,#059669)" icon="✅" height={220}>
        <Bar data={weekendData} options={weekendOptions} />
      </ChartCard>

      <ChartCard title="System Check Completion" color="linear-gradient(135deg,#8b5cf6,#7c3aed)" icon="⚙️" height={220}>
        <Bar data={systemData} options={systemOptions} />
      </ChartCard>

    </div>
  );
}
