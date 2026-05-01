import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, ExternalLink, Anchor, PlugZap, Cloud,
  ChevronDown, ChevronRight, LayoutGrid, AlignJustify, X, MapPin, Filter,
} from 'lucide-react';
import { useSites } from '../context/SitesContext.jsx';
import { useWs } from '../context/WsContext.jsx';
import { api } from '../api/client.js';
import StatusDot from '../components/ui/StatusDot.jsx';
import InstanceActionButtons from '../components/ui/InstanceActionButtons.jsx';
import Tooltip from '../components/ui/Tooltip.jsx';
import { usePeoplePresence } from '../hooks/useInstanceMeta.js';
import clsx from 'clsx';

const NOISY_DOMAINS = new Set([
  'sun', 'weather', 'homeassistant', 'update', 'recorder',
  'persistent_notification', 'zone', 'device_tracker',
]);

function useActivityFeed(instanceId, connected) {
  const [events, setEvents] = useState([]);
  const [hasNew, setHasNew] = useState(false);
  const lastWhenRef = useRef(null);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await api.get(`/instances/${instanceId}/logbook`);
        if (cancelled || !Array.isArray(data)) return;
        const filtered = data.filter(e => e.entity_id && !NOISY_DOMAINS.has(e.domain)).slice(-5);
        if (filtered.length > 0) {
          const latest = filtered[filtered.length - 1];
          if (lastWhenRef.current !== null && latest.when !== lastWhenRef.current) {
            setHasNew(true);
            setTimeout(() => { if (!cancelled) setHasNew(false); }, 2500);
          }
          lastWhenRef.current = latest.when;
        }
        setEvents(filtered);
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [instanceId, connected]);

  return { events, hasNew };
}

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
      <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{person.name}</span>
      <span className={clsx('ml-auto', isHome ? 'text-green-500' : '')} style={{ color: isHome ? undefined : 'var(--color-text-tertiary)' }}>
        {isHome ? 'Home' : 'Away'}
      </span>
    </div>
  );
}

function StatCard({ label, value, valueColor }) {
  return (
    <div
      className="flex flex-col gap-1 p-4"
      style={{
        background:   'var(--color-bg-surface)',
        border:       '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow:    'var(--shadow-sm)',
      }}
    >
      <span
        className="font-bold leading-none"
        style={{ color: valueColor || 'var(--color-text-primary)', fontSize: 'var(--text-3xl)' }}
      >
        {value}
      </span>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>
        {label}
      </span>
    </div>
  );
}

