import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import Spinner from '../ui/Spinner.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import Modal from '../ui/Modal.jsx';
import { Users, UserPlus, Trash2, Shield } from 'lucide-react';

function CreateUserModal({ open, onClose, onCreated, instId }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setName(''); setUsername(''); setPassword(''); setIsAdmin(false); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const user = await api.post(`/instances/${instId}/users`, { name, username, password, is_admin: isAdmin });
      onCreated(user);
      reset();
      onClose();
      toast(`User "${username}" created`, 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Create HA user">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="label">Display name <span className="text-red-500">*</span></label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Username <span className="text-red-500">*</span></label>
          <input className="input" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="off" />
        </div>
        <div>
          <label className="label">Password <span className="text-red-500">*</span></label>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="rounded" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Administrator</span>
        </label>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={() => { reset(); onClose(); }} className="btn-md btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-md btn-primary flex items-center gap-2">
            {saving && <Spinner size="sm" />} Create user
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersTab({ inst }) {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    api.get(`/instances/${inst.id}/users`)
      .then(setUsers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [inst.id]);

  const handleDelete = async () => {
    await api.delete(`/instances/${inst.id}/users/${deleteTarget.id}`);
    setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
    toast(`User "${deleteTarget.name}" deleted`, 'success');
    setDeleteTarget(null);
  };

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Users size={15} className="text-harbor-500" /> Home Assistant Users
        </h2>
        <button onClick={() => setCreateOpen(true)} className="btn-sm btn-secondary flex items-center gap-1.5">
          <UserPlus size={13} /> Add user
        </button>
      </div>

      {error ? (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">
          {error} — user management requires HA WebSocket API access.
        </div>
      ) : users.length === 0 ? (
        <div className="text-sm text-gray-400 italic">No users found.</div>
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
          {users.map(user => (
            <div key={user.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-harbor-100 dark:bg-harbor-900/40 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-harbor-700 dark:text-harbor-400">
                  {(user.name || user.username || '?')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{user.name || user.username}</span>
                  {(user.is_admin || user.group_ids?.includes('system-admin')) && (
                    <Shield size={12} className="text-harbor-500" />
                  )}
                  {user.system_generated && (
                    <span className="badge badge-gray text-xs">system</span>
                  )}
                </div>
                {user.username && user.name !== user.username && (
                  <div className="text-xs text-gray-400">@{user.username}</div>
                )}
              </div>
              {!user.system_generated && (
                <button
                  onClick={() => setDeleteTarget(user)}
                  className="btn-ghost btn-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(u) => setUsers(prev => [...prev, u])} instId={inst.id} />
      <ConfirmDialog open={!!deleteTarget} title="Delete user" confirmLabel="Delete" danger onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}>
        Delete user <strong>{deleteTarget?.name}</strong>? They will no longer be able to log into this Home Assistant instance.
      </ConfirmDialog>
    </div>
  );
}
