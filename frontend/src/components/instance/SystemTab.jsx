import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../../api/client.js';
import { runCompanionCommand } from '../../hooks/useCompanionCommand.js';
import Spinner from '../ui/Spinner.jsx';
import {
  Server, RefreshCw, Settings, CheckCircle, RotateCcw,
  ChevronLeft, ChevronRight, Activity, Lightbulb, ToggleLeft,
  Thermometer, Lock, Wind, Music, ShieldAlert, User, Star,
  MousePointer, Radio, Layers, X,
} from 'lucide-react';
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

const DOMAIN_ICONS = {
  light:               Lightbulb,
  switch:              ToggleLeft,
  climate:             Thermometer,
  lock:                Lock,
  fan:                 Wind,
  media_player:        Music,
  alarm_control_panel: ShieldAlert,
  person:              User,
  scene:               Star,
  button:              MousePointer,
  binary_sensor:       Radio,
  input_boolean:       ToggleLeft,
  cover:               Layers,
};

function DomainIcon({ domain }) {
  const Icon = DOMAIN_ICONS[domain] || Activity;
  return <Icon size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />;
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function formatEventMessage(e) {
  if (e.message) return e.message;
  if (e.state) return `changed to ${e.state}`;
  return 'updated';
}

function formatDateLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function LogbookSkeleton() {
  return (
    <div className="space-y-2 mt-3">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-8 rounded animate-[skeleton-pulse_1.5s_ease_infinite]"
          style={{ background: 'var(--color-bg-hover)', opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  );
}

function ActivityLog({ inst }) {
  const { toast } = useToast();
  const [rangeStart, setRangeStart] = useState(() => new Date(Date.now() - 86400000));
  const [rangeEnd, setRangeEnd]     = useState(() => new Date());
  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [entityFilter, setEntityFilter] = useState('');
  const [filterInput, setFilterInput]   = useState('');
  const [filterOpen, setFilterOpen]     = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = e => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: rangeStart.toISOString(),
        end:   rangeEnd.toISOString(),
        limit: '200',
      });
      if (entityFilter) params.set('entity_id', entityFilter);
      const data = await api.get(`/instances/${inst.id}/logbook?${params}`);
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [inst.id, rangeStart, rangeEnd, entityFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const shiftRange = (dir) => {
    const ms = 86400000;
    setRangeStart(d => new Date(d.getTime() + dir * ms));
    setRangeEnd(d =>   new Date(d.getTime() + dir * ms));
  };

  const rangeLabel = useMemo(() => {
    const fmt = d => d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return `${fmt(rangeStart)} – ${fmt(rangeEnd)}`;
  }, [rangeStart, rangeEnd]);

  const grouped = useMemo(() => {
    const map = new Map();
    events.forEach(e => {
      const key = formatDateLabel(e.when);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return map;
  }, [events]);

  const applyFilter = () => {
    setEntityFilter(filterInput.trim());
    setFilterOpen(false);
  };

  const clearFilter = () => {
    setEntityFilter('');
    setFilterInput('');
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Activity size={14} className="text-harbor-500" /> Activity Log
        </h3>
        <button onClick={load} disabled={loading} className="btn-ghost btn-sm" title="Refresh">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Date range controls */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={() => shiftRange(-1)} className="btn-sm btn-ghost p-1" title="Previous day">
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {rangeLabel}
        </span>
        <button onClick={() => shiftRange(1)} className="btn-sm btn-ghost p-1" title="Next day">
          <ChevronRight size={14} />
        </button>

        {/* Entity filter */}
        <div className="relative ml-auto" ref={filterRef}>
          {entityFilter ? (
            <span
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
              style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', border: '1px solid rgba(37,99,235,0.2)' }}
            >
              {entityFilter}
              <button onClick={clearFilter} className="ml-1 opacity-60 hover:opacity-100">
                <X size={11} />
              </button>
            </span>
          ) : (
            <button
              onClick={() => setFilterOpen(v => !v)}
              className="btn-sm btn-secondary flex items-center gap-1"
              style={{ fontSize: '11px' }}
            >
              + Add target
            </button>
          )}
          {filterOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-50 p-2 flex items-center gap-2"
              style={{
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                minWidth: 240,
              }}
            >
              <input
                autoFocus
                className="input text-xs py-1"
                placeholder="entity_id (e.g. light.living_room)"
                value={filterInput}
                onChange={e => setFilterInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applyFilter(); if (e.key === 'Escape') setFilterOpen(false); }}
              />
              <button onClick={applyFilter} className="btn-sm btn-primary shrink-0">Apply</button>
            </div>
          )}
        </div>
      </div>

      {/* Events */}
      {loading ? (
        <LogbookSkeleton />
      ) : events.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">No activity found</div>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([dateLabel, evts]) => (
            <div key={dateLabel}>
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {dateLabel}
              </p>
              <div
                className="rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--color-border-subtle)' }}
              >
                {evts.map((e, i) => {
                  const domain = e.domain || (e.entity_id ? e.entity_id.split('.')[0] : '');
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2"
                      style={{
                        borderBottom: i < evts.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                        background: 'var(--color-bg-surface)',
                      }}
                    >
                      <DomainIcon domain={domain} />
                      <div className="flex-1 min-w-0">
                        <span
                          className="font-medium text-xs"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {e.name || e.entity_id}
                        </span>
                        {' '}
                        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {formatEventMessage(e)}
                        </span>
                      </div>
                      <span
                        className="shrink-0 text-right whitespace-nowrap"
                        style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}
                      >
                        {formatTime(e.when)} · {timeAgo(e.when)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
      <ActivityLog inst={inst} />
    </div>
  );
}
