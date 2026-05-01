import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, RefreshCw, ArrowUp, CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../api/client.js';
import { runCompanionCommand } from '../../hooks/useCompanionCommand.js';
import Spinner from '../ui/Spinner.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';

const BUILTIN_UPDATE_IDS = new Set([
  'update.home_assistant_core_update',
  'update.home_assistant_supervisor_update',
  'update.home_assistant_operating_system_update',
]);

function PlaceholderView({ inst }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <RefreshCw size={24} className="text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
        Manage updates in Home Assistant
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        Update management requires the Harbor Companion add-on. Install and configure it in Settings.
      </p>
      <a href={inst.url} target="_blank" rel="noopener noreferrer" className="btn-md btn-primary flex items-center gap-2">
        <ExternalLink size={14} /> Open in Home Assistant
      </a>
    </div>
  );
}

function UpdateRow({ label, info, onUpdate, updating }) {
  const [confirm, setConfirm] = useState(false);
  if (!info) return null;
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
            {info.update_available && <span className="badge badge-blue">Update available</span>}
          </div>
          <p className="text-xs text-gray-400 font-mono mt-0.5">
            {info.version}{info.update_available && info.version_latest ? ` → ${info.version_latest}` : ''}
          </p>
        </div>
        {info.update_available && onUpdate && (
          <button onClick={() => setConfirm(true)} disabled={updating} className="btn-sm btn-primary flex items-center gap-1.5 shrink-0">
            {updating ? <Spinner size="sm" /> : <ArrowUp size={12} />} Update
          </button>
        )}
      </div>
      <ConfirmDialog open={confirm} title={`Update ${label}`} confirmLabel="Update" onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onUpdate(); }}>
        Update <strong>{label}</strong>{info.version_latest ? ` to ${info.version_latest}` : ''}? Home Assistant may restart during the update.
      </ConfirmDialog>
    </>
  );
}

