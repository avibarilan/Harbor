import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ExternalLink, ChevronRight, AlertTriangle, WifiOff } from 'lucide-react';
import { api } from '../api/client.js';
import { useSites } from '../context/SitesContext.jsx';
import { useWs } from '../context/WsContext.jsx';
import StatusDot from '../components/ui/StatusDot.jsx';
import SkeletonLoader from '../components/SkeletonLoader.jsx';
import InstanceActionButtons from '../components/ui/InstanceActionButtons.jsx';
import Tooltip from '../components/ui/Tooltip.jsx';
import EntitiesTab      from '../components/instance/EntitiesTab.jsx';
import AutomationsTab   from '../components/instance/AutomationsTab.jsx';
import ScriptsScenesTab from '../components/instance/ScriptsScenesTab.jsx';
import UsersTab         from '../components/instance/UsersTab.jsx';
import AddonsTab        from '../components/instance/AddonsTab.jsx';
import UpdatesTab       from '../components/instance/UpdatesTab.jsx';
import BackupsTab       from '../components/instance/BackupsTab.jsx';
import SystemTab        from '../components/instance/SystemTab.jsx';
import InstanceSettingsTab from '../components/instance/InstanceSettingsTab.jsx';
import clsx from 'clsx';

const TABS = [
  { key: 'entities',    label: 'Entities' },
  { key: 'automations', label: 'Automations' },
  { key: 'scripts',     label: 'Scripts & Scenes' },
  { key: 'users',       label: 'Users' },
  { key: 'addons',      label: 'Add-ons' },
  { key: 'updates',     label: 'Updates' },
  { key: 'backups',     label: 'Backups' },
  { key: 'system',      label: 'System' },
  { key: 'settings',    label: 'Settings' },
];

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function InstanceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { locations } = useSites();
  const { statuses } = useWs();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inst, setInst] = useState(null);
  const [loading, setLoading] = useState(true);

  const activeTab = searchParams.get('tab') || 'entities';
  const setTab = (key) => setSearchParams({ tab: key }, { replace: true });

  useEffect(() => {
    setLoading(true);
    api.get(`/instances/${id}`)
      .then(setInst)
      .catch(() => navigate('/', { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const refreshInst = () => api.get(`/instances/${id}`).then(setInst).catch(() => {});

  if (loading) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div
          className="px-6 pt-4 pb-0 shrink-0"
          style={{ background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border)' }}
        >
          <SkeletonLoader variant="text" rows={2} className="mb-4 max-w-xs" />
          <div className="flex gap-4 mt-2 -mb-px">
            {TABS.slice(0, 5).map((_, i) => (
              <div
                key={i}
                className="h-8 w-20 rounded animate-[skeleton-pulse_1.5s_ease_infinite]"
                style={{ background: 'var(--color-bg-hover)' }}
              />
            ))}
          </div>
        </div>
        <div className="p-6 space-y-3">
          {[...Array(6)].map((_, i) => (
            <SkeletonLoader key={i} variant="table-row" />
          ))}
        </div>
      </div>
    );
  }

  if (!inst) return null;

  const liveStatus = statuses[inst.id] || inst.status;
  const location = locations.find(l => l.id === inst.location_id);
  const isOffline = liveStatus !== 'connected';
  const isAuthFailed = liveStatus === 'auth_failed';
  const instWithStatus = { ...inst, status: liveStatus };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div
        className="px-6 pt-4 pb-0 shrink-0"
        style={{ background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-3" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
          <Link
            to="/"
            className="transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
          >
            Dashboard
          </Link>
          {location && (
            <>
              <ChevronRight size={11} />
              <span>{location.name}</span>
            </>
          )}
          <ChevronRight size={11} />
          <span style={{ color: 'var(--color-text-secondary)' }}>{inst.name}</span>
        </div>

        {/* Title row */}
        <div className="flex items-start gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <StatusDot status={liveStatus} />
              <h1
                className="font-bold truncate"
                style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-xl)' }}
              >
                {inst.name}
              </h1>
            </div>
            <div className="flex items-center gap-3 mt-1 ml-[18px]">
              {inst.ha_version && (
                <span className="font-mono" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
                  {inst.ha_version}
                </span>
              )}
              {isOffline && inst.last_seen && (
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
                  Last seen {timeAgo(inst.last_seen)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <InstanceActionButtons instance={instWithStatus} />
            <Tooltip content="Open in Home Assistant">
              <a
                href={inst.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost btn-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <ExternalLink size={14} />
              </a>
            </Tooltip>
          </div>
        </div>

        {/* Status banners */}
        {isAuthFailed && (
          <div
            className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg text-sm"
            style={{
              background: 'var(--color-warning-subtle)',
              border: '1px solid rgba(210,153,34,0.3)',
            }}
          >
            <AlertTriangle size={14} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
            <span className="flex-1 text-xs" style={{ color: 'var(--color-warning)' }}>
              Authentication failed — token was revoked or is invalid.
            </span>
            <button
              onClick={() => setTab('settings')}
              className="text-xs font-medium shrink-0 hover:underline"
              style={{ color: 'var(--color-warning)' }}
            >
              Update token
            </button>
          </div>
        )}
        {liveStatus === 'disconnected' && (
          <div
            className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg"
            style={{
              background: 'var(--color-danger-subtle)',
              border: '1px solid rgba(248,81,73,0.2)',
            }}
          >
            <WifiOff size={12} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
            <span className="text-xs" style={{ color: 'var(--color-danger)' }}>
              Instance offline — showing last known state. Retrying in background.
            </span>
          </div>
        )}

        {/* Tab bar */}
        <div
          className="flex gap-0 overflow-x-auto -mb-px"
          style={{ scrollbarWidth: 'none' }}
        >
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className="whitespace-nowrap transition-colors"
              style={{
                padding: '12px 16px',
                fontSize: 'var(--text-sm)',
                fontWeight: activeTab === tab.key ? '500' : '400',
                borderBottom: activeTab === tab.key
                  ? '2px solid var(--color-accent)'
                  : '2px solid transparent',
                color: activeTab === tab.key
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)',
                background: 'transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                if (activeTab !== tab.key) e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={e => {
                if (activeTab !== tab.key) e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — key causes re-mount + animate on tab switch */}
      <div
        key={activeTab}
        className="flex-1 overflow-y-auto min-h-0 animate-[tab-in_200ms_ease_forwards]"
      >
        {activeTab === 'entities'    && <EntitiesTab      inst={instWithStatus} />}
        {activeTab === 'automations' && <AutomationsTab   inst={instWithStatus} />}
        {activeTab === 'scripts'     && <ScriptsScenesTab inst={instWithStatus} />}
        {activeTab === 'users'       && <UsersTab         inst={instWithStatus} />}
        {activeTab === 'addons'      && <AddonsTab        inst={instWithStatus} />}
        {activeTab === 'updates'     && <UpdatesTab       inst={instWithStatus} />}
        {activeTab === 'backups'     && <BackupsTab       inst={instWithStatus} />}
        {activeTab === 'system'      && <SystemTab        inst={instWithStatus} />}
        {activeTab === 'settings'    && <InstanceSettingsTab inst={inst} onSaved={refreshInst} />}
      </div>
    </div>
  );
}
