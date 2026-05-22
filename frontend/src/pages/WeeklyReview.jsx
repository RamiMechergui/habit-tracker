import React, { useState, useMemo } from 'react';
import { useHabits } from '../Store';
import { Line, Bar } from 'react-chartjs-2';
import CircularTracker from '../components/CircularTracker';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, DollarSign, Clock, CheckSquare } from 'lucide-react';
import { format, addDays, subDays, isToday } from 'date-fns';

// ── Shared chart defaults (theme-aware) ──────────────────────
const getChartDefaults = () => {
  const isDarkTheme = !document.documentElement.getAttribute('data-theme') || document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDarkTheme ? 'rgba(255,255,255,0.82)' : 'rgba(15,23,42,0.78)';
  const gridColor = isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';
  const axisColor = isDarkTheme ? 'rgba(255,255,255,0.42)' : 'rgba(15,23,42,0.38)';
  const tooltipBg = isDarkTheme ? 'rgba(15,15,20,0.95)' : '#ffffff';
  const tooltipText = isDarkTheme ? '#fff' : '#0f172a';
  const tooltipBorder = isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: textColor,
          font: { family: 'Inter, sans-serif', size: 12 },
          boxWidth: 12,
          boxHeight: 12,
          borderRadius: 4,
        }
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: isDarkTheme ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
        borderColor: tooltipBorder,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
      }
    },
    scales: {
      x: {
        ticks: { color: textColor, font: { size: 12 }, padding: 8 },
        grid: { color: gridColor, tickColor: axisColor, drawTicks: true },
        border: { display: true, color: axisColor, width: 1 }
      },
      y: {
        ticks: { color: textColor, font: { size: 12, weight: '600' }, padding: 10 },
        grid: { color: gridColor, tickColor: axisColor, drawTicks: true, tickLength: 8 },
        border: { display: true, color: axisColor, width: 2 }
      }
    }
  };
};

const mergeScaleOptions = (base, override = {}) => ({
  ...base,
  ...override,
  ticks: { ...base.ticks, ...(override.ticks || {}) },
  grid: { ...base.grid, ...(override.grid || {}) },
  border: { ...base.border, ...(override.border || {}) },
});

