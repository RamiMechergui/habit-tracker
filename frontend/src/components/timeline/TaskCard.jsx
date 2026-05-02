import React, { useRef, useState, useEffect } from 'react';
import { Clock, Bell, BellOff, CheckCircle, XCircle, GripHorizontal } from 'lucide-react';

export default function TaskCard({ task, onUpdateStatus, onEdit, onDragTime, isFutureDate }) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDraggingTime, setIsDraggingTime] = useState(false);
  const [confetti, setConfetti] = useState(false);
  
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);

  // --- Horizontal Swiping (Status) ---
  const handleTouchStart = (e) => {
    if (isFutureDate || isDraggingTime) return;
    startX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping || isFutureDate || isDraggingTime) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    if (diff > 100) setSwipeOffset(100);
    else if (diff < -100) setSwipeOffset(-100);
    else setSwipeOffset(diff);
  };

  const handleTouchEnd = () => {
    if (!isSwiping || isFutureDate) return;
    setIsSwiping(false);

    if (swipeOffset > 75) {
      if (task.status !== 'Completed') {
        setConfetti(true);
        setTimeout(() => setConfetti(false), 1000);
      }
      onUpdateStatus('Completed');
    } else if (swipeOffset < -75) {
      onUpdateStatus('Missed');
    }
    setSwipeOffset(0);
  };

  // --- Vertical Dragging (Time Change) ---
  const handleDragStart = (e) => {
    if (isFutureDate) return;
    e.stopPropagation();
    setIsDraggingTime(true);
    startY.current = e.touches ? e.touches[0].clientY : e.clientY;
  };

  const handleDragMove = (e) => {
    if (!isDraggingTime || isFutureDate) return;
    e.stopPropagation();
    e.preventDefault(); // Prevent scroll while dragging
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragY(clientY - startY.current);
  };

  const handleDragEnd = (e) => {
    if (!isDraggingTime || isFutureDate) return;
    e.stopPropagation();
    setIsDraggingTime(false);
    
    const [hours, minutes] = task.time.split(':').map(Number);
    const baseTopPosition = (hours * 60 + minutes) * 1.5;
    
    // Snap to 15 mins (22.5px)
    const totalMins = Math.round((baseTopPosition + dragY) / 1.5);
    const snappedMins = Math.round(totalMins / 15) * 15;
    
    // Ensure boundaries
    const safeMins = Math.max(0, Math.min(24 * 60 - 15, snappedMins));
    const h = Math.floor(safeMins / 60).toString().padStart(2, '0');
    const m = (safeMins % 60).toString().padStart(2, '0');
    
    if (`${h}:${m}` !== task.time) {
      onDragTime(`${h}:${m}`);
    }
    setDragY(0);
  };

  useEffect(() => {
    if (isDraggingTime) {
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
    } else {
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    }
    return () => {
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDraggingTime, dragY]);


  // --- Layout Calculations ---
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

  const [hours, minutes] = task.time.split(':').map(Number);
  const baseTopPosition = (hours * 60 + minutes) * 1.5;
  const topPosition = baseTopPosition + dragY;

  const durationHeight = Math.max((parseInt(task.duration) || 30) * 1.5, 45);

  const colIndex = task.layout?.colIndex || 0;
  const numCols = task.layout?.numCols || 1;
  const widthPercentage = 100 / numCols;
  const leftPercentage = colIndex * widthPercentage;

  return (
    <div style={{
      position: 'absolute',
      top: `${topPosition}px`,
      left: `calc(60px + (100% - 70px) * ${leftPercentage / 100})`, 
      width: `calc((100% - 70px) * ${widthPercentage / 100})`,
      height: `${durationHeight}px`,
      zIndex: isSwiping || isDraggingTime ? 10 : 1,
      transition: isSwiping || isDraggingTime ? 'none' : 'transform 0.3s ease, top 0.3s ease, left 0.3s ease, width 0.3s ease',
      transform: `translateX(${swipeOffset}px)`
    }}>
      {/* Background Action Indicators */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 20px', opacity: Math.abs(swipeOffset) / 100, zIndex: -1,
        background: swipeOffset > 0 ? '#10b981' : '#ef4444'
      }}>
        {swipeOffset > 0 ? <CheckCircle color="#fff" /> : <div />}
        {swipeOffset < 0 ? <XCircle color="#fff" /> : <div />}
      </div>

      <div 
        className={`glass-card ${confetti ? 'confetti-pop' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (isFutureDate || isDraggingTime) return;
          onEdit && onEdit();
        }}
        style={{
          background: bgColor,
          border: `1px solid ${borderColor}`,
          padding: '8px 12px',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          cursor: isFutureDate ? 'default' : 'pointer',
          height: '100%',
          boxShadow: isDraggingTime ? '0 10px 20px rgba(0,0,0,0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {task.title}
              {task.notificationEnabled && <Bell size={12} color="var(--accent-blue)" style={{flexShrink: 0}} />}
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              <Clock size={10} />
              {task.time} {task.duration ? `(${task.duration}m)` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            {statusIcon}
            
            {!isFutureDate && (
              <div 
                className="drag-handle"
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                style={{ cursor: 'grab', padding: '4px', color: 'var(--text-muted)', opacity: 0.5 }}
                onClick={(e) => e.stopPropagation()}
              >
                <GripHorizontal size={16} />
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes popConfetti {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(16,185,129,0.5); }
          50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(16,185,129,0.8); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(16,185,129,0); }
        }
        .confetti-pop {
          animation: popConfetti 0.5s ease-out forwards;
        }
        .drag-handle:hover {
          color: var(--text-primary) !important;
          opacity: 1 !important;
        }
        .drag-handle:active {
          cursor: grabbing !important;
        }
      `}</style>
    </div>
  );
}
