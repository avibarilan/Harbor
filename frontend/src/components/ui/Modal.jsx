import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';

export default function Modal({ open, onClose, title, children, size = 'md', hideClose = false }) {
  const overlayRef = useRef(null);
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
      const t = setTimeout(() => { setVisible(false); setClosing(false); }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!visible) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    <div
      ref={overlayRef}
      className={clsx(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        closing ? 'animate-[backdrop-out_200ms_ease_forwards]' : 'animate-[backdrop-in_250ms_ease_forwards]'
      )}
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={clsx(
          'w-full flex flex-col max-h-[90vh]',
          widths[size],
          closing ? 'animate-[modal-out_200ms_ease_forwards]' : 'animate-[modal-in_250ms_ease_forwards]'
        )}
        style={{
          background:   'var(--color-bg-elevated)',
          border:       '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow:    'var(--shadow-lg)',
        }}
      >
        {(title || !hideClose) && (
          <div
            className="flex items-center justify-between px-5 py-4 shrink-0"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            {title && (
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {title}
              </h2>
            )}
            {!hideClose && (
              <button onClick={onClose} className="btn-ghost btn-sm ml-auto -mr-1">
                <X size={16} />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}
