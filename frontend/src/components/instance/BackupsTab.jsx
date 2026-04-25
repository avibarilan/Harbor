import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, HardDrive, Plus, Download, RotateCcw, RefreshCw } from 'lucide-react';
import { api, downloadFile } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import Spinner from '../ui/Spinner.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';

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
        Backup management requires the Home Assistant Supervisor API. Install the Harbor Companion
        add-on and configure it in Settings to manage backups from here.
      </p>
      <a
        href={inst.url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-md btn-primary flex items-center gap-2"
      >
        <ExternalLink size={14} /> Open in Home Assistant
      </a>
    </div>
  );
}

function BackupRow({ backup, instanceId, onRestoreSuccess }) {
  const { toast } = useToast();
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadFile(`/instances/${instanceId}/backups/${backup.slug}/download`, `${backup.slug}.tar.gz`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await api.post(`/instances/${instanceId}/backups/${backup.slug}/restore`);
      toast('Restore triggered', 'success');
      onRestoreSuccess?.();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setRestoring(false);
      setRestoreConfirm(false);
    }
  };

  const date = backup.date ? new Date(backup.date).toLocaleString() : '—';
  const sizeMb = backup.size ? (backup.size / 1024 / 1024).toFixed(1) + ' MB' : null;

  return (
    <>
      <div className="flex items-center gap-3 py-3 px-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
        <HardDrive size={16} className="text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{backup.name || backup.slug}</p>
          <p className="text-xs text-gray-400">{date}{sizeMb ? ` · ${sizeMb}` : ''}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={handleDownload} disabled={downloading} className="btn-ghost btn-sm" title="Download">
            {downloading ? <Spinner size="sm" /> : <Download size={14} />}
          </button>
          <button onClick={() => setRestoreConfirm(true)} disabled={restoring} className="btn-ghost btn-sm" title="Restore">
            {restoring ? <Spinner size="sm" /> : <RotateCcw size={14} />}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={restoreConfirm}
        title="Restore backup"
        confirmLabel="Restore"
        danger
        onClose={() => setRestoreConfirm(false)}
        onConfirm={handleRestore}
      >
        Restore backup <strong>{backup.name || backup.slug}</strong>? Home Assistant will restart and all current state will be replaced.
      </ConfirmDialog>
    </>
  );
}

function FullBackupsView({ inst }) {
  const { toast } = useToast();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/instances/${inst.id}/backups`);
      setBackups(Array.isArray(data) ? data : []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [inst.id]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.post(`/instances/${inst.id}/backups`);
      toast('Backup started — this may take a moment', 'success');
      setTimeout(load, 3000);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setCreating(false);
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
      ) : backups.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-400">No backups found</div>
      ) : (
        <div className="card overflow-hidden">
          {backups.map(b => (
            <BackupRow key={b.slug} backup={b} instanceId={inst.id} onRestoreSuccess={load} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BackupsTab({ inst }) {
  if (!inst.companion_enabled) return <PlaceholderView inst={inst} />;
  return <FullBackupsView inst={inst} />;
}
