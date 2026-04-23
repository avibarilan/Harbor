import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import Spinner from '../ui/Spinner.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import { Zap, Play, Trash2, ExternalLink, Bot } from 'lucide-react';
import clsx from 'clsx';

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={e => { e.stopPropagation(); onChange(!checked); }}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        checked ? 'bg-harbor-500' : 'bg-gray-300 dark:bg-gray-600'
      )}
    >
      <span className={clsx(
        'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5'
      )} />
    </button>
  );
}

export default function AutomationsTab({ inst }) {
  const { toast } = useToast();
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const offline = inst.status !== 'connected';

  const load = () => {
    setLoading(true);
    api.get(`/instances/${inst.id}/automations`)
      .then(setAutomations)
      .catch(err => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [inst.id]);

  const handleToggle = async (auto) => {
    const optimisticState = auto.state === 'on' ? 'off' : 'on';
    setAutomations(prev => prev.map(a => a.entity_id === auto.entity_id ? { ...a, state: optimisticState } : a));
    try {
      await api.post(`/instances/${inst.id}/automations/${encodeURIComponent(auto.entity_id)}/toggle`);
      toast(`${auto.friendly_name} ${optimisticState === 'on' ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
      toast(err.message, 'error');
      setAutomations(prev => prev.map(a => a.entity_id === auto.entity_id ? { ...a, state: auto.state } : a));
    }
  };

  const handleTrigger = async (auto) => {
    try {
      await api.post(`/instances/${inst.id}/automations/${encodeURIComponent(auto.entity_id)}/trigger`);
      toast(`Triggered: ${auto.friendly_name}`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleDelete = async () => {
    await api.delete(`/instances/${inst.id}/automations/${encodeURIComponent(deleteTarget.id || deleteTarget.entity_id)}`);
    setAutomations(prev => prev.filter(a => a.entity_id !== deleteTarget.entity_id));
    toast(`Deleted: ${deleteTarget.friendly_name}`, 'success');
    setDeleteTarget(null);
  };

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;

  return (
    <div className="p-6">
      {automations.length === 0 ? (
        <EmptyState icon={Bot} title="No automations" description="No automations found on this instance." />
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
          {automations.map(auto => (
            <div key={auto.entity_id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
              <Toggle checked={auto.state === 'on'} onChange={() => handleToggle(auto)} disabled={offline} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{auto.friendly_name}</div>
                {auto.last_triggered && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Last triggered: {new Date(auto.last_triggered).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Tooltip content={offline ? 'Instance offline' : 'Trigger now'}>
                  <button
                    disabled={offline}
                    onClick={() => handleTrigger(auto)}
                    className="btn-ghost btn-sm"
                  >
                    <Play size={13} />
                  </button>
                </Tooltip>
                <Tooltip content="Edit in Home Assistant">
                  <a
                    href={`${inst.url}/config/automation/edit/${auto.id || ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost btn-sm"
                  >
                    <ExternalLink size={13} />
                  </a>
                </Tooltip>
                <Tooltip content="Delete automation">
                  <button
                    onClick={() => setDeleteTarget(auto)}
                    className="btn-ghost btn-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={13} />
                  </button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete automation"
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      >
        Delete automation <strong>{deleteTarget?.friendly_name}</strong>? This cannot be undone.
      </ConfirmDialog>
    </div>
  );
}