function FullUpdatesView({ inst }) {
  const { toast } = useToast();
  const [updates, setUpdates] = useState(null);
  const [integrationUpdates, setIntegrationUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState({});
  const [restartRequired, setRestartRequired] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [companionRes, entitiesRes] = await Promise.allSettled([
      runCompanionCommand(inst.id, 'GET_UPDATES'),
      api.get(`/instances/${inst.id}/entities?domain=update`),
    ]);

    const companionData = companionRes.status === 'fulfilled' ? companionRes.value : null;

    if (companionData) {
      setUpdates(companionData);
    } else {
      setError(companionRes.reason?.message || 'Failed to load updates');
    }

    if (entitiesRes.status === 'fulfilled') {
      // Build exclusion sets from companion addon data to prevent add-ons
      // from appearing in both "Add-on Updates" and "HACS / Custom Integrations"
      const addonList = companionData?.addons || [];
      const addonNameSet = new Set(addonList.map(a => a.name.toLowerCase()));
      const addonSlugEntityIds = new Set(
        addonList.map(a => `update.${a.slug.replace(/-/g, '_').toLowerCase()}_update`)
      );

      setIntegrationUpdates(
        entitiesRes.value.filter(e => {
          if (e.state !== 'on') return false;
          if (BUILTIN_UPDATE_IDS.has(e.entity_id)) return false;
          const title = (e.attributes?.title || '').toLowerCase();
          return !addonNameSet.has(title) && !addonSlugEntityIds.has(e.entity_id);
        })
      );
    }

    setLoading(false);
  }, [inst.id]);

  useEffect(() => { load(); }, [load]);

  const handleRestartNow = async () => {
    setRestarting(true);
    try {
      await runCompanionCommand(inst.id, 'RESTART_HA');
      toast('Home Assistant is restarting…', 'success');
      setRestartRequired(false);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setRestarting(false);
    }
  };

  const doUpdate = async (command, key, addonSlug) => {
    const k = addonSlug || key;
    setUpdating(u => ({ ...u, [k]: true }));
    try {
      await runCompanionCommand(inst.id, command, addonSlug ? { addon_slug: addonSlug } : undefined);
      toast(`${key} update triggered`, 'success');
      setRestartRequired(true);
      setTimeout(load, 8000);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUpdating(u => ({ ...u, [k]: false }));
    }
  };

  const doIntegrationUpdate = async (entity) => {
    const key = entity.entity_id;
    setUpdating(u => ({ ...u, [key]: true }));
    try {
      await api.post(`/instances/${inst.id}/entities/call`, {
        entity_id: entity.entity_id,
        service: 'install',
      });
      toast(`Update started for ${entity.attributes?.title || entity.attributes?.friendly_name || entity.entity_id}`, 'success');
      setRestartRequired(true);
      setTimeout(load, 8000);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUpdating(u => ({ ...u, [key]: false }));
    }
  };

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;

  const allUpToDate = updates
    && !updates.core?.update_available
    && !updates.supervisor?.update_available
    && !updates.os?.update_available
    && (!updates.addons || updates.addons.length === 0)
    && integrationUpdates.length === 0;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Updates</h2>
        <button onClick={load} className="btn-ghost btn-sm" title="Refresh"><RefreshCw size={14} /></button>
      </div>

      {restartRequired && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-lg" style={{ background: 'var(--color-warning-subtle)', border: '1px solid rgba(210,153,34,0.3)' }}>
          <AlertTriangle size={14} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
          <span className="flex-1 text-xs" style={{ color: 'var(--color-warning)' }}>
            Home Assistant restart required to complete the update.
          </span>
          <button onClick={handleRestartNow} disabled={restarting} className="btn-sm btn-secondary flex items-center gap-1.5 shrink-0">
            {restarting ? <Spinner size="sm" /> : <RotateCcw size={11} />} Restart Now
          </button>
          <button onClick={() => setRestartRequired(false)} className="btn-sm btn-ghost shrink-0">Later</button>
        </div>
      )}

      {error ? (
        <div className="card p-8 text-center text-sm text-red-500 dark:text-red-400">{error}</div>
      ) : !updates ? (
        <div className="card p-8 text-center text-sm text-gray-400">Could not load update information</div>
      ) : (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <UpdateRow label="Core" info={updates.core} onUpdate={() => doUpdate('UPDATE_CORE', 'core')} updating={updating.core} />
            <UpdateRow label="Supervisor" info={updates.supervisor} onUpdate={() => doUpdate('UPDATE_SUPERVISOR', 'supervisor')} updating={updating.supervisor} />
            <UpdateRow label="OS" info={updates.os} onUpdate={() => doUpdate('UPDATE_OS', 'os')} updating={updating.os} />
          </div>

          {allUpToDate && (
            <div className="card p-4 text-center text-sm text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
              <CheckCircle size={14} /> Everything is up to date
            </div>
          )}

          {updates.addons && updates.addons.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Add-on updates</h3>
              <div className="card overflow-hidden">
                {updates.addons.map(addon => (
                  <UpdateRow
                    key={addon.slug}
                    label={addon.name}
                    info={{ version: addon.version, version_latest: addon.version_latest, update_available: true }}
                    onUpdate={() => doUpdate('UPDATE_ADDON', addon.name, addon.slug)}
                    updating={updating[addon.slug]}
                  />
                ))}
              </div>
            </>
          )}

          {integrationUpdates.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">HACS / Custom integrations</h3>
              <div className="card overflow-hidden">
                {integrationUpdates.map(entity => (
                  <UpdateRow
                    key={entity.entity_id}
                    label={entity.attributes?.title || entity.attributes?.friendly_name || entity.entity_id}
                    info={{
                      version: entity.attributes?.installed_version,
                      version_latest: entity.attributes?.latest_version,
                      update_available: true,
                    }}
                    onUpdate={() => doIntegrationUpdate(entity)}
                    updating={updating[entity.entity_id]}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function UpdatesTab({ inst }) {
  if (!inst.companion_enabled) return <PlaceholderView inst={inst} />;
  return <FullUpdatesView inst={inst} />;
}
