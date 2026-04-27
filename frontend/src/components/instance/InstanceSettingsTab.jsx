import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useSites } from '../../context/SitesContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Spinner from '../ui/Spinner.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import { CheckCircle, AlertTriangle, Trash2, PlugZap, Unplug, Link, Copy } from 'lucide-react';

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
  const [companionEnabling, setCompanionEnabling] = useState(false);
  const [companionError, setCompanionError] = useState('');
  const [removeCompanionConfirm, setRemoveCompanionConfirm] = useState(false);
  const [setupInfo, setSetupInfo] = useState(null);   // { instance_id, registration_secret }
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [checkStatusMsg, setCheckStatusMsg] = useState('');

  const companionEnabled = !!inst.companion_enabled;
  const isAuthFailed = inst.status === 'auth_failed';
  const harborOrigin = window.location.origin;

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

  const handleEnableCompanion = async () => {
    setCompanionEnabling(true);
    setCompanionError('');
    try {
      const result = await api.post(`/instances/${inst.id}/companion/enable`, { companion_url: companionUrl.trim() });
      setSetupInfo(result);
      setCheckStatusMsg('');
    } catch (err) {
      setCompanionError(err.message);
    } finally {
      setCompanionEnabling(false);
    }
  };

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    setCheckStatusMsg('');
    try {
      const res = await api.get(`/instances/${inst.id}/companion`);
      if (res.enabled) {
        setSetupInfo(null);
        await refresh();
        await onSaved();
        toast('Companion connected!', 'success');
      } else {
        setCheckStatusMsg('Not registered yet — make sure the add-on is started.');
      }
    } catch (err) {
      setCheckStatusMsg(err.message);
    } finally {
      setCheckingStatus(false);
    }
  };

  const copyToClipboard = (value) => {
    navigator.clipboard.writeText(value).then(() => toast('Copied!', 'success'));
  };

  const handleRemoveCompanion = async () => {
    try {
      await api.delete(`/instances/${inst.id}/companion`);
      await refresh();
      await onSaved();
      toast('Companion disabled', 'success');
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
          add-on control, and host reboot/shutdown from Harbor. Harbor connects to the companion
          directly using a URL and shared secret.
        </p>

        {companionEnabled ? (
          <div className="card p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 min-w-0">
              <Link size={14} className="shrink-0" />
              <span className="truncate">{inst.companion_url || 'Connected'}</span>
            </div>
            <button
              onClick={() => setRemoveCompanionConfirm(true)}
              className="btn-sm btn-danger flex items-center gap-1.5 shrink-0"
            >
              <Unplug size={12} /> Disable
            </button>
          </div>
        ) : setupInfo ? (
          <div className="card p-4 space-y-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Configure the Harbor Companion add-on in Home Assistant with these values:
            </p>
            <div className="space-y-3">
              {[
                { label: 'Harbor URL', value: harborOrigin },
                { label: 'Instance ID', value: String(inst.id) },
                { label: 'Registration Secret', value: setupInfo.registration_secret },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 truncate select-all">
                      {value}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(value)}
                      className="btn-sm btn-secondary flex items-center gap-1"
                    >
                      <Copy size={11} /> Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <ol className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-decimal list-inside">
              <li>Install the Harbor Companion add-on from your Home Assistant add-on store</li>
              <li>Open the add-on <strong>Configuration</strong> tab and enter the three values above</li>
              <li>Start the add-on — it will register with Harbor automatically</li>
            </ol>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={checkingStatus}
                className="btn-sm btn-primary flex items-center gap-2"
              >
                {checkingStatus && <Spinner size="sm" />} Check status
              </button>
              <button
                type="button"
                onClick={() => { setSetupInfo(null); setCheckStatusMsg(''); }}
                className="btn-sm btn-ghost"
              >
                Cancel
              </button>
              {checkStatusMsg && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{checkStatusMsg}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-4 space-y-3">
            <div>
              <label className="label">Companion URL</label>
              <input
                className="input"
                placeholder="https://havm-beta-companion.example.com"
                value={companionUrl}
                onChange={e => setCompanionUrl(e.target.value)}
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                The direct URL Harbor will use to reach the Companion add-on.
              </p>
            </div>
            {companionError && <p className="text-sm text-red-600 dark:text-red-400">{companionError}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleEnableCompanion}
                disabled={companionEnabling || !companionUrl.trim()}
                className="btn-md btn-primary flex items-center gap-2"
              >
                {companionEnabling && <Spinner size="sm" />}
                <PlugZap size={14} /> Enable Companion
              </button>
            </div>
          </div>
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
        title="Disable companion"
        confirmLabel="Disable"
        danger
        onClose={() => setRemoveCompanionConfirm(false)}
        onConfirm={handleRemoveCompanion}
      >
        Disable the Harbor Companion for <strong>{inst.name}</strong>? Supervisor features will revert to the "Open in HA" placeholder. The add-on itself is not uninstalled.
      </ConfirmDialog>
    </div>
  );
}
