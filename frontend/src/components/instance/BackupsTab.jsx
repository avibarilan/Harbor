import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, HardDrive, Plus, RefreshCw, Trash2, Download, RotateCcw } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { runCompanionCommand } from '../../hooks/useCompanionCommand.js';
import Spinner from '../ui/Spinner.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';

const DOWNLOAD_TIMEOUT_MS = 120_000;

function PlaceholderView({ inst }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <HardDrive size={24} className="text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
        Manage backups in Home Assistant
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        Backup management requires the Harbor Companion add-on. Install and configure it in Settings.
      </p>
      <a href={inst.url} target="_blank" rel="noopener noreferrer" className="btn-md btn-primary flex items-center gap-2">
        <ExternalLink size={14} /> Open in Home Assistant
      </a>
    </div>
  );
}

function FullBackupsView({ inst }) {
  const { toast } = useToast();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [restoreConfirm, setRestoreConfirm] = useState(null);
  const [deleting, setDeleting] = useState({});
  const [downloading, setDownloading] = useState({});
  const [restoring, setRestoring] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await runCompanionCommand(inst.id, 'GET_BACKUPS');
      setBackups(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [inst.id]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const name = `harbor-backup-${new Date().toISOString().slice(0, 10)}`;
      await runCompanionCommand(inst.id, 'BACKUP_NOW', { name });
      toast('Backup started — this may take a moment', 'success');
      setTimeout(load, 5000);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (slug) => {
    setDeleting(d => ({ ...d, [slug]: true }));
    try {
      await runCompanionCommand(inst.id, 'DELETE_BACKUP', { slug });
      toast('Backup deleted', 'success');
      setBackups(prev => prev.filter(b => b.slug !== slug));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setDeleting(d => ({ ...d, [slug]: false }));
      setDeleteConfirm(null);
    }
  };

  const handleDownload = async (backup) => {
    setDownloading(d => ({ ...d, [backup.slug]: true }));
    try {
      toast('Downloading backup — this may take a moment…', 'success');
      const result = await runCompanionCommand(inst.id, 'DOWNLOAD_BACKUP', { slug: backup.slug }, DOWNLOAD_TIMEOUT_MS);
      if (!result?.content) throw new Error('No content returned from companion');

      const bytes = atob(result.content);
      const buf = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      const blob = new Blob([buf], { type: 'application/x-tar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${backup.slug}.tar`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setDownloading(d => ({ ...d, [backup.slug]: false }));
    }
  };

  const handleRestore = async (slug) => {
    setRestoring(r => ({ ...r, [slug]: true }));
    try {
      await runCompanionCommand(inst.id, 'RESTORE_BACKUP', { slug });
      toast('Restore initiated — Home Assistant will restart', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setRestoring(r => ({ ...r, [slug]: false }));
      setRestoreConfirm(null);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Backups</h2>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost btn-sm" title="Refresh"><RefreshCw size={14} /></button>
          <button onClick={handleCreate} disabled={creating} className="btn-md btn-primary flex items-center gap-2">
            {creating ? <Spinner size="sm" /> : <Plus size={14} />} New backup
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="card p-8 text-center text-sm text-red-500 dark:text-red-400">{error}</div>
      ) : backups.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-400">No backups found</div>
      ) : (
        <div className="card overflow-hidden">
          {backups.map(b => {
            const date = b.date ? new Date(b.date).toLocaleString() : '—';
            const sizeMb = b.size ? (b.size / 1024 / 1024).toFixed(1) + ' MB' : null;
            return (
              <div key={b.slug} className="flex items-center gap-3 py-3 px-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <HardDrive size={16} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{b.name || b.slug}</p>
                  <p className="text-xs text-gray-400">{date}{sizeMb ? ` · ${sizeMb}` : ''}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleDownload(b)}
                    disabled={downloading[b.slug]}
                    className="btn-ghost btn-sm text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                    title="Download backup"
                  >
                    {downloading[b.slug] ? <Spinner size="sm" /> : <Download size={14} />}
                  </button>
                  <button
                    onClick={() => setRestoreConfirm(b)}
                    disabled={restoring[b.slug]}
                    className="btn-ghost btn-sm text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
                    title="Restore backup"
                  >
                    {restoring[b.slug] ? <Spinner size="sm" /> : <RotateCcw size={14} />}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(b)}
                    disabled={deleting[b.slug]}
                    className="btn-ghost btn-sm text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Delete backup"
                  >
                    {deleting[b.slug] ? <Spinner size="sm" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          open
          title="Delete backup"
          confirmLabel="Delete"
          danger
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => handleDelete(deleteConfirm.slug)}
        >
          Delete backup <strong>{deleteConfirm.name || deleteConfirm.slug}</strong>? This cannot be undone.
        </ConfirmDialog>
      )}

      {restoreConfirm && (
        <ConfirmDialog
          open
          title="Restore backup"
          confirmLabel="Restore"
          danger
          onClose={() => setRestoreConfirm(null)}
          onConfirm={() => handleRestore(restoreConfirm.slug)}
        >
          <p>Are you sure you want to restore <strong>{restoreConfirm.name || restoreConfirm.slug}</strong>?</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Home Assistant will restart and all current data will be replaced with this backup.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default function BackupsTab({ inst }) {
  if (!inst.companion_enabled) return <PlaceholderView inst={inst} />;
  return <FullBackupsView inst={inst} />;
}
