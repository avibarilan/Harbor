import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, RefreshCw, RotateCcw, Trash2, EyeOff, Eye, Puzzle } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../api/client.js';
import Spinner from '../ui/Spinner.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';

const STATE_COLOR = {
  loaded:        'badge-green',
  setup_error:   'badge-red',
  migration_error: 'badge-red',
  failed_unload: 'badge-red',
  setup_retry:   'badge-orange',
  not_loaded:    'badge-gray',
};

function EntryRow({ entry, instId, onRefresh }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const act = async (action, label) => {
    setBusy(action);
    try {
      await api.post(`/instances/${instId}/integrations/${entry.entry_id}/${action}`);
      toast(`${entry.title}: ${label}`, 'success');
      setTimeout(onRefresh, 1000);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async () => {
    setBusy('delete');
    try {
      await api.delete(`/instances/${instId}/integrations/${entry.entry_id}`);
      toast(`${entry.title}: removed`, 'success');
      onRefresh();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const isDisabled = !!entry.disabled_by;
  const isBusy = !!busy;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
        <Puzzle size={15} className="text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{entry.title || entry.domain}</span>
            <span className={`badge ${STATE_COLOR[entry.state] || 'badge-gray'}`}>{entry.state?.replace(/_/g, ' ') || 'unknown'}</span>
            {isDisabled && <span className="badge badge-gray">Disabled</span>}
          </div>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{entry.domain}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isDisabled && entry.state === 'loaded' && (
            <button onClick={() => act('reload', 'reloaded')} disabled={isBusy} title="Reload" className="btn-sm btn-ghost">
              {busy === 'reload' ? <Spinner size="sm" /> : <RotateCcw size={12} />}
            </button>
          )}
          <button
            onClick={() => act(isDisabled ? 'enable' : 'disable', isDisabled ? 'enabled' : 'disabled')}
            disabled={isBusy}
            title={isDisabled ? 'Enable' : 'Disable'}
            className="btn-sm btn-ghost"
          >
            {busy === 'disable' || busy === 'enable' ? <Spinner size="sm" /> : isDisabled ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <button onClick={() => setDeleteConfirm(true)} disabled={isBusy} title="Remove" className="btn-sm btn-ghost" style={{ color: 'var(--color-danger)' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirm}
        title={`Remove ${entry.title || entry.domain}`}
        confirmLabel="Remove"
        danger
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => { setDeleteConfirm(false); doDelete(); }}
      >
        Remove the <strong>{entry.title || entry.domain}</strong> integration? This cannot be undone.
      </ConfirmDialog>
    </>
  );
}

function FlowRow({ flow, instId, onRefresh }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const ignore = async () => {
    setBusy(true);
    try {
      await api.delete(`/instances/${instId}/integrations/flows/${flow.flow_id}`);
      toast(`Dismissed ${flow.handler} discovery`, 'success');
      onRefresh();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <Puzzle size={15} className="text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{flow.handler}</span>
        <span className="badge badge-blue ml-2">Discovered</span>
        <p className="text-xs text-gray-400 mt-0.5">Source: {flow.context?.source || 'unknown'}</p>
      </div>
      <button onClick={ignore} disabled={busy} title="Ignore" className="btn-sm btn-ghost">
        {busy ? <Spinner size="sm" /> : <EyeOff size={12} />}
      </button>
    </div>
  );
}

export default function IntegrationsTab({ inst }) {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get(`/instances/${inst.id}/integrations`);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [inst.id]);

  useEffect(() => { load(); }, [load]);

  const entries = data?.entries || [];
  const flows = data?.flows?.filter(f => f.context?.source !== 'ignore') || [];

  const errored = entries.filter(e => ['setup_error', 'migration_error', 'failed_unload', 'setup_retry'].includes(e.state));
  const disabled = entries.filter(e => e.disabled_by);
  const loaded = entries.filter(e => e.state === 'loaded' && !e.disabled_by);

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Integrations</h2>
        <button onClick={load} className="btn-ghost btn-sm" title="Refresh"><RefreshCw size={14} /></button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="card p-8 text-center text-sm text-red-500 dark:text-red-400">{error}</div>
      ) : (
        <div className="space-y-4">
          {flows.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Discovered</h3>
              <div className="card overflow-hidden">
                {flows.map(f => <FlowRow key={f.flow_id} flow={f} instId={inst.id} onRefresh={load} />)}
              </div>
            </>
          )}

          {errored.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wide">Errors</h3>
              <div className="card overflow-hidden">
                {errored.map(e => <EntryRow key={e.entry_id} entry={e} instId={inst.id} onRefresh={load} />)}
              </div>
            </>
          )}

          {loaded.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Configured — {loaded.length}</h3>
              <div className="card overflow-hidden">
                {loaded.map(e => <EntryRow key={e.entry_id} entry={e} instId={inst.id} onRefresh={load} />)}
              </div>
            </>
          )}

          {disabled.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Disabled</h3>
              <div className="card overflow-hidden">
                {disabled.map(e => <EntryRow key={e.entry_id} entry={e} instId={inst.id} onRefresh={load} />)}
              </div>
            </>
          )}

          {entries.length === 0 && flows.length === 0 && (
            <div className="card p-8 text-center text-sm text-gray-400">No integrations found</div>
          )}
        </div>
      )}
    </div>
  );
}
