import React, { useState, useMemo } from 'react';
import { useHabits } from '../Store';
import { Line, Bar } from 'react-chartjs-2';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, DollarSign, Star, BarChart2 } from 'lucide-react';
import CircularTracker from '../components/CircularTracker';

// ── Shared chart defaults (theme-aware) ───────────────────────────
const getChartDefaults = () => {
  const isDarkTheme = !document.documentElement.getAttribute('data-theme') || document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDarkTheme ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.7)';
  const gridColor = isDarkTheme ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
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
          boxWidth: 12, boxHeight: 12, borderRadius: 4,
        }
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: isDarkTheme ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
        borderColor: tooltipBorder,
        borderWidth: 1, cornerRadius: 8, padding: 10,
      }
    },
    scales: {
      x: {
        ticks: { color: textColor, font: { size: 11 }, maxTicksLimit: 16 },
        grid: { color: gridColor }
      },
      y: {
        ticks: { color: textColor, font: { size: 11 } },
        grid: { color: gridColor }
      }
    }
  };
};

const CHART_DEFAULTS = getChartDefaults();

const mergeChartOptions = (extra) => {
  const defaults = getChartDefaults();
  return {
    ...defaults,
    plugins: {
      ...defaults.plugins,
      ...(extra.plugins || {}),
      legend: { ...defaults.plugins.legend, ...(extra.plugins?.legend || {}) },
      tooltip: { ...defaults.plugins.tooltip, ...(extra.plugins?.tooltip || {}) },
    },
    scales: {
      x: { ...defaults.scales.x, ...(extra.scales?.x || {}) },
      y: { ...defaults.scales.y, ...(extra.scales?.y || {}) },
    }
  };
};

const getScoreColor = (score) => {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
};

