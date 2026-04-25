import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import Spinner from '../ui/Spinner.jsx';
import { Server, Terminal, RefreshCw } from 'lucide-react';

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

function LogsPanel({ instanceId }) {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await api.get(`/instances/${instanceId}/logs`);
      setLogs(data.logs || '');
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [instanceId]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Terminal size={14} className="text-harbor-500" /> Recent Logs
        </h3>
        <button onClick={load} className="btn-ghost btn-sm" title="Refresh"><RefreshCw size={13} /></button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-24"><Spinner size="md" /></div>
      ) : error ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">Could not load logs</p>
      ) : (
        <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          {logs || '(empty)'}
        </pre>
      )}
    </div>
  );
}

export default function SystemTab({ inst }) {
  const [config, setConfig] = useState(null);
  const [sysinfo, setSysinfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    const requests = [api.get(`/instances/${inst.id}/sysconfig`)];
    if (inst.companion_enabled) requests.push(api.get(`/instances/${inst.id}/sysinfo`).catch(() => null));

    Promise.all(requests)
      .then(([cfg, info]) => {
        setConfig(cfg);
        setSysinfo(info || null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [inst.id, inst.companion_enabled]);

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
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Server size={14} className="text-harbor-500" /> System Information
        </h3>
        <InfoRow label="HA Version"         value={config.version} />
        <InfoRow label="Installation type"  value={config.installation_type} />
        <InfoRow label="Location name"      value={config.location_name} />
        <InfoRow label="Timezone"           value={config.time_zone} />
        <InfoRow label="Units"              value={unitSystemSummary(config.unit_system)} />
        <InfoRow label="Currency"           value={config.currency} />
        <InfoRow label="Country"            value={config.country} />
        <InfoRow label="Language"           value={config.language} />
        {sysinfo && (
          <>
            <InfoRow label="Supervisor"     value={sysinfo.supervisor_version} />
            <InfoRow label="OS version"     value={sysinfo.os_version} />
            <InfoRow label="Hostname"       value={sysinfo.hostname} />
            <InfoRow label="Architecture"   value={sysinfo.arch} />
          </>
        )}
      </div>

      {inst.companion_enabled && <LogsPanel instanceId={inst.id} />}
    </div>
  );
}
