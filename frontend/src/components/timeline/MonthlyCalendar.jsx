import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, parseISO, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
    <div className="glass-card" style={{ padding: '24px', marginTop: 20 }}>
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

      {/* Filter bar */}
      <div className="month-filter-bar">
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>
          STATUS:
        </span>
        {FILTER_STATUSES.map(s => (
          <button key={s}
            className={`month-filter-chip ${filterStatus === s ? 'active' : ''}`}
            onClick={() => setFilterStatus(s)}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
        <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px', alignSelf: 'center' }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>
          PRIORITY:
        </span>
        {FILTER_PRIORITIES.map(p => (
          <button key={p}
            className={`month-filter-chip ${filterPriority === p ? 'active' : ''}`}
            onClick={() => setFilterPriority(p)}
          >
            {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Grid header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px', textAlign: 'center', marginBottom: 8 }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, paddingBottom: 4 }}>{d}</div>
        ))}
      </div>

      {/* Grid cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px' }}>
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
              style={{
                aspectRatio: '1',
                padding: '4px 2px 6px',
                background: today ? 'rgba(59,130,246,0.2)' : (heatBg || 'var(--tl-panel-bg)'),
                border: today
                  ? '1.5px solid var(--accent-blue)'
                  : '1px solid var(--border)',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                cursor: 'pointer',
                transition: 'all 0.18s',
                gap: 2,
              }}
              title={data ? `${data.completed}/${data.total} completed (${data.pct}%)` : 'No tasks'}
            >
              <span style={{
                fontSize: '0.85rem',
                fontWeight: today ? 800 : 500,
                color: today ? 'var(--accent-blue)' : 'var(--text-primary)',
              }}>
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
                <span style={{
                  fontSize: '0.58rem', fontWeight: 700,
                  color: data.pct >= 80 ? STATUS_COLORS.Completed : data.pct >= 50 ? STATUS_COLORS.Delayed : STATUS_COLORS.Missed,
                }}>
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
