import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useHabits } from '../Store';
import { format, isAfter, startOfDay, parseISO, addDays, subDays, isToday } from 'date-fns';
import {
  Plus, Loader2, Bell,
  List, CalendarDays, CheckCircle2, Target, Filter, X,
  ChevronLeft, ChevronRight, Search,
} from 'lucide-react';

import DailyTimeline     from '../components/timeline/DailyTimeline';
import TaskBottomSheet   from '../components/timeline/TaskBottomSheet';
import MissedTasksBar    from '../components/timeline/MissedTasksBar';
import MonthlyCalendar   from '../components/timeline/MonthlyCalendar';
import TimelineAnalytics from '../components/timeline/TimelineAnalytics';
import LiveFocusBanner   from '../components/timeline/LiveFocusBanner';
import SmartAlerts       from '../components/timeline/SmartAlerts';
import { usePushNotifications } from '../hooks/usePushNotifications';

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIORITY_FILTERS = ['all', 'low', 'medium', 'high', 'critical'];
const STATUS_FILTERS   = ['all', 'Pending', 'Completed', 'Delayed', 'Missed'];

const BASE_CATEGORIES = ['Work', 'Health', 'Personal', 'Learning', 'Finance', 'Social', 'Other'];

const VIEW_OPTIONS = [
  { key: 'daily',   icon: <List size={14} />,         label: 'Timeline' },
  { key: 'monthly', icon: <CalendarDays size={14} />, label: 'Heatmap'  },
];

