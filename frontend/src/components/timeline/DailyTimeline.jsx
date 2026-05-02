import React, { useMemo } from 'react';
import TaskCard from './TaskCard';

export default function DailyTimeline({ date, tasks, onUpdateTask, isFutureDate }) {
  // Generate hour markers from 00:00 to 23:00
  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
  }, []);

  const handleUpdateStatus = (taskIndex, newStatus) => {
    const updatedTasks = [...tasks];
    updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], status: newStatus };
    onUpdateTask(updatedTasks);
  };

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
        {tasks.map((task, i) => (
          <TaskCard 
            key={task.id || i} 
            task={task} 
            isFutureDate={isFutureDate}
            onUpdateStatus={(newStatus) => handleUpdateStatus(i, newStatus)} 
          />
        ))}

        {/* Current Time Indicator (Only if today) */}
        {!isFutureDate && date === new Date().toISOString().split('T')[0] && (
          <CurrentTimeIndicator />
        )}
      </div>
    </div>
  );
}

function CurrentTimeIndicator() {
  const [top, setTop] = React.useState(0);

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      setTop(minutes * 1.5);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
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
