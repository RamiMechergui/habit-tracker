import React, { useMemo, useState, useEffect, useRef } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, parseISO, addMonths, subMonths, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, BarChart2, Search } from 'lucide-react';
import './MonthlyCalendar.css';
import HeatmapTooltip from './HeatmapTooltip';
import StatisticsPanel from './StatisticsPanel';

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

const PRIORITY_WEIGHTS = { low: 1, medium: 2, high: 3, critical: 4 };

function computeScore(tasks = []) {
  let earned = 0, total = 0, penalty = 0;
  for (const t of tasks) {
    const w = PRIORITY_WEIGHTS[t.priority] || 1;
    total += w;
    if (t.status === 'Completed') earned += w;
    if (t.status === 'Missed')    penalty += w;
  }
  if (total === 0) return null;
  return Math.max(0, Math.min(100, Math.round(((earned - penalty) / total) * 100)));
}

const FILTER_STATUSES   = ['all', 'Completed', 'Delayed', 'Missed', 'Pending'];
const FILTER_PRIORITIES = ['all', 'low', 'medium', 'high', 'critical'];
const FILTER_CATEGORIES = ['all', 'Work', 'Health', 'Personal', 'Learning', 'Finance', 'Social', 'Other'];

const PRIORITY_COLORS = { low:'var(--priority-low)', medium:'var(--priority-medium)', high:'var(--priority-high)', critical:'var(--priority-critical)' };
const STATUS_DOT_COLORS = { Completed:'var(--status-completed)', Delayed:'var(--status-delayed)', Missed:'var(--status-missed)', Pending:'var(--text-muted)' };

function getHeatGradient(score) {
  if (score === null) return undefined;
  if (score >= 90) return 'rgba(16,185,129,0.22)';
  if (score >= 70) return 'rgba(16,185,129,0.13)';
  if (score >= 50) return 'rgba(245,158,11,0.15)';
  if (score >= 20) return 'rgba(239,68,68,0.10)';
  return 'rgba(239,68,68,0.06)';
}

// ── Day Expand Panel ──────────────────────────────────────────────────────────
function DayExpandPanel({ dateStr, tasks, onClose, onAddClick, onSelectDate }) {
  const date = new Date(dateStr + 'T12:00:00');
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  return (
    <div className="day-expand-panel" role="dialog" aria-label={`Tasks for ${dateStr}`}>
      <div className="day-expand-header">
        <div>
          <div className="day-expand-date">{format(date, 'EEEE, MMMM d')}</div>
          <div className="day-expand-summary">
            {tasks.length} tasks · {pct}% done
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button className="day-expand-add" onClick={() => { onAddClick(); onSelectDate(dateStr); onClose(); }} aria-label="Add task">
            <Plus size={14} /> Add
          </button>
          <button className="day-expand-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="day-expand-progress-track">
        <div className="day-expand-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Task list */}
      <div className="day-expand-tasks evolvia-scrollbar">
        {tasks.length === 0
          ? <p className="day-expand-empty">No tasks. Click Add to plan something!</p>
          : tasks.map((t, i) => (
              <div key={t.id || i} className={`day-expand-task-row priority-${t.priority || 'medium'}`}>
                <span className="day-expand-dot" style={{ background: STATUS_DOT_COLORS[t.status] || STATUS_DOT_COLORS.Pending }} />
                <div className="day-expand-task-info">
                  <span className="day-expand-task-title">{t.title}</span>
                  <span className="day-expand-task-meta">{t.time} · {t.duration}m</span>
                </div>
                <span className={`task-status-pill ${(t.status||'pending').toLowerCase()}`} style={{ fontSize:'0.65rem' }}>{t.status}</span>
              </div>
            ))
        }
      </div>
    </div>
  );
}