// ── Page Component ────────────────────────────────────────────────────────────
export default function TasksPage() {
  const { getLog, saveLog, logs, scheduleTaskReminder, cancelTaskReminder, getVirtualTasksForDate, recurringTasks } = useHabits();

  const [date,          setDate]          = useState(format(new Date(), 'yyyy-MM-dd'));
  const [log,           setLog]           = useState(() => logs[format(new Date(), 'yyyy-MM-dd')] || { date: format(new Date(), 'yyyy-MM-dd'), tasks: [] });
  const [saveStatus,    setSaveStatus]    = useState('');
  const [localDirty,    setLocalDirty]    = useState(false);
  const [timelineView,  setTimelineView]  = useState('daily');
  const [isSheetOpen,   setIsSheetOpen]   = useState(false);
  const [editingTask,   setEditingTask]   = useState(null);
  const [showFilters,   setShowFilters]   = useState(false);
  const [suggestedHour, setSuggestedHour] = useState(null);
  const [filterStatus,  setFilterStatus]  = useState('all');
  const [filterPriority,setFilterPriority]= useState('all');
  const [filterCategory,setFilterCategory]= useState('all');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [showSearch,    setShowSearch]    = useState(false);

  const { isSupported, permission, isSubscribed, loading, subscribe } = usePushNotifications();

  // ── Sync log on date change ──────────────────────────────────────────────────
  useEffect(() => {
    setLog(logs[date] ?? getLog(date) ?? { date, tasks: [] });
    setLocalDirty(false);
  }, [date, logs, getLog]);

  // ── Auto-save (1s debounce) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!localDirty) return;
    const timer = setTimeout(async () => {
      setSaveStatus('Saving…');
      try {
        await saveLog(date, log);
        setSaveStatus('Saved');
        setLocalDirty(false);
        setTimeout(() => setSaveStatus(''), 2000);
      } catch {
        setSaveStatus('Error');
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [log, date, saveLog, localDirty]);

  // ── Derived state ────────────────────────────────────────────────────────────
  const isFuture = useMemo(
    () => isAfter(startOfDay(parseISO(date)), startOfDay(new Date())),
    [date]
  );

  // Merge persisted tasks with virtual recurring instances
  const tasks = useMemo(() => {
    const real = log.tasks ?? [];
    const virtual = getVirtualTasksForDate(date);
    // Deduplicate: virtual instances are only added if no real entry with the same recurringId exists
    return [...real, ...virtual];
  }, [log.tasks, date, getVirtualTasksForDate]);

  // #1 — Progress pill stats
  const progressStats = useMemo(() => {
    const total     = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [tasks]);

  // #12 — Derive categories dynamically from all logs + base set
  const categoryFilters = useMemo(() => {
    const cats = new Set(BASE_CATEGORIES);
    Object.values(logs).forEach(log => {
      (log?.tasks ?? []).forEach(t => { if (t.category) cats.add(t.category); });
    });
    return ['all', ...Array.from(cats)];
  }, [logs]);

  const activeFilters = useMemo(
    () => ({ status: filterStatus, priority: filterPriority, category: filterCategory, search: searchQuery }),
    [filterStatus, filterPriority, filterCategory, searchQuery]
  );

  const hasActiveFilter = filterStatus !== 'all' || filterPriority !== 'all' || filterCategory !== 'all' || searchQuery !== '';

  // ── Date navigation ──────────────────────────────────────────────────────────
  const goToPrevDay  = useCallback(() => setDate(d => format(subDays(parseISO(d), 1), 'yyyy-MM-dd')), []);
  const goToNextDay  = useCallback(() => setDate(d => format(addDays(parseISO(d), 1), 'yyyy-MM-dd')), []);
  const goToToday    = useCallback(() => setDate(format(new Date(), 'yyyy-MM-dd')), []);
  const isOnToday    = date === format(new Date(), 'yyyy-MM-dd');

  // ── Task handlers ────────────────────────────────────────────────────────────
  const markDirty = useCallback((updater) => {
    setLog(updater);
    setLocalDirty(true);
  }, []);

  const handleUpdateTasks = useCallback((newTasks) => {
    markDirty(prev => ({ ...prev, tasks: newTasks }));
  }, [markDirty]);

  const handleUpdateTaskStatus = useCallback((taskIndex, newStatus) => {
    markDirty(prev => {
      const updated = [...(prev.tasks ?? [])];
      updated[taskIndex] = { ...updated[taskIndex], status: newStatus };
      return { ...prev, tasks: updated };
    });
  }, [markDirty]);

  const handleSaveTask = useCallback((taskData) => {
    markDirty(prev => {
      const existing = prev.tasks ?? [];
      const idx = existing.findIndex(t => t.id === taskData.id);
      if (idx >= 0) {
        const updated = [...existing];
        updated[idx] = taskData;
        return { ...prev, tasks: updated };
      }
      return { ...prev, tasks: [...existing, taskData] };
    });

    if (taskData.notificationEnabled && taskData.status === 'Pending') {
      scheduleTaskReminder(taskData, date);
    } else {
      cancelTaskReminder(taskData.id);
    }
  }, [date, markDirty, scheduleTaskReminder, cancelTaskReminder]);

  const handleDeleteTask = useCallback((taskId) => {
    markDirty(prev => ({ ...prev, tasks: (prev.tasks ?? []).filter(t => t.id !== taskId) }));
    cancelTaskReminder(taskId);
  }, [markDirty, cancelTaskReminder]);

  const handleDuplicateTask = useCallback((task) => {
    const dup = {
      ...task,
      id:               `task_${Date.now()}`,
      status:           'Pending',
      notificationSent: false,
      createdAt:        new Date().toISOString(),
    };
    markDirty(prev => ({ ...prev, tasks: [...(prev.tasks ?? []), dup] }));
  }, [markDirty]);

  const openEdit = useCallback((task) => {
    setEditingTask(task);
    setIsSheetOpen(true);
  }, []);

  const openAdd = useCallback(() => {
    setEditingTask(null);
    setSuggestedHour(null);
    setIsSheetOpen(true);
  }, []);

  const openAddAtHour = useCallback((h) => {
    setEditingTask(null);
    setSuggestedHour(h);
    setIsSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setIsSheetOpen(false);
    setEditingTask(null);
    setSuggestedHour(null);
  }, []);

  const clearFilters = useCallback((e) => {
    e.stopPropagation();
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterCategory('all');
    setSearchQuery('');
  }, []);

  const handleSelectDate = useCallback((d) => {
    setDate(d);
    setTimelineView('daily');
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="tasks-page">

      {/* Future date notice */}
      {isFuture && (
        <div className="future-date-banner">
          <strong>📅 Planning Mode:</strong> Viewing {format(parseISO(date), 'MMMM d, yyyy')}. You can pre-plan your tasks here.
        </div>
      )}

      {/* Push notification prompt */}
      {isSupported && !isSubscribed && permission !== 'denied' && (
        <div className="push-notif-banner">
          <div className="push-notif-body">
            <div className="push-notif-icon">
              <Bell size={18} aria-hidden="true" />
            </div>
            <div>
              <h4 className="push-notif-title">Enable Task Reminders</h4>
              <p className="push-notif-sub">Get notified when tasks are due, even when the app is closed.</p>
            </div>
          </div>
          <button
            className="btn push-notif-btn"
            onClick={subscribe}
            disabled={loading}
            aria-label="Enable push notifications"
          >
            {loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Bell size={14} aria-hidden="true" />}
            Enable
          </button>
        </div>
      )}

      {/* ── Sticky Hub Toolbar ──────────────────────────────────────────────── */}
      <div className="hub-toolbar" role="toolbar" aria-label="Timeline controls">
        <div className="hub-toolbar-left">

          {/* Brand */}
          <div className="hub-brand">
            <Target size={20} className="hub-brand-icon" aria-hidden="true" />
            <span className="hub-brand-label">Hub</span>
          </div>

          {/* View toggle */}
          <div className="hub-toolbar-toggle" role="group" aria-label="View mode">
            {VIEW_OPTIONS.map(v => (
              <button
                key={v.key}
                className={`hub-toggle-btn ${timelineView === v.key ? 'hub-toggle-btn--active' : ''}`}
                onClick={() => setTimelineView(v.key)}
                aria-pressed={timelineView === v.key}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          {/* #2 ── Custom date navigator (replaces raw date input) */}
          <div className="hub-date-nav" role="group" aria-label="Date navigation">
            <button
              className="hub-date-nav-btn"
              onClick={goToPrevDay}
              aria-label="Previous day"
            >
              <ChevronLeft size={15} />
            </button>

            <button
              className={`hub-date-display ${isOnToday ? 'hub-date-display--today' : ''}`}
              onClick={goToToday}
              title="Click to jump to today"
              aria-label={isOnToday ? 'Today' : `Go to today (currently viewing ${format(parseISO(date), 'MMM d')})`}
            >
              <span className="hub-date-label">
                {isOnToday ? 'Today' : format(parseISO(date), 'MMM d')}
              </span>
              {!isOnToday && (
                <span className="hub-date-year">{format(parseISO(date), 'yyyy')}</span>
              )}
            </button>

            <button
              className="hub-date-nav-btn"
              onClick={goToNextDay}
              aria-label="Next day"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="hub-toolbar-right">

          {/* #1 ── Progress pill */}
          {timelineView === 'daily' && progressStats.total > 0 && (
            <div
              className="hub-progress-pill"
              aria-label={`${progressStats.completed} of ${progressStats.total} tasks completed`}
              title={`${progressStats.pct}% complete`}
            >
              <div className="hub-progress-track">
                <div
                  className="hub-progress-fill"
                  style={{ width: `${progressStats.pct}%` }}
                />
              </div>
              <span className="hub-progress-label">
                {progressStats.completed}<span className="hub-progress-sep">/</span>{progressStats.total}
              </span>
            </div>
          )}

          {/* #11 ── Search toggle */}
          {timelineView === 'daily' && (
            <button
              className={`hub-filter-btn ${showSearch ? 'hub-filter-btn--active' : ''}`}
              onClick={() => setShowSearch(s => !s)}
              aria-label="Toggle task search"
              title="Search tasks"
            >
              <Search size={13} aria-hidden="true" />
            </button>
          )}

          {/* Filter toggle */}
          {timelineView === 'daily' && (
            <button
              className={`hub-filter-btn ${hasActiveFilter ? 'hub-filter-btn--active' : ''}`}
              onClick={() => setShowFilters(f => !f)}
              aria-expanded={showFilters}
              aria-label={hasActiveFilter ? 'Filters active' : 'Toggle filters'}
            >
              <Filter size={13} aria-hidden="true" />
              {hasActiveFilter ? 'Filtered' : 'Filter'}
              {hasActiveFilter && (
                <span
                  className="hub-filter-clear"
                  onClick={clearFilters}
                  role="button"
                  aria-label="Clear filters"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && clearFilters(e)}
                >
                  <X size={12} aria-hidden="true" />
                </span>
              )}
            </button>
          )}

          {/* Save status */}
          <div
            className={`hub-save-status hub-save-status--${saveStatus === 'Error' ? 'error' : saveStatus === 'Saved' ? 'saved' : 'idle'}`}
            aria-live="polite"
          >
            {saveStatus === 'Saved' && <CheckCircle2 size={14} aria-hidden="true" />}
            {saveStatus}
          </div>
        </div>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      {showSearch && timelineView === 'daily' && (
        <div className="tl-search-bar" role="search">
          <Search size={14} className="tl-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="tl-search-input"
            placeholder="Search tasks by name…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            autoFocus
            aria-label="Search tasks"
          />
          {searchQuery && (
            <button
              className="tl-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      {showFilters && timelineView === 'daily' && (
        <div className="tl-filter-bar">
          <FilterGroup
            label="Status"
            options={STATUS_FILTERS}
            value={filterStatus}
            onChange={setFilterStatus}
            display={s => s === 'all' ? 'All' : s}
          />
          <span className="tl-filter-divider" aria-hidden="true" />
          <FilterGroup
            label="Priority"
            options={PRIORITY_FILTERS}
            value={filterPriority}
            onChange={setFilterPriority}
            display={p => p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
          />
          <span className="tl-filter-divider" aria-hidden="true" />
          <FilterGroup
            label="Category"
            options={categoryFilters}
            value={filterCategory}
            onChange={setFilterCategory}
            display={c => c === 'all' ? 'All' : c}
          />
        </div>
      )}

      {/* ── Views ──────────────────────────────────────────────────────────── */}
      {timelineView === 'monthly' ? (
        <MonthlyCalendar
          currentDate={date}
          logs={logs}
          onSelectDate={handleSelectDate}
          onAddClick={openAdd}
        />
      ) : (
        <div className="timeline-view-wrap">
          <SmartAlerts date={date} tasks={tasks} logs={logs} recurringTasks={recurringTasks} />
          <MissedTasksBar tasks={tasks} onUpdateTaskStatus={handleUpdateTaskStatus} />
          <LiveFocusBanner tasks={tasks} onUpdateStatus={handleUpdateTaskStatus} />
          <TimelineAnalytics date={date} tasks={tasks} logs={logs} />
          <DailyTimeline
            date={date}
            tasks={tasks}
            onUpdateTask={handleUpdateTasks}
            onEditTask={openEdit}
            onAddClick={openAddAtHour}
            isFutureDate={isFuture}
            filters={activeFilters}
          />
        </div>
      )}

      {/* ── FAB ────────────────────────────────────────────────────────────── */}
      {timelineView === 'daily' && (
        <button
          className="fab-button-v2"
          onClick={openAdd}
          aria-label="Add new task"
        >
          <Plus size={20} aria-hidden="true" />
          <span className="fab-label">Add Task</span>
        </button>
      )}

      {/* ── Task Bottom Sheet ───────────────────────────────────────────────── */}
      <TaskBottomSheet
        isOpen={isSheetOpen}
        onClose={closeSheet}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        onDuplicate={handleDuplicateTask}
        initialData={editingTask}
        isFutureDate={isFuture}
        suggestedHour={suggestedHour}
      />
    </div>
  );
}

// ── Filter Group Sub-component ────────────────────────────────────────────────
function FilterGroup({ label, options, value, onChange, display }) {
  return (
    <div className="tl-filter-group" role="group" aria-label={`Filter by ${label}`}>
      <span className="tl-filter-label">{label}:</span>
      {options.map(opt => (
        <button
          key={opt}
          className={`tl-filter-chip ${value === opt ? 'active' : ''}`}
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
        >
          {display(opt)}
        </button>
      ))}
    </div>
  );
}
