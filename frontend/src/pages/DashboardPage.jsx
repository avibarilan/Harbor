import { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, ExternalLink, Anchor, PlugZap, Cloud,
  ChevronDown, ChevronRight, LayoutGrid, AlignJustify, X, MapPin,
} from 'lucide-react';
import { useSites } from '../context/SitesContext.jsx';
import { useWs } from '../context/WsContext.jsx';
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

const STATUS_BAR = {
  connected:    'bg-green-500',
  disconnected: 'bg-red-500',
  auth_failed:  'bg-amber-500',
};

function PersonRow({ person }) {
  const isHome = person.state === 'home';
  return (
    <div className="flex items-center gap-2 py-0.5 text-xs">
      <span>{isHome ? '🏠' : '📍'}</span>
      <span className="font-medium text-gray-700 dark:text-gray-300">{person.name}</span>
      <span className={clsx('ml-auto', isHome ? 'text-green-600' : 'text-gray-400')}>
        {isHome ? 'Home' : 'Away'}
      </span>
    </div>
  );
}

function GridCard({ inst, liveStatus, location }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const { people, load: loadPeople } = usePeoplePresence(inst.id, liveStatus, hovered);
  const isConnected = liveStatus === 'connected';
  const barColor = STATUS_BAR[liveStatus] || 'bg-gray-300';

  return (
    <div
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden hover:shadow-md transition-shadow duration-200 cursor-pointer"
      onMouseEnter={() => { setHovered(true); loadPeople(); }}
      onMouseLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false); }}
      onClick={() => navigate(`/instances/${inst.id}`)}
    >
      <div className={clsx('h-[3px]', barColor)} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <StatusDot status={liveStatus} />
            <span className="font-semibold text-[15px] text-gray-900 dark:text-white truncate">{inst.name}</span>
          </div>
          {inst.ha_version && (
            <span className="text-xs text-gray-400 font-mono shrink-0">{inst.ha_version}</span>
          )}
        </div>

        {location && (
          <div className="flex items-center gap-1 mt-1.5 ml-5">
            <MapPin size={10} className="text-gray-400 shrink-0" />
            <span className="text-xs text-gray-400">{location.name}</span>
          </div>
        )}

        {(inst.cloudflare_proxied || inst.companion_enabled) && (
          <div className="flex items-center gap-2 mt-2 ml-5">
            {inst.cloudflare_proxied && (
              <Tooltip content="Cloudflare proxied">
                <Cloud size={12} className="text-orange-400" />
              </Tooltip>
            )}
            {inst.companion_enabled && (
              <Tooltip content="Companion connected">
                <PlugZap size={12} className="text-harbor-500" />
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {hovered && isConnected && people && people.length > 0 && (
        <div className="people-panel px-4 pb-2 pt-1 border-t border-gray-100 dark:border-gray-800">
          {people.map(p => <PersonRow key={p.entity_id} person={p} />)}
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {isConnected
            ? 'Connected'
            : inst.last_seen ? `Last seen ${timeAgo(inst.last_seen)}` : 'Never connected'}
        </span>
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <InstanceActionButtons instance={{ ...inst, status: liveStatus }} />
          <a
            href={inst.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="btn-ghost btn-sm text-gray-400 hover:text-gray-600"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}

function ListRow({ inst, liveStatus, location }) {
  const navigate = useNavigate();
  const barColor = STATUS_BAR[liveStatus] || 'bg-gray-300';

  return (
    <div
      className="relative flex items-center gap-4 px-5 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
      onClick={() => navigate(`/instances/${inst.id}`)}
    >
      <div className={clsx('absolute left-0 top-0 bottom-0 w-[3px] rounded-r', barColor)} />
      <StatusDot status={liveStatus} />
      <span className="font-medium text-sm text-gray-900 dark:text-white flex-1 min-w-0 truncate">{inst.name}</span>
      {location && (
        <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{location.name}</span>
      )}
      {inst.ha_version && (
        <span className="text-xs text-gray-400 font-mono shrink-0 hidden md:block">{inst.ha_version}</span>
      )}
      <div className="flex items-center gap-1.5 shrink-0">
        {inst.cloudflare_proxied && <Cloud size={12} className="text-orange-400" />}
        {inst.companion_enabled && <PlugZap size={12} className="text-harbor-500" />}
      </div>
      <span className="text-xs text-gray-400 shrink-0 hidden lg:block w-24 text-right">
        {liveStatus === 'connected' ? 'Connected' : inst.last_seen ? timeAgo(inst.last_seen) : '—'}
      </span>
      <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
        <InstanceActionButtons instance={{ ...inst, status: liveStatus }} />
        <a
          href={inst.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="btn-ghost btn-sm text-gray-400 hover:text-gray-600"
        >
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

function FilterSection({ title, open, onToggle, children }) {
  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        {title}
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

function FilterRow({ label, count, checked, onChange, radio, name }) {
  const id = `filter-${name || label}`;
  return (
    <label htmlFor={id} className="flex items-center gap-2.5 px-4 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <input
        id={id}
        type={radio ? 'radio' : 'checkbox'}
        name={radio ? 'location-filter' : undefined}
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 rounded border-gray-300 text-harbor-600 focus:ring-harbor-500 focus:ring-offset-0"
      />
      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="text-xs text-gray-400">{count}</span>}
    </label>
  );
}

export default function DashboardPage() {
  const { instances, locations, loading } = useSites();
  const { statuses } = useWs();
  const [viewMode, setViewMode] = useState('grid');
  const [statusFilters, setStatusFilters] = useState(new Set());
  const [locationFilter, setLocationFilter] = useState(null);
  const [companionFilter, setCompanionFilter] = useState(false);
  const [sections, setSections] = useState({ status: true, location: true, has: true });

  const getStatus = useCallback(inst => statuses[inst.id] || inst.status || 'disconnected', [statuses]);

  const counts = useMemo(() => ({
    connected:    instances.filter(i => getStatus(i) === 'connected').length,
    disconnected: instances.filter(i => getStatus(i) === 'disconnected').length,
    auth_failed:  instances.filter(i => getStatus(i) === 'auth_failed').length,
    companion:    instances.filter(i => i.companion_enabled).length,
  }), [instances, getStatus]);

  const filtered = useMemo(() => instances.filter(inst => {
    if (statusFilters.size > 0 && !statusFilters.has(getStatus(inst))) return false;
    if (locationFilter !== null && inst.location_id !== locationFilter) return false;
    if (companionFilter && !inst.companion_enabled) return false;
    return true;
  }), [instances, statusFilters, locationFilter, companionFilter, getStatus]);

  const hasFilters = statusFilters.size > 0 || locationFilter !== null || companionFilter;

  const clearFilters = () => {
    setStatusFilters(new Set());
    setLocationFilter(null);
    setCompanionFilter(false);
  };

  const toggleStatus = (s) => setStatusFilters(prev => {
    const next = new Set(prev);
    next.has(s) ? next.delete(s) : next.add(s);
    return next;
  });

  const locById = useMemo(() => Object.fromEntries(locations.map(l => [l.id, l])), [locations]);

  if (loading) {
    return (
      <div className="flex min-h-full">
        <aside className="w-[200px] shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800" />
        <div className="flex-1 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg h-32 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full">
      {/* Filter panel */}
      <aside className="w-[200px] shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 self-start sticky top-0 max-h-screen overflow-y-auto">
        <div className="py-1">
          <FilterSection title="Status" open={sections.status} onToggle={() => setSections(s => ({ ...s, status: !s.status }))}>
            <FilterRow label="Online"      count={counts.connected}    checked={statusFilters.has('connected')}    onChange={() => toggleStatus('connected')} />
            <FilterRow label="Offline"     count={counts.disconnected} checked={statusFilters.has('disconnected')} onChange={() => toggleStatus('disconnected')} />
            <FilterRow label="Auth Failed" count={counts.auth_failed}  checked={statusFilters.has('auth_failed')}  onChange={() => toggleStatus('auth_failed')} />
          </FilterSection>

          {locations.length > 0 && (
            <FilterSection title="Location" open={sections.location} onToggle={() => setSections(s => ({ ...s, location: !s.location }))}>
              <FilterRow label="All" radio checked={locationFilter === null} onChange={() => setLocationFilter(null)} name="all" />
              {locations.map(loc => (
                <FilterRow
                  key={loc.id}
                  label={loc.name}
                  count={instances.filter(i => i.location_id === loc.id).length}
                  radio
                  checked={locationFilter === loc.id}
                  onChange={() => setLocationFilter(loc.id)}
                  name={String(loc.id)}
                />
              ))}
            </FilterSection>
          )}

          <FilterSection title="Has" open={sections.has} onToggle={() => setSections(s => ({ ...s, has: !s.has }))}>
            <FilterRow label="Companion" count={counts.companion} checked={companionFilter} onChange={() => setCompanionFilter(v => !v)} />
          </FilterSection>

          {hasFilters && (
            <div className="px-4 py-2">
              <button onClick={clearFilters} className="text-xs text-harbor-600 hover:text-harbor-700 flex items-center gap-1">
                <X size={11} /> Clear filters
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 p-5">
        {/* Summary + controls */}
        <div className="flex items-center justify-between mb-5 gap-4">
          <div className="flex items-center gap-5 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-white">{instances.length}</span> total
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-green-600">{counts.connected}</span> online
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-red-500">{counts.disconnected + counts.auth_failed}</span> offline
            </span>
            {hasFilters && (
              <span className="text-xs text-gray-400">· {filtered.length} shown</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/adopt"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-harbor-300 dark:border-harbor-700 text-sm text-harbor-600 dark:text-harbor-400 hover:bg-harbor-50 dark:hover:bg-harbor-900/20 transition-colors"
            >
              <Plus size={13} /> Add instance
            </Link>
            <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={clsx('p-1.5 transition-colors', viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600')}
                title="Grid view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={clsx('p-1.5 transition-colors', viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600')}
                title="List view"
              >
                <AlignJustify size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-harbor-50 dark:bg-harbor-900/20 flex items-center justify-center mb-4">
              <Anchor size={26} className="text-harbor-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No instances yet</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Add your first Home Assistant instance to get started.</p>
            <Link to="/adopt" className="btn-md btn-primary">Add Instance</Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No instances match the current filters.</p>
            <button className="btn-md btn-secondary" onClick={clearFilters}>Clear filters</button>
          </div>
        ) : viewMode === 'list' ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            {filtered.map(inst => (
              <ListRow
                key={inst.id}
                inst={inst}
                liveStatus={getStatus(inst)}
                location={inst.location_id ? locById[inst.location_id] : null}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(inst => (
              <GridCard
                key={inst.id}
                inst={inst}
                liveStatus={getStatus(inst)}
                location={inst.location_id ? locById[inst.location_id] : null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
