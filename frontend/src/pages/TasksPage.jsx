import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHabits } from '../Store';
import { format, isAfter, startOfDay, parseISO, addDays, subDays, isToday, startOfWeek, endOfWeek } from 'date-fns';

// Fallback for startOfWeek in case the imported symbol is undefined at runtime
const safeStartOfWeek = typeof startOfWeek === 'function'
  ? startOfWeek
  : (date, opts = {}) => {
      const d = new Date(date);
      const weekStartsOn = opts.weekStartsOn ?? 0;
      const day = d.getDay();
      const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      return d;
    };
import {
  Plus, Loader2, Bell,
  List, CalendarDays, CheckCircle2, Target, Filter, X,
  ChevronLeft, ChevronRight, Search, FileDown,
} from 'lucide-react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  const [searchParams, setSearchParams] = useSearchParams();
  const queryDate = searchParams.get('date');

  const [date,          setDate]          = useState(() => {
    if (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
      return queryDate;
    }
    return format(new Date(), 'yyyy-MM-dd');
  });

  // Sync date when URL search parameter changes
  useEffect(() => {
    if (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate) && queryDate !== date) {
      setDate(queryDate);
    }
  }, [queryDate]);

  const [log,           setLog]           = useState(() => logs[date] || { date, tasks: [] });
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
  const goToPrevWeek = useCallback(() => setDate(d => format(subDays(parseISO(d), 7), 'yyyy-MM-dd')), []);
  const goToNextWeek = useCallback(() => setDate(d => format(addDays(parseISO(d), 7), 'yyyy-MM-dd')), []);
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

  const handleDownloadPDF = useCallback(() => {
    try {
      const doc = new jsPDF();
      const reportDateStr = format(parseISO(date), 'MMMM d, yyyy');
      
      // Theme colors (Midnight/Navy brand styles)
      const primaryColor = [15, 23, 42]; // deep slate
      const accentColor = [99, 102, 241]; // indigo
      
      // Page background
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, 210, 297, 'F');
      
      // Header Banner
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 42, 'F');
      
      // Accent line
      doc.setFillColor(...accentColor);
      doc.rect(0, 42, 210, 4, 'F');
      
      // Brand Title
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('HABIT TRACKER', 16, 20);
      
      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(203, 213, 225);
      doc.text('Daily Focus & Task Performance Report', 16, 28);
      
      // Date in Header (Right aligned)
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(reportDateStr, 194, 25, { align: 'right' });
      
      // Summary Metrics Card
      const cardY = 56;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(16, cardY, 178, 30, 3, 3, 'FD');
      
      // Card vertical accent line
      doc.setFillColor(...accentColor);
      doc.rect(16, cardY, 3, 30, 'F');
      
      // Progress stats calculations
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'Completed').length;
      const missed = tasks.filter(t => t.status === 'Missed').length;
      const pending = tasks.filter(t => !t.status || t.status === 'Pending').length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      // Metrics text placement
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('TOTAL TASKS', 26, cardY + 11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...primaryColor);
      doc.text(String(total), 26, cardY + 22);
      
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('COMPLETED', 66, cardY + 11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(16, 185, 129); // emerald
      doc.text(`${completed} (${pct}%)`, 66, cardY + 22);
      
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('MISSED', 116, cardY + 11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(239, 68, 68); // rose/red
      doc.text(String(missed), 116, cardY + 22);
      
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('PENDING', 156, cardY + 11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(245, 158, 11); // amber
      doc.text(String(pending), 156, cardY + 22);
      
      // Section title: Tasks Table
      doc.setTextColor(...primaryColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Detailed Task List', 16, cardY + 44);
      
      // Table data mapping
      const tableRows = tasks.map((t, idx) => [
        t.time || '--:--',
        t.title || 'Untitled Task',
        t.category || 'Personal',
        (t.priority || 'medium').toUpperCase(),
        t.status || 'Pending'
      ]);
      
      autoTable(doc, {
        startY: cardY + 48,
        margin: { left: 16, right: 16 },
        head: [['Time', 'Task Description', 'Category', 'Priority', 'Status']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left',
          fontSize: 9,
          cellPadding: 5
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [51, 65, 85],
          cellPadding: 4
        },
        alternateRowStyles: {
          fillColor: [241, 245, 249]
        },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 32 },
          3: { cellWidth: 22 },
          4: { cellWidth: 28, fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const status = data.cell.raw;
            if (status === 'Completed') {
              data.cell.styles.textColor = [16, 185, 129]; // emerald green
            } else if (status === 'Missed') {
              data.cell.styles.textColor = [239, 68, 68]; // red
            } else if (status === 'Pending') {
              data.cell.styles.textColor = [245, 158, 11]; // amber
            } else if (status === 'Delayed') {
              data.cell.styles.textColor = [99, 102, 241]; // indigo
            }
          }
        }
      });
      
      // Footer text on every page
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        
        // Footer divider
        doc.setDrawColor(226, 232, 240);
        doc.line(16, 285, 194, 285);
        
        // Page numbers & generated info
        doc.text(`Generated by Habit Tracker • ${new Date().toLocaleDateString()}`, 16, 290);
        doc.text(`Page ${i} of ${pageCount}`, 194, 290, { align: 'right' });
      }
      
      // Download file
      doc.save(`HabitTracker_Report_${date}.pdf`);
    } catch (err) {
      console.error('Error generating PDF report:', err);
    }
  }, [date, tasks]);

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

          {/* Week navigation */}
          <div className="hub-week-nav" role="group" aria-label="Week navigation">
            <button
              className="hub-week-nav-btn"
              onClick={goToPrevWeek}
              aria-label="Previous week"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="hub-week-label">
              {format(safeStartOfWeek(parseISO(date), { weekStartsOn: 1 }), 'MMM d')}
              {' – '}
              {format(endOfWeek(parseISO(date), { weekStartsOn: 1 }), 'MMM d')}
            </span>
            <button
              className="hub-week-nav-btn"
              onClick={goToNextWeek}
              aria-label="Next week"
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

          {/* PDF export button */}
          {timelineView === 'daily' && (
            <button
              className="hub-pdf-btn"
              onClick={handleDownloadPDF}
              aria-label="Download Daily PDF Report"
              title="Download PDF Report"
            >
              <FileDown size={13} aria-hidden="true" />
              <span>Export PDF</span>
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
