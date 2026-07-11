import React, { useState } from 'react';
import { useHabits } from '../Store';
import { format, startOfMonth, getDay, differenceInCalendarDays, isSameMonth } from 'date-fns';
import { NavLink, useNavigate } from 'react-router-dom';
import { Trash2, BookOpen, CheckCircle2, BookMarked, BookX, CheckCircle, ChevronLeft, ChevronRight, Edit2, Check, X, Search, Calendar, Clock, ExternalLink, SlidersHorizontal } from 'lucide-react';

export default function Dashboard() {
  const { user, getLog, saveLog, getMonthlyData, expenseCategories, addExpenseCategory, deleteExpenseCategory, editExpenseCategory, currentBook, setCurrentBook, finishCurrentBook, getBookProgress, archivedBooks, logs } = useHabits();
  
  const displayName = user?.firstName || user?.lastName
    ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
    : (user?.email?.split('@')[0] || 'User');
  const navigate = useNavigate();
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryValue, setEditCategoryValue] = useState('');
  const [bookName, setBookName] = useState('');
  const [targetPages, setTargetPages] = useState('');
  const [bookError, setBookError] = useState('');
  const [categoryMessage, setCategoryMessage] = useState({ text: '', type: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: '', category: '' });
  const [calendarDate, setCalendarDate] = useState(new Date());

  // ── Tasks List State ────────────────────────────────────────────────────────
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState('all');
  const [taskSortBy, setTaskSortBy] = useState('date-desc');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);

  // Inline edit state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [editStatus, setEditStatus] = useState('Pending');
  const [editCategory, setEditCategory] = useState('Other');
  const [editError, setEditError] = useState('');

  // Gather all tasks
  const allTasks = React.useMemo(() => {
    const list = [];
    Object.entries(logs || {}).forEach(([dateStr, logData]) => {
      let tasksForDate = [];
      if (logData && logData.tasks) {
        if (Array.isArray(logData.tasks)) {
          tasksForDate = logData.tasks;
        } else if (logData.tasks.tasks && Array.isArray(logData.tasks.tasks)) {
          tasksForDate = logData.tasks.tasks;
        }
      }
      tasksForDate.forEach(task => {
        list.push({
          ...task,
          date: dateStr
        });
      });
    });
    return list;
  }, [logs]);

  // Derived Categories
  const allCategories = React.useMemo(() => {
    const cats = new Set(['Work', 'Health', 'Personal', 'Learning', 'Finance', 'Social', 'Other']);
    allTasks.forEach(t => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats);
  }, [allTasks]);

  // Filtered & Sorted Tasks
  const filteredTasks = React.useMemo(() => {
    return allTasks
      .filter(t => {
        if (taskSearch.trim()) {
          const q = taskSearch.toLowerCase();
          const titleMatch = t.title?.toLowerCase().includes(q);
          const descMatch = t.description?.toLowerCase().includes(q);
          if (!titleMatch && !descMatch) return false;
        }
        if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) return false;
        if (taskPriorityFilter !== 'all' && t.priority !== taskPriorityFilter) return false;
        if (taskCategoryFilter !== 'all' && t.category !== taskCategoryFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (taskSortBy === 'date-desc') {
          const dateComp = b.date.localeCompare(a.date);
          if (dateComp !== 0) return dateComp;
          return (b.time || '').localeCompare(a.time || '');
        }
        if (taskSortBy === 'date-asc') {
          const dateComp = a.date.localeCompare(b.date);
          if (dateComp !== 0) return dateComp;
          return (a.time || '').localeCompare(b.time || '');
        }
        if (taskSortBy === 'priority-desc') {
          const weight = { critical: 4, high: 3, medium: 2, low: 1 };
          return (weight[b.priority] || 0) - (weight[a.priority] || 0);
        }
        if (taskSortBy === 'priority-asc') {
          const weight = { critical: 4, high: 3, medium: 2, low: 1 };
          return (weight[a.priority] || 0) - (weight[b.priority] || 0);
        }
        if (taskSortBy === 'title-asc') {
          return (a.title || '').localeCompare(b.title || '');
        }
        return 0;
      });
  }, [allTasks, taskSearch, taskStatusFilter, taskPriorityFilter, taskCategoryFilter, taskSortBy]);

  const startEditTask = (task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title || '');
    setEditDesc(task.description || '');
    setEditTime(task.time || '');
    setEditEndTime(task.endTime || '');
    setEditPriority(task.priority || 'medium');
    setEditStatus(task.status || 'Pending');
    setEditCategory(task.category || 'Other');
    setEditError('');
  };

  const saveEditedTask = async (task) => {
    if (!editTitle.trim()) {
      setEditError('Title is required');
      return;
    }
    if (!editTime.trim()) {
      setEditError('Start time is required');
      return;
    }
    if (editEndTime && editEndTime < editTime) {
      setEditError('End time must be after start time');
      return;
    }

    const updatedFields = {
      title: editTitle.trim(),
      description: editDesc.trim(),
      time: editTime,
      endTime: editEndTime,
      priority: editPriority,
      status: editStatus,
      category: editCategory
    };

    const logData = getLog(task.date);
    let tasksForDate = [];
    if (logData.tasks) {
      if (Array.isArray(logData.tasks)) {
        tasksForDate = [...logData.tasks];
      } else if (logData.tasks.tasks && Array.isArray(logData.tasks.tasks)) {
        tasksForDate = [...logData.tasks.tasks];
      }
    }

    const idx = tasksForDate.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      tasksForDate[idx] = { ...tasksForDate[idx], ...updatedFields };
    }

    const updatedLog = { ...logData, tasks: tasksForDate };
    await saveLog(task.date, updatedLog);
    setEditingTaskId(null);
    showMessage('Task updated successfully!');
  };

  const confirmDeleteTask = async (task) => {
    const logData = getLog(task.date);
    let tasksForDate = [];
    if (logData.tasks) {
      if (Array.isArray(logData.tasks)) {
        tasksForDate = [...logData.tasks];
      } else if (logData.tasks.tasks && Array.isArray(logData.tasks.tasks)) {
        tasksForDate = [...logData.tasks.tasks];
      }
    }

    const updatedTasks = tasksForDate.filter(t => t.id !== task.id);
    const updatedLog = { ...logData, tasks: updatedTasks };
    await saveLog(task.date, updatedLog);
    showMessage('Task deleted successfully!');
    setDeletingTaskId(null);
  };

  const showMessage = (text, type = 'success') => {
    setCategoryMessage({ text, type });
    setTimeout(() => setCategoryMessage({ text: '', type: '' }), 3000);
  };

  const todayDate = new Date();
  const todayStr = format(todayDate, 'yyyy-MM-dd');
  const todayLog = getLog(todayStr);
  
  const monthData = getMonthlyData(calendarDate);
  const firstDay = startOfMonth(calendarDate);
  const emptyCells = getDay(firstDay);
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handlePrevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  const bookProgress = getBookProgress();

  // ── Book Reading Status (synced with Book Progress Tracker) ──────────────
  const mostRecentArchive =
    archivedBooks && archivedBooks.length > 0
      ? archivedBooks[archivedBooks.length - 1]
      : null;

  let bookReadingStatus, bookReadingColor, BookReadingIcon;
  if (currentBook && currentBook.isActive) {
    // Actively reading a book
    bookReadingStatus = currentBook.bookName;
    bookReadingColor  = '#3b82f6';
    BookReadingIcon   = BookMarked;
  } else if (mostRecentArchive && mostRecentArchive.completionDate) {
    // A book was recently finished — calculate days since completion
    const completedOn  = new Date(mostRecentArchive.completionDate + 'T00:00:00');
    const daysSince    = differenceInCalendarDays(new Date(), completedOn);
    const dayLabel     = daysSince === 0
      ? 'today'
      : daysSince === 1
      ? '1 day ago'
      : `${daysSince} days ago`;
    bookReadingStatus = `Finished ${dayLabel}`;
    bookReadingColor  = '#10b981';
    BookReadingIcon   = CheckCircle;
  } else {
    // No active or completed book
    bookReadingStatus = 'No book active';
    bookReadingColor  = 'var(--text-muted)';
    BookReadingIcon   = BookX;
  }

  const handleAddCategoryClick = () => {
    const cat = newCategory.trim();
    if (cat) {
      setConfirmModal({ isOpen: true, action: 'add', category: cat });
    }
  };

  const handleDeleteCategoryClick = (cat) => {
    setConfirmModal({ isOpen: true, action: 'delete', category: cat });
  };

  const confirmAction = () => {
    const { action, category } = confirmModal;
    if (action === 'add') {
      addExpenseCategory(category);
      setNewCategory('');
      showMessage(`Category '${category}' added successfully!`);
    } else if (action === 'delete') {
      deleteExpenseCategory(category);
      showMessage(`Category '${category}' deleted successfully!`);
    }
    setConfirmModal({ isOpen: false, action: '', category: '' });
  };

  const cancelAction = () => {
    setConfirmModal({ isOpen: false, action: '', category: '' });
  };

  const handleEditCategoryClick = (cat) => {
    setEditingCategory(cat);
    setEditCategoryValue(cat);
  };

  const handleSaveCategory = (oldCat) => {
    const newCat = editCategoryValue.trim();
    if (newCat && newCat !== oldCat) {
      if (expenseCategories.includes(newCat)) {
        showMessage('Category already exists.', 'error');
      } else {
        editExpenseCategory(oldCat, newCat);
        showMessage(`Category updated to '${newCat}' successfully!`);
      }
    }
    setEditingCategory(null);
  };

  const cancelEditCategory = () => {
    setEditingCategory(null);
  };

  const handleSetBook = async () => {
    setBookError('');
    if (!bookName.trim()) {
      setBookError('Book name is required');
      return;
    }
    if (!targetPages || parseInt(targetPages) <= 0) {
      setBookError('Target pages must be greater than 0');
      return;
    }
    try {
      await setCurrentBook(bookName.trim(), parseInt(targetPages));
      setBookName('');
      setTargetPages('');
    } catch (e) {
      setBookError(e.message || 'Error setting book');
    }
  };

  return (
    <>
      <div className="dashboard-welcome mb-8" style={{ animation: 'evolvia-up 0.5s ease-out' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: 900, 
          background: 'linear-gradient(to right, #fff, #94a3b8)', 
          WebkitBackgroundClip: 'text', 
          backgroundClip: 'text', 
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem'
        }}>
          Protocol Dashboard
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          Welcome back, <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{displayName}</span>. Stay disciplined, stay focused.
        </p>
      </div>
      
      <div className="grid-2 mb-8">
        <div className="glass-card stat-card" style={{ 
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.05))',
          borderColor: 'rgba(59, 130, 246, 0.2)'
        }}>
          <h3 className="mb-2" style={{ opacity: 0.8 }}>Today's Performance</h3>
          <div className="stat-number" style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-2px' }}>
            {todayLog.totalScore}<span className="pts" style={{ fontSize: '1rem', opacity: 0.5 }}>/100</span>
          </div>
          <div className="flex justify-center mt-3">
            <span className={`grade-pill grade-${todayLog.rank.toLowerCase()}`} style={{ scale: '1.1' }}>
              Rank {todayLog.rank}
            </span>
          </div>
          <p className="mt-6" style={{ textAlign: 'center' }}>
            <NavLink to="/daily" className="text-amber" style={{ 
              textDecoration: 'none', 
              fontWeight: 600, 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px' 
            }}>
              Journal Entry <ChevronRight size={16} />
            </NavLink>
          </p>
        </div>
        
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 className="mb-6" style={{ opacity: 0.8 }}>Quick Metrics</h3>
          <div className="flex-col gap-4">
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'rgba(16,185,129,0.06)' }}>
              <span className="text-muted">Total Income</span>
              <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>
                {(Array.isArray(todayLog.income) ? todayLog.income : []).reduce((t, i) => t + (parseFloat(i.amount)||0), 0).toFixed(3)} TND
              </strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-muted">Total Expenses</span>
              <strong className="text-amber" style={{ fontSize: '1.1rem' }}>
                {(Array.isArray(todayLog.expenses) ? todayLog.expenses : []).reduce((t, e) => t + (parseFloat(e.amount)||0), 0).toFixed(3)} TND
              </strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{
              background: (() => { const bal = (Array.isArray(todayLog.income) ? todayLog.income : []).reduce((t, i) => t + (parseFloat(i.amount)||0), 0) - (Array.isArray(todayLog.expenses) ? todayLog.expenses : []).reduce((t, e) => t + (parseFloat(e.amount)||0), 0); return bal >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' })(),
              border: `1px solid ${(() => { const bal = (Array.isArray(todayLog.income) ? todayLog.income : []).reduce((t, i) => t + (parseFloat(i.amount)||0), 0) - (Array.isArray(todayLog.expenses) ? todayLog.expenses : []).reduce((t, e) => t + (parseFloat(e.amount)||0), 0); return bal >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)' })()}`,
            }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>⚖️ Remaining</span>
              <strong style={{
                color: (() => { const bal = (Array.isArray(todayLog.income) ? todayLog.income : []).reduce((t, i) => t + (parseFloat(i.amount)||0), 0) - (Array.isArray(todayLog.expenses) ? todayLog.expenses : []).reduce((t, e) => t + (parseFloat(e.amount)||0), 0); return bal >= 0 ? '#10b981' : '#ef4444' })(),
                fontSize: '1.25rem',
              }}>
                {((Array.isArray(todayLog.income) ? todayLog.income : []).reduce((t, i) => t + (parseFloat(i.amount)||0), 0) - (Array.isArray(todayLog.expenses) ? todayLog.expenses : []).reduce((t, e) => t + (parseFloat(e.amount)||0), 0)).toFixed(3)} TND
              </strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-muted">Hustle Status</span>
              <strong style={{ 
                color: todayLog.hustle.achieved ? 'var(--accent-emerald)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {todayLog.hustle.achieved ? <CheckCircle2 size={16} /> : null}
                {todayLog.hustle.achieved ? 'Operational' : 'Pending'}
              </strong>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-muted">Active Reading</span>
              <strong style={{ 
                color: bookReadingColor, 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                fontSize: '0.9rem' 
              }}>
                <BookReadingIcon size={16} />
                {bookReadingStatus}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Scope-styled Premium Tasks List Card */}
      <div className="glass-card p-6 mb-6">
        <style dangerouslySetInnerHTML={{ __html: `
          .dashboard-tasks-list {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          }
          .tasks-filter-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 1rem;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 1.25rem;
          }
          .filter-row {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          .filter-row label {
            font-size: 0.75rem;
            color: var(--text-muted);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0;
          }
          .filter-row input, .filter-row select {
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 8px 12px;
            color: var(--text-primary);
            outline: none;
            font-size: 0.85rem;
            transition: all 0.2s ease;
          }
          .filter-row input:focus, .filter-row select:focus {
            border-color: var(--accent-blue);
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
            background: rgba(0, 0, 0, 0.4);
          }
          .filter-chips-outer {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            background: rgba(255, 255, 255, 0.01);
            border-radius: 10px;
            padding: 0.75rem 1rem;
            border: 1px solid rgba(255, 255, 255, 0.03);
          }
          .filter-chips-label {
            font-size: 0.75rem;
            color: var(--text-muted);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .filter-chips-container {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
          }
          .filter-chip-btn {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 0.8rem;
            color: var(--text-muted);
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .filter-chip-btn:hover {
            background: rgba(255, 255, 255, 0.08);
            color: var(--text-primary);
          }
          .filter-chip-btn.active {
            background: var(--accent-blue);
            border-color: var(--accent-blue);
            color: #fff;
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
          }
          .tasks-items-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            max-height: 450px;
            overflow-y: auto;
            padding-right: 6px;
          }
          /* Custom sleek scrollbar for items list */
          .tasks-items-list::-webkit-scrollbar {
            width: 6px;
          }
          .tasks-items-list::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.01);
            border-radius: 3px;
          }
          .tasks-items-list::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
          }
          .tasks-items-list::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
          }
          .task-item-row {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1rem;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
          }
          .task-item-row:hover {
            background: rgba(255, 255, 255, 0.04);
            border-color: rgba(255, 255, 255, 0.12);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          }
          .task-item-layout {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            align-items: center;
            justify-content: space-between;
          }
          .task-item-left {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
            min-width: 120px;
          }
          .task-item-date {
            font-size: 0.85rem;
            font-weight: 700;
            color: var(--accent-blue);
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .task-item-time {
            font-size: 0.8rem;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .task-item-middle {
            flex: 1 1 250px;
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
          }
          .task-item-title-wrap {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }
          .task-item-title {
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-primary);
            margin: 0;
          }
          .task-item-desc {
            font-size: 0.85rem;
            color: var(--text-muted);
            margin: 0;
            line-height: 1.4;
          }
          .task-badges-flex {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 4px;
          }
          .badge {
            font-size: 0.65rem;
            font-weight: 700;
            text-transform: uppercase;
            padding: 2px 8px;
            border-radius: 12px;
            letter-spacing: 0.5px;
          }
          .badge-priority-critical {
            background: rgba(239, 68, 68, 0.12);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.25);
          }
          .badge-priority-high {
            background: rgba(249, 115, 22, 0.12);
            color: #fb923c;
            border: 1px solid rgba(249, 115, 22, 0.25);
          }
          .badge-priority-medium {
            background: rgba(59, 130, 246, 0.12);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.25);
          }
          .badge-priority-low {
            background: rgba(148, 163, 184, 0.12);
            color: #cbd5e1;
            border: 1px solid rgba(148, 163, 184, 0.25);
          }
          .badge-status-completed {
            background: rgba(16, 185, 129, 0.12);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.25);
          }
          .badge-status-pending {
            background: rgba(245, 158, 11, 0.12);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.25);
          }
          .badge-status-delayed {
            background: rgba(139, 92, 246, 0.12);
            color: #a78bfa;
            border: 1px solid rgba(139, 92, 246, 0.25);
          }
          .badge-status-missed {
            background: rgba(220, 38, 38, 0.12);
            color: #f87171;
            border: 1px solid rgba(220, 38, 38, 0.25);
          }
          .badge-category {
            background: rgba(255, 255, 255, 0.04);
            color: var(--text-primary);
            border: 1px solid rgba(255, 255, 255, 0.08);
          }
          .task-item-actions {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .action-btn {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 8px;
            border-radius: 8px;
            color: var(--text-muted);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .action-btn:hover {
            background: rgba(255, 255, 255, 0.08);
            color: var(--text-primary);
          }
          .action-btn-edit:hover {
            color: var(--accent-blue);
            background: rgba(59, 130, 246, 0.1);
          }
          .action-btn-delete:hover {
            color: #ef4444;
            background: rgba(239, 68, 68, 0.1);
          }
          .action-btn-navigate:hover {
            color: #f59e0b;
            background: rgba(245, 158, 11, 0.1);
          }
          .task-inline-edit-form {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 12px;
            padding: 1.25rem;
            margin-top: 0.75rem;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
            animation: evolvia-down 0.2s ease-out;
          }
          .edit-form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 1rem;
            margin-bottom: 1rem;
          }
          .edit-form-row {
            display: flex;
            flex-direction: column;
            gap: 0.4rem;
          }
          .edit-form-row label {
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-muted);
            margin: 0;
          }
          .edit-form-row input, .edit-form-row select, .edit-form-row textarea {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 8px 12px;
            color: var(--text-primary);
            outline: none;
            font-size: 0.85rem;
            transition: all 0.2s ease;
          }
          .edit-form-row textarea {
            resize: vertical;
            min-height: 50px;
          }
          .edit-form-row input:focus, .edit-form-row select:focus, .edit-form-row textarea:focus {
            border-color: var(--accent-blue);
            background: rgba(0, 0, 0, 0.5);
          }
          .edit-form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
          }
          .edit-error-msg {
            background: rgba(239, 68, 68, 0.12);
            color: #f87171;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 0.85rem;
            margin-bottom: 1rem;
            border: 1px solid rgba(239, 68, 68, 0.25);
          }
        ` }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SlidersHorizontal size={24} style={{ color: 'var(--accent-blue)' }} />
            <h3 style={{ margin: 0 }}>Protocol Tasks Hub</h3>
          </div>
          <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            {filteredTasks.length} {filteredTasks.length === 1 ? 'Task' : 'Tasks'}
          </span>
        </div>

        <div className="dashboard-tasks-list">
          {/* Filters Grid */}
          <div className="tasks-filter-grid">
            <div className="filter-row">
              <label>Search Tasks</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search title/description..."
                  value={taskSearch}
                  onChange={e => setTaskSearch(e.target.value)}
                  style={{ paddingLeft: '32px', width: '100%' }}
                />
                {taskSearch && (
                  <button
                    onClick={() => setTaskSearch('')}
                    style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="filter-row">
              <label>Category</label>
              <select value={taskCategoryFilter} onChange={e => setTaskCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="filter-row">
              <label>Sort By</label>
              <select value={taskSortBy} onChange={e => setTaskSortBy(e.target.value)}>
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="priority-desc">Priority: High to Low</option>
                <option value="priority-asc">Priority: Low to High</option>
                <option value="title-asc">Alphabetical (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="grid-2" style={{ gap: '0.75rem' }}>
            <div className="filter-chips-outer">
              <span className="filter-chips-label">Priority Filter</span>
              <div className="filter-chips-container">
                {['all', 'low', 'medium', 'high', 'critical'].map(p => (
                  <button
                    key={p}
                    className={`filter-chip-btn ${taskPriorityFilter === p ? 'active' : ''}`}
                    onClick={() => setTaskPriorityFilter(p)}
                  >
                    {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-chips-outer">
              <span className="filter-chips-label">Status Filter</span>
              <div className="filter-chips-container">
                {['all', 'Pending', 'Completed', 'Delayed', 'Missed'].map(s => (
                  <button
                    key={s}
                    className={`filter-chip-btn ${taskStatusFilter === s ? 'active' : ''}`}
                    onClick={() => setTaskStatusFilter(s)}
                  >
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tasks List */}
          <div className="tasks-items-list evolvia-scrollbar">
            {filteredTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
                <p className="text-muted" style={{ margin: 0, fontSize: '0.95rem' }}>No tasks found matching your filter selections.</p>
                <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>Use the Tasks Hub to monitor or pre-plan upcoming items.</p>
              </div>
            ) : (
              filteredTasks.map(task => {
                const isEditing = editingTaskId === task.id;
                return (
                  <div key={task.id} className="task-item-row">
                    <div className="task-item-layout">
                      <div className="task-item-left">
                        <div className="task-item-date" title="Task Date">
                          <Calendar size={13} />
                          {task.date}
                        </div>
                        <div className="task-item-time" title="Task Start / End">
                          <Clock size={13} />
                          {task.time}{task.endTime ? ` - ${task.endTime}` : ''}
                        </div>
                      </div>

                      <div className="task-item-middle">
                        <div className="task-item-title-wrap">
                          <h4 className="task-item-title">{task.title}</h4>
                        </div>
                        {task.description && (
                          <p className="task-item-desc text-sm">{task.description}</p>
                        )}
                        <div className="task-badges-flex">
                          <span className={`badge badge-priority-${task.priority || 'medium'}`}>
                            {task.priority || 'medium'}
                          </span>
                          <span className={`badge badge-status-${(task.status || 'Pending').toLowerCase()}`}>
                            {task.status || 'Pending'}
                          </span>
                          {task.category && (
                            <span className="badge badge-category">
                              {task.category}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="task-item-actions">
                        <button
                          className="action-btn action-btn-edit"
                          onClick={() => isEditing ? setEditingTaskId(null) : startEditTask(task)}
                          title="Edit Task Details"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="action-btn action-btn-delete"
                          onClick={() => deletingTaskId === task.id ? setDeletingTaskId(null) : setDeletingTaskId(task.id)}
                          title="Delete Task"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button
                          className="action-btn action-btn-navigate"
                          onClick={() => navigate(`/tasks?date=${task.date}`)}
                          title="Navigate to Timeline entry"
                        >
                          <ExternalLink size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Inline Delete Confirmation */}
                    {deletingTaskId === task.id && (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '1rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        animation: 'evolvia-down 0.2s ease-out'
                      }}>
                        <span style={{ fontSize: '0.9rem', color: '#f87171', fontWeight: 500 }}>
                          Are you sure you want to delete this task?
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => setDeletingTaskId(null)}
                            style={{ background: 'transparent', border: '1px solid #f87171', color: '#f87171', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => confirmDeleteTask(task)}
                            style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inline Edit Form */}
                    {isEditing && (
                      <div className="task-inline-edit-form">
                        <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-blue)' }}>Quick Inline Editor</h4>
                        {editError && (
                          <div className="edit-error-msg">{editError}</div>
                        )}
                        <div className="edit-form-grid">
                          <div className="edit-form-row">
                            <label>Title</label>
                            <input
                              type="text"
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              placeholder="Task title..."
                            />
                          </div>

                          <div className="edit-form-row">
                            <label>Description</label>
                            <textarea
                              value={editDesc}
                              onChange={e => setEditDesc(e.target.value)}
                              placeholder="Brief description..."
                            />
                          </div>

                          <div className="edit-form-row">
                            <label>Start Time</label>
                            <input
                              type="time"
                              value={editTime}
                              onChange={e => setEditTime(e.target.value)}
                            />
                          </div>

                          <div className="edit-form-row">
                            <label>End Time</label>
                            <input
                              type="time"
                              value={editEndTime}
                              onChange={e => setEditEndTime(e.target.value)}
                            />
                          </div>

                          <div className="edit-form-row">
                            <label>Priority</label>
                            <select value={editPriority} onChange={e => setEditPriority(e.target.value)}>
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                          </div>

                          <div className="edit-form-row">
                            <label>Status</label>
                            <select value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                              <option value="Pending">Pending</option>
                              <option value="Completed">Completed</option>
                              <option value="Delayed">Delayed</option>
                              <option value="Missed">Missed</option>
                            </select>
                          </div>

                          <div className="edit-form-row">
                            <label>Category</label>
                            <select value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                              {allCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="edit-form-actions">
                          <button
                            className="btn"
                            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                            onClick={() => setEditingTaskId(null)}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={() => saveEditedTask(task)}
                          >
                            Save Updates
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Book Progress Tracker */}
      <div className="glass-card p-6 mb-6">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
          <BookOpen size={24} style={{ color: 'var(--accent-blue)' }} />
          <h3 style={{ margin: 0 }}>Book Progress Tracker</h3>
        </div>

        {!bookProgress ? (
          <div>
            <p className="text-muted text-sm mb-4">Start tracking a new book reading journey.</p>
            {bookError && (
              <div style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: '10px', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                {bookError}
              </div>
            )}
            <div className="flex flex-wrap gap-2" style={{ marginBottom: '0.75rem' }}>
              <input
                type="text"
                placeholder="Book title"
                value={bookName}
                onChange={e => setBookName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetBook()}
                style={{ flex: '1 1 200px' }}
              />
              <input
                type="number"
                placeholder="Pages"
                value={targetPages}
                onChange={e => setTargetPages(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetBook()}
                style={{ flex: '1 1 80px', maxWidth: '100%' }}
              />
            </div>

            <button className="btn btn-primary" onClick={handleSetBook} style={{ width: '100%' }}>
              Start Reading
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                {currentBook?.photoUrl && (
                  <div style={{ width: 64, height: 80, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                    <img src={currentBook.photoUrl.startsWith('http') ? currentBook.photoUrl : (currentBook.photoUrl.startsWith('/') ? currentBook.photoUrl : `/uploads/${currentBook.photoUrl}`)} alt={bookProgress.bookName} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{bookProgress.bookName}</h4>
                    {currentBook?.author && (
                      <p className="text-muted text-sm" style={{ margin: '0.15rem 0' }}>
                        by {currentBook.author}
                      </p>
                    )}
                    <p className="text-muted text-sm" style={{ margin: '0.25rem 0' }}>
                      {bookProgress.currentPage} / {bookProgress.targetPages} pages
                    </p>
                  </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-blue)' }}>
                    {Math.round(bookProgress.progress)}%
                  </div>
                  <p className="text-muted text-sm" style={{ margin: '0.25rem 0' }}>
                    {bookProgress.isFinished ? '✓ Completed' : 'In Progress'}
                  </p>
                </div>
              </div>
              </div>

              {/* Progress Bar */}
              <div style={{ background: 'var(--bg-card-hover)', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(bookProgress.progress, 100)}%`,
                    background: bookProgress.isFinished ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #3b82f6, #2563eb)',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>

              {/* Daily Progress Micro Chart */}
              <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '60px', marginBottom: '1rem' }}>
                {bookProgress.dailyProgress.slice(-14).map((day, idx) => {
                  const height = day.page > 0 ? (day.page / bookProgress.targetPages) * 100 : 0;
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        background: day.page > 0 ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
                        height: Math.max(height, 2) + '%',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        opacity: 0.8,
                        transition: 'opacity 0.2s'
                      }}
                      title={`${day.date}: ${day.page} pages`}
                      onMouseEnter={e => e.target.style.opacity = '1'}
                      onMouseLeave={e => e.target.style.opacity = '0.8'}
                    />
                  );
                })}
              </div>

              {/* Stats */}
              <div className="grid-2" style={{ fontSize: '0.85rem' }}>
                <div style={{ background: 'var(--bg-card-hover)', padding: '8px', borderRadius: '6px' }}>
                  <p className="text-muted" style={{ margin: 0 }}>Started</p>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{format(new Date(bookProgress.startDate), 'MMM dd, yyyy')}</p>
                </div>
                <div style={{ background: 'var(--bg-card-hover)', padding: '8px', borderRadius: '6px' }}>
                  <p className="text-muted" style={{ margin: 0 }}>Reading Days</p>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{bookProgress.dailyProgress.filter(d => d.page > 0).length} days</p>
                </div>
              </div>

              {bookProgress.isFinished ? (
                <button 
                  className="btn btn-primary" 
                  onClick={finishCurrentBook}
                  style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <CheckCircle2 size={18} />
                  Finish Book & Start New
                </button>
              ) : (
                <NavLink 
                  to="/daily" 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '1rem', textAlign: 'center', textDecoration: 'none' }}
                >
                  Continue Reading
                </NavLink>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expense Categories Management */}
      <div className="glass-card p-6 mb-6">
        <h3 className="mb-4">Manage Expense Classifications</h3>
        <p className="text-muted text-sm mb-4">Define custom categories for your daily expenses.</p>
        
        <div className="flex flex-wrap gap-2 mb-4 evolvia-scrollbar" style={{ maxHeight: '180px', overflowY: 'auto', padding: '2px', alignContent: 'flex-start' }}>
          {expenseCategories.map(cat => (
            <div key={cat} className="flex items-center gap-2" style={{ background: 'var(--bg-card-hover)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
              {editingCategory === cat ? (
                <>
                  <input 
                    type="text" 
                    value={editCategoryValue} 
                    onChange={(e) => setEditCategoryValue(e.target.value)} 
                    onKeyDown={(e) => { if(e.key === 'Enter') handleSaveCategory(cat); else if(e.key === 'Escape') cancelEditCategory(); }}
                    style={{ padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--accent-blue)', background: 'transparent', color: 'var(--text-primary)', outline: 'none', width: '120px' }}
                    autoFocus
                  />
                  <button type="button" onClick={() => handleSaveCategory(cat)} title="Save" style={{ background: 'transparent', border: 'none', color: '#10b981', cursor: 'pointer', display: 'flex' }}>
                    <Check size={14} />
                  </button>
                  <button type="button" onClick={cancelEditCategory} title="Cancel" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}>
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span>{cat}</span>
                  <button 
                    type="button" 
                    onClick={() => handleEditCategoryClick(cat)} 
                    title="Edit Category"
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <Edit2 size={12} />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleDeleteCategoryClick(cat)} 
                    title="Delete Category"
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        
        {categoryMessage.text && (
          <div style={{ 
            padding: '8px 12px', 
            borderRadius: '6px', 
            marginBottom: '1rem', 
            fontSize: '0.85rem',
            background: categoryMessage.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
            color: categoryMessage.type === 'success' ? '#10b981' : '#ef4444'
          }}>
            {categoryMessage.text}
          </div>
        )}
        
        <div className="flex flex-wrap gap-2">
          <input 
            type="text" 
            placeholder="New classification (e.g., Software)" 
            value={newCategory} 
            onChange={e => setNewCategory(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCategoryClick()}
            style={{ flex: '1 1 240px' }}
          />
          <button className="btn btn-primary" style={{ flex: '1 1 120px' }} onClick={handleAddCategoryClick}>Add Category</button>
        </div>
      </div>

      {/* Interactive Monthly Calendar */}
      <div className="glass-card p-6 mt-6">
        <div className="flex justify-between items-center mb-6">
          <button className="btn" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)' }} onClick={handlePrevMonth}>
            <ChevronLeft size={20} />
          </button>
          <h3 className="text-amber m-0" style={{ fontSize: '1.2rem' }}>
            {format(calendarDate, 'MMMM yyyy')}
          </h3>
          <button className="btn" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)' }} onClick={handleNextMonth}>
            <ChevronRight size={20} />
          </button>
        </div>
        
        <div className="dashboard-calendar">
          {daysOfWeek.map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          
          {Array.from({ length: emptyCells }).map((_, i) => (
            <div key={`empty-${i}`} className="calendar-cell is-empty"></div>
          ))}
          
          {monthData.map((d, i) => {
            const isToday = d.date === todayStr;
            const isCurrentMonthView = isSameMonth(calendarDate, todayDate);
            const logData = d.log;
            const expenseStr = (Array.isArray(logData.expenses) ? logData.expenses : []).reduce((t, e) => t + (parseFloat(e.amount)||0), 0).toFixed(3) + ' TND';
            
            return (
              <div 
                key={d.date} 
                className={`calendar-cell ${(isToday && isCurrentMonthView) ? 'is-today' : ''}`}
                onClick={() => navigate(`/daily?date=${d.date}`)}
                title={`Click to view logs for ${d.date}`}
              >
                <div className="flex justify-between">
                  <span className="cal-date" style={{ color: (isToday && isCurrentMonthView) ? 'var(--accent-blue)' : 'var(--text-primary)'}}>
                    {d.dayNum}
                  </span>
                  {logData.isSubmitted && (
                    <span className={`cal-score grade-pill grade-${logData.rank.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '1px 4px', margin: 0 }}>
                      {logData.totalScore}
                    </span>
                  )}
                </div>
                {logData.isSubmitted && (
                  <div className="cal-expense">Exp: {expenseStr}</div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-center text-muted text-sm mt-4">Select any date to view or edit its daily log.</p>
      </div>


      
      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="glass-card p-6" style={{ width: '90%', maxWidth: '380px', animation: 'pageSlideIn 0.2s ease-out' }}>
            <h3 className="mb-3" style={{ fontSize: '1.2rem' }}>Confirm Action</h3>
            <p className="mb-6 text-muted" style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
              Are you sure you want to <strong style={{ color: confirmModal.action === 'delete' ? '#ef4444' : '#10b981' }}>{confirmModal.action}</strong> the category <strong style={{ color: 'var(--text-primary)' }}>'{confirmModal.category}'</strong>?
            </p>
            <div className="flex gap-3">
              <button 
                className="btn" 
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)' }} 
                onClick={cancelAction}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                style={{ 
                  flex: 1, 
                  background: confirmModal.action === 'delete' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff', border: 'none'
                }} 
                onClick={confirmAction}
              >
                {confirmModal.action === 'delete' ? 'Yes, Delete' : 'Yes, Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      </>
    );
}
