import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import Spinner from '../ui/Spinner.jsx';
import { Activity, Server, Cpu, HardDrive } from 'lucide-react';

function InfoRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-4 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-400 dark:text-gray-500 w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs font-mono text-gray-800 dark:text-gray-200 break-all">{String(value)}</span>
    </div>
  );
}

function Section({ title, icon: Icon, data }) {
  if (!data) return null;
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object');
  if (entries.length === 0) return null;
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <Icon size={14} className="text-harbor-500" /> {title}
      </h3>
      <div>
        {entries.map(([k, v]) => (
          <InfoRow key={k} label={k.replace(/_/g, ' ')} value={v} />
        ))}
      </div>
    </div>
  );
}

export default function SystemTab({ inst }) {
  const [health, setHealth] = useState(null);
  const [logs, setLogs] = useState('');
  const [healthLoading, setHealthLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [healthError, setHealthError] = useState('');

  useEffect(() => {
    api.get(`/instances/${inst.id}/health`)
      .then(setHealth)
      .catch(err => setHealthError(err.message))
      .finally(() => setHealthLoading(false));

    fetch(`/api/instances/${inst.id}/logs`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('harbor_token')}` },
    })
      .then(r => r.text())
      .then(setLogs)
      .catch(() => setLogs('Could not load logs.'))
      .finally(() => setLogsLoading(false));
  }, [inst.id]);

  return (
    <div className="p-6 max-w-3xl space-y-5">
      {/* Health */}
      {healthLoading ? (
        <div className="flex items-center justify-center h-32"><Spinner /></div>
      ) : healthError ? (
        <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
          System health info requires the Supervisor API (Home Assistant OS / Supervised only).
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Section title="Core" icon={Activity} data={health?.core} />
          <Section title="Supervisor" icon={Server} data={health?.supervisor} />
          <Section title="Host" icon={Cpu} data={health?.host} />
          <Section title="OS" icon={HardDrive} data={health?.os} />
        </div>
      )}

      {/* Logs */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Activity size={14} className="text-harbor-500" /> Recent Logs
        </h3>
        {logsLoading ? (
          <div className="flex items-center justify-center h-24"><Spinner /></div>
        ) : (
          <pre className="card p-4 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-auto max-h-96 whitespace-pre-wrap break-words">
            {logs || 'No logs available.'}
          </pre>
        )}
      </div>
    </div>
  );
}
