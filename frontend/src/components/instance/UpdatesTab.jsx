import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import Spinner from '../ui/Spinner.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import { RefreshCw, CheckCircle, Package } from 'lucide-react';
import clsx from 'clsx';

function UpdateRow({ label, current, latest, updateAvailable, onUpdate, updating }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
          {current ?? '—'}
          {updateAvailable && latest && (
            <span className="text-blue-600 dark:text-blue-400"> → {latest}</span>
          )}
        </div>
      </div>
      {updateAvailable ? (
        <button
          disabled={updating}
          onClick={onUpdate}
          className="btn-sm btn-secondary flex items-center gap-1.5 shrink-0 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
        >
          {updating ? <Spinner size="sm" /> : <RefreshCw size={12} />}
          Update
        </button>
      ) : current ? (
        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 shrink-0">
          <CheckCircle size={12} /> Up to date
        </div>
      ) : null}
    </div>
  );
}

export default function UpdatesTab({ inst }) {
  const { toast } = useToast();
  const [updates, setUpdates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/instances/${inst.id}/updates`)
      .then(setUpdates)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [inst.id]);

  const triggerUpdate = async () => {
    const { type, slug, label } = confirm;
    setConfirm(null);
    setUpdating(type);
    try {
      if (type === 'addon') {
        await api.post(`/instances/${inst.id}/addons/${slug}/update`);
      } else {
        await api.post(`/instances/${inst.id}/updates/${type}`);
      }
      toast(`Update triggered: ${label}`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;

  if (error) {
    return (
      <div className="p-6">
        <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
          Update information requires the Supervisor API (Home Assistant OS / Supervised only).
        </div>
      </div>
    );
  }

  const { core, supervisor, os, addons = [] } = updates || {};
  const hasAnyUpdate = core?.update_available || supervisor?.update_available || os?.update_available || addons.length > 0;

  return (
    <div className="p-6 max-w-2xl space-y-5">
      {!hasAnyUpdate && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400">
          <CheckCircle size={14} /> Everything is up to date
        </div>
      )}

      {/* Core components */}
      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Core Components
        </div>
        {[
          { key: 'core',       label: 'Home Assistant Core',       data: core },
          { key: 'supervisor', label: 'Supervisor',                 data: supervisor },
          { key: 'os',         label: 'Home Assistant OS',          data: os },
        ].map(({ key, label, data }) =>
          data ? (
            <UpdateRow
              key={key}
              label={label}
              current={data.version}
              latest={data.version_latest}
              updateAvailable={data.update_available}
              updating={updating === key}
              onUpdate={() => setConfirm({ type: key, label, current: data.version, latest: data.version_latest })}
            />
          ) : null
        )}
      </div>

      {/* Add-on updates */}
      {addons.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Package size={12} /> Add-on Updates ({addons.length})
          </div>
          {addons.map(addon => (
            <UpdateRow
              key={addon.slug}
              label={addon.name}
              current={addon.version}
              latest={addon.version_latest}
              updateAvailable
              updating={updating === `addon_${addon.slug}`}
              onUpdate={() => setConfirm({ type: 'addon', slug: addon.slug, label: addon.name, current: addon.version, latest: addon.version_latest })}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={`Update ${confirm?.label}`}
        confirmLabel="Update now"
        onClose={() => setConfirm(null)}
        onConfirm={triggerUpdate}
      >
        <div className="space-y-2">
          <p>Update <strong>{confirm?.label}</strong> from <code className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{confirm?.current}</code> to <code className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{confirm?.latest}</code>?</p>
          <p className="text-gray-400 text-xs">The instance may be briefly unavailable during the update.</p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
