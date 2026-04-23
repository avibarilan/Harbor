import { useState, useEffect } from 'react';
import { api, downloadFile } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import Spinner from '../ui/Spinner.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import Modal from '../ui/Modal.jsx';
import { HardDrive, Plus, Download, RotateCcw, AlertTriangle, Calendar } from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  return (Date.now() - new Date(dateStr)) / (1000 * 60 * 60 * 24);
}

function ScheduleModal({ open, onClose, instId }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [schedule, setSchedule] = useState('0 3 * * *');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get(`/instances/${instId}/backups/schedule`)
      .then(d => { setEnabled(d.enabled); setSchedule(d.schedule || '0 3 * * *'); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, instId]);

  const PRESETS = [
    { label: 'Daily at 3am',          value: '0 3 * * *' },
    { label: 'Weekly (Sun 3am)',       value: '0 3 * * 0' },
    { label: 'Monthly (1st 3am)',      value: '0 3 1 * *' },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/instances/${instId}/backups/schedule`, { enabled, schedule });
      toast('Backup schedule saved', 'success');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Configure backup schedule" size="sm">
      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="p-5 space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable scheduled backups</span>
          </label>
          {enabled && (
            <>
              <div>
                <label className="label">Presets</label>
                <div className="flex flex-col gap-1">
                  {PRESETS.map(p => (
                    <button key={p.value} type="button" onClick={() => setSchedule(p.value)}
                      className={`text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${schedule === p.value ? 'bg-harbor-50 dark:bg-harbor-900/20 text-harbor-700 dark:text-harbor-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Cron expression</label>
                <input className="input font-mono text-sm" value={schedule} onChange={e => setSchedule(e.target.value)} />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="btn-md btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-md btn-primary flex items-center gap-2">
              {saving && <Spinner size="sm" />} Save
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function BackupsTab({ inst }) {
  const { toast } = useToast();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/instances/${inst.id}/backups`)
      .then(data => setBackups([...data].sort((a, b) => new Date(b.date) - new Date(a.date))))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [inst.id]);

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      await api.post(`/instances/${inst.id}/backups`);
      toast('Backup started — it will appear in the list when complete', 'success');
      setTimeout(load, 5000);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownload = async (backup) => {
    setDownloading(backup.slug);
    try {
      await downloadFile(`/instances/${inst.id}/backups/${backup.slug}/download`, `${backup.slug}.tar`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setDownloading(null);
    }
  };

  const handleRestore = async () => {
    await api.post(`/instances/${inst.id}/backups/${restoreTarget.slug}/restore`);
    toast('Restore initiated — the instance will restart', 'success');
    setRestoreTarget(null);
  };

  const latestBackup = backups[0];
  const backupWarning = !latestBackup || daysSince(latestBackup.date) > 7;

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;

  if (error) {
    return (
      <div className="p-6">
        <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
          Backup management requires the Supervisor API (Home Assistant OS / Supervised only).
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl space-y-5">
      {backupWarning && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
          <AlertTriangle size={15} className="shrink-0" />
          {latestBackup
            ? `Last backup was ${Math.floor(daysSince(latestBackup.date))} days ago — consider creating one now.`
            : 'No backups found — this instance has never been backed up.'}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleCreateBackup}
          disabled={creatingBackup || inst.status !== 'connected'}
          className="btn-md btn-primary flex items-center gap-2"
        >
          {creatingBackup ? <Spinner size="sm" /> : <Plus size={15} />}
          Create backup now
        </button>
        <button onClick={() => setScheduleOpen(true)} className="btn-md btn-secondary flex items-center gap-2">
          <Calendar size={15} /> Schedule
        </button>
      </div>

      {/* Backup list */}
      {backups.length === 0 ? (
        <EmptyState icon={HardDrive} title="No backups" description="No backups found on this instance." />
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
          {backups.map(backup => (
            <div key={backup.slug} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{backup.name || backup.slug}</div>
                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                  <span>{backup.date ? new Date(backup.date).toLocaleString() : '—'}</span>
                  <span>{formatBytes(backup.size * 1024)}</span>
                  {backup.type && <span className="badge badge-gray">{backup.type}</span>}
                  {backup.protected && <span className="badge badge-blue">encrypted</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  disabled={downloading === backup.slug}
                  onClick={() => handleDownload(backup)}
                  className="btn-ghost btn-sm"
                  title="Download"
                >
                  {downloading === backup.slug ? <Spinner size="sm" /> : <Download size={13} />}
                </button>
                <button
                  disabled={inst.status !== 'connected'}
                  onClick={() => setRestoreTarget(backup)}
                  className="btn-ghost btn-sm"
                  title="Restore"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ScheduleModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} instId={inst.id} />

      <ConfirmDialog
        open={!!restoreTarget}
        title="Restore backup"
        confirmLabel="Restore"
        danger
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestore}
      >
        <div className="space-y-2">
          <p>Restore <strong>{restoreTarget?.name || restoreTarget?.slug}</strong>?</p>
          {restoreTarget?.date && <p className="text-gray-400 text-xs">Created: {new Date(restoreTarget.date).toLocaleString()}</p>}
          <p className="text-red-600 dark:text-red-400 font-medium text-xs">This will overwrite the current instance state and cause downtime.</p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
