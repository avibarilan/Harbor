import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, Pencil, Trash2, Check, X, MapPin, Tag, Globe } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../api/client.js';
import Spinner from '../ui/Spinner.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';

// ── Sub-tab shell ────────────────────────────────────────────────────────────

const SUB_TABS = [
  { key: 'areas',  label: 'Areas',  icon: MapPin },
  { key: 'labels', label: 'Labels', icon: Tag },
  { key: 'zones',  label: 'Zones',  icon: Globe },
];

// ── Inline edit row ──────────────────────────────────────────────────────────

function EditableRow({ value, onSave, onCancel }) {
  const [text, setText] = useState(value || '');
  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <input
        className="input flex-1 py-1"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(text); if (e.key === 'Escape') onCancel(); }}
        autoFocus
      />
      <button onClick={() => onSave(text)} className="btn-sm btn-primary"><Check size={12} /></button>
      <button onClick={onCancel} className="btn-sm btn-ghost"><X size={12} /></button>
    </div>
  );
}

// ── Areas ────────────────────────────────────────────────────────────────────

function AreasPanel({ instId }) {
  const { toast } = useToast();
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAreas(await api.get(`/instances/${instId}/areas`));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [instId]);

  useEffect(() => { load(); }, [load]);

  const create = async (name) => {
    if (!name.trim()) return setAdding(false);
    setBusy('add');
    try {
      await api.post(`/instances/${instId}/areas`, { name: name.trim() });
      toast('Area created', 'success');
      setAdding(false);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const update = async (areaId, name) => {
    if (!name.trim()) return setEditing(null);
    setBusy(areaId);
    try {
      await api.put(`/instances/${instId}/areas/${areaId}`, { name: name.trim() });
      toast('Area renamed', 'success');
      setEditing(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (area) => {
    setBusy(area.area_id);
    try {
      await api.delete(`/instances/${instId}/areas/${area.area_id}`);
      toast(`${area.name} deleted`, 'success');
      setDeleteConfirm(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-32"><Spinner size="lg" /></div>;

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={() => setAdding(true)} disabled={adding} className="btn-sm btn-secondary flex items-center gap-1.5">
          <Plus size={12} /> Add Area
        </button>
      </div>
      <div className="card overflow-hidden">
        {adding && (
          <div className="border-b border-gray-100 dark:border-gray-800">
            <EditableRow value="" onSave={create} onCancel={() => setAdding(false)} />
          </div>
        )}
        {areas.length === 0 && !adding ? (
          <div className="p-8 text-center text-sm text-gray-400">No areas defined</div>
        ) : (
          areas.map(area => (
            <div key={area.area_id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
              {editing === area.area_id ? (
                <EditableRow value={area.name} onSave={n => update(area.area_id, n)} onCancel={() => setEditing(null)} />
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">
                  <MapPin size={14} className="text-gray-400 shrink-0" />
                  <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{area.name}</span>
                  {area.device_count > 0 && (
                    <span className="text-xs text-gray-400">{area.device_count} device{area.device_count !== 1 ? 's' : ''}</span>
                  )}
                  <button onClick={() => setEditing(area.area_id)} disabled={!!busy} className="btn-sm btn-ghost"><Pencil size={12} /></button>
                  <button onClick={() => setDeleteConfirm(area)} disabled={!!busy} className="btn-sm btn-ghost" style={{ color: 'var(--color-danger)' }}>
                    {busy === area.area_id ? <Spinner size="sm" /> : <Trash2 size={12} />}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title={`Delete ${deleteConfirm?.name}`}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => remove(deleteConfirm)}
      >
        Delete area <strong>{deleteConfirm?.name}</strong>? Devices assigned to it will become unassigned.
      </ConfirmDialog>
    </>
  );
}

// ── Labels ───────────────────────────────────────────────────────────────────

const LABEL_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

function LabelsPanel({ instId }) {
  const { toast } = useToast();
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LABEL_COLORS[4]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLabels(await api.get(`/instances/${instId}/labels`));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [instId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy('add');
    try {
      await api.post(`/instances/${instId}/labels`, { name: newName.trim(), color: newColor });
      toast('Label created', 'success');
      setAdding(false);
      setNewName('');
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const update = async (label, name) => {
    if (!name.trim()) return setEditing(null);
    setBusy(label.label_id);
    try {
      await api.put(`/instances/${instId}/labels/${label.label_id}`, { name: name.trim(), color: label.color });
      toast('Label updated', 'success');
      setEditing(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (label) => {
    setBusy(label.label_id);
    try {
      await api.delete(`/instances/${instId}/labels/${label.label_id}`);
      toast(`${label.name} deleted`, 'success');
      setDeleteConfirm(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-32"><Spinner size="lg" /></div>;

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={() => setAdding(true)} disabled={adding} className="btn-sm btn-secondary flex items-center gap-1.5">
          <Plus size={12} /> Add Label
        </button>
      </div>
      <div className="card overflow-hidden">
        {adding && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1 shrink-0">
              {LABEL_COLORS.map(c => (
                <button key={c} onClick={() => setNewColor(c)} className="w-4 h-4 rounded-full transition-transform hover:scale-110" style={{ background: c, outline: newColor === c ? '2px solid var(--color-accent)' : 'none', outlineOffset: 1 }} />
              ))}
            </div>
            <input className="input flex-1 py-1" placeholder="Label name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') { setAdding(false); setNewName(''); }}} autoFocus />
            <button onClick={create} disabled={!!busy || !newName.trim()} className="btn-sm btn-primary"><Check size={12} /></button>
            <button onClick={() => { setAdding(false); setNewName(''); }} className="btn-sm btn-ghost"><X size={12} /></button>
          </div>
        )}
        {labels.length === 0 && !adding ? (
          <div className="p-8 text-center text-sm text-gray-400">No labels defined</div>
        ) : (
          labels.map(label => (
            <div key={label.label_id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
              {editing === label.label_id ? (
                <EditableRow value={label.name} onSave={n => update(label, n)} onCancel={() => setEditing(null)} />
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: label.color || '#6b7280' }} />
                  <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{label.name}</span>
                  <button onClick={() => setEditing(label.label_id)} disabled={!!busy} className="btn-sm btn-ghost"><Pencil size={12} /></button>
                  <button onClick={() => setDeleteConfirm(label)} disabled={!!busy} className="btn-sm btn-ghost" style={{ color: 'var(--color-danger)' }}>
                    {busy === label.label_id ? <Spinner size="sm" /> : <Trash2 size={12} />}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title={`Delete ${deleteConfirm?.name}`}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => remove(deleteConfirm)}
      >
        Delete label <strong>{deleteConfirm?.name}</strong>?
      </ConfirmDialog>
    </>
  );
}

// ── Zones ────────────────────────────────────────────────────────────────────

function ZoneForm({ initial, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name || '');
  const [lat, setLat] = useState(initial?.latitude ?? '');
  const [lng, setLng] = useState(initial?.longitude ?? '');
  const [radius, setRadius] = useState(initial?.radius ?? 100);
  const [passive, setPassive] = useState(initial?.passive || false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ name, latitude: parseFloat(lat), longitude: parseFloat(lng), radius: parseInt(radius), passive });
  };

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3 border-b border-gray-100 dark:border-gray-800">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Radius (m)</label>
          <input className="input" type="number" min="1" value={radius} onChange={e => setRadius(e.target.value)} required />
        </div>
        <div>
          <label className="label">Latitude</label>
          <input className="input" type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} required />
        </div>
        <div>
          <label className="label">Longitude</label>
          <input className="input" type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} required />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={passive} onChange={e => setPassive(e.target.checked)} />
        Passive (not used for person tracking)
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-sm btn-ghost">Cancel</button>
        <button type="submit" disabled={saving} className="btn-sm btn-primary flex items-center gap-1.5">
          {saving && <Spinner size="sm" />} Save
        </button>
      </div>
    </form>
  );
}

function ZonesPanel({ instId }) {
  const { toast } = useToast();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setZones(await api.get(`/instances/${instId}/zones`));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [instId]);

  useEffect(() => { load(); }, [load]);

  const create = async (data) => {
    setSaving(true);
    try {
      await api.post(`/instances/${instId}/zones`, data);
      toast(`Zone "${data.name}" created`, 'success');
      setAdding(false);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const update = async (zone, data) => {
    setSaving(true);
    const entityId = zone.entity_id;
    try {
      await api.put(`/instances/${instId}/zones/${encodeURIComponent(entityId)}`, data);
      toast(`Zone updated`, 'success');
      setEditing(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (zone) => {
    setBusy(zone.entity_id);
    try {
      await api.delete(`/instances/${instId}/zones/${encodeURIComponent(zone.entity_id)}`);
      toast(`${zone.name} deleted`, 'success');
      setDeleteConfirm(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-32"><Spinner size="lg" /></div>;

  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={() => setAdding(true)} disabled={adding} className="btn-sm btn-secondary flex items-center gap-1.5">
          <Plus size={12} /> Add Zone
        </button>
      </div>
      <div className="card overflow-hidden">
        {adding && <ZoneForm onSave={create} onCancel={() => setAdding(false)} saving={saving} />}
        {zones.length === 0 && !adding ? (
          <div className="p-8 text-center text-sm text-gray-400">No custom zones defined</div>
        ) : (
          zones.map(zone => (
            <div key={zone.entity_id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
              {editing === zone.entity_id ? (
                <ZoneForm initial={zone} onSave={d => update(zone, d)} onCancel={() => setEditing(null)} saving={saving} />
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Globe size={14} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{zone.name}</span>
                      {zone.passive && <span className="badge badge-gray">Passive</span>}
                    </div>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      {zone.latitude?.toFixed(4)}, {zone.longitude?.toFixed(4)} · {zone.radius}m
                    </p>
                  </div>
                  <button onClick={() => setEditing(zone.entity_id)} disabled={!!busy} className="btn-sm btn-ghost"><Pencil size={12} /></button>
                  <button onClick={() => setDeleteConfirm(zone)} disabled={!!busy} className="btn-sm btn-ghost" style={{ color: 'var(--color-danger)' }}>
                    {busy === zone.entity_id ? <Spinner size="sm" /> : <Trash2 size={12} />}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title={`Delete ${deleteConfirm?.name}`}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => remove(deleteConfirm)}
      >
        Delete zone <strong>{deleteConfirm?.name}</strong>?
      </ConfirmDialog>
    </>
  );
}

// ── Root tab ─────────────────────────────────────────────────────────────────

export default function AreasTab({ inst }) {
  const [sub, setSub] = useState('areas');

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-0 mb-5 overflow-hidden" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', display: 'inline-flex' }}>
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors"
            style={{
              background: sub === key ? 'var(--color-bg-hover)' : 'transparent',
              color: sub === key ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: sub === key ? '500' : '400',
              borderRight: key !== 'zones' ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {sub === 'areas'  && <AreasPanel  instId={inst.id} />}
      {sub === 'labels' && <LabelsPanel instId={inst.id} />}
      {sub === 'zones'  && <ZonesPanel  instId={inst.id} />}
    </div>
  );
}
