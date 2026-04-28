import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import clsx from 'clsx';

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info };
const ACCENT = {
  success: 'var(--color-success)',
  error:   'var(--color-danger)',
  warning: 'var(--color-warning)',
  info:    'var(--color-accent)',
};
const DURATION = 5000;

function Toast({ id, message, type, onDismiss }) {
  const [leaving, setLeaving] = useState(false);
  const Icon = ICONS[type] || Info;
  const color = ACCENT[type] || ACCENT.info;

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(id), 220);
  }, [id, onDismiss]);

  useEffect(() => {
    const t = setTimeout(dismiss, DURATION);
    return () => clearTimeout(t);
  }, [dismiss]);

  return (
    <div
      className={clsx(
        'pointer-events-auto flex flex-col overflow-hidden w-80',
        leaving
          ? 'animate-[toast-out_200ms_ease_forwards]'
          : 'animate-[toast-in_300ms_ease_forwards]'
      )}
      style={{
        background:   'var(--color-bg-elevated)',
        border:       '1px solid var(--color-border)',
        borderLeft:   `3px solid ${color}`,
        borderRadius: 'var(--radius-md)',
        boxShadow:    'var(--shadow-lg)',
      }}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <Icon size={16} style={{ color, flexShrink: 0, marginTop: 1 }} />
        <span
          className="flex-1 text-sm leading-snug"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {message}
        </span>
        <button
          onClick={dismiss}
          className="shrink-0 -mt-0.5 -mr-1 p-0.5 rounded transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
        >
          <X size={14} />
        </button>
      </div>
      <div
        className="h-[2px] animate-[toast-progress_5s_linear_forwards]"
        style={{ background: color }}
      />
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-[100] pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} {...t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
