import { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Server, Wifi, WifiOff, Globe, Cloud, ExternalLink,
  Tag, Filter, AlertTriangle, Anchor, PlugZap,
} from 'lucide-react';
import { useSites } from '../context/SitesContext.jsx';
import { useWs } from '../context/WsContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import StatusDot from '../components/ui/StatusDot.jsx';
import InstanceActionButtons from '../components/ui/InstanceActionButtons.jsx';
import Tooltip from '../components/ui/Tooltip.jsx';
import { usePeoplePresence } from '../hooks/useInstanceMeta.js';
import clsx from 'clsx';

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const secs = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function PersonRow({ person }) {
  const isHome = person.state === 'home';
  return (
    <div className="flex items-center gap-2 py-0.5 text-xs">
      <span>{isHome ? '🏠' : '📍'}</span>
      <span className="font-medium text-gray-700 dark:text-gray-300">{person.name}</span>
      <span className={clsx('ml-auto', isHome ? 'text-green-600 dark:text-green-400' : 'text-gray-400')}>
        {isHome ? 'Home' : 'Away'}
      </span>
    </div>
  );
}

const STATUS_ACCENT = {
  connected:    'border-l-green-400',
  disconnected: 'border-l-red-400',
  auth_failed:  'border-l-orange-400',
};

function worstStatus(statuses, instances) {
  const priority = { auth_failed: 0, disconnected: 1, connected: 2 };
  return instances
    .map(i => statuses[i.id] || i.status || 'disconnected')
    .sort((a, b) => (priority[a] ?? 3) - (priority[b] ?? 3))[0] || 'disconnected';
}

