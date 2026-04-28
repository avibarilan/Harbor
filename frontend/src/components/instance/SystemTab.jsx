import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { runCompanionCommand } from '../../hooks/useCompanionCommand.js';
import Spinner from '../ui/Spinner.jsx';
import { Server, RefreshCw } from 'lucide-react';

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-400 dark:text-gray-500 w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-200">{String(value)}</span>
    </div>
  );
}

function unitSystemSummary(us) {
  if (!us) return null;
  return [us.temperature, us.length, us.mass, us.volume].filter(Boolean).join(' · ');
}

function CompanionSystemInfo({ instanceId }) {
  const [sysinfo, setSysinfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await runCompanionCommand(instanceId, 'GET_SYSTEM');
      setSysinfo(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [instanceId]);

  if (loading) return <div className="flex items-center gap-2 text-xs text-gray-400"><Spinner size="sm" /> Loading supervisor info…</div>;
  if (error) return <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>;
  if (!sysinfo) return null;

  return (
    <>
      <InfoRow label="Supervisor" value={sysinfo.supervisor_version} />
      <InfoRow label="OS version" value={sysinfo.os_version} />
      <InfoRow label="Hostname" value={sysinfo.hostname} />
      <InfoRow label="Architecture" value={sysinfo.arch} />
    </>
  );
}

export default function SystemTab({ inst }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    api.get(`/instances/${inst.id}/sysconfig`)
      .then(setConfig)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [inst.id, refreshKey]);

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;

  if (error || !config) {
    return (
      <div className="p-6">
        <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
          Could not load system information. The instance may be offline.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Server size={14} className="text-harbor-500" /> System Information
          </h3>
          <button onClick={() => setRefreshKey(k => k + 1)} className="btn-ghost btn-sm" title="Refresh"><RefreshCw size={13} /></button>
        </div>
        <InfoRow label="HA Version"        value={config.version} />
        <InfoRow label="Installation type" value={config.installation_type} />
        <InfoRow label="Location name"     value={config.location_name} />
        <InfoRow label="Timezone"          value={config.time_zone} />
        <InfoRow label="Units"             value={unitSystemSummary(config.unit_system)} />
        <InfoRow label="Currency"          value={config.currency} />
        <InfoRow label="Country"           value={config.country} />
        <InfoRow label="Language"          value={config.language} />
        {inst.companion_enabled && <CompanionSystemInfo instanceId={inst.id} />}
      </div>
    </div>
  );
}
