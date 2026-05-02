import React, { useState } from 'react';
import { AlertCircle, X, CheckCircle } from 'lucide-react';

export default function MissedTasksBar({ tasks, onUpdateTaskStatus }) {
  const [isOpen, setIsOpen] = useState(false);

  // Determine missed tasks. We consider 'Missed' status or 'Pending' tasks where time has passed
  const missedTasks = tasks.filter((t, i) => {
    if (t.status === 'Missed') return true;
    if (t.status === 'Pending') {
      const now = new Date();
      const currentHourMin = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      return t.time < currentHourMin;
    }
    return false;
  }).map(t => ({ ...t, originalIndex: tasks.findIndex(task => task.id === t.id) }));

  if (missedTasks.length === 0) return null;

  return (
    <>
      {/* Sticky Bar */}
      <div 
        onClick={() => setIsOpen(true)}
        style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          animation: 'pageSlideIn 0.3s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={20} color="#ef4444" />
          <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.95rem' }}>
            You have {missedTasks.length} missed task{missedTasks.length > 1 ? 's' : ''} today
          </span>
        </div>
        <span style={{ fontSize: '0.8rem', color: '#ef4444', textDecoration: 'underline' }}>View</span>
      </div>

      {/* Missed Tasks Modal */}
      {isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '20px', backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg)', borderRadius: '16px', width: '100%', maxWidth: '400px',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            animation: 'scaleIn 0.2s ease'
          }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} /> Missed Tasks
              </h3>
              <button className="btn" style={{ padding: 4, background: 'transparent' }} onClick={() => setIsOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {missedTasks.map((t) => (
                <div key={t.id} className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem' }}>{t.title}</h4>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Scheduled for {t.time}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button 
                      className="btn" 
                      style={{ flex: 1, padding: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                      onClick={() => onUpdateTaskStatus(t.originalIndex, 'Completed')}
                    >
                      <CheckCircle size={16} /> Completed Late
                    </button>
                    <button 
                      className="btn" 
                      style={{ flex: 1, padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                      onClick={() => onUpdateTaskStatus(t.originalIndex, 'Missed')}
                    >
                      <X size={16} /> Mark as Missed
                    </button>
                  </div>
                </div>
              ))}
              {missedTasks.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                  All caught up!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
