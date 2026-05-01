import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Package, ArrowUp, RefreshCw, Play, Square, RotateCcw, FileText, Settings, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { runCompanionCommand } from '../../hooks/useCompanionCommand.js';
import Spinner from '../ui/Spinner.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import Modal from '../ui/Modal.jsx';

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

function AddonRow({ addon, instId, onRefresh }) {
  const { toast } = useToast();
  const [running, setRunning] = useState(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [configText, setConfigText] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [uninstallConfirm, setUninstallConfirm] = useState(false);
  const [updateConfirm, setUpdateConfirm] = useState(false);

  const run = useCallback(async (command, label, opts = {}) => {
    setRunning(command);
    try {
      const result = await runCompanionCommand(instId, command, { slug: addon.slug });
      if (command === 'ADDON_GET_LOGS') {
        setLogs(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
        setLogsOpen(true);
      } else if (command === 'ADDON_GET_CONFIG') {
        setConfigText(JSON.stringify(result, null, 2));
        setConfigOpen(true);
      } else {
        toast(`${addon.name}: ${label}`, 'success');
        if (opts.refresh) setTimeout(onRefresh, 3000);
      }
    } catch (e) {
      toast(`${addon.name}: ${e.message}`, 'error');
    } finally {
      setRunning(null);
    }
  }, [addon.slug, addon.name, instId, onRefresh, toast]);

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      const parsed = JSON.parse(configText);
      await runCompanionCommand(instId, 'ADDON_SET_CONFIG', { slug: addon.slug, options: parsed });
      toast(`${addon.name}: configuration saved`, 'success');
      setConfigOpen(false);
    } catch (e) {
      toast(e instanceof SyntaxError ? 'Invalid JSON' : e.message, 'error');
    } finally {
      setConfigSaving(false);
    }
  };

  const isStarted = addon.state === 'started';
  const busy = !!running;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
        <Package size={16} className="text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{addon.name}</span>
            <span className={`badge ${STATE_COLOR[addon.state] || 'badge-gray'}`}>{addon.state || 'unknown'}</span>
            {addon.update_available && <span className="badge badge-blue">Update available</span>}
          </div>
          <p className="text-xs text-gray-400 font-mono mt-0.5">
            {addon.version}{addon.update_available && addon.version_latest ? ` → ${addon.version_latest}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isStarted ? (
            <button onClick={() => run('ADDON_STOP', 'stopped', { refresh: true })} disabled={busy} title="Stop" className="btn-sm btn-secondary">
              {running === 'ADDON_STOP' ? <Spinner size="sm" /> : <Square size={12} />}
            </button>
          ) : (
            <button onClick={() => run('ADDON_START', 'started', { refresh: true })} disabled={busy} title="Start" className="btn-sm btn-secondary">
              {running === 'ADDON_START' ? <Spinner size="sm" /> : <Play size={12} />}
            </button>
          )}
          <button onClick={() => run('ADDON_RESTART', 'restarted', { refresh: true })} disabled={busy || !isStarted} title="Restart" className="btn-sm btn-ghost">
            {running === 'ADDON_RESTART' ? <Spinner size="sm" /> : <RotateCcw size={12} />}
          </button>
          <button onClick={() => run('ADDON_GET_LOGS', '')} disabled={busy} title="View logs" className="btn-sm btn-ghost">
            {running === 'ADDON_GET_LOGS' ? <Spinner size="sm" /> : <FileText size={12} />}
          </button>
          <button onClick={() => run('ADDON_GET_CONFIG', '')} disabled={busy} title="Edit configuration" className="btn-sm btn-ghost">
            {running === 'ADDON_GET_CONFIG' ? <Spinner size="sm" /> : <Settings size={12} />}
          </button>
          {addon.update_available && (
            <button onClick={() => setUpdateConfirm(true)} disabled={busy} className="btn-sm btn-primary flex items-center gap-1 shrink-0">
              {running === 'UPDATE_ADDON' ? <Spinner size="sm" /> : <ArrowUp size={12} />} Update
            </button>
          )}
          <button onClick={() => setUninstallConfirm(true)} disabled={busy} title="Uninstall" className="btn-sm btn-ghost" style={{ color: 'var(--color-danger)' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <Modal open={logsOpen} onClose={() => setLogsOpen(false)} title={`${addon.name} — Logs`} size="lg">
        <div className="p-4">
          <pre className="text-xs font-mono bg-gray-950 text-green-400 p-4 rounded-lg overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">
            {logs || 'No log output'}
          </pre>
        </div>
      </Modal>

      <Modal open={configOpen} onClose={() => setConfigOpen(false)} title={`${addon.name} — Configuration`} size="md">
        <div className="p-4 space-y-3">
          <textarea
            className="input font-mono text-xs resize-none w-full"
            style={{ minHeight: 280 }}
            value={configText}
            onChange={e => setConfigText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfigOpen(false)} className="btn-md btn-secondary">Cancel</button>
            <button onClick={handleSaveConfig} disabled={configSaving} className="btn-md btn-primary flex items-center gap-2">
              {configSaving && <Spinner size="sm" />} Save configuration
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={updateConfirm}
        title={`Update ${addon.name}`}
        confirmLabel="Update"
        onClose={() => setUpdateConfirm(false)}
        onConfirm={() => {
          setUpdateConfirm(false);
          run('UPDATE_ADDON', 'update triggered', { refresh: true });
        }}
      >
        Update <strong>{addon.name}</strong>{addon.version_latest ? ` to ${addon.version_latest}` : ''}? It will restart during the update.
      </ConfirmDialog>

      <ConfirmDialog
        open={uninstallConfirm}
        title={`Uninstall ${addon.name}`}
        confirmLabel={running === 'ADDON_UNINSTALL' ? 'Uninstalling…' : 'Uninstall'}
        danger
        onClose={() => setUninstallConfirm(false)}
        onConfirm={() => {
          setUninstallConfirm(false);
          run('ADDON_UNINSTALL', 'uninstalled', { refresh: true });
        }}
      >
        Uninstall <strong>{addon.name}</strong>? This removes the add-on and its data from Home Assistant.
      </ConfirmDialog>
    </>
  );
}

function FullAddonsView({ inst }) {
  const { toast } = useToast();
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return (
    <div className="p-6 max-w-3xl">
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
            <AddonRow key={addon.slug} addon={addon} instId={inst.id} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddonsTab({ inst }) {
  if (!inst.companion_enabled) return <PlaceholderView inst={inst} />;
  return <FullAddonsView inst={inst} />;
}
