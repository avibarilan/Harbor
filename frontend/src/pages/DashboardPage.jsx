import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Server, Wifi, Globe, RefreshCw, AlertTriangle, Tag } from 'lucide-react';
import { useSites } from '../context/SitesContext.jsx';
import { useWs } from '../context/WsContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import StatusDot from '../components/ui/StatusDot.jsx';
import Badge from '../components/ui/Badge.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import InstanceActionButtons from '../components/ui/InstanceActionButtons.jsx';
import { useInstanceMeta } from '../hooks/useInstanceMeta.js';
import clsx from 'clsx';

function InstanceRow({ inst, liveStatus }) {
  const navigate = useNavigate();
  const status = liveStatus || inst.status;
  const { updates, backupAgeWarning } = useInstanceMeta(inst.id, status);

  return (
    <div
      onClick={() => navigate(`/instances/${inst.id}`)}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition-colors group"
    >
      <StatusDot status={status} />
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">{inst.name}</span>

      <div className="flex items-center gap-1.5 shrink-0">
        {updates > 0 && (
          <Badge variant="blue"><RefreshCw size={10} />{updates} update{updates !== 1 ? 's' : ''}</Badge>
        )}
        {backupAgeWarning && (
          <Badge variant="yellow"><AlertTriangle size={10} />Backup</Badge>
        )}
        {status === 'auth_failed' && (
          <Badge variant="orange">Auth failed</Badge>
        )}
        {inst.ha_version && (
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono hidden sm:block">{inst.ha_version}</span>
        )}
        <InstanceActionButtons instance={{ ...inst, status }} />
      </div>
    </div>
  );
}

function SiteCard({ site, liveStatuses }) {
  const navigate = useNavigate();
  const instances = site.instances || [];
  const onlineCount = instances.filter(i => (liveStatuses[i.id] || i.status) === 'connected').length;

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-start gap-3 px-4 pt-4 pb-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
        onClick={() => navigate(`/sites/${site.id}`)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{site.name}</h3>
            {site.customer_name && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{site.customer_name}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {site.tags?.map(tag => (
              <span key={tag} className="badge badge-gray text-xs">{tag}</span>
            ))}
          </div>
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 shrink-0 text-right">
          <span className="font-medium text-gray-600 dark:text-gray-300">{onlineCount}</span>/{instances.length} online
        </div>
      </div>

      {instances.length > 0 ? (
        <div className="px-1 pb-2 border-t border-gray-100 dark:border-gray-800 pt-1">
          {instances.map(inst => (
            <InstanceRow key={inst.id} inst={inst} liveStatus={liveStatuses[inst.id]} />
          ))}
        </div>
      ) : (
        <div className="px-4 pb-4 text-sm text-gray-400 dark:text-gray-500 italic border-t border-gray-100 dark:border-gray-800 pt-3">
          No instances —{' '}
          <Link to="/adopt" className="text-harbor-600 hover:underline" onClick={e => e.stopPropagation()}>
            add one
          </Link>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { sites, loading } = useSites();
  const { statuses } = useWs();
  const { density } = useTheme();
  const [tagFilter, setTagFilter] = useState(null);
  const compact = density === 'compact';

  const allTags = useMemo(() => {
    const set = new Set();
    for (const s of sites) for (const t of (s.tags || [])) set.add(t);
    return [...set].sort();
  }, [sites]);

  const allInstances = useMemo(() => sites.flatMap(s => s.instances || []), [sites]);
  const onlineCount = useMemo(
    () => allInstances.filter(i => (statuses[i.id] || i.status) === 'connected').length,
    [allInstances, statuses]
  );

  const filtered = tagFilter ? sites.filter(s => s.tags?.includes(tagFilter)) : sites;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={clsx('mx-auto', compact ? 'max-w-5xl p-4' : 'max-w-6xl p-6')}>
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Sites',     value: sites.length,        icon: Globe,  color: 'text-harbor-600' },
          { label: 'Instances', value: allInstances.length,  icon: Server, color: 'text-gray-600 dark:text-gray-400' },
          { label: 'Online',    value: onlineCount,          icon: Wifi,   color: 'text-green-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card px-4 py-3 flex items-center gap-3">
            <Icon size={18} className={color} />
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
            </div>
          </div>
        ))}
        <Link
          to="/adopt"
          className="card px-4 py-3 flex items-center gap-3 hover:bg-harbor-50 dark:hover:bg-harbor-900/20 transition-colors border-dashed border-harbor-200 dark:border-harbor-800 group"
        >
          <Plus size={18} className="text-harbor-500 group-hover:text-harbor-600" />
          <div>
            <div className="text-sm font-semibold text-harbor-600 dark:text-harbor-400">Add Site</div>
            <div className="text-xs text-gray-400">Adopt new instance</div>
          </div>
        </Link>
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <Tag size={14} className="text-gray-400" />
          <button
            onClick={() => setTagFilter(null)}
            className={clsx(
              'badge cursor-pointer transition-colors',
              tagFilter === null ? 'badge-blue' : 'badge-gray hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(t => t === tag ? null : tag)}
              className={clsx(
                'badge cursor-pointer transition-colors',
                tagFilter === tag ? 'badge-blue' : 'badge-gray hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Site cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No sites yet"
          description="Add your first site to start managing Home Assistant instances."
          action={<Link to="/adopt" className="btn-md btn-primary">Add your first site</Link>}
        />
      ) : (
        <div className={clsx(
          'grid gap-4',
          compact ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'
        )}>
          {filtered.map(site => (
            <SiteCard key={site.id} site={site} liveStatuses={statuses} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}
