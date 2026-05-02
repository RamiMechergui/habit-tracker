import React, { useRef, useState } from 'react';
import { Clock, Bell, BellOff, CheckCircle, XCircle } from 'lucide-react';

export default function TaskCard({ task, onUpdateStatus, isFutureDate }) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);

  const handleTouchStart = (e) => {
    if (isFutureDate) return;
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || isFutureDate) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    
    // Limit swipe to reasonable bounds
    if (diff > 100) setSwipeOffset(100);
    else if (diff < -100) setSwipeOffset(-100);
    else setSwipeOffset(diff);
  };

  const handleTouchEnd = () => {
    if (!isDragging || isFutureDate) return;
    setIsDragging(false);

    if (swipeOffset > 75) {
      // Swiped Right -> Complete
      onUpdateStatus('Completed');
    } else if (swipeOffset < -75) {
      // Swiped Left -> Missed
      onUpdateStatus('Missed');
    }
    
    setSwipeOffset(0);
  };

  let bgColor = 'var(--bg-card)';
  let borderColor = 'rgba(255,255,255,0.05)';
  let statusIcon = null;

  if (task.status === 'Completed') {
    bgColor = 'rgba(16, 185, 129, 0.1)';
    borderColor = 'rgba(16, 185, 129, 0.3)';
    statusIcon = <CheckCircle size={20} color="#10b981" />;
  } else if (task.status === 'Missed') {
    bgColor = 'rgba(239, 68, 68, 0.1)';
    borderColor = 'rgba(239, 68, 68, 0.3)';
    statusIcon = <XCircle size={20} color="#ef4444" />;
  }

  // Calculate top position based on time (HH:mm)
  const [hours, minutes] = task.time.split(':').map(Number);
  const topPosition = (hours * 60 + minutes) * 1.5; // 1.5px per minute = 90px per hour

  return (
    <div style={{
      position: 'absolute',
      top: `${topPosition}px`,
      left: '60px', // Right of the timeline axis
      right: '10px',
      zIndex: isDragging ? 10 : 1,
      transition: isDragging ? 'none' : 'transform 0.3s ease',
      transform: `translateX(${swipeOffset}px)`
    }}>
      {/* Background Action Indicators (revealed when swiping) */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px',
        opacity: Math.abs(swipeOffset) / 100,
        zIndex: -1,
        background: swipeOffset > 0 ? '#10b981' : '#ef4444'
      }}>
        {swipeOffset > 0 ? <CheckCircle color="#fff" /> : <div />}
        {swipeOffset < 0 ? <XCircle color="#fff" /> : <div />}
      </div>

      <div 
        className="glass-card"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (isFutureDate) return;
          onUpdateStatus(task.status === 'Completed' ? 'Pending' : 'Completed');
        }}
        style={{
          background: bgColor,
          border: `1px solid ${borderColor}`,
          padding: '12px 16px',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: isFutureDate ? 'default' : 'pointer',
          minHeight: '60px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}
      >
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {task.title}
            {task.notificationEnabled ? <Bell size={14} color="var(--accent-blue)" /> : <BellOff size={14} color="var(--text-muted)" />}
          </h4>
          {task.description && (
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{task.description}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <Clock size={12} />
            {task.time} {task.duration ? `(${task.duration}m)` : ''}
          </div>
        </div>
        <div>
          {statusIcon}
        </div>
      </div>
    </div>
  );
}
