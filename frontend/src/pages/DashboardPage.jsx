import { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Server, Wifi, WifiOff, Globe, Cloud, ExternalLink,
  Filter, Anchor, PlugZap, MapPin,
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
      onMouseLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false);
      }}
      onClick={() => navigate(`/instances/${inst.id}`)}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <StatusDot status={liveStatus} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{inst.name}</span>
            {isAuthFailed && (
              <span className="badge badge-orange text-xs">Auth failed</span>
            )}
          </div>
          {isAuthFailed && (
            <p className="text-xs text-orange-500 dark:text-orange-400 mt-0.5">Update token in Settings</p>
          )}
          {isOffline && inst.last_seen && (
            <p className="text-xs text-gray-400 mt-0.5">Last seen {timeAgo(inst.last_seen)}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
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

function InstanceCard({ inst, liveStatus }) {
  const accent = STATUS_ACCENT[liveStatus] || 'border-l-gray-300 dark:border-l-gray-700';
  return (
    <div className={clsx('card overflow-hidden border-l-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200', accent)}>
      <InstanceRow inst={inst} liveStatus={liveStatus} />
    </div>
  );
}

function LocationCard({ location, instances, statuses, compact }) {
  const worst = instances
    .map(i => statuses[i.id] || i.status || 'disconnected')
    .sort((a, b) => {
      const p = { auth_failed: 0, disconnected: 1, connected: 2 };
      return (p[a] ?? 3) - (p[b] ?? 3);
    })[0] || 'disconnected';
  const accent = STATUS_ACCENT[worst] || 'border-l-gray-300 dark:border-l-gray-700';

  return (
    <div className={clsx('card overflow-hidden border-l-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200', accent)}>
      <div className={clsx('px-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2', compact ? 'py-2.5' : 'py-3')}>
        <MapPin size={12} className="text-gray-400 shrink-0" />
        <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{location.name}</span>
        <span className="badge badge-gray ml-auto shrink-0">{instances.length}</span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {instances.map(inst => (
          <InstanceRow key={inst.id} inst={inst} liveStatus={statuses[inst.id] || inst.status || 'disconnected'} />
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
  const { instances, locations, loading } = useSites();
  const { statuses } = useWs();
  const { density } = useTheme();
  const [statusFilter, setStatusFilter] = useState('all');
  const compact = density === 'compact';

  const liveStats = useMemo(() => ({
    locations: locations.length,
    total:     instances.length,
    online:    instances.filter(i => (statuses[i.id] || i.status) === 'connected').length,
    offline:   instances.filter(i => (statuses[i.id] || i.status) !== 'connected').length,
  }), [instances, locations, statuses]);

  const filtered = useMemo(() => {
    if (statusFilter === 'online')  return instances.filter(i => (statuses[i.id] || i.status) === 'connected');
    if (statusFilter === 'offline') return instances.filter(i => (statuses[i.id] || i.status) !== 'connected');
    return instances;
  }, [instances, statuses, statusFilter]);

  // Split into location groups + ungrouped
  const { locationGroups, ungrouped } = useMemo(() => {
    const byLoc = {};
    const ungrouped = [];
    for (const inst of filtered) {
      if (inst.location_id) {
        if (!byLoc[inst.location_id]) byLoc[inst.location_id] = [];
        byLoc[inst.location_id].push(inst);
      } else {
        ungrouped.push(inst);
      }
    }
    const locationGroups = locations
      .filter(l => byLoc[l.id])
      .map(l => ({ location: l, instances: byLoc[l.id] }));
    return { locationGroups, ungrouped };
  }, [filtered, locations]);

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
        <StatPill icon={Globe}   label="locations"  value={liveStats.locations} color="text-harbor-600" active={false}                     onClick={() => setStatusFilter('all')} />
        <StatPill icon={Server}  label="instances"  value={liveStats.total}     color="text-gray-500"   active={statusFilter === 'all'}    onClick={() => setStatusFilter('all')} />
        <StatPill icon={Wifi}    label="online"     value={liveStats.online}    color="text-green-600"  active={statusFilter === 'online'} onClick={() => toggleFilter('online')} />
        <StatPill icon={WifiOff} label="offline"    value={liveStats.offline}   color="text-red-500"    active={statusFilter === 'offline'} onClick={() => toggleFilter('offline')} />
        <Link
          to="/adopt"
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-harbor-300 dark:border-harbor-700 text-sm text-harbor-600 dark:text-harbor-400 hover:bg-harbor-50 dark:hover:bg-harbor-900/20 transition-colors ml-auto"
        >
          <Plus size={14} /> Add instance
        </Link>
      </div>

      {/* Active filter hint */}
      {statusFilter !== 'all' && (
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
          <Filter size={12} />
          {filtered.length} instance{filtered.length !== 1 ? 's' : ''} shown ·{' '}
          <button onClick={() => setStatusFilter('all')} className="text-harbor-600 hover:underline">Clear</button>
        </div>
      )}

      {/* Empty state */}
      {instances.length === 0 ? (
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Filter size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No instances match this filter.</p>
          <button className="btn-md btn-secondary" onClick={() => setStatusFilter('all')}>Clear filter</button>
        </div>
      ) : (
        <div className={gridCls}>
          {/* Ungrouped instances — each gets its own standalone card */}
          {ungrouped.map(inst => (
            <InstanceCard
              key={inst.id}
              inst={inst}
              liveStatus={statuses[inst.id] || inst.status || 'disconnected'}
            />
          ))}
          {/* Location-grouped instances */}
          {locationGroups.map(({ location, instances: locInsts }) => (
            <LocationCard
              key={location.id}
              location={location}
              instances={locInsts}
              statuses={statuses}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}
