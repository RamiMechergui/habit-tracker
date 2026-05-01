import { useState, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useHabits } from '../Store';
import NotificationCenter from './NotificationCenter';

export default function NotificationBar() {
  const { unreadCount } = useHabits();
  const [open, setOpen] = useState(false);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        className={`notif-bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setOpen(prev => !prev)}
        title="Notifications"
        aria-label={`Notifications, ${unreadCount} unread`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && <NotificationCenter onClose={handleClose} />}
    </>
  );
}
