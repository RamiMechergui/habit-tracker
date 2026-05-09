import React, { useState, useEffect, useCallback } from 'react';
import { useHabits } from '../Store';
import { format, isAfter, startOfDay, parseISO } from 'date-fns';
import { 
  Plus, Calendar as CalendarIcon, 
  Loader2, Bell,
  List, CalendarDays, CheckCircle2, Target, Filter, X
} from 'lucide-react';

import DailyTimeline     from '../components/timeline/DailyTimeline';
import TaskBottomSheet   from '../components/timeline/TaskBottomSheet';
import MissedTasksBar    from '../components/timeline/MissedTasksBar';
import MonthlyCalendar   from '../components/timeline/MonthlyCalendar';
import TimelineAnalytics from '../components/timeline/TimelineAnalytics';
import LiveFocusBanner   from '../components/timeline/LiveFocusBanner';
import { usePushNotifications } from '../hooks/usePushNotifications';

const PRIORITY_FILTERS  = ['all','low','medium','high','critical'];
const STATUS_FILTERS    = ['all','Pending','Completed','Delayed','Missed'];
const CATEGORY_FILTERS  = ['all','Work','Health','Personal','Learning','Finance','Social','Other'];

export default function TasksPage() {
  const { getLog, saveLog, logs, scheduleTaskReminder, cancelTaskReminder } = useHabits();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [log,  setLog]  = useState(logs[date] || { date, tasks: [] });
  const [saveStatus,  setSaveStatus]  = useState('');
  const [localDirty,  setLocalDirty]  = useState(false);
  const [timelineView, setTimelineView] = useState('daily');
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);
  const [editingTask,     setEditingTask]     = useState(null);

  // Filters
  const [showFilters,    setShowFilters]    = useState(false);
  const [filterStatus,   setFilterStatus]   = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  const { isSupported, permission, isSubscribed, loading, subscribe } = usePushNotifications();

  // Sync log when date changes
  useEffect(() => {
    const current = logs[date];
    if (current) {
      setLog(current);
    } else {
      const fetched = getLog(date);
      setLog(fetched || { date, tasks: [] });
    }
    setLocalDirty(false);
  }, [date, logs, getLog]);

  // Auto-save
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

  const isFuture = isAfter(startOfDay(parseISO(date)), startOfDay(new Date()));

  // Task handlers
  const handleUpdateTasks = useCallback((newTasks) => {
    setLog(prev => ({ ...prev, tasks: newTasks }));
    setLocalDirty(true);
  }, []);

  const handleUpdateTaskStatus = useCallback((taskIndex, newStatus) => {
    setLog(prev => {
      const updated = [...(prev.tasks || [])];
      updated[taskIndex] = { ...updated[taskIndex], status: newStatus };
      return { ...prev, tasks: updated };
    });
    setLocalDirty(true);
  }, []);

  const handleSaveTask = useCallback((taskData) => {
    setLog(prev => {
      const existing = prev.tasks || [];
      const idx = existing.findIndex(t => t.id === taskData.id);
      if (idx >= 0) {
        const updated = [...existing];
        updated[idx] = taskData;
        return { ...prev, tasks: updated };
      }
      return { ...prev, tasks: [...existing, taskData] };
    });
    setLocalDirty(true);

    // Schedule or cancel reminder
    if (taskData.notificationEnabled && taskData.status === 'Pending') {
      scheduleTaskReminder(taskData, date);
    } else {
      cancelTaskReminder(taskData.id);
    }
  }, [date, scheduleTaskReminder, cancelTaskReminder]);

  const handleDeleteTask = useCallback((taskId) => {
    setLog(prev => ({ ...prev, tasks: (prev.tasks || []).filter(t => t.id !== taskId) }));
    setLocalDirty(true);
    cancelTaskReminder(taskId);
  }, [cancelTaskReminder]);

  const handleDuplicateTask = useCallback((task) => {
    const dup = { ...task, id: `task_${Date.now()}`, status: 'Pending', notificationSent: false, createdAt: new Date().toISOString() };
    setLog(prev => ({ ...prev, tasks: [...(prev.tasks || []), dup] }));
    setLocalDirty(true);
  }, []);

  const openEdit = useCallback((task) => {
    setEditingTask(task);
    setIsTaskSheetOpen(true);
  }, []);

  const activeFilters = { status: filterStatus, priority: filterPriority, category: filterCategory };
  const hasActiveFilter = filterStatus !== 'all' || filterPriority !== 'all' || filterCategory !== 'all';

  const tasks = log.tasks || [];

  return (
    <div className="page-transition" style={{ maxWidth: '860px', margin: '0 auto' }}>

      {/* Future date banner */}
      {isFuture && (
        <div style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', padding: '12px 16px', borderRadius: 12, marginBottom: 20, color: '#f5a623', fontSize: '0.88rem' }}>
          <strong>📅 Future Date:</strong> Viewing {format(parseISO(date), 'MMMM d, yyyy')}. Task actions are disabled.
        </div>
      )}

      {/* Push notification banner */}
      {isSupported && !isSubscribed && permission !== 'denied' && (
        <>
          <div className="push-banner" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', padding: '14px 16px', borderRadius: 14, marginBottom: 20, animation: 'pageSlideIn 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: 'var(--accent-blue)', padding: 8, borderRadius: 10, color: '#fff' }}>
                <Bell size={18} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Enable Task Reminders</h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Get notified when tasks are due, even when the app is closed.
                </p>
              </div>
            </div>
            <button className="btn" onClick={subscribe} disabled={loading}
              style={{ background: 'var(--accent-blue)', color: '#fff', padding: '8px 16px', fontSize: '0.83rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
              Enable
            </button>
          </div>
          <style>{`.push-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;}@media(max-width:520px){.push-banner{flex-direction:column;align-items:flex-start;}.push-banner button{align-self:flex-end;}}`}</style>
        </>
      )}

      {/* ── Sticky Hub Toolbar ────────────────────────────────────────────── */}
      <div className="hub-toolbar">
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 10 }}>
            <Target size={20} color="var(--accent-blue)" />
            <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Hub</span>
          </div>

          {/* View toggle */}
          <div className="hub-toolbar-toggle">
            {[
              { key: 'daily',   icon: <List size={14} />,         label: 'Timeline'   },
              { key: 'monthly', icon: <CalendarDays size={14} />, label: 'Heatmap' },
            ].map(v => (
              <button key={v.key}
                onClick={() => setTimelineView(v.key)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: timelineView === v.key ? 'var(--accent-blue)' : 'transparent',
                  color: timelineView === v.key ? '#fff' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: '0.85rem', fontWeight: 700, transition: 'all 0.2s',
                  fontFamily: 'var(--font-sans)',
                  boxShadow: timelineView === v.key ? '0 2px 8px rgba(59,130,246,0.3)' : 'none'
                }}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          {/* Date picker */}
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="hub-toolbar-date" />
        </div>

          {/* Filter toggle (daily only) */}
          {timelineView === 'daily' && (
            <button
              onClick={() => setShowFilters(f => !f)}
              className="btn"
              style={{
                padding: '7px 12px', fontSize: '0.82rem', fontWeight: 700,
                background: hasActiveFilter ? 'rgba(59,130,246,0.15)' : 'transparent',
                border: `1px solid ${hasActiveFilter ? 'var(--accent-blue)' : 'var(--border)'}`,
                color: hasActiveFilter ? 'var(--accent-blue)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Filter size={13} />
              {hasActiveFilter ? 'Filtered' : 'Filter'}
              {hasActiveFilter && (
                <span
                  onClick={e => { e.stopPropagation(); setFilterStatus('all'); setFilterPriority('all'); setFilterCategory('all'); }}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <X size={12} />
                </span>
              )}
            </button>
          )}

          {/* Save status */}
          <div style={{ minWidth: 70, textAlign: 'right', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, color: saveStatus === 'Error' ? '#ef4444' : saveStatus === 'Saved' ? '#10b981' : 'var(--text-muted)' }}>
            {saveStatus === 'Saved' && <CheckCircle2 size={14} />}
            {saveStatus}
          </div>
        </div>

      {/* ── Filters bar ──────────────────────────────────────────────────────── */}
      {showFilters && timelineView === 'daily' && (
        <div className="tl-filter-bar" style={{ marginBottom: 16, animation: 'pageSlideIn 0.2s ease' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Status:</span>
          {STATUS_FILTERS.map(s => (
            <button key={s} className={`tl-filter-chip ${filterStatus === s ? 'active' : ''}`}
              onClick={() => setFilterStatus(s)}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
          <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />

          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Priority:</span>
          {PRIORITY_FILTERS.map(p => (
            <button key={p} className={`tl-filter-chip ${filterPriority === p ? 'active' : ''}`}
              onClick={() => setFilterPriority(p)}>
              {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />

          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Category:</span>
          {CATEGORY_FILTERS.map(c => (
            <button key={c} className={`tl-filter-chip ${filterCategory === c ? 'active' : ''}`}
              onClick={() => setFilterCategory(c)}>
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>
      )}

      {/* ── Views ─────────────────────────────────────────────────────────────── */}
      {timelineView === 'monthly' ? (
        <MonthlyCalendar
          currentDate={date}
          logs={logs}
          onSelectDate={d => { setDate(d); setTimelineView('daily'); }}
        />
      ) : (
        <div style={{ animation: 'pageSlideIn 0.3s ease' }}>
          <MissedTasksBar tasks={tasks} onUpdateTaskStatus={handleUpdateTaskStatus} />
          
          <LiveFocusBanner tasks={tasks} onUpdateStatus={handleUpdateTaskStatus} />

          <TimelineAnalytics date={date} tasks={tasks} logs={logs} />
          
          <DailyTimeline
            date={date}
            tasks={tasks}
            onUpdateTask={handleUpdateTasks}
            onEditTask={openEdit}
            isFutureDate={isFuture}
            filters={activeFilters}
          />
        </div>
      )}

      {/* ── FAB ───────────────────────────────────────────────────────────────── */}
      {timelineView === 'daily' && (
        <button
          className="fab-button-v2"
          onClick={() => { setEditingTask(null); setIsTaskSheetOpen(true); }}
          disabled={isFuture}
        >
          <Plus size={20} />
          <span className="fab-label">Add Task</span>
        </button>
      )}

      {/* ── Bottom sheet ──────────────────────────────────────────────────────── */}
      <TaskBottomSheet
        isOpen={isTaskSheetOpen}
        onClose={() => { setIsTaskSheetOpen(false); setEditingTask(null); }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        onDuplicate={handleDuplicateTask}
        initialData={editingTask}
        isFutureDate={isFuture}
      />
    </div>
  );
}
