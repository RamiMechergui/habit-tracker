import React, { useState } from 'react';
import { X, Clock, Bell, AlignLeft, Target } from 'lucide-react';

export default function TaskBottomSheet({ isOpen, onClose, onSave, isFutureDate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('12:00');
  const [duration, setDuration] = useState('30');
  const [notificationEnabled, setNotificationEnabled] = useState(true);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!title.trim() || !time) return;
    onSave({
      id: `task_${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      time,
      duration,
      notificationEnabled,
      status: 'Pending',
      notificationSent: false
    });
    // Reset
    setTitle('');
    setDescription('');
    setTime('12:00');
    setDuration('30');
    setNotificationEnabled(true);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 999,
          backdropFilter: 'blur(4px)'
        }}
      />
      
      {/* Bottom Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
        padding: '24px', zIndex: 1000,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.2)',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Add New Task</h3>
          <button className="btn" style={{ background: 'transparent', padding: '8px' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="flex-col gap-4">
          <div style={{ position: 'relative' }}>
            <Target size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              className="w-full" style={{ paddingLeft: '2.5rem' }} 
              placeholder="Task Title (Required)" 
              value={title} onChange={e => setTitle(e.target.value)} 
              autoFocus
            />
          </div>

          <div style={{ position: 'relative' }}>
            <AlignLeft size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
            <textarea 
              className="w-full" style={{ paddingLeft: '2.5rem', paddingTop: '10px', minHeight: '80px', resize: 'none' }} 
              placeholder="Description (Optional)" 
              value={description} onChange={e => setDescription(e.target.value)} 
            />
          </div>

          <div className="flex gap-3">
            <div style={{ flex: 1, position: 'relative' }}>
              <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="time" className="w-full" style={{ paddingLeft: '2.5rem' }} 
                value={time} onChange={e => setTime(e.target.value)} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <input 
                type="number" className="w-full" placeholder="Duration (min)" 
                value={duration} onChange={e => setDuration(e.target.value)} 
              />
            </div>
          </div>

          <label className="flex items-center justify-between p-3 rounded-xl cursor-pointer mt-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-3">
              <Bell size={18} color={notificationEnabled ? 'var(--accent-blue)' : 'var(--text-muted)'} />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Remind me at task time</span>
            </div>
            <input 
              type="checkbox" 
              className="habit-checkbox" 
              checked={notificationEnabled} 
              onChange={e => setNotificationEnabled(e.target.checked)} 
            />
          </label>

          <button 
            className="btn w-full mt-4" 
            style={{ background: 'var(--accent-blue)', color: '#fff', padding: '12px', fontWeight: 600 }}
            onClick={handleSave}
            disabled={!title.trim() || !time || isFutureDate}
          >
            Save Task
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
