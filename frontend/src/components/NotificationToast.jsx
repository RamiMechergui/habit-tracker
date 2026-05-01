import { useEffect, useRef } from 'react';
import { X, ShieldAlert, ShoppingBag } from 'lucide-react';

/**
 * NotificationToast — stacked top-right toasts for incoming SSE notifications.
 * Props:
 *   toasts: Array<{ id, type, message, itemName }>
 *   onDismiss: (id) => void
 */
export default function NotificationToast({ toasts, onDismiss }) {
  return (
    <div className="notif-toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const timerRef = useRef(null);
  const isUrgent = toast.type === 'urgent';
  const duration = isUrgent ? 8000 : 5000;

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, duration, onDismiss]);

  return (
    <div className={`notif-toast ${isUrgent ? 'notif-toast-urgent' : 'notif-toast-reminder'}`}>
      <div className="notif-toast-icon">
        {isUrgent ? <ShieldAlert size={18} /> : <ShoppingBag size={18} />}
      </div>
      <div className="notif-toast-body">
        <span className="notif-toast-label">
          {isUrgent ? '🚨 Out of Stock' : '🔔 Running Low'}
        </span>
        <p className="notif-toast-message">{toast.message}</p>
      </div>
      <button
        className="notif-toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
      {/* Progress bar that shrinks over the toast duration */}
      <div
        className="notif-toast-progress"
        style={{ animationDuration: `${duration}ms` }}
      />
    </div>
  );
}
