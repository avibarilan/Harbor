import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import Spinner from '../ui/Spinner.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import Badge from '../ui/Badge.jsx';
import { Package, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

export default function AddonsTab({ inst }) {
  const { toast } = useToast();
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);
  const [confirmAddon, setConfirmAddon] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/instances/${inst.id}/addons`)
      .then(setAddons)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [inst.id]);

  const handleUpdate = async () => {
    const addon = confirmAddon;
    setConfirmAddon(null);
    setUpdating(addon.slug);
    try {
      await api.post(`/instances/${inst.id}/addons/${addon.slug}/update`);
      toast(`Update triggered for ${addon.name}`, 'success');
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
          Add-ons are only available on Home Assistant OS and Supervised installations.
        </div>
      </div>
    );
  }

  const updateable = addons.filter(a => a.update_available);

  return (
    <div className="p-6">
      {updateable.length > 0 && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400">
          <RefreshCw size={14} className="shrink-0" />
          {updateable.length} add-on{updateable.length !== 1 ? 's' : ''} available for update
        </div>
      )}

      {addons.length === 0 ? (
        <EmptyState icon={Package} title="No add-ons" description="No add-ons installed on this instance." />
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
          {addons.map(addon => (
            <div key={addon.slug} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{addon.name}</span>
                  <span className={clsx('badge', addon.state === 'started' ? 'badge-green' : 'badge-gray')}>
                    {addon.state || 'unknown'}
                  </span>
                  {addon.update_available && <Badge variant="blue"><RefreshCw size={10} /> Update available</Badge>}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                  v{addon.version}
                  {addon.update_available && addon.version_latest && ` → v${addon.version_latest}`}
                </div>
              </div>
              {addon.update_available && (
                <button
                  disabled={updating === addon.slug}
                  onClick={() => setConfirmAddon(addon)}
                  className="btn-sm btn-secondary flex items-center gap-1.5 shrink-0"
                >
                  {updating === addon.slug ? <Spinner size="sm" /> : <RefreshCw size={12} />}
                  Update
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmAddon}
        title="Update add-on"
        confirmLabel="Update"
        onClose={() => setConfirmAddon(null)}
        onConfirm={handleUpdate}
      >
        Update <strong>{confirmAddon?.name}</strong> from <code>v{confirmAddon?.version}</code> to <code>v{confirmAddon?.version_latest}</code>?
        The add-on will restart during the update.
      </ConfirmDialog>
    </div>
  );
}
