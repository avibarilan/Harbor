import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { runCompanionCommand } from '../../hooks/useCompanionCommand.js';
import Spinner from '../ui/Spinner.jsx';
import { Server, RefreshCw, Settings, CheckCircle, RotateCcw } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import Modal from '../ui/Modal.jsx';

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

const RELOAD_DOMAINS = [
  { key: 'automation',     label: 'Automations' },
  { key: 'script',         label: 'Scripts' },
  { key: 'scene',          label: 'Scenes' },
  { key: 'input_boolean',  label: 'Input Boolean' },
  { key: 'input_select',   label: 'Input Select' },
  { key: 'input_number',   label: 'Input Number' },
  { key: 'input_text',     label: 'Input Text' },
  { key: 'timer',          label: 'Timers' },
  { key: 'schedule',       label: 'Schedules' },
];

function ConfigManagement({ instanceId }) {
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [checkOpen, setCheckOpen] = useState(false);
  const [reloading, setReloading] = useState({});

  const configCheck = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const result = await api.post(`/instances/${instanceId}/config-check`);
      setCheckResult(result);
      setCheckOpen(true);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setChecking(false);
    }
  };

  const reloadAll = async () => {
    setReloading(r => ({ ...r, _all: true }));
    try {
      await api.post(`/instances/${instanceId}/reload-yaml`);
      toast('All YAML reloaded', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setReloading(r => ({ ...r, _all: false }));
    }
  };

  const reloadDomain = async (domain) => {
    setReloading(r => ({ ...r, [domain]: true }));
    try {
      await api.post(`/instances/${instanceId}/reload/${domain}`);
      toast(`Reloaded ${domain}`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setReloading(r => ({ ...r, [domain]: false }));
    }
  };

  const isValid = checkResult?.result === 'valid';

  return (
    <>
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
          <Settings size={14} className="text-harbor-500" /> Configuration Management
        </h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={configCheck} disabled={checking} className="btn-sm btn-secondary flex items-center gap-1.5">
            {checking ? <Spinner size="sm" /> : <CheckCircle size={12} />} Config Check
          </button>
          <button onClick={reloadAll} disabled={!!reloading._all} className="btn-sm btn-secondary flex items-center gap-1.5">
            {reloading._all ? <Spinner size="sm" /> : <RotateCcw size={12} />} Reload All YAML
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Reload individual domains:</p>
        <div className="flex flex-wrap gap-1.5">
          {RELOAD_DOMAINS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => reloadDomain(key)}
              disabled={!!reloading[key]}
              className="btn-sm btn-ghost text-xs flex items-center gap-1"
            >
              {reloading[key] && <Spinner size="sm" />} {label}
            </button>
          ))}
        </div>
      </div>

      <Modal open={checkOpen} onClose={() => setCheckOpen(false)} title="Configuration Check" size="sm">
        <div className="p-4">
          {checkResult && (
            <div className={`flex items-start gap-3 px-4 py-3 rounded-lg text-sm ${isValid ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
              <CheckCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{isValid ? 'Configuration is valid' : 'Configuration errors found'}</p>
                {!isValid && checkResult.errors && (
                  <pre className="mt-2 text-xs whitespace-pre-wrap font-mono opacity-80">{checkResult.errors}</pre>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
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
      {inst.companion_enabled && <ConfigManagement instanceId={inst.id} />}
    </div>
  );
}
