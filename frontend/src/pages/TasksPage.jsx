import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHabits } from '../Store';
import { format, isAfter, startOfDay, parseISO, addDays, subDays, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { Play, Pause, Square, Clock as ClockIcon } from 'lucide-react';

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
  Plus,
  List, CalendarDays, CheckCircle2, Target, Filter, X,
  ChevronLeft, ChevronRight, Search, FileDown,
  CheckCircle, XCircle, RefreshCw, Trash2,
} from 'lucide-react';

import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

import DailyTimeline     from '../components/timeline/DailyTimeline';
import TaskBottomSheet   from '../components/timeline/TaskBottomSheet';
import MissedTasksBar    from '../components/timeline/MissedTasksBar';
import MonthlyCalendar   from '../components/timeline/MonthlyCalendar';
import TimelineAnalytics from '../components/timeline/TimelineAnalytics';
import LiveFocusBanner   from '../components/timeline/LiveFocusBanner';
import SmartAlerts       from '../components/timeline/SmartAlerts';


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
  const { getLog, saveLog, logs, expenseCategories, getVirtualTasksForDate, recurringTasks } = useHabits();

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
  const [saveSaving,    setSaveSaving]    = useState(false);
  const [undoToast,     setUndoToast]     = useState(null);
  const [selectedIds,   setSelectedIds]   = useState(new Set());
  const [bulkMode,      setBulkMode]      = useState(false);
  const [batchEditMode, setBatchEditMode] = useState(false);
  const [batchPriority, setBatchPriority] = useState('');
  const [batchCategory, setBatchCategory] = useState('');
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroPhase, setPomodoroPhase] = useState('work'); // work | break
  const [pomodoroSeconds, setPomodoroSeconds] = useState(25 * 60);
  const jsonInputRef = useRef(null);

  // #28 — Pomodoro timer tick
  const pomodoroRef = useRef(null);
  useEffect(() => {
    if (!pomodoroActive) { if (pomodoroRef.current) clearInterval(pomodoroRef.current); return; }
    pomodoroRef.current = setInterval(() => {
      setPomodoroSeconds(s => {
        if (s <= 1) {
          // Cycle
          const nextPhase = pomodoroPhase === 'work' ? 'break' : 'work';
          const nextDur = nextPhase === 'work' ? 25 * 60 : 5 * 60;
          setPomodoroPhase(nextPhase);
          if (Notification.permission === 'granted') new Notification(`Pomodoro: ${nextPhase === 'work' ? 'Work' : 'Break'} time!`);
          return nextDur;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(pomodoroRef.current);
  }, [pomodoroActive, pomodoroPhase]);
  const [loading,       setLoading]       = useState(true);
  const [autoRescheduledCount, setAutoRescheduledCount] = useState(0);
  const [pdfError, setPdfError] = useState('');
  const mountedRef = useRef(false);

  // #41 — Auto-reschedule missed tasks on mount
  useEffect(() => {
    if (!mountedRef.current) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayLog = getLog(today);
    if (!todayLog) return;
    const todayTasks = getVirtualTasksForDate(today, todayLog.tasks ?? []);
    const missed = todayTasks.filter(t => t.status === 'Missed' && !t.isVirtual);
    if (missed.length === 0) return;
    const updatedTasks = (todayLog.tasks ?? []).map(t => {
      if (missed.some(m => m.id === t.id)) return { ...t, status: 'Pending' };
      return t;
    });
    saveLog(today, { tasks: updatedTasks });
    setAutoRescheduledCount(missed.length);
    setTimeout(() => setAutoRescheduledCount(0), 5000);
  }, []);



  // ── Sync log on date change ──────────────────────────────────────────────────
  useEffect(() => {
    setLog(logs[date] ?? getLog(date) ?? { date, tasks: [] });
    setLocalDirty(false);
    if (!mountedRef.current) {
      mountedRef.current = true;
      setLoading(false);
    }
  }, [date, logs, getLog]);

  const logRef = React.useRef(log);
  const dateRef = React.useRef(date);
  const localDirtyRef = React.useRef(localDirty);

  useEffect(() => {
    logRef.current = log;
    dateRef.current = date;
    localDirtyRef.current = localDirty;
  }, [log, date, localDirty]);

  // ── Auto-save (1s debounce, with save-in-progress guard) ──────────────────────
  useEffect(() => {
    if (!localDirty || saveSaving) return;
    const timer = setTimeout(async () => {
      setSaveSaving(true);
      setSaveStatus('Saving…');
      try {
        await saveLog(date, log);
        setSaveStatus('Saved');
        setLocalDirty(false);
        setTimeout(() => setSaveStatus(''), 2000);
      } catch {
        setSaveStatus('Error');
      } finally {
        setSaveSaving(false);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [log, date, saveLog, localDirty, saveSaving]);

  useEffect(() => {
    const handleSavePending = () => {
      if (localDirtyRef.current) {
        saveLog(dateRef.current, logRef.current).catch(err => {
          console.error('[TasksPage] Pending save failed:', err);
        });
      }
    };
    window.addEventListener('evolvia-save-pending', handleSavePending);

    return () => {
      window.removeEventListener('evolvia-save-pending', handleSavePending);
      if (localDirtyRef.current) {
        saveLog(dateRef.current, logRef.current).catch(err => {
          console.error('[TasksPage] Unmount save failed:', err);
        });
      }
    };
  }, [saveLog]);

  // ── Derived state ────────────────────────────────────────────────────────────
  const isFuture = useMemo(
    () => isAfter(startOfDay(parseISO(date)), startOfDay(new Date())),
    [date]
  );

  // Merge persisted tasks with virtual recurring instances
  const tasks = useMemo(() => {
    const real = (log.tasks ?? []).filter(t => !t.isVirtual);
    // Pass the real tasks for override detection so deletes are reflected immediately
    const virtual = getVirtualTasksForDate(date, real);
    return [...real, ...virtual];
  }, [log.tasks, date, getVirtualTasksForDate, log]);

  // #1 — Progress pill stats
  const progressStats = useMemo(() => {
    const total     = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [tasks]);

  const totalDeepWork = useMemo(() => {
    const qualifying = ['Video Editing', 'Side Hustle', 'Learning'];
    return tasks
      .filter(t => {
        const cats = Array.isArray(t.categories) ? t.categories : [t.category || 'Other'];
        return cats.some(c => qualifying.includes(c));
      })
      .reduce((sum, t) => sum + (parseFloat(t.deepWorkHours) || 0), 0);
  }, [tasks]);

  // #12 — Derive categories dynamically from all logs + base set
  const categoryFilters = useMemo(() => {
    const cats = new Set(BASE_CATEGORIES);
    Object.values(logs).forEach(log => {
      (log?.tasks ?? []).forEach(t => {
        if (t.categories) t.categories.forEach(c => cats.add(c));
        else if (t.category) cats.add(t.category);
      });
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
    const prevTasks = log.tasks ?? [];
    const prevTask = prevTasks[taskIndex];
    markDirty(prev => {
      const updated = [...(prev.tasks ?? [])];
      updated[taskIndex] = { ...updated[taskIndex], status: newStatus };
      return { ...prev, tasks: updated };
    });
    // Undo toast
    setUndoToast({ taskIndex, prevStatus: prevTask?.status, newStatus, message: `Marked "${prevTask?.title || 'task'}" as ${newStatus}` });
    setTimeout(() => setUndoToast(null), 5000);
  }, [markDirty, log.tasks]);

  const handleUndoStatus = useCallback(() => {
    if (!undoToast) return;
    markDirty(prev => {
      const updated = [...(prev.tasks ?? [])];
      if (updated[undoToast.taskIndex]) {
        updated[undoToast.taskIndex] = { ...updated[undoToast.taskIndex], status: undoToast.prevStatus };
      }
      return { ...prev, tasks: updated };
    });
    setUndoToast(null);
  }, [undoToast, markDirty]);

  // ── Snooze (postpone to tomorrow) ──────────────────────────────
  const handleSnooze = useCallback((task) => {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    markDirty(prev => {
      // Mark current task as missed
      const updated = [...(prev.tasks ?? [])];
      const idx = updated.findIndex(t => t.id === task.id);
      if (idx >= 0) updated[idx] = { ...updated[idx], status: 'Missed' };
      // Clone task for tomorrow as Pending
      const { id, ...rest } = task;
      const snoozed = { ...rest, status: 'Pending', isSnoozed: true, snoozedFrom: date, id: `${Date.now()}_snooze` };
      return { ...prev, tasks: [...updated, snoozed] };
    });
  }, [date, markDirty]);

  // ── Bulk operations ────────────────────────────────────────────
  const toggleBulkSelect = useCallback((taskId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  }, []);

  const bulkAction = useCallback((newStatus) => {
    markDirty(prev => {
      const updated = [...(prev.tasks ?? [])];
      selectedIds.forEach(id => {
        const idx = updated.findIndex(t => t.id === id);
        if (idx >= 0) updated[idx] = { ...updated[idx], status: newStatus };
      });
      return { ...prev, tasks: updated };
    });
    setSelectedIds(new Set());
    setBulkMode(false);
  }, [selectedIds, markDirty]);

  const bulkDelete = useCallback(() => {
    markDirty(prev => ({
      ...prev,
      tasks: (prev.tasks ?? []).filter(t => !selectedIds.has(t.id))
    }));
    setSelectedIds(new Set());
    setBulkMode(false);
  }, [selectedIds, markDirty]);

  const applyBatchEdit = useCallback(() => {
    markDirty(prev => {
      const updated = [...(prev.tasks ?? [])];
      selectedIds.forEach(id => {
        const idx = updated.findIndex(t => t.id === id);
        if (idx < 0) return;
        const upd = { ...updated[idx] };
        if (batchPriority) upd.priority = batchPriority;
        if (batchCategory) upd.category = batchCategory;
        updated[idx] = upd;
      });
      return { ...prev, tasks: updated };
    });
    setBatchEditMode(false);
    setBatchPriority('');
    setBatchCategory('');
    setSelectedIds(new Set());
    setBulkMode(false);
  }, [selectedIds, markDirty, batchPriority, batchCategory]);

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
  }, [markDirty]);

  const handleDeleteTask = useCallback((taskId) => {
    markDirty(prev => ({ ...prev, tasks: (prev.tasks ?? []).filter(t => t.id !== taskId) }));
  }, [markDirty]);

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

  const handleMoveToDate = useCallback((task, targetDate) => {
    const dup = {
      ...task, id: `task_${Date.now()}_moved`, time: task.time || '09:00',
      status: 'Pending', notificationSent: false, createdAt: new Date().toISOString(),
    };
    const targetLog = getLog(targetDate);
    const existingTasks = targetLog?.tasks ?? [];
    saveLog(targetDate, { tasks: [...existingTasks, dup] });
    // Remove from current day
    markDirty(prev => ({ ...prev, tasks: (prev.tasks ?? []).filter(t => t.id !== task.id) }));
  }, [getLog, saveLog, markDirty]);

  const handleCloneToDate = useCallback((task, targetDate) => {
    const dup = {
      ...task,
      id:               `task_${Date.now()}_clone`,
      time:             task.time || '09:00',
      status:           'Pending',
      notificationSent: false,
      createdAt:        new Date().toISOString(),
    };
    const targetLog = getLog(targetDate);
    const existingTasks = targetLog?.tasks ?? [];
    saveLog(targetDate, { tasks: [...existingTasks, dup] });
  }, [getLog, saveLog]);

  // #46 — .ics export
  const exportIcs = useCallback(() => {
    const fmt = (d) => {
      const p = (n) => String(n).padStart(2,'0');
      return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
    };
    let lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//HabitTracker//EN'];
    const now = new Date();
    tasks.filter(t => t.status !== 'Missed' && t.status !== 'Skipped').forEach(t => {
      const startH = parseInt((t.time||'09:00').split(':')[0]);
      const startM = parseInt((t.time||'09:00').split(':')[1]);
      const dur = parseInt(t.duration) || 30;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM);
      const end = new Date(start.getTime() + dur * 60000);
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${t.id}@habittracker`);
      lines.push(`DTSTART:${fmt(start)}`);
      lines.push(`DTEND:${fmt(end)}`);
      lines.push(`SUMMARY:${t.title}`);
      if (t.description) lines.push(`DESCRIPTION:${t.description}`);
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type:'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `tasks-${date}.ics`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [tasks, date]);

  // #51 — JSON export
  const exportJson = useCallback(() => {
    const data = { version:1, exportedAt:new Date().toISOString(), tasks };
    const blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `tasks-${date}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [tasks, date]);

  const importJson = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.tasks && Array.isArray(data.tasks)) {
          markDirty(prev => ({ ...prev, tasks: data.tasks }));
        }
      } catch(err) { console.error('Import failed:', err); }
    };
    reader.readAsText(file);
    e.target.value = '';
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

  // #49 — Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openAdd(); }
      if (e.key === 'j' || e.key === 'J') { e.preventDefault(); setDate(d => format(addDays(parseISO(d), 1), 'yyyy-MM-dd')); }
      if (e.key === 'k' || e.key === 'K') { e.preventDefault(); setDate(d => format(subDays(parseISO(d), 1), 'yyyy-MM-dd')); }
      if (e.key === ' ') { e.preventDefault(); setBulkMode(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openAdd]);

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

  const handleDownloadPDF = useCallback(async () => {
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const reportDateStr = format(parseISO(date), 'MMMM d, yyyy');

      // ── Brand colours ─────────────────────────────────────────────
      const C = {
        navy:    [15,  23,  42],
        indigo:  [99, 102, 241],
        emerald: [16, 185, 129],
        red:     [239, 68,  68],
        amber:   [245,158,  11],
        slate:   [71,  85, 105],
        light:   [241,245, 249],
        white:   [255,255, 255],
        muted:   [148,163, 184],
        border:  [226,232, 240],
      };

      // ── Helper: draw footer on current page ───────────────────────
      const drawFooter = (pageNum, totalPages) => {
        doc.setDrawColor(...C.border);
        doc.line(14, 284, 196, 284);
        doc.setFontSize(7.5);
        doc.setTextColor(...C.muted);
        doc.setFont('helvetica', 'normal');
        doc.text(`Evolvio · Daily Habits Report · Generated ${new Date().toLocaleDateString()}`, 14, 289);
        doc.text(`Page ${pageNum} of ${totalPages}`, 196, 289, { align: 'right' });
      };

      // ═══════════════════════════════════════════════════════════════
      // PAGE 1 — HEADER
      // ═══════════════════════════════════════════════════════════════

      // Background
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, 210, 297, 'F');

      // Dark header band
      doc.setFillColor(...C.navy);
      doc.rect(0, 0, 210, 46, 'F');

      // Indigo accent stripe
      doc.setFillColor(...C.indigo);
      doc.rect(0, 46, 210, 3.5, 'F');

      // ── Logo (attempt to load /logo_circle.png) ────────────────────
      try {
        const imgData = await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width  = img.naturalWidth  || img.width;
            canvas.height = img.naturalHeight || img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = reject;
          img.src = '/logo_circle.png';
        });
        doc.addImage(imgData, 'PNG', 174, 6, 28, 28);
      } catch {
        // fallback – draw a simple circle badge
        doc.setFillColor(...C.indigo);
        doc.circle(188, 20, 13, 'F');
        doc.setTextColor(...C.white);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('E', 188, 23, { align: 'center' });
      }

      // App name
      doc.setTextColor(...C.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('EVOLVIO', 14, 22);

      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(203, 213, 225);
      doc.text('Daily Habits & Task Performance Report', 14, 30);

      // Date chip (right side)
      doc.setFillColor(255, 255, 255, 0.12);
      doc.setDrawColor(255, 255, 255, 0.2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...C.white);
      doc.text(reportDateStr, 196, 38, { align: 'right' });

      // ── STATS CARD ─────────────────────────────────────────────────
      const statsY = 58;
      const total     = tasks.length;
      const completed = tasks.filter(t => t.status === 'Completed').length;
      const missed    = tasks.filter(t => t.status === 'Missed').length;
      const delayed   = tasks.filter(t => t.status === 'Delayed').length;
      const pending   = tasks.filter(t => !t.status || t.status === 'Pending').length;
      const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

      // White card
      doc.setFillColor(...C.white);
      doc.setDrawColor(...C.border);
      doc.roundedRect(14, statsY, 182, 36, 3, 3, 'FD');

      // Left accent bar
      doc.setFillColor(...C.indigo);
      doc.roundedRect(14, statsY, 4, 36, 2, 0, 'F');

      // Stat columns
      const stats = [
        { label: 'TOTAL',     value: String(total),            color: C.navy    },
        { label: 'DONE',      value: `${completed} (${pct}%)`, color: C.emerald },
        { label: 'MISSED',    value: String(missed),           color: C.red     },
        { label: 'DELAYED',   value: String(delayed),          color: C.indigo  },
        { label: 'PENDING',   value: String(pending),          color: C.amber   },
      ];
      stats.forEach((s, i) => {
        const x = 24 + i * 36;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.slate);
        doc.text(s.label, x, statsY + 13);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...s.color);
        doc.text(s.value, x, statsY + 25);
      });

      // ── PROGRESS BAR ───────────────────────────────────────────────
      const pbY = statsY + 43;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.navy);
      doc.text(`Completion: ${pct}%`, 14, pbY);
      // Track
      doc.setFillColor(...C.light);
      doc.roundedRect(14, pbY + 3, 182, 5, 2, 2, 'F');
      // Fill
      if (pct > 0) {
        doc.setFillColor(...C.indigo);
        doc.roundedRect(14, pbY + 3, 182 * (pct / 100), 5, 2, 2, 'F');
      }

      // ── TASK TABLE ─────────────────────────────────────────────────
      const tableStartY = pbY + 16;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...C.navy);
      doc.text('Detailed Task Log', 14, tableStartY);

      const taskRows = tasks.map(t => [
        t.time || '--:--',
        t.title || 'Untitled Task',
        t.category || 'Personal',
        (t.priority || 'medium').charAt(0).toUpperCase() + (t.priority || 'medium').slice(1),
        t.status || 'Pending',
        t.duration ? `${t.duration}m` : '—',
      ]);

      autoTable(doc, {
        startY: tableStartY + 4,
        margin: { left: 14, right: 14 },
        head: [['Time', 'Task', 'Category', 'Priority', 'Status', 'Dur.']],
        body: taskRows.length > 0 ? taskRows : [['—', 'No tasks logged for this day', '', '', '', '']],
        theme: 'grid',
        headStyles: {
          fillColor: C.navy,
          textColor: C.white,
          fontStyle: 'bold',
          fontSize: 8.5,
          cellPadding: 4,
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85],
          cellPadding: 3.5,
        },
        alternateRowStyles: { fillColor: C.light },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 28 },
          3: { cellWidth: 22 },
          4: { cellWidth: 24, fontStyle: 'bold' },
          5: { cellWidth: 14, halign: 'center' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const s = data.cell.raw;
            if (s === 'Completed') data.cell.styles.textColor = C.emerald;
            else if (s === 'Missed')    data.cell.styles.textColor = C.red;
            else if (s === 'Pending')   data.cell.styles.textColor = C.amber;
            else if (s === 'Delayed')   data.cell.styles.textColor = C.indigo;
          }
          if (data.section === 'body' && data.column.index === 3) {
            const p = data.cell.raw?.toLowerCase();
            if (p === 'critical') data.cell.styles.textColor = C.red;
            else if (p === 'High') data.cell.styles.textColor = C.amber;
          }
        },
      });

      // ── DAILY EXPENSE SECTION ──────────────────────────────────────
      const dailyLog    = logs[date] || {};
      const expenses    = (dailyLog.expenses || []).filter(e => parseFloat(e.amount) > 0);
      const totalSpent  = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

      // Category breakdown
      const catMap = {};
      expenses.forEach(e => {
        const cat = e.category || 'Other';
        catMap[cat] = (catMap[cat] || 0) + (parseFloat(e.amount) || 0);
      });
      const catRows = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

      const expY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 180;

      // Check if we need a new page for expense section
      const needsNewPage = expY > 230;
      if (needsNewPage) {
        doc.addPage();
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, 210, 297, 'F');
      }

      const expSectionY = needsNewPage ? 16 : expY;

      // Section header bar
      doc.setFillColor(...C.navy);
      doc.roundedRect(14, expSectionY, 182, 9, 2, 2, 'F');
      doc.setTextColor(...C.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Daily Expense Report', 18, expSectionY + 6.2);

      // Total spent badge (right)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Total: ${totalSpent.toFixed(3)} TND`, 196, expSectionY + 6.2, { align: 'right' });

      if (expenses.length === 0) {
        // No expenses
        doc.setFillColor(...C.white);
        doc.setDrawColor(...C.border);
        doc.roundedRect(14, expSectionY + 12, 182, 14, 2, 2, 'FD');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...C.muted);
        doc.text('No expenses recorded for this day.', 105, expSectionY + 21, { align: 'center' });
      } else {
        // Category summary chips
        let chipX = 14;
        const chipY = expSectionY + 14;
        catRows.slice(0, 6).forEach(([cat, amt]) => {
          const label = `${cat}: ${amt.toFixed(3)} TND`;
          const w = Math.min(doc.getTextWidth(label) + 8, 60);
          if (chipX + w > 196) return; // skip if too wide
          doc.setFillColor(...C.light);
          doc.setDrawColor(...C.border);
          doc.roundedRect(chipX, chipY, w, 7, 1.5, 1.5, 'FD');
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...C.slate);
          doc.text(label, chipX + 4, chipY + 5);
          chipX += w + 3;
        });

        // Expense detail table
        const expenseRows = expenses.map(e => [
          e.time || '--:--',
          e.category || 'Other',
          e.desc || 'No description',
          `${parseFloat(e.amount).toFixed(3)} TND`,
        ]);

        autoTable(doc, {
          startY: chipY + 11,
          margin: { left: 14, right: 14 },
          head: [['Time', 'Category', 'Description', 'Amount']],
          body: expenseRows,
          foot: [['', '', 'TOTAL', `${totalSpent.toFixed(3)} TND`]],
          theme: 'grid',
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: C.white,
            fontStyle: 'bold',
            fontSize: 8.5,
            cellPadding: 4,
          },
          bodyStyles: {
            fontSize: 8,
            textColor: [51, 65, 85],
            cellPadding: 3.5,
          },
          footStyles: {
            fillColor: C.navy,
            textColor: C.white,
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 4,
          },
          alternateRowStyles: { fillColor: C.light },
          columnStyles: {
            0: { cellWidth: 18 },
            1: { cellWidth: 30 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
          },
        });
      }

      // ── FOOTER ON ALL PAGES ────────────────────────────────────────
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        drawFooter(i, pageCount);
      }

      // ── SAVE ───────────────────────────────────────────────────────
      doc.save(`Evolvio_DailyReport_${date}.pdf`);
    } catch (err) {
      console.error('[PDF] Error generating report:', err);
      setPdfError('Could not generate PDF. Please try again.');
    }
  }, [date, tasks, logs]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="tasks-page">

      {/* Future date notice */}
      {isFuture && (
        <div className="future-date-banner">
          <strong>📅 Planning Mode:</strong> Viewing {format(parseISO(date), 'MMMM d, yyyy')}. You can pre-plan your tasks here.
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="tl-loading-skeleton">
          {[1,2,3,4].map(i => (
            <div key={i} className="tl-skeleton-row" style={{ height: 48 + i * 8, marginBottom: 10, borderRadius: 10, background: 'var(--skeleton)', animation: 'tlShimmer 1.5s infinite' }} />
          ))}
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

          {/* Day navigation */}
          <div className="hub-week-nav" role="group" aria-label="Day navigation">
            <button
              className="hub-week-nav-btn"
              onClick={goToPrevDay}
              aria-label="Previous day"
            >
              <ChevronLeft size={15} />
            </button>
            <span 
              className="hub-week-label"
              style={{ cursor: 'pointer', position: 'relative' }}
              onClick={() => {
                const el = document.getElementById('hub-native-date-picker');
                if (el) {
                  try { el.showPicker(); } catch (_) { el.click(); }
                }
              }}
              title="Click to pick a specific date"
            >
              {format(new Date(date + 'T12:00:00'), 'MMM d, yyyy')}
              <input
                id="hub-native-date-picker"
                type="date"
                value={date}
                onChange={(e) => {
                  if (e.target.value) {
                    setDate(e.target.value);
                  }
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />
            </span>
            <button
              className="hub-week-nav-btn"
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

          {/* Deep Work total */}
          {totalDeepWork > 0 && (
            <div className="hub-progress-pill" style={{ background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.2)' }} title="Total Deep Work hours (Video Editing + Side Hustle)">
              <span style={{ fontSize:'0.7rem', fontWeight:700, color:'#f97316', display:'flex', alignItems:'center', gap:4 }}>
                🧠 {totalDeepWork < 1 ? `${Math.round(totalDeepWork * 60)}m` : `${totalDeepWork}h`}
              </span>
            </div>
          )}

          {/* Bulk mode toggle */}
          {timelineView === 'daily' && (
            <button
              className={`hub-filter-btn ${bulkMode ? 'hub-filter-btn--active' : ''}`}
              onClick={() => { setBulkMode(b => !b); if (bulkMode) setSelectedIds(new Set()); }}
              aria-label="Toggle bulk selection"
              title="Bulk select"
            >
              <span role="img" aria-hidden="true">☑</span>
              {bulkMode ? 'Done' : 'Bulk'}
            </button>
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

          {/* Filter toggle with count badge */}
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
              onClick={() => { setPdfError(''); handleDownloadPDF(); }}
              aria-label="Download Daily PDF Report"
              title="Download PDF Report"
            >
              <FileDown size={13} aria-hidden="true" />
              <span>Export PDF</span>
            </button>
          )}
          {pdfError && <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, marginLeft: '0.5rem' }}>{pdfError}</span>}

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
          <button onClick={exportIcs} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 12px', color:'var(--text-muted)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', gap:4 }}>
            <FileDown size={13} /> .ics
          </button>
          <button onClick={exportJson} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 12px', color:'var(--text-muted)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', gap:4 }}>
            <FileDown size={13} /> JSON
          </button>
          <input ref={jsonInputRef} type="file" accept=".json" style={{ display:'none' }} onChange={importJson} />
          <button onClick={() => jsonInputRef.current?.click()} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 12px', color:'var(--text-muted)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)', display:'flex', alignItems:'center', gap:4 }}>
            <FileDown size={13} /> Import
          </button>
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
          <MissedTasksBar tasks={tasks} onUpdateTaskStatus={handleUpdateTaskStatus} onSnooze={handleSnooze} />
          <LiveFocusBanner tasks={tasks} onUpdateStatus={handleUpdateTaskStatus} />
          <TimelineAnalytics date={date} tasks={tasks} logs={logs} />
          <DailyTimeline
            date={date}
            tasks={tasks}
            onUpdateTask={handleUpdateTasks}
            onEditTask={openEdit}
            onAddClick={openAddAtHour}
            isFutureDate={isFuture}
            onSelectDate={handleSelectDate}
            filters={activeFilters}
            bulkMode={bulkMode}
            selectedIds={selectedIds}
            onBulkSelect={toggleBulkSelect}
            onMoveToDate={handleMoveToDate}
          />
        </div>
      )}

      {/* ── Bulk action bar ──────────────────────────────────────────── */}
      {bulkMode && selectedIds.size > 0 && !batchEditMode && (
        <div className="bulk-action-bar">
          <span className="bulk-action-count">{selectedIds.size} selected</span>
          <button className="bulk-action-btn" onClick={() => bulkAction('Completed')}><CheckCircle2 size={14} /> Complete</button>
          <button className="bulk-action-btn" onClick={() => bulkAction('Missed')}><XCircle size={14} /> Missed</button>
          <button className="bulk-action-btn" onClick={() => bulkAction('Pending')}><RefreshCw size={14} /> Reset</button>
          <button className="bulk-action-btn bulk-action-btn--danger" onClick={bulkDelete}><Trash2 size={14} /> Delete</button>
          <button className="bulk-action-btn" onClick={() => setBatchEditMode(true)}>Edit</button>
          <button className="bulk-action-btn" onClick={() => { setSelectedIds(new Set()); setBulkMode(false); }}>Cancel</button>
        </div>
      )}
      {batchEditMode && (
        <div className="bulk-action-bar" style={{ gap:8, flexWrap:'wrap' }}>
          <span className="bulk-action-count">Batch edit {selectedIds.size} tasks</span>
          <select value={batchPriority} onChange={e => setBatchPriority(e.target.value)}
            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-card)', color:'var(--text)', fontSize:'0.75rem', fontFamily:'var(--font-sans)' }}>
            <option value="">Keep priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select value={batchCategory} onChange={e => setBatchCategory(e.target.value)}
            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-card)', color:'var(--text)', fontSize:'0.75rem', fontFamily:'var(--font-sans)' }}>
            <option value="">Keep category</option>
            {BASE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="bulk-action-btn" onClick={applyBatchEdit}>Apply</button>
          <button className="bulk-action-btn" onClick={() => { setBatchEditMode(false); setBatchPriority(''); setBatchCategory(''); }}>Cancel</button>
        </div>
      )}

      {/* ── Undo toast ────────────────────────────────────────────────── */}
      {undoToast && (
        <div className="undo-toast">
          <span>{undoToast.message}</span>
          <button className="undo-toast-btn" onClick={handleUndoStatus}>Undo</button>
          <button className="undo-toast-close" onClick={() => setUndoToast(null)}><X size={14} /></button>
        </div>
      )}
      {autoRescheduledCount > 0 && (
        <div className="undo-toast" style={{ background:'var(--priority-high)', left:'50%', transform:'translateX(-50%)' }}>
          <span>{autoRescheduledCount} missed task{autoRescheduledCount > 1 ? 's' : ''} rescheduled to today</span>
          <button className="undo-toast-close" onClick={() => setAutoRescheduledCount(0)}><X size={14} /></button>
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

      {/* ── Pomodoro widget ─────────────────────────────────────────────── */}
      <div style={{ position:'fixed', bottom:100, right:20, zIndex:100, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
        {pomodoroActive && (
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:16, padding:'12px 16px', boxShadow:'0 8px 24px rgba(0,0,0,0.3)', display:'flex', flexDirection:'column', alignItems:'center', gap:8, minWidth:140 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <ClockIcon size={14} style={{ color:'var(--accent-blue)' }} />
              <span style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--text-muted)' }}>{pomodoroPhase === 'work' ? 'FOCUS' : 'BREAK'}</span>
            </div>
            <span style={{ fontSize:'2rem', fontWeight:700, fontVariantNumeric:'tabular-nums', letterSpacing:'0.03em' }}>
              {String(Math.floor(pomodoroSeconds/60)).padStart(2,'0')}:{String(pomodoroSeconds%60).padStart(2,'0')}
            </span>
            <div style={{ display:'flex', gap:6 }}>
              {!pomodoroActive ? (
                <button onClick={() => { setPomodoroActive(true); if (Notification.permission === 'default') Notification.requestPermission(); }} style={{ background:'var(--accent)', border:'none', borderRadius:8, padding:'6px 12px', color:'#fff', cursor:'pointer', fontFamily:'var(--font-sans)', fontSize:'0.72rem', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                  <Play size={12} /> Start
                </button>
              ) : (
                <>
                  <button onClick={() => setPomodoroActive(false)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', color:'var(--text-muted)', cursor:'pointer', fontFamily:'var(--font-sans)', fontSize:'0.72rem', display:'flex', alignItems:'center', gap:4 }}>
                    <Square size={12} />
                  </button>
                  <button onClick={() => { setPomodoroActive(false); setPomodoroSeconds(25*60); setPomodoroPhase('work'); }} style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'6px 10px', color:'#ef4444', cursor:'pointer', fontFamily:'var(--font-sans)', fontSize:'0.72rem', display:'flex', alignItems:'center', gap:4 }}>
                    <RefreshCw size={12} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {!pomodoroActive && (
          <button onClick={() => { setPomodoroActive(true); setPomodoroSeconds(25*60); setPomodoroPhase('work'); if (Notification.permission === 'default') Notification.requestPermission(); }}
            style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'50%', width:44, height:44, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent-blue)', cursor:'pointer', boxShadow:'0 4px 12px rgba(0,0,0,0.2)' }}
            title="Start Pomodoro timer" aria-label="Start Pomodoro timer">
            <ClockIcon size={18} />
          </button>
        )}
      </div>

      {/* ── Task Bottom Sheet ───────────────────────────────────────────────── */}
      <TaskBottomSheet
        isOpen={isSheetOpen}
        onClose={closeSheet}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        onDuplicate={handleDuplicateTask}
        onCloneToDate={handleCloneToDate}
        initialData={editingTask}
        isFutureDate={isFuture}
        suggestedHour={suggestedHour}
        availableTasks={tasks}
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
