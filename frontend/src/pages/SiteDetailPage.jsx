import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useSites } from '../context/SitesContext.jsx';
import { useWs } from '../context/WsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import StatusDot from '../components/ui/StatusDot.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import InstanceActionButtons from '../components/ui/InstanceActionButtons.jsx';
import Modal from '../components/ui/Modal.jsx';
import { ExternalLink, Plus, Pencil, Trash2, ChevronRight, Tag, X } from 'lucide-react';
import clsx from 'clsx';

function EditSiteModal({ site, open, onClose, onSaved }) {
  const [name, setName] = useState(site.name);
  const [customerName, setCustomerName] = useState(site.customer_name || '');
  const [notes, setNotes] = useState(site.notes || '');
  const [tags, setTags] = useState(site.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addTag = () => {
    const val = tagInput.trim();
    if (val && !tags.includes(val)) setTags(t => [...t, val]);
    setTagInput('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await api.put(`/sites/${site.id}`, { name, customer_name: customerName, tags, notes });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit site">
      <form onSubmit={handleSave} className="p-5 space-y-4">
        <div>
          <label className="label">Site name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Customer name</label>
          <input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} />
        </div>
        <div>
          <label className="label">Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(t => (
              <span key={t} className="badge badge-blue flex items-center gap-1">
                {t}
                <button type="button" onClick={() => setTags(tags.filter(x => x !== t))}><X size={11} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="input" value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Add tag" />
            <button type="button" onClick={addTag} className="btn-md btn-secondary shrink-0"><Tag size={14} /></button>
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none min-h-[80px]" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-md btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-md btn-primary flex items-center gap-2">
            {saving && <Spinner size="sm" />} Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function SiteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sites, refresh } = useSites();
  const { statuses } = useWs();
  const { toast } = useToast();

  const [site, setSite] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    const found = sites.find(s => String(s.id) === String(id));
    if (found) setSite(found);
    else if (sites.length > 0) navigate('/', { replace: true });
  }, [sites, id, navigate]);

  if (!site) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;

  const instances = site.instances || [];
  const onlineCount = instances.filter(i => (statuses[i.id] || i.status) === 'connected').length;

  const handleDelete = async () => {
    await api.delete(`/sites/${site.id}`);
    await refresh();
    toast(`Site "${site.name}" deleted`, 'success');
    navigate('/');
  };

  const handleSaved = (updated) => {
    setSite({ ...site, ...updated });
    refresh();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-5">
        <Link to="/" className="hover:text-gray-600 dark:hover:text-gray-300">Dashboard</Link>
        <ChevronRight size={14} />
        <span className="text-gray-700 dark:text-gray-200 font-medium">{site.name}</span>
      </div>

      {/* Site header card */}
      <div className="card p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{site.name}</h1>
            {site.customer_name && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{site.customer_name}</p>}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {site.tags?.map(t => <span key={t} className="badge badge-gray">{t}</span>)}
            </div>
            {site.notes && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-lg">{site.notes}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setEditOpen(true)} className="btn-md btn-secondary flex items-center gap-1.5">
              <Pencil size={13} /> Edit
            </button>
            <button onClick={() => setDeleteConfirm(true)} className="btn-md btn-secondary text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1.5">
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400">
          <span><strong className="text-gray-900 dark:text-white">{instances.length}</strong> instance{instances.length !== 1 ? 's' : ''}</span>
          <span><strong className="text-green-600">{onlineCount}</strong> online</span>
        </div>
      </div>

      {/* Instances */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Instances</h2>
        <Link to="/adopt" state={{ siteId: site.id }} className="btn-sm btn-secondary flex items-center gap-1.5">
          <Plus size={13} /> Add instance
        </Link>
      </div>

      <div className="space-y-3">
        {instances.map(inst => {
          const status = statuses[inst.id] || inst.status;
          return (
            <div key={inst.id} className="card p-4 flex items-center gap-4">
              <StatusDot status={status} />
              <div className="flex-1 min-w-0">
                <Link to={`/instances/${inst.id}`} className="font-medium text-gray-900 dark:text-white hover:text-harbor-600 dark:hover:text-harbor-400 text-sm">
                  {inst.name}
                </Link>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                  {inst.ha_version && <span className="font-mono">{inst.ha_version}</span>}
                  {inst.installation_type && <span>{inst.installation_type}</span>}
                  {inst.last_seen && <span>Last seen {new Date(inst.last_seen).toLocaleString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <InstanceActionButtons instance={{ ...inst, status }} />
                <a
                  href={inst.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="btn-sm btn-secondary flex items-center gap-1"
                >
                  <ExternalLink size={12} /> Open HA
                </a>
                <Link to={`/instances/${inst.id}`} className="btn-sm btn-secondary">
                  Manage
                </Link>
              </div>
            </div>
          );
        })}
        {instances.length === 0 && (
          <div className="card p-8 text-center text-sm text-gray-400 dark:text-gray-500">
            No instances yet.{' '}
            <Link to="/adopt" className="text-harbor-600 hover:underline">Add the first one.</Link>
          </div>
        )}
      </div>

      <EditSiteModal site={site} open={editOpen} onClose={() => setEditOpen(false)} onSaved={handleSaved} />

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete site"
        confirmLabel="Delete site"
        danger
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
      >
        Delete <strong>{site.name}</strong> and all its instances? This cannot be undone.
      </ConfirmDialog>
    </div>
  );
}