const mergeChartOptions = (extra = {}) => {
  const defaults = getChartDefaults();
  const merged = {
    ...defaults,
    plugins: {
      ...defaults.plugins,
      ...(extra.plugins || {}),
      legend: { ...defaults.plugins.legend, ...(extra.plugins?.legend || {}) },
      tooltip: { ...defaults.plugins.tooltip, ...(extra.plugins?.tooltip || {}) },
    },
    scales: {
      x: mergeScaleOptions(defaults.scales.x, extra.scales?.x),
      y: mergeScaleOptions(defaults.scales.y, extra.scales?.y),
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
  const isDarkTheme = !document.documentElement.getAttribute('data-theme') || document.documentElement.getAttribute('data-theme') === 'dark';
  const labelColor = isDarkTheme ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.6)';
  
  return (
    <div className="review-stat-badge" style={{
      background: isDarkTheme ? `rgba(${color},0.08)` : `rgba(${color},0.06)`,
      border: isDarkTheme ? `1px solid rgba(${color},0.2)` : `1px solid rgba(${color},0.15)`,
      borderRadius: '14px',
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      flex: '1 1 0',
      minWidth: 0,
    }}>
      <div className="stat-icon-wrap" style={{
        width: 36, height: 36, borderRadius: '10px',
        background: isDarkTheme ? `rgba(${color},0.15)` : `rgba(${color},0.12)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} style={{ color: `rgb(${color})` }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: '800', color: `rgb(${color})`, lineHeight: 1.1 }}>{value}</div>
        <div className="stat-label" style={{ fontSize: '0.72rem', color: labelColor, marginTop: '0.2rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      </div>
    </div>
  );
}

// ── Chart Section Wrapper ────────────────────────────────────────
function ChartCard({ title, color, icon, height = 300, children }) {
  const isDarkTheme = !document.documentElement.getAttribute('data-theme') || document.documentElement.getAttribute('data-theme') === 'dark';
  
  return (
    <div className="glass-card mb-6 review-chart-card" style={{ overflow: 'hidden', padding: 0 }}>
      <div className="chart-header" style={{
        padding: '1rem 1.5rem',
        borderBottom: isDarkTheme ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)',
        display: 'flex', alignItems: 'center', gap: '0.65rem',
        background: isDarkTheme ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
      }}>
        <span className="chart-icon" style={{ fontSize: '1.2rem' }}>{icon}</span>
        <h3 style={{
          margin: 0, fontSize: '1rem', fontWeight: '700',
          background: color, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>{title}</h3>
      </div>
      <div className="chart-body" style={{ padding: '1.5rem' }}>
        <div className={`chart-container ${height >= 250 ? 'chart-container--tall' : ''}`} style={{ position: 'relative', height, width: '100%' }}>
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
      y: {
        min: 0, max: 100,
        ticks: { stepSize: 20 }
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
      y: { beginAtZero: true }
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
      y: {
        reverse: true,
        min: 3, max: 12,
        ticks: {
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
      y: {
        min: 0, max: 1,
        ticks: { stepSize: 1, callback: v => v === 1 ? '✓ Done' : '✗ Not Done' }
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
      y: {
        min: 0, max: 1,
        ticks: { stepSize: 1, callback: v => v === 1 ? 'Done' : '' }
      }
    }
  });

  return (
    <div className="review-page review-page--weekly" style={{ paddingBottom: '2rem', animation: 'pageSlideIn 0.4s ease' }}>

      {/* ── Header Navigation ─────────────────────────────────── */}
      <div className="review-header review-header--weekly" style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(245,158,11,0.05) 100%)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '20px',
        padding: '1.75rem',
        marginBottom: '1.75rem',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Title */}
        <div className="review-title-row" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <Calendar size={20} style={{ color: '#f59e0b' }} />
            <h2 className="review-title" style={{
              margin: 0, fontSize: '1.65rem', fontWeight: '900', letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #3b82f6 0%, #f59e0b 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')}
            </h2>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span className="review-subtitle" style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              📅 Weekly Review
            </span>
            {isCurrentWeek && (
              <span className="review-badge" style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '20px', padding: '0.25rem 0.75rem',
                color: '#10b981', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em',
              }}>🎯 THIS WEEK</span>
            )}
          </div>
        </div>

        {/* Enhanced Navigation */}
        <div className="review-nav-row" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <button
            id="weekly-prev-btn"
            className="review-nav-btn"
            onClick={goPrevWeek}
            style={{
              background: 'rgba(59,130,246,0.12)', border: '1.5px solid rgba(59,130,246,0.22)',
              borderRadius: '12px', padding: '0.7rem 1rem', color: '#2563eb',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              transition: 'all 0.3s ease', fontSize: '0.9rem', fontWeight: '600',
              whiteSpace: 'nowrap', minHeight: '40px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.22)'; e.currentTarget.style.transform = 'translateX(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            aria-label="Previous week"
          >
            <ChevronLeft size={18} /> <span>Previous</span>
          </button>

          {/* Date Display Card */}
          <div className="review-date-chip" style={{
            background: '#ffffff',
            border: '1.5px solid rgba(245,158,11,0.2)',
            borderRadius: '12px',
            padding: '0.7rem 1.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
            minHeight: '40px',
            boxShadow: '0 2px 8px rgba(245,158,11,0.1)',
          }}>
            <Calendar size={16} style={{ color: '#f59e0b' }} />
            <span style={{
              fontSize: '0.95rem', fontWeight: '700', color: '#0f172a',
              letterSpacing: '0.3px',
            }}>
              Week of {format(weekStart, 'MMM d')}
            </span>
          </div>

          <button
            id="weekly-today-btn"
            className={`review-nav-btn review-nav-btn--center ${isCurrentWeek ? 'is-active' : ''}`}
            onClick={goToday}
            style={{
              background: isCurrentWeek
                ? 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.1) 100%)'
                : 'rgba(16,185,129,0.08)',
              border: isCurrentWeek ? '1.5px solid rgba(16,185,129,0.35)' : '1.5px solid rgba(16,185,129,0.15)',
              borderRadius: '12px', padding: '0.7rem 1.2rem', color: '#10b981',
              cursor: 'pointer', transition: 'all 0.3s ease',
              fontSize: '0.9rem', fontWeight: '700', whiteSpace: 'nowrap',
              minHeight: '40px',
            }}
            onMouseEnter={e => { 
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0.15) 100%)';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = isCurrentWeek
                ? 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.1) 100%)'
                : 'rgba(16,185,129,0.08)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            aria-label="Jump to today"
          >
            🎯 Today
          </button>

          <button
            id="weekly-next-btn"
            className="review-nav-btn"
            onClick={goNextWeek}
            style={{
              background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.22)',
              borderRadius: '12px', padding: '0.7rem 1rem', color: '#f59e0b',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              transition: 'all 0.3s ease', fontSize: '0.9rem', fontWeight: '600',
              whiteSpace: 'nowrap', minHeight: '40px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.22)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.12)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            aria-label="Next week"
          >
            <span>Next</span> <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* ── Summary Stats Row ─────────────────────────────────── */}
      <div className="review-stats-row" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.85rem', 
        marginBottom: '1.75rem',
      }}>
        <StatBadge icon={TrendingUp} label="Avg Score" value={`${avgScore}`} color="245,158,11" />
        <StatBadge icon={TrendingUp} label="Best Score" value={`${bestScore}`} color="16,185,129" />
        <StatBadge icon={DollarSign} label="Total (TND)" value={totalExpenses} color="59,130,246" />
        <StatBadge icon={CheckSquare} label="Days Logged" value={`${submittedDays.length}/7`} color="139,92,246" />
      </div>

      {/* ── Day Pills ─────────────────────────────────────────── */}
      <div className="weekly-day-pills" style={{
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
              className={`day-pill ${isDayToday ? 'is-today' : ''} ${hasData ? 'has-data' : 'is-empty'}`}
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
              <div className="day-name" style={{ fontSize: '0.7rem', fontWeight: '700', color: isDayToday ? '#10b981' : 'rgba(255,255,255,0.5)', marginBottom: '0.3rem', letterSpacing: '0.05em' }}>
                {d.dayName.toUpperCase()}
              </div>
              <div className="day-num" style={{ fontSize: '1.05rem', fontWeight: '800', color: isDayToday ? '#fff' : 'rgba(255,255,255,0.85)', marginBottom: '0.3rem' }}>
                {format(dayDate, 'd')}
              </div>
              {hasData ? (
                <div className="day-score-chip" style={{
                  fontSize: '0.7rem', fontWeight: '700',
                  color: getScoreColor(score),
                  background: `${getScoreColor(score)}18`,
                  borderRadius: '6px', padding: '0.15rem 0.2rem',
                }}>
                  {score}
                </div>
              ) : (
                <div className="day-empty-mark" style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>—</div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Score Table ───────────────────────────────────────── */}
      <div className="glass-card mb-6 weekly-score-table-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-header" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'rgba(0,0,0,0.9)' }}>📋 Weekly Score Table</h3>
        </div>
        <div className="table-scroll" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'center', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                <th className="metric-label" style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: '700', color: 'rgba(0,0,0,0.6)', fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Metric</th>
                {weeklyData.map((d, i) => {
                  const dayDate = addDays(weekStart, i);
                  const isDayToday = isToday(dayDate);
                  return (
                    <th key={i} className={isDayToday ? 'is-today' : ''} style={{
                      padding: '0.85rem 0.6rem',
                      background: isDayToday ? 'rgba(16,185,129,0.05)' : 'transparent',
                      borderBottom: isDayToday ? '2px solid rgba(16,185,129,0.3)' : '2px solid transparent',
                      fontWeight: '700', color: isDayToday ? '#10b981' : 'rgba(0,0,0,0.7)',
                    }}>
                      <div className="day-label" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>{d.dayName.toUpperCase()}</div>
                      <div className="date-label" style={{ fontSize: '1rem', fontWeight: '800', marginTop: '0.2rem' }}>{format(dayDate, 'd')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <td className="metric-label" style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: '600', color: 'rgba(0,0,0,0.6)', fontSize: '0.85rem' }}>Score</td>
                {weeklyData.map((d, i) => (
                  <td key={i} style={{ padding: '0.85rem 0.6rem', fontWeight: '700', fontSize: '1rem', color: getScoreColor(d.log.totalScore) }}>
                    {d.log.totalScore}
                  </td>
                ))}
              </tr>
              <tr style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <td className="metric-label" style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: '600', color: 'rgba(0,0,0,0.6)', fontSize: '0.85rem' }}>Rank</td>
                {weeklyData.map((d, i) => (
                  <td key={i} style={{ padding: '0.75rem 0.6rem' }}>
                    <span className="rank-badge" style={{
                      padding: '0.35rem 0.6rem', borderRadius: '8px',
                      fontSize: '0.85rem', fontWeight: '800',
                      background: `${getRankColor(d.log.rank)}15`,
                      color: getRankColor(d.log.rank),
                      border: `1px solid ${getRankColor(d.log.rank)}30`,
                    }}>
                      {d.log.rank}
                    </span>
                  </td>
                ))}
              </tr>
              <tr style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                <td className="metric-label" style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: '600', color: 'rgba(0,0,0,0.6)', fontSize: '0.85rem' }}>Wake-Up</td>
                {weeklyData.map((d, i) => (
                  <td key={i} className="wake-time-cell" style={{ padding: '0.85rem 0.6rem', fontSize: '0.85rem', color: 'rgba(0,0,0,0.7)', fontWeight: '500' }}>
                    {d.log.morning.wakeTime || '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Circular Tracker ─────────────────────────────────── */}
      <div className="glass-card mb-6 review-rings-card" style={{ overflow: 'hidden', padding: 0 }}>
        <div className="rings-header" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'rgba(0,0,0,0.9)' }}>🎯 Habit Completion Rings</h3>
        </div>
        <div className="rings-body" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
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
      <div className="review-expense-banner" style={{
        background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
        borderRadius: '14px', padding: '1rem 1.5rem', marginBottom: '1.5rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span className="expense-label" style={{ color: 'rgba(0,0,0,0.6)', fontWeight: '600', fontSize: '0.9rem' }}>Total Weekly Expenses</span>
        <span className="expense-value" style={{ color: '#f59e0b', fontWeight: '800', fontSize: '1.2rem' }}>{totalExpenses} <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>TND</span></span>
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
