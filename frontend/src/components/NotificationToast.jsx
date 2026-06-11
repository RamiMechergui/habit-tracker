import { useEffect, useRef } from 'react';
import { X, ShieldAlert, ShoppingBag, AlertTriangle } from 'lucide-react';

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
  const type = toast.type === 'system' ? 'system' : toast.type === 'urgent' ? 'urgent' : 'reminder';
  const duration = type === 'urgent' ? 8000 : type === 'system' ? 10000 : 5000;

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, duration, onDismiss]);

  const icon = type === 'urgent' ? <ShieldAlert size={18} /> : type === 'system' ? <AlertTriangle size={18} /> : <ShoppingBag size={18} />;
  const label = type === 'urgent' ? '🚨 Out of Stock' : type === 'system' ? '⚠️ System' : '🔔 Running Low';
  const cls = type === 'urgent' ? 'notif-toast-urgent' : type === 'system' ? 'notif-toast-system' : 'notif-toast-reminder';

  return (
    <div className={`notif-toast ${cls}`}>
      <div className="notif-toast-icon">{icon}</div>
      <div className="notif-toast-body">
        <span className="notif-toast-label">{label}</span>
        <p className="notif-toast-message">{toast.message}</p>
      </div>
      <button
        className="notif-toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
      <div
        className="notif-toast-progress"
        style={{ animationDuration: `${duration}ms` }}
      />
    </div>
  );
}
