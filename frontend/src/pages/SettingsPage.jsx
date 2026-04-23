import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { Settings, KeyRound, CheckCircle } from 'lucide-react';

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

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Settings size={18} className="text-harbor-600" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      {/* Account info */}
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

      {/* About */}
      <div className="card p-5 max-w-md">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">About Harbor</h2>
        <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex gap-2"><span className="w-28 text-gray-400">Version</span><span>1.0.0</span></div>
          <div className="flex gap-2"><span className="w-28 text-gray-400">Account created</span><span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span></div>
        </div>
      </div>
    </div>
  );
}
