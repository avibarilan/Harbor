import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Package, ArrowUp, RefreshCw } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { runCompanionCommand } from '../../hooks/useCompanionCommand.js';
import Spinner from '../ui/Spinner.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';

function PlaceholderView({ inst }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <Package size={24} className="text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
        Manage add-ons in Home Assistant
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        Add-on management requires the Harbor Companion add-on. Install and configure it in Settings.
      </p>
      <a href={inst.url} target="_blank" rel="noopener noreferrer" className="btn-md btn-primary flex items-center gap-2">
        <ExternalLink size={14} /> Open in Home Assistant
      </a>
    </div>
  );
}

const STATE_COLOR = { started: 'badge-green', stopped: 'badge-gray', error: 'badge-red' };

function FullAddonsView({ inst }) {
  const { toast } = useToast();
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await runCompanionCommand(inst.id, 'GET_ADDONS');
      setAddons(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [inst.id]);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (slug, name) => {
    setUpdating(u => ({ ...u, [slug]: true }));
    try {
      await runCompanionCommand(inst.id, 'UPDATE_ADDON', { addon_slug: slug });
      toast(`${name} update triggered`, 'success');
      setTimeout(load, 8000);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUpdating(u => ({ ...u, [slug]: false }));
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add-ons</h2>
        <button onClick={load} className="btn-ghost btn-sm" title="Refresh"><RefreshCw size={14} /></button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="card p-8 text-center text-sm text-red-500 dark:text-red-400">{error}</div>
      ) : addons.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-400">No add-ons installed</div>
      ) : (
        <div className="card overflow-hidden">
          {addons.map(addon => (
            <div key={addon.slug} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <Package size={16} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{addon.name}</span>
                  <span className={`badge ${STATE_COLOR[addon.state] || 'badge-gray'}`}>{addon.state || 'unknown'}</span>
                  {addon.update_available && <span className="badge badge-blue">Update available</span>}
                </div>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  {addon.version}{addon.version_latest && addon.version !== addon.version_latest ? ` → ${addon.version_latest}` : ''}
                </p>
              </div>
              {addon.update_available && (
                <UpdateButton
                  slug={addon.slug}
                  name={addon.name}
                  updating={!!updating[addon.slug]}
                  onUpdate={handleUpdate}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UpdateButton({ slug, name, updating, onUpdate }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <button onClick={() => setConfirm(true)} disabled={updating} className="btn-sm btn-primary flex items-center gap-1.5 shrink-0">
        {updating ? <Spinner size="sm" /> : <ArrowUp size={12} />} Update
      </button>
      <ConfirmDialog open={confirm} title={`Update ${name}`} confirmLabel="Update" onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onUpdate(slug, name); }}>
        Update add-on <strong>{name}</strong>? It will restart during the update.
      </ConfirmDialog>
    </>
  );
}

export default function AddonsTab({ inst }) {
  if (!inst.companion_enabled) return <PlaceholderView inst={inst} />;
  return <FullAddonsView inst={inst} />;
}
