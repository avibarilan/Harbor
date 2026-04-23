import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useSites } from '../../context/SitesContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Spinner from '../ui/Spinner.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import { CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';

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
    navigate(`/`, { replace: true });
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
    </div>
  );
}