// ── Sub-components ───────────────────────────────────────────────
function StatBadge({ icon: Icon, label, value, colorRgb }) {
  return (
    <div className="review-stat-badge" style={{
      background: `rgba(${colorRgb},0.08)`,
      border: `1px solid rgba(${colorRgb},0.2)`,
      borderRadius: '14px', padding: '1rem 1.25rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      flex: '1 1 0', minWidth: 0,
    }}>
      <div className="stat-icon-wrap" style={{
        width: 36, height: 36, borderRadius: '10px',
        background: `rgba(${colorRgb},0.15)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={17} style={{ color: `rgb(${colorRgb})` }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="stat-value" style={{ fontSize: '1.2rem', fontWeight: '800', color: `rgb(${colorRgb})`, lineHeight: 1.1 }}>{value}</div>
        <div className="stat-label" style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.2rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, colorGradient, icon, borderColor, height = 320, children }) {
  return (
    <div className="glass-card mb-6 review-chart-card" style={{ overflow: 'hidden', padding: 0, border: `1px solid ${borderColor}` }}>
      <div className="chart-header" style={{
        padding: '0.85rem 1.5rem',
        background: `linear-gradient(135deg, ${borderColor}22 0%, transparent 100%)`,
        borderBottom: `1px solid ${borderColor}33`,
        display: 'flex', alignItems: 'center', gap: '0.6rem',
      }}>
        <span className="chart-icon" style={{ fontSize: '1.1rem' }}>{icon}</span>
        <h3 style={{
          margin: 0, fontSize: '0.92rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em',
          background: colorGradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>{title}</h3>
      </div>
      <div className="chart-body" style={{ padding: '1.25rem 1.5rem' }}>
        <div className={`chart-container ${height >= 250 ? 'chart-container--tall' : ''}`} style={{ position: 'relative', height, width: '100%' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
export default function MonthlyReview() {
  const { getMonthlyData } = useHabits();
  const [date, setDate] = useState(new Date());

  const goPrevMonth = () => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1));
  const goNextMonth = () => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1));
  const goToday = () => setDate(new Date());

  const monthlyData = getMonthlyData(date);
  const labels = monthlyData.map(d => d.dayNum);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }, [date]);

  // ── Summary Stats ───────────────────────────────────────────
  const submittedDays = monthlyData.filter(d => d.log.isSubmitted || d.log.totalScore > 0);
  const avgScore = submittedDays.length
    ? Math.round(submittedDays.reduce((s, d) => s + d.log.totalScore, 0) / submittedDays.length)
    : 0;
  const bestScore = Math.max(...monthlyData.map(d => d.log.totalScore), 0);
  const totalMonthlySpend = monthlyData.reduce(
    (t, d) => t + (Array.isArray(d.log.expenses) ? d.log.expenses : []).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
    0
  ).toFixed(3);
  const eliteDays = submittedDays.filter(d => d.log.totalScore >= 90).length;

  // ── Chart Datasets ──────────────────────────────────────────
  const disciplineData = {
    labels,
    datasets: [{
      label: 'Daily Score',
      data: monthlyData.map(d => d.log.totalScore),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.08)',
      tension: 0.35,
      fill: true,
      pointBackgroundColor: monthlyData.map(d => getScoreColor(d.log.totalScore)),
      pointRadius: 3,
      pointHoverRadius: 6,
      spanGaps: false,
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
    },
    plugins: {
      annotation: {
        annotations: {
          eliteZone: {
            type: 'box', yMin: 90, yMax: 100,
            backgroundColor: 'rgba(16,185,129,0.06)', borderWidth: 0,
            label: { content: 'ELITE ZONE', display: true, position: 'end', color: 'rgba(16,185,129,0.6)', font: { size: 10, weight: '700' } }
          },
          minLine: {
            type: 'line', yMin: 50, yMax: 50,
            borderColor: 'rgba(239,68,68,0.5)', borderWidth: 1.5, borderDash: [5, 5]
          }
        }
      }
    }
  });

  const expensesData = {
    labels,
    datasets: [{
      label: 'Daily Spend (TND)',
      data: monthlyData.map(d =>
        parseFloat((Array.isArray(d.log.expenses) ? d.log.expenses : [])
          .reduce((t, e) => t + (parseFloat(e.amount) || 0), 0).toFixed(3))
      ),
      backgroundColor: 'rgba(245,158,11,0.55)',
      borderColor: 'rgba(245,158,11,0.8)',
      borderWidth: 1, borderRadius: 4,
      barPercentage: 0.6,
    }]
  };

  const expensesOptions = mergeChartOptions({
    scales: {
      x: { ...CHART_DEFAULTS.scales.x },
      y: { ...CHART_DEFAULTS.scales.y, beginAtZero: true }
    },
    plugins: { legend: { display: false } }
  });

  const parseWakeTime = (timeStr) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':');
    return parseInt(h, 10) + parseInt(m, 10) / 60;
  };

  const wakingData = {
    labels,
    datasets: [{
      label: 'Wake-Up Time',
      data: monthlyData.map(d => parseWakeTime(d.log.morning.wakeTime)),
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139,92,246,0.1)',
      tension: 0.35,
      fill: true,
      pointBackgroundColor: '#8b5cf6',
      pointRadius: 2.5,
      pointHoverRadius: 5,
      spanGaps: true,
    }]
  };

  const wakingOptions = mergeChartOptions({
    scales: {
      x: { ...CHART_DEFAULTS.scales.x },
      y: {
        ...CHART_DEFAULTS.scales.y,
        reverse: true, min: 3, max: 12,
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

  // ── Weekend Duties Aggregation ──────────────────────────────
  let preLaundryCount = 0, cleanRoomCount = 0, regularLaundryCount = 0, shareBoughtCount = 0;
  monthlyData.forEach(d => {
    const w = d.log.weekend;
    if (w?.saturday?.preLaundry) preLaundryCount++;
    if (w?.sunday?.cleanRoom) cleanRoomCount++;
    if (w?.sunday?.regularLaundry) regularLaundryCount++;
    if (w?.sunday?.shareBought) shareBoughtCount++;
  });

  const totalSats = monthlyData.filter(d => new Date(d.date + 'T12:00:00').getDay() === 6).length;
  const totalSuns = monthlyData.filter(d => new Date(d.date + 'T12:00:00').getDay() === 0).length;

  const weekendData = {
    labels: ['Pre-laundry (Sat)', 'Clean Room (Sun)', 'Laundry (Sun)', 'Share Bought (Sun)'],
    datasets: [{
      label: 'Times Completed',
      data: [preLaundryCount, cleanRoomCount, regularLaundryCount, shareBoughtCount],
      backgroundColor: ['rgba(16,185,129,0.6)', 'rgba(16,185,129,0.6)', 'rgba(16,185,129,0.6)', 'rgba(16,185,129,0.6)'],
      borderColor: ['rgba(16,185,129,0.9)', 'rgba(16,185,129,0.9)', 'rgba(16,185,129,0.9)', 'rgba(16,185,129,0.9)'],
      borderWidth: 1, borderRadius: 6, barPercentage: 0.55,
    }]
  };

  const weekendOptions = mergeChartOptions({
    scales: {
      x: { ...CHART_DEFAULTS.scales.x },
      y: { ...CHART_DEFAULTS.scales.y, beginAtZero: true, ticks: { ...CHART_DEFAULTS.scales.y.ticks, stepSize: 1 } }
    },
    plugins: { legend: { display: false } }
  });

  // ── System Check Aggregation ────────────────────────────────
  let todoCount = 0, moneyCount = 0;
  monthlyData.forEach(d => {
    if (d.log.system?.todo) todoCount++;
    if (d.log.system?.money) moneyCount++;
  });

  const systemData = {
    labels: ['Timeline Updated', 'Expense Tracker'],
    datasets: [{
      label: 'Times Completed',
      data: [todoCount, moneyCount],
      backgroundColor: ['rgba(59,130,246,0.6)', 'rgba(16,185,129,0.6)'],
      borderColor: ['rgba(59,130,246,0.9)', 'rgba(16,185,129,0.9)'],
      borderWidth: 1, borderRadius: 6, barPercentage: 0.45,
    }]
  };

  const systemOptions = mergeChartOptions({
    scales: {
      x: { ...CHART_DEFAULTS.scales.x },
      y: { ...CHART_DEFAULTS.scales.y, beginAtZero: true, ticks: { ...CHART_DEFAULTS.scales.y.ticks, stepSize: 1 } }
    },
    plugins: { legend: { display: false } }
  });

  return (
    <div className="review-page" style={{ paddingBottom: '2rem', animation: 'pageSlideIn 0.4s ease' }}>

      {/* ── Header Navigation ─────────────────────────────────── */}
      <div className="review-header" style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.05) 100%)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '20px', padding: '1.75rem', marginBottom: '1.75rem',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Title */}
        <div className="review-title-row" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <Calendar size={20} style={{ color: '#8b5cf6' }} />
            <h2 className="review-title" style={{
              margin: 0, fontSize: '1.75rem', fontWeight: '900', letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {format(date, 'MMMM yyyy')}
            </h2>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span className="review-subtitle" style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              📊 Monthly Analytics
            </span>
            {isCurrentMonth && (
               <span className="review-badge" style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.05) 100%)',
                border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: '20px', padding: '0.25rem 0.75rem',
                color: '#8b5cf6', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em',
              }}>🎯 CURRENT MONTH</span>
            )}
          </div>
        </div>

        {/* Enhanced Date Navigation */}
        <div className="review-nav-row" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <button
            id="monthly-prev-btn"
            className="review-nav-btn"
            onClick={goPrevMonth}
            style={{
              background: 'rgba(59,130,246,0.12)', border: '1.5px solid rgba(59,130,246,0.22)',
              borderRadius: '12px', padding: '0.7rem 1rem', color: '#2563eb',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              transition: 'all 0.3s ease', fontSize: '0.9rem', fontWeight: '600', whiteSpace: 'nowrap',
              minHeight: '40px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.22)'; e.currentTarget.style.transform = 'translateX(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} /> <span>Previous</span>
          </button>

          {/* Date Display Card */}
          <div style={{
            background: '#ffffff',
            border: '1.5px solid rgba(139,92,246,0.2)',
            borderRadius: '12px',
            padding: '0.7rem 1.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
            minHeight: '40px',
            boxShadow: '0 2px 8px rgba(139,92,246,0.1)',
          }}>
            <Calendar size={16} style={{ color: '#8b5cf6' }} />
            <span style={{
              fontSize: '0.95rem', fontWeight: '700', color: '#0f172a',
              letterSpacing: '0.3px',
            }}>
              {format(date, 'MMM')} {format(date, 'yyyy')}
            </span>
          </div>

          <button
            id="monthly-today-btn"
            className="review-nav-btn review-nav-btn--center"
            onClick={goToday}
            style={{
              background: isCurrentMonth
                ? 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(139,92,246,0.1) 100%)'
                : 'rgba(139,92,246,0.08)',
              border: isCurrentMonth ? '1.5px solid rgba(139,92,246,0.35)' : '1.5px solid rgba(139,92,246,0.15)',
              borderRadius: '12px', padding: '0.7rem 1.2rem', color: '#8b5cf6',
              cursor: 'pointer', transition: 'all 0.3s ease',
              fontSize: '0.9rem', fontWeight: '700', whiteSpace: 'nowrap',
              minHeight: '40px',
            }}
            onMouseEnter={e => { 
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(139,92,246,0.15) 100%)';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = isCurrentMonth
                ? 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(139,92,246,0.1) 100%)'
                : 'rgba(139,92,246,0.08)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            aria-label="Jump to current month"
          >
            🎯 Today
          </button>

          <button
            id="monthly-next-btn"
            className="review-nav-btn"
            onClick={goNextMonth}
            style={{
              background: 'rgba(139,92,246,0.12)', border: '1.5px solid rgba(139,92,246,0.22)',
              borderRadius: '12px', padding: '0.7rem 1rem', color: '#8b5cf6',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              transition: 'all 0.3s ease', fontSize: '0.9rem', fontWeight: '600', whiteSpace: 'nowrap',
              minHeight: '40px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.22)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            aria-label="Next month"
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
        <StatBadge icon={TrendingUp} label="Avg Score" value={`${avgScore}`} colorRgb="59,130,246" />
        <StatBadge icon={Star} label="Best Day" value={`${bestScore}`} colorRgb="16,185,129" />
        <StatBadge icon={BarChart2} label="Elite Days (90+)" value={`${eliteDays}`} colorRgb="139,92,246" />
        <StatBadge icon={DollarSign} label="Total (TND)" value={totalMonthlySpend} colorRgb="245,158,11" />
      </div>

      {/* ── Mini Calendar Heatmap Strip ──────────────────────── */}
      <div className="glass-card mb-6 monthly-heatmap-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="heatmap-header" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'rgba(0,0,0,0.9)' }}>
            🗓️ {format(date, 'MMMM')} Score Heatmap
          </h3>
        </div>
        <div className="heatmap-body" style={{ padding: '1.25rem 1rem', overflowX: 'auto' }}>
          <div className="heatmap-strip" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', minWidth: 300 }}>
            {monthlyData.map((d, i) => {
              const score = d.log.totalScore;
              const hasData = d.log.isSubmitted || score > 0;
              const dayOfWeek = new Date(d.date + 'T12:00:00').getDay();
              const dayNames = ['Su','Mo','Tu','We','Th','Fr','Sa'];
              return (
                <div
                  key={i}
                  className="heatmap-cell"
                  title={`${format(new Date(d.date + 'T12:00:00'), 'EEE, MMM d')}: ${score} pts`}
                  style={{
                    width: 36, height: 44, borderRadius: '8px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                    background: hasData
                      ? score >= 90 ? 'rgba(16,185,129,0.2)'
                        : score >= 80 ? 'rgba(59,130,246,0.15)'
                        : score >= 60 ? 'rgba(245,158,11,0.12)'
                        : 'rgba(239,68,68,0.1)'
                      : 'rgba(0,0,0,0.02)',
                    border: `1px solid ${
                      hasData
                        ? score >= 90 ? 'rgba(16,185,129,0.3)'
                          : score >= 80 ? 'rgba(59,130,246,0.25)'
                          : score >= 60 ? 'rgba(245,158,11,0.2)'
                          : 'rgba(239,68,68,0.2)'
                        : 'rgba(0,0,0,0.06)'
                    }`,
                    flexShrink: 0,
                    cursor: 'default',
                  }}
                >
                  <span className="cell-weekday" style={{ fontSize: '0.55rem', color: 'rgba(0,0,0,0.5)', fontWeight: '600' }}>{dayNames[dayOfWeek]}</span>
                  <span className="cell-day" style={{ fontSize: '0.75rem', fontWeight: '700', color: hasData ? getScoreColor(score) : 'rgba(0,0,0,0.35)' }}>{d.dayNum}</span>
                  {hasData && <span className="cell-score" style={{ fontSize: '0.5rem', color: 'rgba(0,0,0,0.5)' }}>{score}</span>}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="heatmap-legend" style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {[
              { color: 'rgba(16,185,129,0.2)', border: 'rgba(16,185,129,0.3)', label: '90–100 (Elite)' },
              { color: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.25)', label: '80–89 (A)' },
              { color: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.2)', label: '60–79 (B/C)' },
              { color: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', label: '0–59 (F)' },
            ].map(({ color, border, label }) => (
              <div key={label} className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div className="legend-dot" style={{ width: 12, height: 12, borderRadius: '3px', background: color, border: `1px solid ${border}` }} />
                <span className="legend-text" style={{ fontSize: '0.72rem', color: 'rgba(0,0,0,0.6)', fontWeight: '500' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    {/* ── Circular Tracker ──────────────────────────────────── */}
    <div className="glass-card mb-6 review-rings-card" style={{ overflow: 'hidden', padding: 0 }}>
      <div className="rings-header" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'rgba(0,0,0,0.9)' }}>🎯 Monthly Habit Completion</h3>
      </div>
      <div className="rings-body" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
        <CircularTracker data={monthlyData} />
      </div>
    </div>

      {/* ── Charts ───────────────────────────────────────────── */}
      <ChartCard title="Discipline Index Evolution (0–100 pts)" colorGradient="linear-gradient(135deg,#3b82f6,#06b6d4)" icon="📊" borderColor="#3b82f6" height={320}>
        <Line data={disciplineData} options={disciplineOptions} />
      </ChartCard>

      <ChartCard title="Financial Outflow – Daily Spend (TND)" colorGradient="linear-gradient(135deg,#f59e0b,#d97706)" icon="💰" borderColor="#f59e0b" height={300}>
        <Bar data={expensesData} options={expensesOptions} />
      </ChartCard>

    {/* ── Expense Total Banner ─────────────────────────────── */}
    <div className="review-expense-banner" style={{
      background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
      borderRadius: '14px', padding: '1rem 1.5rem', marginBottom: '1.5rem',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span className="expense-label" style={{ color: 'rgba(0,0,0,0.6)', fontWeight: '600', fontSize: '0.9rem' }}>Total {format(date, 'MMMM')} Expenses</span>
      <span className="expense-value" style={{ color: '#f59e0b', fontWeight: '800', fontSize: '1.25rem' }}>{totalMonthlySpend} <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>TND</span></span>
    </div>

    <ChartCard title="Waking Up Time (24h Format)" colorGradient="linear-gradient(135deg,#8b5cf6,#7c3aed)" icon="⏰" borderColor="#8b5cf6" height={290}>
      <Line data={wakingData} options={wakingOptions} />
    </ChartCard>

    <ChartCard title="Weekend Duties Completion" colorGradient="linear-gradient(135deg,#10b981,#059669)" icon="✅" borderColor="#10b981" height={250}>
      <Bar data={weekendData} options={weekendOptions} />
    </ChartCard>

    {/* ── Weekend Completion Rate ───────────────────────────── */}
    <div className="monthly-weekend-grid" style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
      gap: '0.6rem', marginBottom: '1.5rem',
    }}>
      {[
        { label: 'Pre-laundry', done: preLaundryCount, total: totalSats },
        { label: 'Clean Room', done: cleanRoomCount, total: totalSuns },
        { label: 'Laundry', done: regularLaundryCount, total: totalSuns },
        { label: 'Share Bought', done: shareBoughtCount, total: totalSuns },
      ].map(({ label, done, total }) => {
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <div key={label} className="weekend-cell" style={{
            background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
            borderRadius: '12px', padding: '0.85rem', textAlign: 'center',
          }}>
            <div className="weekend-pct" style={{ fontSize: '1.15rem', fontWeight: '800', color: '#10b981' }}>{pct}%</div>
            <div className="weekend-label" style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.2rem', fontWeight: '500' }}>{label}</div>
            <div className="weekend-count" style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.1rem' }}>{done}/{total}</div>
          </div>
        );
      })}
    </div>

      <ChartCard title="System Check Completion" colorGradient="linear-gradient(135deg,#3b82f6,#2563eb)" icon="⚙️" borderColor="#3b82f6" height={220}>
        <Bar data={systemData} options={systemOptions} />
      </ChartCard>

    </div>
  );
}
