import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useSites } from '../../context/SitesContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Spinner from '../ui/Spinner.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import { CheckCircle, AlertTriangle, Trash2, Plug, PlugZap, Unplug } from 'lucide-react';

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

  // Companion state
  const [companionUrl, setCompanionUrl] = useState(inst.companion_url || '');
  const [companionSecret, setCompanionSecret] = useState('');
  const [companionSaving, setCompanionSaving] = useState(false);
  const [companionError, setCompanionError] = useState('');
  const [removeCompanionConfirm, setRemoveCompanionConfirm] = useState(false);

  const companionEnabled = !!inst.companion_enabled;
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
    navigate(`/`, { replace: true });
  };

  const handleSaveCompanion = async (e) => {
    e.preventDefault();
    setCompanionSaving(true);
    setCompanionError('');
    try {
      await api.post(`/instances/${inst.id}/companion`, {
        companion_url: companionUrl.trim(),
        companion_secret: companionSecret.trim(),
      });
      await refresh();
      await onSaved();
      setCompanionSecret('');
      toast('Companion configured successfully', 'success');
    } catch (err) {
      setCompanionError(err.message);
    } finally {
      setCompanionSaving(false);
    }
  };

  const handleRemoveCompanion = async () => {
    try {
      await api.delete(`/instances/${inst.id}/companion`);
      await refresh();
      await onSaved();
      setCompanionUrl('');
      setCompanionSecret('');
      toast('Companion removed', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
    setRemoveCompanionConfirm(false);
  };

  return (
    <div className="p-6 max-w-xl space-y-8">
      {/* Auth failed warning */}
      {isAuthFailed && (
        <div className="flex items-start gap-2 px-3 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-sm">
          <AlertTriangle size={15} className="text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-orange-700 dark:text-orange-400">Token is invalid or revoked</p>
            <p className="text-orange-600 dark:text-orange-500 text-xs mt-0.5">Generate a new Long-Lived Access Token in HA → Profile and paste it below.</p>
          </div>
        </div>
      )}

      {/* Edit form */}
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

        {/* Test connection */}
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

      {/* Harbor Companion */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Harbor Companion</h2>
          {companionEnabled && (
            <span className="badge badge-green flex items-center gap-1"><PlugZap size={10} /> Connected</span>
          )}
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Install the Harbor Companion add-on in Home Assistant to enable backup management, updates,
          add-on control, logs, and host reboot/shutdown from Harbor. Find the secret in the add-on logs
          after installing.
        </p>

        {companionEnabled ? (
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Companion URL</p>
                <p className="text-sm font-mono text-gray-700 dark:text-gray-300">{inst.companion_url}</p>
              </div>
              <button
                onClick={() => setRemoveCompanionConfirm(true)}
                className="btn-sm btn-danger flex items-center gap-1.5"
              >
                <Unplug size={12} /> Remove
              </button>
            </div>

            {/* Allow re-saving to update secret */}
            <form onSubmit={handleSaveCompanion} className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-3">
              <p className="text-xs text-gray-400">Update companion URL or secret:</p>
              <div>
                <label className="label">Companion URL</label>
                <input className="input" value={companionUrl} onChange={e => setCompanionUrl(e.target.value)} required />
              </div>
              <div>
                <label className="label">New secret</label>
                <input className="input font-mono text-xs" placeholder="Paste new secret…" value={companionSecret} onChange={e => setCompanionSecret(e.target.value)} required />
              </div>
              {companionError && <p className="text-sm text-red-600 dark:text-red-400">{companionError}</p>}
              <div className="flex justify-end">
                <button type="submit" disabled={companionSaving} className="btn-md btn-secondary flex items-center gap-2">
                  {companionSaving && <Spinner size="sm" />} Update
                </button>
              </div>
            </form>
          </div>
        ) : (
          <form onSubmit={handleSaveCompanion} className="card p-4 space-y-3">
            <div>
              <label className="label">Companion URL</label>
              <input
                className="input"
                placeholder={`${inst.url}/harbor-companion`}
                value={companionUrl}
                onChange={e => setCompanionUrl(e.target.value)}
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Direct IP: <code className="font-mono">http://&#123;ha-ip&#125;:7779</code>
                {' · '}Cloudflare Tunnel: <code className="font-mono">&#123;ha-url&#125;/harbor-companion</code>
              </p>
            </div>
            <div>
              <label className="label">Secret</label>
              <input
                className="input font-mono text-xs"
                placeholder="Paste secret from add-on logs…"
                value={companionSecret}
                onChange={e => setCompanionSecret(e.target.value)}
                required
              />
            </div>
            {companionError && <p className="text-sm text-red-600 dark:text-red-400">{companionError}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={companionSaving} className="btn-md btn-primary flex items-center gap-2">
                {companionSaving && <Spinner size="sm" />}
                <Plug size={14} /> Connect companion
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Danger zone */}
      <div className="border border-red-200 dark:border-red-900 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Danger zone</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Removing this instance will delete all cached entity data and disconnect Harbor from it permanently.
        </p>
        <button
          onClick={() => setDeleteConfirm(true)}
          className="btn-md btn-danger flex items-center gap-2"
        >
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

      <ConfirmDialog
        open={removeCompanionConfirm}
        title="Remove companion"
        confirmLabel="Remove"
        danger
        onClose={() => setRemoveCompanionConfirm(false)}
        onConfirm={handleRemoveCompanion}
      >
        Remove the Harbor Companion configuration for <strong>{inst.name}</strong>? Supervisor features will revert to the "Open in HA" placeholder. The add-on itself is not uninstalled.
      </ConfirmDialog>
    </div>
  );
}
