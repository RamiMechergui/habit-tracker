import React, { useMemo, useState, useRef, useEffect } from 'react';

import { format, isAfter, parseISO, endOfDay } from 'date-fns';

import TaskCard from './TaskCard';


export default function DailyTimeline({ date, tasks, onUpdateTask, onEditTask, isFutureDate }) {
  // Generate hour markers from 00:00 to 23:00
  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
  }, []);

  const handleUpdateStatus = (taskId, newStatus) => {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex < 0) return;
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], status: newStatus };
    onUpdateTask(updatedTasks);
  };

  const handleDragTime = (taskId, newTime) => {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex < 0) return;
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], time: newTime };
    onUpdateTask(updatedTasks);
  };

  const clusteredTasks = useMemo(() => {
    if (!tasks || tasks.length === 0) return [];
    
    // Convert time to minutes from midnight
    const getMins = (time) => {
      if (!time) return 0;
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    // Sort by start time, then by duration (longest first)
    const sortedTasks = [...tasks].map(t => ({
      ...t,
      startMins: getMins(t.time),
      endMins: getMins(t.time) + (parseInt(t.duration) || 30)
    })).sort((a, b) => {
      if (a.startMins === b.startMins) return b.endMins - a.endMins;
      return a.startMins - b.startMins;
    });

    const clusters = [];
    let currentCluster = [];
    let clusterEnd = 0;

    for (const task of sortedTasks) {
      if (currentCluster.length === 0) {
        currentCluster.push([task]);
        clusterEnd = task.endMins;
      } else if (task.startMins < clusterEnd) {
        // Overlaps with the current cluster
        // Find a column where it doesn't overlap
        let placed = false;
        for (const col of currentCluster) {
          const lastTaskInCol = col[col.length - 1];
          if (task.startMins >= lastTaskInCol.endMins) {
            col.push(task);
            placed = true;
            break;
          }
        }
        if (!placed) {
          currentCluster.push([task]);
        }
        clusterEnd = Math.max(clusterEnd, task.endMins);
      } else {
        clusters.push(currentCluster);
        currentCluster = [[task]];
        clusterEnd = task.endMins;
      }
    }
    if (currentCluster.length > 0) clusters.push(currentCluster);

    // Flatten and assign layout
    const layoutedTasks = [];
    for (const cluster of clusters) {
      const numCols = cluster.length;
      cluster.forEach((col, colIndex) => {
        col.forEach(task => {
          layoutedTasks.push({
            ...task,
            layout: { colIndex, numCols }
          });
        });
      });
    }

    return layoutedTasks;
  }, [tasks]);

  return (
    <div className="glass-card" style={{ position: 'relative', padding: '20px 0', marginTop: '20px', overflow: 'hidden' }}>
      <h3 style={{ padding: '0 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        ⏳ Daily Timeline
      </h3>
      
      <div style={{ position: 'relative', height: `${24 * 90}px`, margin: '0 20px' }}>
        {/* Timeline Axis */}
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '40px',
          width: '2px',
          background: 'var(--border)',
          zIndex: 0
        }} />

        {/* Hour Markers */}
        {hours.map((hour, i) => (
          <div key={hour} style={{
            position: 'absolute',
            top: `${i * 90}px`,
            left: 0,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            zIndex: 0
          }}>
            <div style={{ width: '35px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', paddingRight: '10px' }}>
              {hour}
            </div>
            <div style={{ width: '12px', height: '2px', background: 'var(--border)' }} />
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.02)' }} />
          </div>
        ))}

        {/* Tasks */}
        {clusteredTasks.map((task, i) => (
          <TaskCard 
            key={task.id || i} 
            task={task} 
            isFutureDate={isFutureDate}
            onUpdateStatus={(newStatus) => handleUpdateStatus(task.id, newStatus)} 
            onEdit={() => onEditTask && onEditTask(task)}
            onDragTime={(newTime) => handleDragTime(task.id, newTime)}
          />
        ))}

        {/* Current Time Indicator (Only if today) */}
        {!isFutureDate && date === format(new Date(), 'yyyy-MM-dd') && (
          <CurrentTimeIndicator />
        )}

      </div>
    </div>
  );
}

function CurrentTimeIndicator() {
  const [top, setTop] = useState(0);
  const ref = useRef(null);
  const scrollDone = useRef(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      setTop(minutes * 1.5);
    };
    updateTime();
    
    // Initial auto-scroll (safely)
    const scrollTimer = setTimeout(() => {
      if (ref.current && !scrollDone.current) {
        try {
          ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          scrollDone.current = true;
        } catch (e) {
          try {
            ref.current.scrollIntoView(); // Fallback to instant scroll
          } catch (err) {}
        }
      }
    }, 500);

    const interval = setInterval(updateTime, 60000);
    return () => {
      clearInterval(interval);
      clearTimeout(scrollTimer);
    };
  }, []);


  return (
    <div ref={ref} style={{
      position: 'absolute',
      top: `${top}px`,
      left: '36px',
      right: 0,
      display: 'flex',
      alignItems: 'center',
      zIndex: 5,
      pointerEvents: 'none'
    }}>
      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-blue)' }} />
      <div style={{ flex: 1, height: '2px', background: 'var(--accent-blue)', opacity: 0.5 }} />
    </div>
  );
}
