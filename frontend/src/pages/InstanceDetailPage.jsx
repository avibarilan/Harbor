import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ExternalLink, ChevronRight, AlertTriangle, WifiOff } from 'lucide-react';
import { api } from '../api/client.js';
import { useSites } from '../context/SitesContext.jsx';
import { useWs } from '../context/WsContext.jsx';
import StatusDot from '../components/ui/StatusDot.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import InstanceActionButtons from '../components/ui/InstanceActionButtons.jsx';
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

export default function InstanceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sites } = useSites();
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

  // Refresh instance data (e.g. after settings save)
  const refreshInst = () => api.get(`/instances/${id}`).then(setInst).catch(() => {});

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (!inst) return null;

  const liveStatus = statuses[inst.id] || inst.status;
  const site = sites.find(s => s.instances?.some(i => i.id === inst.id));
  const isOffline = liveStatus !== 'connected';
  const isAuthFailed = liveStatus === 'auth_failed';

  const instWithStatus = { ...inst, status: liveStatus };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 pt-5 pb-0 shrink-0">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
          <Link to="/" className="hover:text-gray-600 dark:hover:text-gray-300">Dashboard</Link>
          <ChevronRight size={12} />
          {site && <Link to={`/sites/${site.id}`} className="hover:text-gray-600 dark:hover:text-gray-300">{site.name}</Link>}
          {site && <ChevronRight size={12} />}
          <span className="text-gray-600 dark:text-gray-300">{inst.name}</span>
        </div>

        {/* Title row */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <StatusDot status={liveStatus} />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{inst.name}</h1>
            {inst.ha_version && (
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0">{inst.ha_version}</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <InstanceActionButtons instance={instWithStatus} />
            <a
              href={inst.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-md btn-secondary flex items-center gap-1.5"
            >
              <ExternalLink size={14} />
              <span className="hidden sm:inline">Open in HA</span>
            </a>
          </div>
        </div>

        {/* Status banners */}
        {isAuthFailed && (
          <div className="flex items-center gap-3 mb-4 px-3 py-2.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-sm">
            <AlertTriangle size={15} className="text-orange-500 shrink-0" />
            <div className="flex-1">
              <span className="font-medium text-orange-700 dark:text-orange-400">Authentication failed — </span>
              <span className="text-orange-600 dark:text-orange-500">the access token was revoked or is invalid.</span>
            </div>
            <button onClick={() => setTab('settings')} className="btn-sm bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/60 shrink-0">
              Update token
            </button>
          </div>
        )}
        {liveStatus === 'disconnected' && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
            <WifiOff size={13} className="shrink-0" />
            Instance offline — showing last known state. Retrying in background.
            {inst.last_seen && <span className="ml-1 text-red-400">Last seen {new Date(inst.last_seen).toLocaleString()}</span>}
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
