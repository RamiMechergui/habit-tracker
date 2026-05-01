import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, Check, CheckCheck, ShieldAlert, ShoppingBag, Trash2, Clock } from 'lucide-react';
import { useHabits } from '../Store';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationCenter({ onClose }) {
  const { notifications, markNotificationRead, markAllNotificationsRead, deleteNotification, unreadCount } = useHabits();
  const [activeTab, setActiveTab] = useState('unread');
  const panelRef = useRef(null);

  const displayed = activeTab === 'unread'
    ? notifications.filter(n => n.status === 'UNREAD')
    : notifications;

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const formatTime = (ts) => {
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); }
    catch { return 'just now'; }
  };

  return createPortal(
    <div className="notif-center-overlay">
      <div className="notif-center-panel glass-card" ref={panelRef}>
        {/* Header */}
        <div className="notif-center-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="notif-center-icon-badge">
              <Bell size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Notifications</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {unreadCount} unread
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {unreadCount > 0 && (
              <button
                className="notif-action-btn"
                onClick={markAllNotificationsRead}
                title="Mark all as read"
              >
                <CheckCheck size={15} />
                <span>All read</span>
              </button>
            )}
            <button className="notif-close-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="notif-tabs">
          <button
            className={`notif-tab ${activeTab === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveTab('unread')}
          >
            Unread {unreadCount > 0 && <span className="notif-tab-badge">{unreadCount}</span>}
          </button>
          <button
            className={`notif-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All {notifications.length > 0 && <span className="notif-tab-badge notif-tab-badge-muted">{notifications.length}</span>}
          </button>
        </div>

        {/* Notification List */}
        <div className="notif-list evolvia-scrollbar">
          {displayed.length === 0 ? (
            <div className="notif-empty">
              <div className="notif-empty-icon">🔔</div>
              <p>
                {activeTab === 'unread'
                  ? 'You\'re all caught up! No unread notifications.'
                  : 'No notifications yet. Update an item status to get started.'}
              </p>
            </div>
          ) : (
            displayed.map(notif => (
              <div
                key={notif._id || notif.notificationId}
                className={`notif-card ${notif.type === 'urgent' ? 'notif-card-urgent' : 'notif-card-reminder'} ${notif.status === 'READ' ? 'notif-card-read' : ''}`}
              >
                <div className="notif-card-icon">
                  {notif.type === 'urgent'
                    ? <ShieldAlert size={16} />
                    : <ShoppingBag size={16} />}
                </div>
                <div className="notif-card-body">
                  <div className="notif-card-title">
                    <span className={`notif-type-pill ${notif.type}`}>
                      {notif.type === 'urgent' ? '🚨 Urgent' : '🔔 Reminder'}
                    </span>
                    {notif.status === 'UNREAD' && <span className="notif-unread-dot" />}
                  </div>
                  <p className="notif-card-message">{notif.message}</p>
                  <div className="notif-card-meta">
                    <Clock size={11} />
                    <span>{formatTime(notif.timestamp)}</span>
                  </div>
                </div>
                <div className="notif-card-actions">
                  {notif.status === 'UNREAD' && (
                    <button
                      className="notif-card-btn"
                      onClick={() => markNotificationRead(notif._id || notif.notificationId)}
                      title="Mark as read"
                    >
                      <Check size={13} />
                    </button>
                  )}
                  <button
                    className="notif-card-btn notif-card-btn-delete"
                    onClick={() => deleteNotification(notif._id || notif.notificationId)}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
