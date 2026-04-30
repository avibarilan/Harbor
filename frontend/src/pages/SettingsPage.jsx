import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSites } from '../context/SitesContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import { Settings, KeyRound, Download, RefreshCw, CheckCircle, AlertCircle, ExternalLink, MapPin, Plus, Pencil, Trash2, X, Globe } from 'lucide-react';

function GeneralSection() {
  const { toast } = useToast();
  const [publicUrl, setPublicUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get('/settings').then(s => {
      setPublicUrl(s.harbor_public_url || '');
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', { harbor_public_url: publicUrl.trim() || null });
      toast('Settings saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="card p-5 max-w-md">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
        <Globe size={15} className="text-harbor-500" /> General
      </h2>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="label">
            Harbor Public URL
            <span className="text-gray-400 font-normal ml-1">(optional override)</span>
          </label>
          <input
            className="input"
            type="url"
            placeholder="https://harbor.example.com"
            value={publicUrl}
            onChange={e => setPublicUrl(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            Used when generating Companion setup tokens. Leave blank to auto-detect from the incoming request.
          </p>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-md btn-primary flex items-center gap-2">
            {saving && <Spinner size="sm" />} Save
          </button>
        </div>
      </form>
    </div>
  );
}

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
            {saving && <Spinner size="sm" />} {saving ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
}

function LocationsSection() {
  const { locations, instances, refresh } = useSites();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const instanceCount = (locId) => instances.filter(i => i.location_id === locId).length;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api.post('/locations', { name: newName.trim() });
      await refresh();
      setNewName('');
      setAddingNew(false);
      toast('Location created', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (id) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await api.put(`/locations/${id}`, { name: editName.trim() });
      await refresh();
      setEditingId(null);
      toast('Location renamed', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (loc) => {
    try {
      await api.delete(`/locations/${loc.id}`);
      await refresh();
      toast(`Location "${loc.name}" deleted`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
    setDeleteConfirm(null);
  };

  return (
    <div className="card p-5 max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <MapPin size={15} className="text-harbor-500" /> Locations
        </h2>
        <button onClick={() => setAddingNew(true)} className="btn-sm btn-secondary flex items-center gap-1">
          <Plus size={13} /> New
        </button>
      </div>

      {addingNew && (
        <form onSubmit={handleCreate} className="flex gap-2 mb-3">
          <input
            className="input flex-1"
            placeholder="Location name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={saving || !newName.trim()} className="btn-sm btn-primary">
            {saving ? <Spinner size="sm" /> : 'Add'}
          </button>
          <button type="button" onClick={() => { setAddingNew(false); setNewName(''); }} className="btn-sm btn-ghost">
            <X size={14} />
          </button>
        </form>
      )}

      {locations.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No locations yet. Create one to group instances on the dashboard.</p>
      ) : (
        <div className="space-y-1">
          {locations.map(loc => (
            <div key={loc.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-800">
              <MapPin size={13} className="text-gray-400 shrink-0" />
              {editingId === loc.id ? (
                <input
                  className="input flex-1 py-0.5 text-sm"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(loc.id); if (e.key === 'Escape') setEditingId(null); }}
                  autoFocus
                />
              ) : (
                <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{loc.name}</span>
              )}
              <span className="text-xs text-gray-400">{instanceCount(loc.id)} inst.</span>
              {editingId === loc.id ? (
                <>
                  <button onClick={() => handleRename(loc.id)} disabled={saving} className="btn-ghost btn-sm text-green-600"><CheckCircle size={13} /></button>
                  <button onClick={() => setEditingId(null)} className="btn-ghost btn-sm"><X size={13} /></button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditingId(loc.id); setEditName(loc.name); }} className="btn-ghost btn-sm text-gray-400 hover:text-gray-600"><Pencil size={13} /></button>
                  <button onClick={() => setDeleteConfirm(loc)} className="btn-ghost btn-sm text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          open
          title="Delete location"
          confirmLabel="Delete"
          danger
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => handleDelete(deleteConfirm)}
        >
          Delete location <strong>{deleteConfirm.name}</strong>? Instances assigned to it will become ungrouped.
        </ConfirmDialog>
      )}
    </div>
  );
}

function HarborUpdatesSection() {
  const [versionInfo, setVersionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [polling, setPolling] = useState(false);
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
    setCheckResult(null);
    setError('');
    try {
      await api.post('/harbor/check-updates');
      const fresh = await api.get('/harbor/version');
      setVersionInfo(fresh);
      setCheckResult(fresh.updateAvailable
        ? `Version ${fresh.latestVersion} is available`
        : 'You are up to date');
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setShowConfirm(false);
    setError('');
    try {
      await api.post('/harbor/update');
      setPolling(true);
    } catch (err) {
      setUpdating(false);
      setError(err.message);
    }
  };

  useEffect(() => {
    if (!polling) return;
    const start = Date.now();
    const maxWait = 3 * 60 * 1000;
    const check = async () => {
      if (Date.now() - start > maxWait) { setPolling(false); setUpdating(false); return; }
      try {
        await api.get('/harbor/version');
        window.location.reload();
      } catch {
        setTimeout(check, 3000);
      }
    };
    setTimeout(check, 15000);
  }, [polling]);

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
      {versionInfo?.updateAvailable && (
        <div className="max-w-md mb-2 flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm">
          <Download size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-amber-700 dark:text-amber-300 font-medium">
            Harbor v{versionInfo.latestVersion} is available
          </span>
          {versionInfo.releaseUrl && (
            <a href={versionInfo.releaseUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-harbor-600 hover:underline flex items-center gap-1 text-xs">
              Notes <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}

      <div className="card p-5 max-w-md">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <Download size={15} className="text-harbor-500" /> Harbor Updates
        </h2>

        {(updating || polling) ? (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
              <RefreshCw size={15} className="animate-spin" /> Updating… Harbor will restart shortly
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 pl-5">
              Polling for restart — the page will reload automatically.
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

            {checkResult && (
              <div className={`flex items-center gap-1.5 text-xs ${versionInfo?.updateAvailable ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                <CheckCircle size={13} /> {checkResult}
              </div>
            )}

            {versionInfo?.latestVersion && !versionInfo.updateAvailable && !checkResult && (
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <CheckCircle size={13} /> Harbor is up to date
              </div>
            )}

            {!versionInfo?.dockerAvailable && (
              <div className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-2.5 text-xs text-gray-500 dark:text-gray-400">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <span>
                  Docker socket not mounted — one-click updates unavailable.
                  Mount <code className="font-mono text-gray-600 dark:text-gray-300">/var/run/docker.sock</code> to enable.
                </span>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button onClick={handleCheckUpdates} disabled={checking} className="btn-sm btn-secondary flex items-center gap-1.5">
                {checking ? <Spinner size="sm" /> : <RefreshCw size={13} />} Check for updates
              </button>
              {versionInfo?.updateAvailable && versionInfo?.dockerAvailable && (
                <button onClick={() => setShowConfirm(true)} className="btn-sm btn-primary flex items-center gap-1.5">
                  <Download size={13} /> Update to v{versionInfo.latestVersion}
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
          The new image will be pulled first (may take 1–2 minutes), then Harbor will restart. The page will reload automatically. Your data will not be affected.
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

      <GeneralSection />

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
      <LocationsSection />
      <HarborUpdatesSection />
    </div>
  );
}