// ── Burnout strip ─────────────────────────────────────────────────────────────
function BurnoutStrip({ logs, viewDate }) {
  const days = eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) });
  let streak = 0, maxStreak = 0, cur = 0;
  days.forEach(d => {
    const ds = format(d, 'yyyy-MM-dd');
    const t = logs[ds]?.tasks || [];
    if (t.length === 0) { cur = 0; return; }
    const s = computeScore(t);
    if (s !== null && s < 25) { cur++; maxStreak = Math.max(maxStreak, cur); }
    else cur = 0;
  });
  if (maxStreak < 4) return null;
  return (
    <div className="burnout-warning" role="alert">
      ⚠️ <strong>Burnout Risk:</strong> {maxStreak} consecutive days with low productivity this month. Consider lightening your schedule.
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MonthlyCalendar({ currentDate, logs, onSelectDate, onAddClick }) {
  const [viewDate,       setViewDate]       = useState(parseISO(currentDate));
  const [filterStatus,   setFilterStatus]   = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [expandedDay,    setExpandedDay]    = useState(null);
  const [hoveredDay,     setHoveredDay]     = useState(null);
  const [tooltipPos,     setTooltipPos]     = useState({ top: true });
  const [showStats,      setShowStats]      = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [showWeekends,   setShowWeekends]   = useState(() => { try { return localStorage.getItem('mc_show_weekends') !== 'false'; } catch { return true; } });
  const isMobile = useIsMobile();
  const gridRef  = useRef(null);

  const toggleWeekends = () => setShowWeekends(prev => { const n = !prev; try { localStorage.setItem('mc_show_weekends', String(n)); } catch {} return n; });

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(viewDate), end: endOfMonth(viewDate) });
  }, [viewDate]);

  const getDayData = (dateStr) => {
    const log = logs[dateStr];
    if (!log || !log.tasks || log.tasks.length === 0) return null;
    let tasks = log.tasks;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      tasks = tasks.filter(t => t.title?.toLowerCase().includes(q));
    }
    if (filterStatus   !== 'all') tasks = tasks.filter(t => t.status   === filterStatus);
    if (filterPriority !== 'all') tasks = tasks.filter(t => t.priority === filterPriority);
    if (filterCategory !== 'all') tasks = tasks.filter(t => {
      const cats = Array.isArray(t.categories) ? t.categories : [t.category || 'Other'];
      return cats.includes(filterCategory);
    });
    if (tasks.length === 0) return null;
    const total     = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const missed    = tasks.filter(t => t.status === 'Missed').length;
    const delayed   = tasks.filter(t => t.status === 'Delayed').length;
    const critical  = tasks.filter(t => t.priority === 'critical').length;
    const high      = tasks.filter(t => t.priority === 'high').length;
    const score     = computeScore(tasks);
    return { total, completed, missed, delayed, critical, high, score, tasks };
  };

  const handleCellClick = (dateStr) => {
    if (expandedDay === dateStr) { setExpandedDay(null); return; }
    setExpandedDay(dateStr);
  };

  const handleCellMouseEnter = (dateStr, e) => {
    if (isMobile) return;
    setHoveredDay(dateStr);
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportH = window.innerHeight;
    setTooltipPos({ top: rect.top > viewportH / 2 });
  };

  const firstDayOffset = startOfMonth(viewDate).getDay();

  return (
    <div className="glass-card month-calendar-card">
      {/* Burnout warning */}
      <BurnoutStrip logs={logs} viewDate={viewDate} />

      {/* Search */}
      <div className="month-search-bar" style={{ margin:'4px 16px', position:'relative' }}>
        <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
        <input type="search" className="w-full" placeholder="Search tasks across month…"
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          style={{ paddingLeft:'30px', paddingTop:8, paddingBottom:8, fontSize:'0.78rem', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, color:'var(--text-primary)', fontFamily:'var(--font-sans)' }} />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:4 }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Month nav */}
      <div className="month-nav-header">
        <button className="month-nav-btn" onClick={() => setViewDate(d => subMonths(d, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
        <button className="month-nav-btn" onClick={() => setViewDate(d => addDays(d, -7))} aria-label="Previous week"><ChevronLeft size={12} /></button>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <h3 style={{ margin:0, fontSize:'1.05rem', fontWeight:700 }}>📅 {format(viewDate, 'MMMM yyyy')}</h3>
          <button className="stats-open-btn" onClick={() => setShowStats(true)} aria-label="Open monthly statistics" title="Monthly statistics">
            <BarChart2 size={15} />
          </button>
        </div>
        <button className="month-nav-btn" onClick={() => setViewDate(d => addDays(d, 7))} aria-label="Next week"><ChevronRight size={12} /></button>
        <button className="month-nav-btn" onClick={() => setViewDate(d => addMonths(d, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
      </div>

      {/* Filters */}
      <div className="month-filter-bar" style={isMobile ? { overflowX:'auto', flexWrap:'nowrap', paddingBottom:4 } : {}}>
        <span className="month-filter-label">{isMobile?'S:':'STATUS:'}</span>
        {FILTER_STATUSES.map(s => (
          <button key={s} className={`month-filter-chip ${filterStatus===s?'active':''}`} onClick={() => setFilterStatus(s)} style={{ flexShrink:0 }}>
            {s==='all'?'All':s}
          </button>
        ))}
        <span className="month-filter-divider" />
        <span className="month-filter-label">{isMobile?'P:':'PRIORITY:'}</span>
        {FILTER_PRIORITIES.map(p => (
          <button key={p} className={`month-filter-chip ${filterPriority===p?'active':''}`} onClick={() => setFilterPriority(p)} style={{ flexShrink:0 }}>
            {p==='all'?'All':p.charAt(0).toUpperCase()+p.slice(1)}
          </button>
        ))}
        {!isMobile && <>
          <span className="month-filter-divider" />
          <span className="month-filter-label">CAT:</span>
          {FILTER_CATEGORIES.slice(0,5).map(c => (
            <button key={c} className={`month-filter-chip ${filterCategory===c?'active':''}`} onClick={() => setFilterCategory(c)} style={{ flexShrink:0 }}>
              {c==='all'?'All':c}
            </button>
          ))}
        </>}
        <span className="month-filter-divider" />
        <button onClick={toggleWeekends} className={`month-filter-chip ${showWeekends?'active':''}`} style={{ flexShrink:0 }}>
          {showWeekends ? 'Weekends on' : 'Weekends off'}
        </button>
      </div>

      {/* Grid header */}
      <div className="month-grid-header">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="month-grid-day">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="month-grid" ref={gridRef}>
        {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e${i}`} />)}

        {daysInMonth.filter(date => showWeekends || (date.getDay() !== 0 && date.getDay() !== 6)).map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const today   = isToday(date);
          const data    = getDayData(dateStr);
          const heatBg  = data ? getHeatGradient(data.score) : undefined;
          const isExpanded = expandedDay === dateStr;
          const rawTasks = logs[dateStr]?.tasks || [];

          return (
            <div key={dateStr} style={{ position:'relative' }}>
              <button
                className={`month-cell month-cell-rich ${today?'today':''} ${isExpanded?'expanded':''}`}
                style={{
                  background: today ? 'rgba(59,130,246,0.2)' : (heatBg || 'var(--bg-card)'),
                  borderColor: today ? 'var(--accent-blue)' : isExpanded ? 'var(--accent-blue)' : 'var(--border)',
                }}
                onClick={() => handleCellClick(dateStr)}
                onMouseEnter={e => handleCellMouseEnter(dateStr, e)}
                onMouseLeave={() => setHoveredDay(null)}
                title={data ? `${data.completed}/${data.total} completed` : 'No tasks'}
                aria-label={`${format(date,'MMMM d')}: ${data ? `${data.completed}/${data.total} tasks` : 'no tasks'}`}
              >
                {/* Day number */}
                <span className={`month-cell-date ${today?'today-date':''}`}>{format(date,'d')}</span>

                {/* Count badges */}
                {data && !isMobile && (
                  <div className="month-cell-badges">
                    {data.completed > 0 && (
                      <span className="month-badge month-badge--done" title="Completed">✓{data.completed}</span>
                    )}
                    {data.critical > 0 && (
                      <span className="month-badge month-badge--critical" title="Critical">🔥{data.critical}</span>
                    )}
                    {data.missed > 0 && (
                      <span className="month-badge month-badge--missed" title="Missed">✗{data.missed}</span>
                    )}
                  </div>
                )}

                {/* Task title previews (desktop only) */}
                {data && !isMobile && (
                  <div className="month-cell-previews">
                    {data.tasks.slice(0, 2).map((t, i) => (
                      <div key={i} className="month-cell-preview-item">
                        <span className="month-preview-dot" style={{ background: PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.medium }} />
                        <span className="month-preview-title">{t.title}</span>
                      </div>
                    ))}
                    {data.tasks.length > 2 && (
                      <span className="month-preview-more">+{data.tasks.length - 2}</span>
                    )}
                  </div>
                )}

                {/* Mobile: dots only */}
                {data && isMobile && (
                  <div className="month-cell-dots">
                    {Array.from({ length: Math.min(data.completed, 3) }).map((_, i) => (
                      <div key={`c${i}`} className="month-dot" style={{ background:'var(--status-completed)' }} />
                    ))}
                    {data.missed > 0 && <div className="month-dot" style={{ background:'var(--status-missed)' }} />}
                    {data.critical > 0 && <div className="month-dot month-dot--critical" />}
                  </div>
                )}

                {/* Score label */}
                {data && data.score !== null && (
                  <span className="month-pct-label"
                    style={{ color: data.score>=80?'var(--status-completed)':data.score>=50?'var(--status-delayed)':'var(--status-missed)' }}>
                    {data.score}%
                  </span>
                )}
              </button>

              {/* Hover tooltip */}
              {hoveredDay === dateStr && !isMobile && (
                <div className={`heatmap-tooltip-wrap ${tooltipPos.top ? 'above' : 'below'}`}>
                  <HeatmapTooltip dateStr={dateStr} tasks={rawTasks} position={tooltipPos.top ? 'above' : 'below'} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded day panel */}
      {expandedDay && (() => {
        const raw = logs[expandedDay]?.tasks || [];
        const q = searchQuery.trim().toLowerCase();
        const tasksForPanel = q ? raw.filter(t => t.title?.toLowerCase().includes(q)) : raw;
        return (
          <DayExpandPanel
            dateStr={expandedDay}
            tasks={tasksForPanel}
            onClose={() => setExpandedDay(null)}
            onAddClick={onAddClick || (() => {})}
            onSelectDate={onSelectDate}
          />
        );
      })()}

      {/* Legend */}
      <div className="month-legend">
        <div className="month-legend-item"><div className="month-dot" style={{ background:'var(--status-completed)' }} />Done</div>
        <div className="month-legend-item"><div className="month-dot" style={{ background:'var(--status-missed)' }} />Missed</div>
        <div className="month-legend-item"><div className="month-dot" style={{ background:'var(--status-delayed)' }} />Delayed</div>
        <div className="month-legend-item"><div style={{ width:12, height:8, borderRadius:2, background:'rgba(16,185,129,0.22)' }} />High score</div>
        <div className="month-legend-item"><div style={{ width:12, height:8, borderRadius:2, background:'rgba(239,68,68,0.10)' }} />Low score</div>
      </div>

      {/* Statistics panel */}
      <StatisticsPanel open={showStats} onClose={() => setShowStats(false)} logs={logs} viewDate={viewDate} />
    </div>
  );
}