function InstanceRow({ inst, liveStatus }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const { people, load: loadPeople } = usePeoplePresence(inst.id, liveStatus, hovered);
  const isConnected  = liveStatus === 'connected';
  const isAuthFailed = liveStatus === 'auth_failed';
  const isOffline    = liveStatus === 'disconnected';

  return (
    <div
      className={clsx('cursor-pointer', !isConnected && 'opacity-70')}
      onMouseEnter={() => { setHovered(true); loadPeople(); }}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/instances/${inst.id}`)}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <StatusDot status={liveStatus} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{inst.name}</span>
            {isAuthFailed && (
              <span className="badge badge-orange"><AlertTriangle size={9} /> Auth failed</span>
            )}
          </div>
          {isAuthFailed && (
            <p className="text-xs text-orange-500 dark:text-orange-400 mt-0.5">Update token in Settings</p>
          )}
          {isOffline && inst.last_seen && (
            <p className="text-xs text-gray-400 mt-0.5">Last seen {timeAgo(inst.last_seen)}</p>
          )}
        </div>

        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={e => e.stopPropagation()}
        >
          {inst.ha_version && (
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500 hidden sm:inline">{inst.ha_version}</span>
          )}
          {inst.cloudflare_proxied ? (
            <Tooltip content="Cloudflare proxied">
              <Cloud size={12} className="text-orange-400" />
            </Tooltip>
          ) : null}
          {inst.companion_enabled ? (
            <Tooltip content="Harbor Companion active">
              <PlugZap size={12} className="text-harbor-500" />
            </Tooltip>
          ) : null}
          <InstanceActionButtons instance={{ ...inst, status: liveStatus }} />
          <a
            href={inst.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="btn-ghost btn-sm text-gray-400 hover:text-harbor-600"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {hovered && people && people.length > 0 && (
        <div className="people-panel px-4 pb-2 pt-1.5 border-t border-gray-100 dark:border-gray-800">
          {people.map(p => <PersonRow key={p.entity_id} person={p} />)}
        </div>
      )}
    </div>
  );
}

function SiteCard({ site, instances, statuses, compact }) {
  const worst   = worstStatus(statuses, instances);
  const accent  = STATUS_ACCENT[worst] || 'border-l-gray-300 dark:border-l-gray-700';

  return (
    <div className={clsx(
      'card overflow-hidden border-l-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200',
      accent
    )}>
      {/* Site header */}
      <div className={clsx(
        'px-4 border-b border-gray-100 dark:border-gray-800',
        compact ? 'py-2.5' : 'py-3'
      )}>
        <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{site.name}</div>
        {site.customer_name && (
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{site.customer_name}</div>
        )}
      </div>

      {/* Instance rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {instances.map(inst => (
          <InstanceRow
            key={inst.id}
            inst={inst}
            liveStatus={statuses[inst.id] || inst.status || 'disconnected'}
          />
        ))}
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all',
        active
          ? 'bg-harbor-600 border-harbor-600 text-white shadow-sm'
          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-harbor-400 dark:hover:border-harbor-600'
      )}
    >
      <Icon size={14} className={active ? 'text-white' : color} />
      <span className="font-semibold">{value}</span>
      <span className={clsx('text-xs', active ? 'text-white/80' : 'text-gray-400')}>{label}</span>
    </button>
  );
}

export default function DashboardPage() {
  const { sites, loading } = useSites();
  const { statuses } = useWs();
  const { density } = useTheme();
  const [tagFilter, setTagFilter]     = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const compact = density === 'compact';

  const allInstances = useMemo(() => sites.flatMap(s => s.instances || []), [sites]);

  const allTags = useMemo(() => {
    const set = new Set();
    for (const s of sites) for (const t of (s.tags || [])) set.add(t);
    return [...set].sort();
  }, [sites]);

  const liveStats = useMemo(() => ({
    sites:   sites.length,
    total:   allInstances.length,
    online:  allInstances.filter(i => (statuses[i.id] || i.status) === 'connected').length,
    offline: allInstances.filter(i => (statuses[i.id] || i.status) !== 'connected').length,
  }), [sites, allInstances, statuses]);

  const filteredGroups = useMemo(() => {
    return sites
      .filter(s => (s.instances || []).length > 0)
      .filter(s => !tagFilter || s.tags?.includes(tagFilter))
      .map(site => {
        let instances = site.instances || [];
        if (statusFilter === 'online')  instances = instances.filter(i => (statuses[i.id] || i.status) === 'connected');
        if (statusFilter === 'offline') instances = instances.filter(i => (statuses[i.id] || i.status) !== 'connected');
        return { site, instances };
      })
      .filter(({ instances }) => instances.length > 0);
  }, [sites, tagFilter, statusFilter, statuses]);

  const toggleFilter = useCallback((key) => setStatusFilter(p => p === key ? 'all' : key), []);

  const gridCls = clsx(
    'grid gap-4',
    compact
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  );

  if (loading) {
    return (
      <div className={clsx('mx-auto', compact ? 'max-w-5xl p-4' : 'max-w-6xl p-6')}>
        <div className="flex gap-2 mb-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 w-28 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
        <div className={gridCls}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-24 animate-pulse bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('mx-auto', compact ? 'max-w-5xl p-4' : 'max-w-6xl p-6')}>
      {/* Fleet summary bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        <StatPill icon={Globe}   label="sites"     value={liveStats.sites}   color="text-harbor-600" active={false}                     onClick={() => setStatusFilter('all')} />
        <StatPill icon={Server}  label="instances" value={liveStats.total}   color="text-gray-500"   active={statusFilter === 'all'}    onClick={() => setStatusFilter('all')} />
        <StatPill icon={Wifi}    label="online"    value={liveStats.online}  color="text-green-600"  active={statusFilter === 'online'} onClick={() => toggleFilter('online')} />
        <StatPill icon={WifiOff} label="offline"   value={liveStats.offline} color="text-red-500"    active={statusFilter === 'offline'} onClick={() => toggleFilter('offline')} />
        <Link
          to="/adopt"
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-harbor-300 dark:border-harbor-700 text-sm text-harbor-600 dark:text-harbor-400 hover:bg-harbor-50 dark:hover:bg-harbor-900/20 transition-colors ml-auto"
        >
          <Plus size={14} /> Add instance
        </Link>
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <Tag size={12} className="text-gray-400" />
          <button
            onClick={() => setTagFilter(null)}
            className={clsx('badge cursor-pointer transition-colors', tagFilter === null ? 'badge-blue' : 'badge-gray hover:bg-gray-200 dark:hover:bg-gray-700')}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(t => t === tag ? null : tag)}
              className={clsx('badge cursor-pointer transition-colors', tagFilter === tag ? 'badge-blue' : 'badge-gray hover:bg-gray-200 dark:hover:bg-gray-700')}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Active filter hint */}
      {statusFilter !== 'all' && (
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
          <Filter size={12} />
          {filteredGroups.reduce((n, g) => n + g.instances.length, 0)} instance{filteredGroups.reduce((n, g) => n + g.instances.length, 0) !== 1 ? 's' : ''} shown ·{' '}
          <button onClick={() => setStatusFilter('all')} className="text-harbor-600 hover:underline">Clear</button>
        </div>
      )}

      {/* Empty states */}
      {sites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-harbor-50 dark:bg-harbor-900/20 flex items-center justify-center mb-4">
            <Anchor size={28} className="text-harbor-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No instances yet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Add your first Home Assistant instance to get started.
          </p>
          <Link to="/adopt" className="btn-md btn-primary">Add Instance</Link>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Filter size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No instances match this filter.</p>
          <button className="btn-md btn-secondary" onClick={() => { setStatusFilter('all'); setTagFilter(null); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className={gridCls}>
          {filteredGroups.map(({ site, instances }) => (
            <SiteCard
              key={site.id}
              site={site}
              instances={instances}
              statuses={statuses}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}
