import React, { useState, useEffect } from 'react';
import { useHabits } from '../Store';
import { format, isAfter, startOfDay } from 'date-fns';
import { CheckCircle2, List, CalendarDays, Plus } from 'lucide-react';
import DailyTimeline from '../components/timeline/DailyTimeline';
import TaskBottomSheet from '../components/timeline/TaskBottomSheet';
import MissedTasksBar from '../components/timeline/MissedTasksBar';
import MonthlyCalendar from '../components/timeline/MonthlyCalendar';

export default function TasksPage() {
  const { getLog, saveLog, logs } = useHabits();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [log, setLog] = useState(logs[date] || { date, tasks: [] });
  const [saveStatus, setSaveStatus] = useState('');
  const [localDirty, setLocalDirty] = useState(false);

  const [timelineView, setTimelineView] = useState('daily');
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);

  // Sync log when date changes
  useEffect(() => {
    let currentLog = logs[date];
    if (currentLog) {
      setLog(currentLog);
    } else {
      getLog(date).then(fetched => setLog(fetched || { date, tasks: [] }));
    }
    setLocalDirty(false);
  }, [date, logs, getLog]);

  // Auto-save
  useEffect(() => {
    if (!localDirty) return;
    const timer = setTimeout(async () => {
      setSaveStatus('Saving...');
      try {
        await saveLog(date, log);
        setSaveStatus('Saved');
        setLocalDirty(false);
        setTimeout(() => setSaveStatus(''), 2000);
      } catch (err) {
        setSaveStatus('Error');
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [log, date, saveLog, localDirty]);

  const isFuture = isAfter(startOfDay(new Date(date)), startOfDay(new Date()));

  const handleUpdateTasks = (newTasks) => {
    setLog(prev => ({ ...prev, tasks: newTasks }));
    setLocalDirty(true);
  };

  const handleUpdateTaskStatus = (taskIndex, newStatus) => {
    setLog(prev => {
      const updatedTasks = [...(prev.tasks || [])];
      updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], status: newStatus };
      return { ...prev, tasks: updatedTasks };
    });
    setLocalDirty(true);
  };

  const handleAddTask = (newTask) => {
    setLog(prev => ({ ...prev, tasks: [...(prev.tasks || []), newTask] }));
    setLocalDirty(true);
  };

  return (
    <div className="page-transition" style={{ maxWidth: '800px', margin: '0 auto' }}>
      
      {isFuture && (
        <div style={{ background: 'rgba(245, 166, 35, 0.1)', border: '1px solid rgba(245, 166, 35, 0.3)', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', color: '#f5a623', fontSize: '0.9rem' }}>
          <strong>Future Date:</strong> You are viewing a future date. Task actions are disabled.
        </div>
      )}

      {/* Missed Tasks Bar */}
      <MissedTasksBar tasks={log.tasks || []} onUpdateTaskStatus={handleUpdateTaskStatus} />

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.8rem', m: 0 }}>Timeline</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <button
              onClick={() => setTimelineView('daily')}
              style={{ padding: '6px 12px', background: timelineView === 'daily' ? 'var(--accent-blue)' : 'transparent', color: timelineView === 'daily' ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}
            >
              <List size={14} /> Daily
            </button>
            <button
              onClick={() => setTimelineView('monthly')}
              style={{ padding: '6px 12px', background: timelineView === 'monthly' ? 'var(--accent-blue)' : 'transparent', color: timelineView === 'monthly' ? '#fff' : 'var(--text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}
            >
              <CalendarDays size={14} /> Monthly
            </button>
          </div>
          
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ minWidth: '140px' }} />
          
          <div style={{ minWidth: '90px', textAlign: 'right', fontSize: '0.9rem', color: saveStatus === 'Error' ? '#ef4444' : saveStatus === 'Saved' ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
            {saveStatus === 'Saved' && <CheckCircle2 size={16} />}
            {saveStatus}
          </div>
        </div>
      </div>

      {timelineView === 'monthly' ? (
        <MonthlyCalendar currentDate={date} logs={logs} onSelectDate={(d) => { setDate(d); setTimelineView('daily'); }} />
      ) : (
        <DailyTimeline 
          date={date} 
          tasks={log.tasks || []} 
          onUpdateTask={handleUpdateTasks} 
          isFutureDate={isFuture} 
        />
      )}

      {/* FAB for Task Creation */}
      {timelineView === 'daily' && (
        <button 
          onClick={() => setIsTaskSheetOpen(true)}
          disabled={isFuture}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--accent-blue)',
            color: '#fff',
            border: 'none',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
            cursor: isFuture ? 'default' : 'pointer',
            opacity: isFuture ? 0.5 : 1,
            zIndex: 100,
            transition: 'transform 0.2s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = isFuture ? 'none' : 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Plus size={24} />
        </button>
      )}

      <TaskBottomSheet 
        isOpen={isTaskSheetOpen} 
        onClose={() => setIsTaskSheetOpen(false)} 
        onSave={handleAddTask}
        isFutureDate={isFuture}
      />

    </div>
  );
}
