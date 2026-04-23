import Modal from './Modal.jsx';
import Spinner from './Spinner.jsx';
import { useState } from 'react';

export default function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirm', danger = false }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{children}</div>
      <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
        <button className="btn-md btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        <button
          className={`btn-md ${danger ? 'btn-danger' : 'btn-primary'} flex items-center gap-2`}
          onClick={handleConfirm}
          disabled={loading}
        >
          {loading && <Spinner size="sm" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
