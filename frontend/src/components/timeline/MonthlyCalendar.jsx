import React, { useMemo, useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, parseISO, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ── Mobile detection hook ─────────────────────────────────────────────────────
function useIsMobile(bp = 600) {
  const [m, setM] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= bp : false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const h = (e) => setM(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [bp]);
  return m;
}

const STATUS_COLORS = {
  Completed: '#10b981',
  Delayed:   '#f59e0b',
  Missed:    '#ef4444',
  Pending:   '#64748b',
};

const FILTER_STATUSES  = ['all', 'Completed', 'Delayed', 'Missed', 'Pending'];
const FILTER_PRIORITIES = ['all', 'low', 'medium', 'high', 'critical'];

export default function MonthlyCalendar({ currentDate, logs, onSelectDate }) {
  const [viewDate,       setViewDate]       = useState(parseISO(currentDate));
  const [filterStatus,   setFilterStatus]   = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const isMobile = useIsMobile();

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(viewDate);
    const end   = endOfMonth(viewDate);
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  const getDayData = (dateStr) => {
    const log = logs[dateStr];
    if (!log || !log.tasks || log.tasks.length === 0) return null;

    let tasks = log.tasks;
    if (filterStatus   !== 'all') tasks = tasks.filter(t => t.status   === filterStatus);
    if (filterPriority !== 'all') tasks = tasks.filter(t => t.priority === filterPriority);
    if (tasks.length === 0) return null;

    const total     = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const delayed   = tasks.filter(t => t.status === 'Delayed').length;
    const missed    = tasks.filter(t => t.status === 'Missed').length;
    const pct       = Math.round((completed / total) * 100);

    return { total, completed, delayed, missed, pct };
  };

  const getHeatmapBg = (pct) => {
    if (pct >= 90) return 'rgba(16,185,129,0.18)';
    if (pct >= 70) return 'rgba(16,185,129,0.10)';
    if (pct >= 50) return 'rgba(245,158,11,0.12)';
    if (pct >= 20) return 'rgba(239,68,68,0.08)';
    return 'rgba(239,68,68,0.04)';
  };

  const firstDayOffset = startOfMonth(viewDate).getDay();

  return (
    <div className="glass-card month-calendar-card">
      {/* Month navigation */}
      <div className="month-nav-header">
        <button className="month-nav-btn" onClick={() => setViewDate(d => subMonths(d, 1))}>
          <ChevronLeft size={16} />
        </button>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
          📅 {format(viewDate, 'MMMM yyyy')}
        </h3>
        <button className="month-nav-btn" onClick={() => setViewDate(d => addMonths(d, 1))}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Filter bar — horizontal scroll on mobile */}
      <div
        className="month-filter-bar"
        style={isMobile ? { overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 } : {}}
      >
        <span style={{
          fontSize: '0.72rem', fontWeight: 700,
          color: 'var(--text-muted)',
          alignSelf: 'center',
          marginRight: 2,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {isMobile ? 'S:' : 'STATUS:'}
        </span>
        {FILTER_STATUSES.map(s => (
          <button key={s}
            className={`month-filter-chip ${filterStatus === s ? 'active' : ''}`}
            onClick={() => setFilterStatus(s)}
            style={{ flexShrink: 0 }}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
        <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px', alignSelf: 'center', flexShrink: 0 }} />
        <span style={{
          fontSize: '0.72rem', fontWeight: 700,
          color: 'var(--text-muted)',
          alignSelf: 'center',
          marginRight: 2,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {isMobile ? 'P:' : 'PRIORITY:'}
        </span>
        {FILTER_PRIORITIES.map(p => (
          <button key={p}
            className={`month-filter-chip ${filterPriority === p ? 'active' : ''}`}
            onClick={() => setFilterPriority(p)}
            style={{ flexShrink: 0 }}
          >
            {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Grid header */}
      <div className="month-grid-header">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="month-grid-day">{d}</div>
        ))}
      </div>

      {/* Grid cells */}
      <div className="month-grid">
        {/* Empty slots */}
        {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e${i}`} />)}

        {daysInMonth.map(date => {
          const dateStr  = format(date, 'yyyy-MM-dd');
          const today    = isToday(date);
          const data     = getDayData(dateStr);
          const heatBg   = data ? getHeatmapBg(data.pct) : undefined;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={`month-cell ${today ? 'today' : ''}`}
              style={{
                background: today ? 'rgba(59,130,246,0.2)' : (heatBg || 'var(--bg-card)'),
                borderColor: today ? 'var(--accent-blue)' : 'var(--border)',
              }}
              title={data ? `${data.completed}/${data.total} completed (${data.pct}%)` : 'No tasks'}
            >
              <span className="month-cell-date">
                {format(date, 'd')}
              </span>

              {/* Status dots */}
              {data && (
                <div className="month-cell-dots">
                  {Array.from({ length: Math.min(data.completed, 3) }).map((_, i) => (
                    <div key={`c${i}`} className="month-dot" style={{ background: STATUS_COLORS.Completed }} />
                  ))}
                  {data.delayed > 0 && (
                    <div className="month-dot" style={{ background: STATUS_COLORS.Delayed }} />
                  )}
                  {data.missed > 0 && (
                    <div className="month-dot" style={{ background: STATUS_COLORS.Missed }} />
                  )}
                </div>
              )}

              {/* % label */}
              {data && (
                <span 
                  className="month-pct-label"
                  style={{
                    color: data.pct >= 80 ? STATUS_COLORS.Completed : data.pct >= 50 ? STATUS_COLORS.Delayed : STATUS_COLORS.Missed,
                  }}
                >
                  {data.pct}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="month-legend">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="month-legend-item">
            <div className="month-dot" style={{ background: color }} />
            {status}
          </div>
        ))}
        <div className="month-legend-item">
          <div style={{ width: 12, height: 8, borderRadius: 2, background: 'rgba(16,185,129,0.18)' }} />
          High productivity
        </div>
      </div>
    </div>
  );
}
