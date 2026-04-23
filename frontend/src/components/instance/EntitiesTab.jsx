import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useWs } from '../../context/WsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Spinner from '../ui/Spinner.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { Lightbulb, ToggleRight, Activity, Zap, Thermometer, Wind, Tv, ChevronUp, Box, Layers } from 'lucide-react';
import clsx from 'clsx';

const DOMAIN_META = {
  light:         { label: 'Lights',          icon: Lightbulb,    toggleable: true },
  switch:        { label: 'Switches',         icon: ToggleRight,  toggleable: true },
  input_boolean: { label: 'Helpers',          icon: ToggleRight,  toggleable: true },
  sensor:        { label: 'Sensors',          icon: Activity,     toggleable: false },
  binary_sensor: { label: 'Binary Sensors',   icon: Zap,          toggleable: false },
  climate:       { label: 'Climate',          icon: Thermometer,  toggleable: false },
  cover:         { label: 'Covers',           icon: ChevronUp,    toggleable: true, onSvc: 'open_cover', offSvc: 'close_cover', onState: 'open' },
  fan:           { label: 'Fans',             icon: Wind,         toggleable: true },
  media_player:  { label: 'Media',            icon: Tv,           toggleable: false },
};

const DOMAIN_ORDER = ['light', 'switch', 'input_boolean', 'sensor', 'binary_sensor', 'climate', 'cover', 'fan', 'media_player'];

function getDomainMeta(domain) {
  return DOMAIN_META[domain] || { label: domain, icon: Box, toggleable: false };
}

function stateColor(state) {
  if (['on', 'open', 'playing', 'home'].includes(state)) return 'text-amber-500';
  if (['off', 'closed', 'idle', 'not_home'].includes(state)) return 'text-gray-400';
  if (['unavailable', 'unknown'].includes(state)) return 'text-red-400';
  return 'text-harbor-600';
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={e => { e.stopPropagation(); onChange(!checked); }}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        checked ? 'bg-harbor-500' : 'bg-gray-300 dark:bg-gray-600'
      )}
    >
      <span className={clsx(
        'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5'
      )} />
    </button>
  );
}

function EntityCard({ entity, offline, onToggle }) {
  const domain = entity.entity_id.split('.')[0];
  const meta = getDomainMeta(domain);
  const Icon = meta.icon;
  const isOn = meta.onState ? entity.state === meta.onState : entity.state === 'on';
  const unavailable = entity.state === 'unavailable';
  const attrs = entity.attributes || {};
  const name = attrs.friendly_name || entity.entity_id.split('.')[1]?.replace(/_/g, ' ') || entity.entity_id;

  let stateDisplay = entity.state;
  if (domain === 'sensor' && attrs.unit_of_measurement) stateDisplay = `${entity.state} ${attrs.unit_of_measurement}`;
  if (domain === 'climate') stateDisplay = `${attrs.current_temperature ?? '?'}° → ${attrs.temperature ?? '?'}°`;
  if (domain === 'binary_sensor') stateDisplay = entity.state === 'on' ? (attrs.device_class === 'motion' ? 'Motion' : 'On') : 'Off';

  return (
    <div className={clsx(
      'card p-3 flex flex-col gap-2 transition-opacity',
      (offline || unavailable) && 'opacity-50'
    )}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon size={14} className={clsx('shrink-0', stateColor(entity.state))} />
          <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{name}</span>
        </div>
        {meta.toggleable && (
          <Toggle
            checked={isOn}
            disabled={offline || unavailable}
            onChange={(val) => onToggle(entity, val)}
          />
        )}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{stateDisplay}</div>
    </div>
  );
}

export default function EntitiesTab({ inst }) {
  const { subscribe } = useWs();
  const { toast } = useToast();
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [domainFilter, setDomainFilter] = useState('all');
  const offline = inst.status !== 'connected';

  useEffect(() => {
    setLoading(true);
    api.get(`/instances/${inst.id}/entities`)
      .then(setEntities)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [inst.id]);

  // Live updates
  useEffect(() => {
    return subscribe(inst.id, (msg) => {
      const ns = msg.new_state;
      if (!ns) return;
      setEntities(prev => prev.map(e =>
        e.entity_id === ns.entity_id
          ? { ...e, state: ns.state, attributes: ns.attributes, last_updated: ns.last_updated }
          : e
      ));
    });
  }, [inst.id, subscribe]);

  const handleToggle = useCallback(async (entity, turnOn) => {
    const domain = entity.entity_id.split('.')[0];
    const meta = getDomainMeta(domain);
    let service;
    if (meta.onSvc) {
      service = turnOn ? meta.onSvc : meta.offSvc;
    } else {
      service = turnOn ? 'turn_on' : 'turn_off';
    }

    // Optimistic update
    const expectedState = meta.onState ?? (turnOn ? 'on' : 'off');
    setEntities(prev => prev.map(e => e.entity_id === entity.entity_id ? { ...e, state: expectedState } : e));

    try {
      await api.post(`/instances/${inst.id}/entities/call`, { entity_id: entity.entity_id, service });
    } catch (err) {
      toast(err.message, 'error');
      // Revert
      setEntities(prev => prev.map(e => e.entity_id === entity.entity_id ? { ...e, state: entity.state } : e));
    }
  }, [inst.id, toast]);

  // Compute available domains in the current entity list
  const availableDomains = [...new Set(entities.map(e => e.entity_id.split('.')[0]))]
    .sort((a, b) => {
      const ai = DOMAIN_ORDER.indexOf(a), bi = DOMAIN_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  const filtered = domainFilter === 'all' ? entities : entities.filter(e => e.entity_id.startsWith(`${domainFilter}.`));

  if (loading) return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;

  return (
    <div className="p-6">
      {/* Domain filter */}
      {availableDomains.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          <button
            onClick={() => setDomainFilter('all')}
            className={clsx('badge cursor-pointer', domainFilter === 'all' ? 'badge-blue' : 'badge-gray hover:bg-gray-200 dark:hover:bg-gray-700')}
          >
            <Layers size={10} /> All ({entities.length})
          </button>
          {availableDomains.map(d => {
            const count = entities.filter(e => e.entity_id.startsWith(`${d}.`)).length;
            const meta = getDomainMeta(d);
            return (
              <button
                key={d}
                onClick={() => setDomainFilter(d)}
                className={clsx('badge cursor-pointer', domainFilter === d ? 'badge-blue' : 'badge-gray hover:bg-gray-200 dark:hover:bg-gray-700')}
              >
                {meta.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={Box} title="No entities" description="No entities found in this domain." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {filtered.map(entity => (
            <EntityCard key={entity.entity_id} entity={entity} offline={offline} onToggle={handleToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