function GridCard({ inst, liveStatus, location }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const { people, load: loadPeople } = usePeoplePresence(inst.id, liveStatus, hovered);
  const { events, hasNew } = useActivityFeed(inst.id, liveStatus === 'connected');
  const isConnected = liveStatus === 'connected';

  return (
    <div
      className={clsx('flex flex-col cursor-pointer overflow-hidden', hasNew && 'activity-pulse')}
      style={{
        background:   'var(--color-bg-surface)',
        border:       '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow:    'var(--shadow-sm)',
        transition:   'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.borderColor = 'rgba(37,99,235,0.4)';
        setHovered(true);
        loadPeople();
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.borderColor = 'var(--color-border)';
        setHovered(false);
      }}
      onClick={() => navigate(`/instances/${inst.id}`)}
    >
      <div className="p-4 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <StatusDot status={liveStatus} />
            <span
              className="font-semibold truncate"
              style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)' }}
            >
              {inst.name}
            </span>
          </div>
          {inst.ha_version && (
            <span
              className="font-mono shrink-0"
              style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}
            >
              {inst.ha_version}
            </span>
          )}
        </div>

        {location && (
          <div className="flex items-center gap-1 mt-1.5 ml-[18px]">
            <MapPin size={10} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
              {location.name}
            </span>
          </div>
        )}

        {(inst.cloudflare_proxied || inst.companion_enabled) && (
          <div className="flex items-center gap-2 mt-2 ml-[18px]">
            {inst.cloudflare_proxied && (
              <Tooltip content="Cloudflare proxied">
                <Cloud size={12} className="text-orange-400" />
              </Tooltip>
            )}
            {inst.companion_enabled && (
              <Tooltip content="Companion connected">
                <PlugZap size={12} style={{ color: 'var(--color-accent)' }} />
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {hovered && isConnected && people && people.length > 0 ? (
        <div
          className="people-panel px-4 pb-2 pt-1"
          style={{ borderTop: '1px solid var(--color-border-subtle)' }}
        >
          {people.map(p => <PersonRow key={p.entity_id} person={p} />)}
        </div>
      ) : isConnected && events.length > 0 ? (
        <div className="px-4 pb-2 pt-1.5 space-y-0.5" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          {events.slice(-3).reverse().map((e, i) => (
            <div key={i} className="flex items-center gap-1.5 min-w-0" style={{ opacity: 1 - i * 0.25 }}>
              <span className="truncate" style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                {e.name || e.entity_id}
              </span>
              {e.message && (
                <span className="shrink-0" style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
                  {e.message}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ borderTop: '1px solid var(--color-border-subtle)' }}
      >
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
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
            className="btn-ghost btn-sm"
            style={{ color: 'var(--color-text-tertiary)' }}
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
  const { events, hasNew } = useActivityFeed(inst.id, liveStatus === 'connected');
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;

  const statusColor = {
    connected:    'var(--color-success)',
    disconnected: 'var(--color-danger)',
    auth_failed:  'var(--color-warning)',
  }[liveStatus] || 'var(--color-text-tertiary)';

  return (
    <div
      className="relative flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors"
      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      onClick={() => navigate(`/instances/${inst.id}`)}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r"
        style={{ background: statusColor }}
      />
      <StatusDot status={liveStatus} />
      <span
        className="font-medium flex-1 min-w-0 truncate"
        style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)' }}
      >
        {inst.name}
      </span>
      {location && (
        <span className="shrink-0 hidden sm:block" style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>
          {location.name}
        </span>
      )}
      {latestEvent ? (
        <span
          key={latestEvent.when}
          className="hidden xl:block shrink-0 max-w-[200px] truncate activity-ticker"
          style={{ color: 'var(--color-text-tertiary)', fontSize: '11px' }}
        >
          {latestEvent.name}: {latestEvent.message || latestEvent.state}
        </span>
      ) : inst.ha_version ? (
        <span className="font-mono shrink-0 hidden md:block" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
          {inst.ha_version}
        </span>
      ) : null}
      <div className="flex items-center gap-1.5 shrink-0">
        {inst.cloudflare_proxied && <Cloud size={12} className="text-orange-400" />}
        {inst.companion_enabled && <PlugZap size={12} style={{ color: 'var(--color-accent)' }} />}
      </div>
      <span className="shrink-0 hidden lg:block w-24 text-right" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
        {liveStatus === 'connected' ? 'Connected' : inst.last_seen ? timeAgo(inst.last_seen) : '—'}
      </span>
      <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
        <InstanceActionButtons instance={{ ...inst, status: liveStatus }} />
        <a
          href={inst.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="btn-ghost btn-sm"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

function FilterSection({ title, open, onToggle, children }) {
  return (
    <div style={{ borderBottom: '1px solid var(--color-border-subtle)' }} className="last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
        style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-tertiary)'}
      >
        <span className="font-semibold uppercase tracking-widest">{title}</span>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

function FilterRow({ label, count, checked, onChange, radio, name }) {
  const id = `filter-${name || label}`;
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2.5 px-4 py-1.5 cursor-pointer transition-colors"
      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <input
        id={id}
        type={radio ? 'radio' : 'checkbox'}
        name={radio ? 'location-filter' : undefined}
        checked={checked}
        onChange={onChange}
        className="w-3.5 h-3.5 rounded"
        style={{ accentColor: 'var(--color-accent)' }}
      />
      <span className="flex-1 truncate" style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)' }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>{count}</span>
      )}
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
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

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
  const offlineCount = counts.disconnected + counts.auth_failed;

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
      <div className="p-5">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl animate-[skeleton-pulse_1.5s_ease_infinite]"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl animate-[skeleton-pulse_1.5s_ease_infinite]"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* Hero stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Instances" value={instances.length} />
        <StatCard
          label="Online"
          value={counts.connected}
          valueColor={counts.connected > 0 ? 'var(--color-success)' : undefined}
        />
        <StatCard
          label="Offline"
          value={offlineCount}
          valueColor={offlineCount > 0 ? 'var(--color-danger)' : undefined}
        />
        <StatCard label="Companion" value={counts.companion} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-5 gap-4">
        <div className="flex items-center gap-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          {hasFilters && (
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>
              {filtered.length} of {instances.length} shown
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Filter button with popover */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${hasFilters ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: hasFilters ? 'var(--color-accent-subtle)' : 'transparent',
                color: hasFilters ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
              onMouseEnter={e => { if (!hasFilters) e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
              onMouseLeave={e => { if (!hasFilters) e.currentTarget.style.background = 'transparent'; }}
            >
              <Filter size={13} />
              Filter
              {hasFilters && (
                <span
                  className="flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] font-bold"
                  style={{ background: 'var(--color-accent)', marginLeft: 2 }}
                >
                  {statusFilters.size + (locationFilter !== null ? 1 : 0) + (companionFilter ? 1 : 0)}
                </span>
              )}
            </button>

            {filterOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-50 w-56 overflow-hidden"
                style={{
                  background:   'var(--color-bg-surface)',
                  border:       '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow:    'var(--shadow-md)',
                }}
              >
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
                    <div className="px-4 py-2" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                      <button
                        onClick={() => { clearFilters(); setFilterOpen(false); }}
                        className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        <X size={11} /> Clear filters
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Link
            to="/adopt"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors"
            style={{
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--color-accent)',
              color: 'var(--color-accent)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-accent-subtle)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Plus size={13} /> Add instance
          </Link>
          <div
            className="flex overflow-hidden"
            style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
          >
            {[['grid', LayoutGrid], ['list', AlignJustify]].map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="p-1.5 transition-colors"
                title={`${mode} view`}
                style={{
                  background: viewMode === mode ? 'var(--color-bg-hover)' : 'transparent',
                  color: viewMode === mode ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                }}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {instances.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--color-accent-subtle)', border: '1px solid rgba(37,99,235,0.2)' }}
          >
            <Anchor size={26} style={{ color: 'var(--color-accent)' }} />
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            No instances yet
          </h2>
          <p className="mb-6" style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            Add your first Home Assistant instance to get started.
          </p>
          <Link to="/adopt" className="btn-md btn-primary">Add Instance</Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="mb-3" style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            No instances match the current filters.
          </p>
          <button className="btn-md btn-secondary" onClick={clearFilters}>Clear filters</button>
        </div>
      ) : viewMode === 'list' ? (
        <div
          className="overflow-hidden"
          style={{
            background:   'var(--color-bg-surface)',
            border:       '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
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
  );
}
