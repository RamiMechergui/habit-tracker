import React, { useState, useMemo } from 'react';
import { useHabits } from '../Store';
import { Line, Bar } from 'react-chartjs-2';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, DollarSign, Star, BarChart2, Smartphone, MessageCircle, Clock, Ban, CheckSquare } from 'lucide-react';
import CircularTracker from '../components/CircularTracker';
import { useMediaQuery } from '../hooks/useMediaQuery';

// ── Shared chart defaults (theme-aware) ───────────────────────────
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
        ticks: { color: textColor, font: { size: 11 }, maxTicksLimit: 12, padding: 8 },
        grid: { color: gridColor, tickColor: axisColor, drawTicks: true },
        border: { display: true, color: axisColor, width: 1 }
      },
      y: {
        ticks: { color: textColor, font: { size: 11, weight: '600' }, padding: 10 },
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
  return {
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
};

const getScoreColor = (score) => {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
};

const getScoreTone = (score) => {
  if (score >= 90) return 'score-elite';
  if (score >= 80) return 'score-high';
  if (score >= 60) return 'score-mid';
  return 'score-low';
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
export default function YearlyReview() {
  const { getYearlyData } = useHabits();
  const [date, setDate] = useState(new Date());
  const isMobile = useMediaQuery('(max-width: 768px)');

  const goPrevYear = () => setDate(new Date(date.getFullYear() - 1, date.getMonth(), 1));
  const goNextYear = () => setDate(new Date(date.getFullYear() + 1, date.getMonth(), 1));
  const goToday = () => setDate(new Date());

  const year = date.getFullYear();
  const yearlyData = getYearlyData(date);
  const labels = yearlyData.map(m => m.monthName);

  const isCurrentYear = useMemo(() => {
    return date.getFullYear() === new Date().getFullYear();
  }, [date]);

  // ── Summary Stats ───────────────────────────────────────────
  const allSubmittedMonths = yearlyData.filter(m => m.submittedDays > 0);
  const avgScore = allSubmittedMonths.length
    ? Math.round(allSubmittedMonths.reduce((s, m) => s + m.avgScore, 0) / allSubmittedMonths.length)
    : 0;
  const bestMonth = yearlyData.reduce((best, m) => m.avgScore > best.avgScore ? m : best, yearlyData[0]);
  const totalYearExpenses = yearlyData.reduce((t, m) => t + m.totalExpenses, 0).toFixed(3);
  const eliteMonths = allSubmittedMonths.filter(m => m.avgScore >= 90).length;

  // ── Averages across months ──────────────────────────────────
  const monthsWithWake = yearlyData.filter(m => m.avgWakeMinutes !== null);
  const avgWakeTime = monthsWithWake.length
    ? monthsWithWake.reduce((s, m) => s + m.avgWakeMinutes, 0) / monthsWithWake.length
    : null;
  const fmtWake = (totalMinutes) => {
    if (totalMinutes === null) return '\u2014';
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const avgPhoneMin = yearlyData.length
    ? Math.round(yearlyData.reduce((s, m) => s + m.avgPhoneMin, 0) / yearlyData.length)
    : 0;
  const avgSocialMin = yearlyData.length
    ? Math.round(yearlyData.reduce((s, m) => s + m.avgSocialMin, 0) / yearlyData.length)
    : 0;
  const fmtMin = (m) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

  const avgCigs = yearlyData.length
    ? Math.round(yearlyData.reduce((s, m) => s + m.avgCigs, 0) / yearlyData.length)
    : 0;

  // ── Chart Datasets ──────────────────────────────────────────
  const disciplineData = {
    labels,
    datasets: [{
      label: 'Monthly Avg Score',
      data: yearlyData.map(m => m.avgScore),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.08)',
      tension: 0.35,
      fill: true,
      pointBackgroundColor: yearlyData.map(m => getScoreColor(m.avgScore)),
      pointRadius: 4,
      pointHoverRadius: 7,
      spanGaps: false,
    }]
  };

  const disciplineOptions = mergeChartOptions({
    scales: {
      y: {
        min: 0, max: 100,
        ticks: { stepSize: 20 }
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
      label: 'Monthly Spend (TND)',
      data: yearlyData.map(m => m.totalExpenses),
      backgroundColor: 'rgba(245,158,11,0.55)',
      borderColor: 'rgba(245,158,11,0.8)',
      borderWidth: 1, borderRadius: 4,
      barPercentage: 0.6,
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
      label: 'Avg Wake-Up Time',
      data: yearlyData.map(m => m.avgWakeMinutes),
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139,92,246,0.1)',
      tension: 0.35,
      fill: true,
      pointBackgroundColor: '#8b5cf6',
      pointRadius: 3,
      pointHoverRadius: 6,
      spanGaps: true,
    }]
  };

  const wakingOptions = mergeChartOptions({
    scales: {
      y: {
        reverse: true, min: 0, max: 24,
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

  const screenTimeData = {
    labels,
    datasets: [
      {
        label: 'Social Media (Hours)',
        data: yearlyData.map(m => parseFloat((m.avgSocialMin / 60).toFixed(2))),
        borderColor: '#a78bfa',
        backgroundColor: 'rgba(167,139,250,0.08)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#a78bfa',
        pointRadius: 3,
        pointHoverRadius: 6,
      },
      {
        label: 'Phone Usage (Hours)',
        data: yearlyData.map(m => parseFloat((m.avgPhoneMin / 60).toFixed(2))),
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236,72,153,0.08)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#ec4899',
        pointRadius: 3,
        pointHoverRadius: 6,
      }
    ]
  };

  const screenTimeOptions = mergeChartOptions({
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (value) => `${value}h` }
      }
    }
  });

  const cigarettesData = {
    labels,
    datasets: [{
      label: 'Avg Cigarettes/Day',
      data: yearlyData.map(m => m.avgCigs),
      borderColor: '#ef4444',
      backgroundColor: 'rgba(239,68,68,0.08)',
      tension: 0.35,
      fill: true,
      pointBackgroundColor: '#ef4444',
      pointRadius: 3,
      pointHoverRadius: 6,
    }]
  };

  const cigarettesOptions = mergeChartOptions({
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } }
    }
  });

  // ── Weekend Duties Aggregation ──────────────────────────────
  let preLaundryCount = 0, cleanRoomCount = 0, regularLaundryCount = 0, shareBoughtCount = 0;
  yearlyData.forEach(m => {
    m.days.forEach(d => {
      const w = d.log.weekend;
      if (w?.saturday?.preLaundry) preLaundryCount++;
      if (w?.sunday?.cleanRoom) cleanRoomCount++;
      if (w?.sunday?.regularLaundry) regularLaundryCount++;
      if (w?.sunday?.shareBought) shareBoughtCount++;
    });
  });

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
      y: { beginAtZero: true, ticks: { stepSize: 1 } }
    },
    plugins: { legend: { display: false } }
  });

  // ── System Check Aggregation ────────────────────────────────
  let todoCount = 0, moneyCount = 0;
  yearlyData.forEach(m => {
    m.days.forEach(d => {
      if (d.log.system?.todo) todoCount++;
      if (d.log.system?.money) moneyCount++;
    });
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
      y: { beginAtZero: true, ticks: { stepSize: 1 } }
    },
    plugins: { legend: { display: false } }
  });

  // ── Flatten all days for CircularTracker ────────────────────
  const allDays = yearlyData.flatMap(m => m.days);

  return (
    <div className="review-page review-page--yearly" style={{ paddingBottom: '2rem', animation: 'pageSlideIn 0.4s ease' }}>

      {/* ── Header Navigation ─────────────────────────────────── */}
      <div className="review-header review-header--yearly" style={{
        background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.03) 100%)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: '20px', padding: '1.75rem', marginBottom: '1.75rem',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Title */}
        <div className="review-title-row" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <Calendar size={20} style={{ color: '#10b981' }} />
            <h2 className="review-title" style={{
              margin: 0, fontSize: isMobile ? '1.2rem' : '1.75rem', fontWeight: '900', letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {year}
            </h2>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span className="review-subtitle" style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.6)', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              📊 Yearly Analytics
            </span>
            {isCurrentYear && (
               <span className="review-badge" style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '20px', padding: '0.25rem 0.75rem',
                color: '#10b981', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em',
              }}>🎯 CURRENT YEAR</span>
            )}
          </div>
        </div>

        {/* Enhanced Date Navigation */}
        <div className="review-nav-row" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <button
            id="yearly-prev-btn"
            className="review-nav-btn"
            onClick={goPrevYear}
            style={{
              background: 'rgba(16,185,129,0.12)', border: '1.5px solid rgba(16,185,129,0.22)',
              borderRadius: '12px', padding: '0.7rem 1rem', color: '#059669',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              transition: 'all 0.3s ease', fontSize: '0.9rem', fontWeight: '600', whiteSpace: 'nowrap',
              minHeight: '40px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.22)'; e.currentTarget.style.transform = 'translateX(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            aria-label="Previous year"
          >
            <ChevronLeft size={18} /> <span>Previous</span>
          </button>

          {/* Date Display Card */}
          <div className="review-date-chip" style={{
            background: '#ffffff',
            border: '1.5px solid rgba(16,185,129,0.2)',
            borderRadius: '12px',
            padding: '0.7rem 1.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
            minHeight: '40px',
            boxShadow: '0 2px 8px rgba(16,185,129,0.1)',
          }}>
            <Calendar size={16} style={{ color: '#10b981' }} />
            <span style={{
              fontSize: '0.95rem', fontWeight: '700', color: '#0f172a',
              letterSpacing: '0.3px',
            }}>
              Year {year}
            </span>
          </div>

          <button
            id="yearly-today-btn"
            className={`review-nav-btn review-nav-btn--center ${isCurrentYear ? 'is-active' : ''}`}
            onClick={goToday}
            style={{
              background: isCurrentYear
                ? 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.1) 100%)'
                : 'rgba(16,185,129,0.08)',
              border: isCurrentYear ? '1.5px solid rgba(16,185,129,0.35)' : '1.5px solid rgba(16,185,129,0.15)',
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
              e.currentTarget.style.background = isCurrentYear
                ? 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.1) 100%)'
                : 'rgba(16,185,129,0.08)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            aria-label="Jump to current year"
          >
            🎯 Today
          </button>

          <button
            id="yearly-next-btn"
            className="review-nav-btn"
            onClick={goNextYear}
            style={{
              background: 'rgba(6,182,212,0.12)', border: '1.5px solid rgba(6,182,212,0.22)',
              borderRadius: '12px', padding: '0.7rem 1rem', color: '#0891b2',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              transition: 'all 0.3s ease', fontSize: '0.9rem', fontWeight: '600', whiteSpace: 'nowrap',
              minHeight: '40px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.22)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.12)'; e.currentTarget.style.transform = 'translateX(0)'; }}
            aria-label="Next year"
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
        <StatBadge icon={TrendingUp} label="Avg Score" value={`${avgScore}`} colorRgb="16,185,129" />
        <StatBadge icon={Clock} label="Avg Wake" value={fmtWake(avgWakeTime)} colorRgb="20,184,166" />
        <StatBadge icon={Star} label="Best Month" value={`${bestMonth?.monthName || '—'}`} colorRgb="245,158,11" />
        <StatBadge icon={BarChart2} label="Elite Months (90+)" value={`${eliteMonths}`} colorRgb="139,92,246" />
        <StatBadge icon={Smartphone} label="Avg Phone" value={fmtMin(avgPhoneMin)} colorRgb="99,102,241" />
        <StatBadge icon={MessageCircle} label="Avg Social" value={fmtMin(avgSocialMin)} colorRgb="236,72,153" />
        <StatBadge icon={Ban} label="Avg Cigs" value={`${avgCigs}`} colorRgb="239,68,68" />
        <StatBadge icon={DollarSign} label="Total (TND)" value={totalYearExpenses} colorRgb="245,158,11" />
      </div>

      {/* ── Monthly Heatmap Strip ───────────────────────────── */}
      <div className="glass-card mb-6 yearly-heatmap-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="heatmap-header" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'rgba(0,0,0,0.9)' }}>
            🗓️ {year} Monthly Score Heatmap
          </h3>
        </div>
        <div className="heatmap-body" style={{ padding: '1.25rem 1rem', overflowX: 'auto' }}>
          <div className="heatmap-strip" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap', minWidth: 300 }}>
            {yearlyData.map((m, i) => {
              const score = m.avgScore;
              const hasData = m.submittedDays > 0;
              return (
                <div
                  key={i}
                  className={`heatmap-cell ${hasData ? getScoreTone(score) : 'is-empty'}`}
                  title={`${m.monthFullName}: Avg ${score} pts (${m.submittedDays}/${m.totalDays} days logged)`}
                  style={{
                    width: 56, height: 60, borderRadius: '10px',
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
                  <span className="cell-month" style={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.5)', fontWeight: '600' }}>{m.monthName}</span>
                  <span className="cell-score" style={{ fontSize: '0.85rem', fontWeight: '700', color: hasData ? getScoreColor(score) : 'rgba(0,0,0,0.35)' }}>{score}</span>
                  {hasData && <span className="cell-days" style={{ fontSize: '0.5rem', color: 'rgba(0,0,0,0.4)' }}>{m.submittedDays}d</span>}
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
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'rgba(0,0,0,0.9)' }}>🎯 Yearly Habit Completion</h3>
      </div>
      <div className="rings-body" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
        <CircularTracker data={allDays} />
      </div>
    </div>

      {/* ── Charts ───────────────────────────────────────────── */}
      <ChartCard title="Discipline Index Evolution (0–100 pts)" colorGradient="linear-gradient(135deg,#10b981,#06b6d4)" icon="📊" borderColor="#10b981" height={320}>
        <Line data={disciplineData} options={disciplineOptions} />
      </ChartCard>

      <ChartCard title="Financial Outflow – Monthly Spend (TND)" colorGradient="linear-gradient(135deg,#f59e0b,#d97706)" icon="💰" borderColor="#f59e0b" height={300}>
        <Bar data={expensesData} options={expensesOptions} />
      </ChartCard>

    {/* ── Expense Total Banner ─────────────────────────────── */}
    <div className="review-expense-banner" style={{
      background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
      borderRadius: '14px', padding: '1rem 1.5rem', marginBottom: '1.5rem',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span className="expense-label" style={{ color: 'rgba(0,0,0,0.6)', fontWeight: '600', fontSize: '0.9rem' }}>Total {year} Expenses</span>
      <span className="expense-value" style={{ color: '#f59e0b', fontWeight: '800', fontSize: '1.25rem' }}>{totalYearExpenses} <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>TND</span></span>
    </div>

    <ChartCard title="Waking Up Time (24h Format)" colorGradient="linear-gradient(135deg,#8b5cf6,#7c3aed)" icon="⏰" borderColor="#8b5cf6" height={290}>
      <Line data={wakingData} options={wakingOptions} />
    </ChartCard>

    <ChartCard title="Social Media & Phone Screen Time" colorGradient="linear-gradient(135deg,#a78bfa,#ec4899)" icon="📱" borderColor="#a78bfa" height={320}>
      <Line data={screenTimeData} options={screenTimeOptions} />
    </ChartCard>

    <ChartCard title="Cigarettes Smoked Evolution" colorGradient="linear-gradient(135deg,#ef4444,#b91c1c)" icon="🚬" borderColor="#ef4444" height={290}>
      <Line data={cigarettesData} options={cigarettesOptions} />
    </ChartCard>

    <ChartCard title="Weekend Duties Completion" colorGradient="linear-gradient(135deg,#10b981,#059669)" icon="✅" borderColor="#10b981" height={250}>
      <Bar data={weekendData} options={weekendOptions} />
    </ChartCard>

      <ChartCard title="System Check Completion" colorGradient="linear-gradient(135deg,#3b82f6,#2563eb)" icon="⚙️" borderColor="#3b82f6" height={220}>
        <Bar data={systemData} options={systemOptions} />
      </ChartCard>

    </div>
  );
}
