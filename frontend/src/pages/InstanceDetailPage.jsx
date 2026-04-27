import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ExternalLink, ChevronRight, AlertTriangle, WifiOff } from 'lucide-react';
import { api } from '../api/client.js';
import { useSites } from '../context/SitesContext.jsx';
import { useWs } from '../context/WsContext.jsx';
import StatusDot from '../components/ui/StatusDot.jsx';
import Spinner from '../components/ui/Spinner.jsx';
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

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (!inst) return null;

  const liveStatus = statuses[inst.id] || inst.status;
  const location = locations.find(l => l.id === inst.location_id);
  const isOffline = liveStatus !== 'connected';
  const isAuthFailed = liveStatus === 'auth_failed';
  const instWithStatus = { ...inst, status: liveStatus };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 pt-4 pb-0 shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
          <Link to="/" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Dashboard</Link>
          {location && (
            <>
              <ChevronRight size={11} />
              <span className="text-gray-400">{location.name}</span>
            </>
          )}
          <ChevronRight size={11} />
          <span className="text-gray-600 dark:text-gray-300">{inst.name}</span>
        </div>

        {/* Title row */}
        <div className="flex items-start gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <StatusDot status={liveStatus} />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{inst.name}</h1>
            </div>
            <div className="flex items-center gap-3 mt-1 ml-[18px]">
              {inst.ha_version && (
                <span className="text-xs font-mono text-gray-400">{inst.ha_version}</span>
              )}
              {isOffline && inst.last_seen && (
                <span className="text-xs text-gray-400">Last seen {timeAgo(inst.last_seen)}</span>
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
                className="btn-ghost btn-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <ExternalLink size={14} />
              </a>
            </Tooltip>
          </div>
        </div>

        {/* Status banners */}
        {isAuthFailed && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <span className="text-amber-700 dark:text-amber-400 flex-1 text-xs">
              Authentication failed — token was revoked or is invalid.
            </span>
            <button
              onClick={() => setTab('settings')}
              className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline shrink-0"
            >
              Update token
            </button>
          </div>
        )}
        {liveStatus === 'disconnected' && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <WifiOff size={12} className="text-red-500 shrink-0" />
            <span className="text-xs text-red-600 dark:text-red-400">
              Instance offline — showing last known state. Retrying in background.
            </span>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-0 overflow-x-auto scrollbar-none -mb-px">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={clsx(
                'px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                activeTab === tab.key
                  ? 'border-harbor-600 text-harbor-700 dark:text-harbor-400 dark:border-harbor-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
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
