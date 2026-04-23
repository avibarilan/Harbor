import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import { Settings, KeyRound, Download, RefreshCw, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

function ChangePasswordForm() {
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (next !== confirm) { setError('New passwords do not match'); return; }
    if (next.length < 8)  { setError('Password must be at least 8 characters'); return; }
    setError('');
    setSaving(true);
    try {
      await api.post('/auth/change-password', { current_password: current, new_password: next });
      toast('Password changed successfully', 'success');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5 max-w-md">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
        <KeyRound size={15} className="text-harbor-500" /> Change password
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Current password</label>
          <input className="input" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required />
        </div>
        <div>
          <label className="label">New password</label>
          <input className="input" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} required />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-md btn-primary flex items-center gap-2">
            {saving && <Spinner size="sm" />}
            {saving ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
}

function HarborUpdatesSection() {
  const [versionInfo, setVersionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [updateStarted, setUpdateStarted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadVersionInfo(); }, []);

  const loadVersionInfo = async () => {
    setLoading(true);
    setError('');
    try {
      setVersionInfo(await api.get('/harbor/version'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckUpdates = async () => {
    setChecking(true);
    setError('');
    try {
      const info = await api.post('/harbor/check-updates');
      setVersionInfo(info);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  const handleUpdate = async () => {
    setError('');
    try {
      await api.post('/harbor/update');
      setShowConfirm(false);
      setUpdateStarted(true);
    } catch (err) {
      setShowConfirm(false);
      setError(err.message);
    }
  };

  const formatDate = iso => iso ? new Date(iso).toLocaleString() : 'Never';

  if (loading) {
    return (
      <div className="card p-5 max-w-md">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Spinner size="sm" /> Checking version…
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card p-5 max-w-md">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <Download size={15} className="text-harbor-500" /> Harbor Updates
        </h2>

        {updateStarted ? (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
              <RefreshCw size={15} className="animate-spin" />
              Update in progress
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 pl-5">
              Harbor is restarting with the new version. Refresh this page in ~30 seconds.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex gap-2">
                <span className="w-28 shrink-0 text-gray-400">Current version</span>
                <span className="font-mono">{versionInfo?.version ?? '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="w-28 shrink-0 text-gray-400">Latest version</span>
                <span className="font-mono">
                  {versionInfo?.latestVersion ? (
                    <span className={versionInfo.updateAvailable
                      ? 'text-amber-600 dark:text-amber-400 font-medium'
                      : 'text-green-600 dark:text-green-400'}>
                      {versionInfo.latestVersion}
                    </span>
                  ) : '—'}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="w-28 shrink-0 text-gray-400">Last checked</span>
                <span>{formatDate(versionInfo?.lastChecked)}</span>
              </div>
            </div>

            {versionInfo?.latestVersion && !versionInfo.updateAvailable && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <CheckCircle size={13} /> Harbor is up to date
              </div>
            )}

            {versionInfo?.updateAvailable && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 space-y-1.5">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Update available: v{versionInfo.latestVersion}
                </p>
                {versionInfo.releaseUrl && (
                  <a
                    href={versionInfo.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-harbor-600 dark:text-harbor-400 hover:underline"
                  >
                    View release notes <ExternalLink size={11} />
                  </a>
                )}
              </div>
            )}

            {!versionInfo?.dockerAvailable && (
              <div className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-2.5 text-xs text-gray-500 dark:text-gray-400">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <span>
                  Docker socket not mounted — one-click updates unavailable.
                  Mount <code className="font-mono text-gray-600 dark:text-gray-300">/var/run/docker.sock</code> in your compose file to enable this feature.
                </span>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleCheckUpdates}
                disabled={checking}
                className="btn-sm btn-secondary flex items-center gap-1.5"
              >
                {checking ? <Spinner size="sm" /> : <RefreshCw size={13} />}
                Check for updates
              </button>

              {versionInfo?.updateAvailable && versionInfo?.dockerAvailable && (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="btn-sm btn-primary flex items-center gap-1.5"
                >
                  <Download size={13} />
                  Update to v{versionInfo.latestVersion}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleUpdate}
        title="Update Harbor"
        confirmLabel="Update Now"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Harbor will update from{' '}
          <strong className="text-gray-900 dark:text-white">v{versionInfo?.version}</strong> to{' '}
          <strong className="text-gray-900 dark:text-white">v{versionInfo?.latestVersion}</strong> and restart.
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          The new image will be pulled first (may take 1–2 minutes), then Harbor will restart automatically.
          Refresh this page after ~30 seconds. Your data will not be affected.
        </p>
      </ConfirmDialog>
    </>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Settings size={18} className="text-harbor-600" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      <div className="card p-5 max-w-md">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Account</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-harbor-100 dark:bg-harbor-900/40 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-harbor-700 dark:text-harbor-400">
              {user?.username?.[0]?.toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white text-sm">{user?.username}</div>
            <div className="text-xs text-gray-400">Administrator</div>
          </div>
        </div>
      </div>

      <ChangePasswordForm />

      <HarborUpdatesSection />
    </div>
  );
}
