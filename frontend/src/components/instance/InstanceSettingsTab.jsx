import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useSites } from '../../context/SitesContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Spinner from '../ui/Spinner.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import { CheckCircle, AlertTriangle, Trash2, PlugZap, Unplug, Copy, WifiOff } from 'lucide-react';

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function CompanionSection({ inst, onRefresh }) {
  const { toast } = useToast();
  const [status, setStatus] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [token, setToken] = useState(null);
  const [disableConfirm, setDisableConfirm] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const needsReconfig = inst.companion_enabled && !inst.companion_last_seen;

  useEffect(() => {
    if (!inst.companion_enabled) { setStatus(null); return; }
    api.get(`/instances/${inst.id}/companion/status`).then(setStatus).catch(() => {});
  }, [inst.id, inst.companion_enabled]);

  const handleGenerate = async () => {
    setGenerating(true);
    setToken(null);
    try {
      const res = await api.post(`/companion/token/${inst.id}`);
      setToken(res.token);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDisable = async () => {
    setDisabling(true);
    try {
      await api.delete(`/instances/${inst.id}/companion`);
      setToken(null);
      setStatus(null);
      await onRefresh();
      toast('Companion disabled', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setDisabling(false);
      setDisableConfirm(false);
    }
  };

  const copyToken = () => {
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => toast('Copied!', 'success'));
  };

  const isOnline = !!status?.online;
  const isEnabled = !!inst.companion_enabled;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Harbor Companion</h2>
        {isEnabled && isOnline && (
          <span className="badge badge-green flex items-center gap-1"><PlugZap size={10} /> Connected</span>
        )}
        {isEnabled && !isOnline && (
          <span className="badge badge-yellow flex items-center gap-1"><WifiOff size={10} /> Offline</span>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Install the Harbor Companion add-on in Home Assistant to enable backup management, updates,
        add-on control, and host reboot/shutdown. The companion polls Harbor for commands — only
        outbound HTTPS from the HA instance is required.
      </p>

      {needsReconfig && (
        <div className="flex items-start gap-2 px-3 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <span className="text-amber-700 dark:text-amber-400">
            Companion needs to be reconfigured for the new poll-based architecture. Generate a new setup token below.
          </span>
        </div>
      )}

      {isEnabled && isOnline && !needsReconfig ? (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
              <PlugZap size={14} />
              <span>Connected</span>
              {status?.version && <span className="text-gray-400 text-xs">v{status.version}</span>}
            </div>
            <button
              onClick={() => setDisableConfirm(true)}
              className="btn-sm btn-danger flex items-center gap-1.5"
            >
              <Unplug size={12} /> Disable
            </button>
          </div>
          {status?.last_seen && (
            <p className="text-xs text-gray-400">Last seen {timeAgo(status.last_seen)}</p>
          )}
        </div>
      ) : isEnabled && !isOnline && !needsReconfig ? (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <WifiOff size={14} />
              <span>Companion offline</span>
            </div>
            <button
              onClick={() => setDisableConfirm(true)}
              className="btn-sm btn-danger flex items-center gap-1.5"
            >
              <Unplug size={12} /> Disable
            </button>
          </div>
          {status?.last_seen && (
            <p className="text-xs text-gray-400">Last seen {timeAgo(status.last_seen)} — check the add-on in Home Assistant.</p>
          )}
        </div>
      ) : (
        <div className="card p-4 space-y-4">
          {!token ? (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Generate a setup token, then paste it into the Harbor Companion add-on configuration in Home Assistant.
              </p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-md btn-primary flex items-center gap-2"
              >
                {generating && <Spinner size="sm" />}
                <PlugZap size={14} /> Generate Setup Token
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Paste this token into the Harbor Companion add-on configuration in Home Assistant.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-2 rounded border border-gray-200 dark:border-gray-700 break-all select-all">
                  {token}
                </code>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={copyToken} className="btn-sm btn-secondary flex items-center gap-1.5">
                  <Copy size={12} /> Copy to clipboard
                </button>
                <button onClick={() => setToken(null)} className="btn-sm btn-ghost">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-gray-400">This token expires in 24 hours and can only be used once.</p>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={disableConfirm}
        title="Disable companion"
        confirmLabel={disabling ? 'Disabling…' : 'Disable'}
        danger
        onClose={() => setDisableConfirm(false)}
        onConfirm={handleDisable}
      >
        Disable the Harbor Companion for <strong>{inst.name}</strong>? Supervisor features will revert to the "Open in HA" placeholder. The add-on itself is not uninstalled.
      </ConfirmDialog>
    </div>
  );
}

export default function InstanceSettingsTab({ inst, onSaved }) {
  const navigate = useNavigate();
  const { refresh } = useSites();
  const { toast } = useToast();

  const [name, setName] = useState(inst.name);
  const [url, setUrl] = useState(inst.url);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isAuthFailed = inst.status === 'auth_failed';

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError('');
    try {
      const body = { url: url.trim() };
      if (token.trim()) body.token = token.trim();
      const res = await api.post(`/instances/${inst.id}/test`, body);
      setTestResult(res);
    } catch (err) {
      setTestError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const body = { name: name.trim(), url: url.trim() };
      if (token.trim()) body.token = token.trim();
      await api.put(`/instances/${inst.id}`, body);
      await refresh();
      await onSaved();
      setToken('');
      toast('Instance settings saved', 'success');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await api.delete(`/instances/${inst.id}`);
    await refresh();
    toast(`Instance "${inst.name}" removed`, 'success');
    navigate('/', { replace: true });
  };

  const handleRefresh = async () => {
    await refresh();
    await onSaved();
  };

  return (
    <div className="p-6 max-w-xl space-y-8">
      {isAuthFailed && (
        <div className="flex items-start gap-2 px-3 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-sm">
          <AlertTriangle size={15} className="text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-orange-700 dark:text-orange-400">Token is invalid or revoked</p>
            <p className="text-orange-600 dark:text-orange-500 text-xs mt-0.5">Generate a new Long-Lived Access Token in HA → Profile and paste it below.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Instance configuration</h2>

        <div>
          <label className="label">Instance name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Home Assistant URL</label>
          <input className="input" value={url} onChange={e => setUrl(e.target.value)} required />
        </div>
        <div>
          <label className="label">
            New access token
            <span className="text-gray-400 font-normal ml-1">(leave blank to keep current)</span>
          </label>
          <textarea
            className={`input font-mono text-xs resize-none min-h-[72px] ${isAuthFailed ? 'border-orange-400 focus:ring-orange-400' : ''}`}
            placeholder="Paste new Long-Lived Access Token…"
            value={token}
            onChange={e => setToken(e.target.value)}
            autoFocus={isAuthFailed}
          />
        </div>

        <div>
          <label className="label">Installation type <span className="text-gray-400 font-normal">(auto-detected)</span></label>
          <input className="input bg-gray-50 dark:bg-gray-800/60" value={inst.installation_type || 'Unknown'} readOnly />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={handleTest} disabled={testing} className="btn-md btn-secondary flex items-center gap-2">
            {testing && <Spinner size="sm" />} Test connection
          </button>
          {testResult && (
            <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle size={14} /> v{testResult.version} · {testResult.installation_type}
            </div>
          )}
          {testError && <p className="text-sm text-red-600 dark:text-red-400">{testError}</p>}
        </div>

        {saveError && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{saveError}</p>}

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-md btn-primary flex items-center gap-2">
            {saving && <Spinner size="sm" />} Save changes
          </button>
        </div>
      </form>

      <hr className="border-t border-gray-200 dark:border-gray-700" />

      <CompanionSection inst={inst} onRefresh={handleRefresh} />

      <div className="border border-red-200 dark:border-red-900 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Danger zone</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Removing this instance will delete all cached entity data and disconnect Harbor from it permanently.
        </p>
        <button onClick={() => setDeleteConfirm(true)} className="btn-md btn-danger flex items-center gap-2">
          <Trash2 size={14} /> Remove instance
        </button>
      </div>

      <ConfirmDialog
        open={deleteConfirm}
        title="Remove instance"
        confirmLabel="Remove instance"
        danger
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
      >
        Remove <strong>{inst.name}</strong> from Harbor? This deletes all cached data for this instance. The Home Assistant installation itself is not affected.
      </ConfirmDialog>
    </div>
  );
}
