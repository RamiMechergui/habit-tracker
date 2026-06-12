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
  Plus,
  List, CalendarDays, CheckCircle2, Target, Filter, X,
  ChevronLeft, ChevronRight, Search, FileDown,
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



  // ── Sync log on date change ──────────────────────────────────────────────────
  useEffect(() => {
    setLog(logs[date] ?? getLog(date) ?? { date, tasks: [] });
    setLocalDirty(false);
  }, [date, logs, getLog]);

  const logRef = React.useRef(log);
  const dateRef = React.useRef(date);
  const localDirtyRef = React.useRef(localDirty);

  useEffect(() => {
    logRef.current = log;
    dateRef.current = date;
    localDirtyRef.current = localDirty;
  }, [log, date, localDirty]);

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
      alert('Could not generate PDF. Please try again.');
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
            onSelectDate={handleSelectDate}
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
