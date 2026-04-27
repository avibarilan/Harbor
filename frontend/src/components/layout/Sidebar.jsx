import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Search, ScrollText, Settings, ChevronRight, ChevronDown, MapPin, Anchor } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWs } from '../../context/WsContext.jsx';
import { useSites } from '../../context/SitesContext.jsx';
import { api } from '../../api/client.js';
import StatusDot from '../ui/StatusDot.jsx';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/audit', label: 'Audit Log', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const { instances, locations } = useSites();
  const { statuses } = useWs();
  const [expandedLocs, setExpandedLocs] = useState({});
  const [version, setVersion] = useState('');

  useEffect(() => {
    api.get('/harbor/version').then(info => {
      setVersion(info.version || '');
    }).catch(() => {});
  }, []);

  const toggleLoc = (id) => setExpandedLocs(e => ({ ...e, [id]: !e[id] }));

  const byLocation = {};
  const ungrouped = [];
  for (const inst of instances) {
    if (inst.location_id) {
      if (!byLocation[inst.location_id]) byLocation[inst.location_id] = [];
      byLocation[inst.location_id].push(inst);
    } else {
      ungrouped.push(inst);
    }
  }

  const navCls = ({ isActive }) => clsx(
    'flex items-center gap-2.5 py-1.5 text-sm transition-colors border-l-[3px] pl-[13px] pr-3',
    isActive
      ? 'border-harbor-600 text-gray-900 dark:text-white font-medium'
      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
  );

  const instCls = ({ isActive }) => clsx(
    'flex items-center gap-2 py-1.5 text-xs transition-colors border-l-[3px] pl-[13px] pr-2',
    isActive
      ? 'border-harbor-600 text-gray-900 dark:text-white font-medium'
      : 'border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
  );

  return (
    <aside className="w-[220px] flex flex-col bg-[#f1f5f9] dark:bg-gray-900 shrink-0 border-r border-gray-200 dark:border-gray-800">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 px-4 py-[14px] border-b border-gray-200 dark:border-gray-800">
        <Anchor size={18} className="text-harbor-600 shrink-0" />
        <span className="font-semibold text-gray-900 dark:text-white tracking-tight text-[15px]">Harbor</span>
      </Link>

      {/* Primary nav */}
      <nav className="py-3 space-y-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navCls}>
            <Icon size={15} className="shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Instances list */}
      <div className="flex-1 overflow-y-auto pb-3 border-t border-gray-200 dark:border-gray-800 pt-3">
        <div className="flex items-center justify-between px-4 mb-2">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Instances</span>
          <Link to="/adopt" className="text-[11px] text-harbor-600 hover:text-harbor-700 font-medium">+ Add</Link>
        </div>

        {ungrouped.map(inst => (
          <NavLink key={inst.id} to={`/instances/${inst.id}`} className={instCls}>
            <StatusDot status={statuses[inst.id] || inst.status} size="sm" />
            <span className="truncate">{inst.name}</span>
          </NavLink>
        ))}

        {locations.filter(l => byLocation[l.id]).map(loc => (
          <div key={loc.id}>
            <button
              onClick={() => toggleLoc(loc.id)}
              className="w-full flex items-center gap-1.5 pl-4 pr-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              {expandedLocs[loc.id] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <MapPin size={10} className="text-gray-400 shrink-0" />
              <span className="truncate flex-1 text-left font-medium">{loc.name}</span>
            </button>
            {expandedLocs[loc.id] && (byLocation[loc.id] || []).map(inst => (
              <NavLink
                key={inst.id}
                to={`/instances/${inst.id}`}
                className={({ isActive }) => clsx(
                  'flex items-center gap-2 pl-8 pr-2 py-1.5 text-xs transition-colors border-l-[3px]',
                  isActive
                    ? 'border-harbor-600 text-gray-900 dark:text-white font-medium'
                    : 'border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                <StatusDot status={statuses[inst.id] || inst.status} size="sm" />
                <span className="truncate">{inst.name}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* Version footer */}
      {version && (
        <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-800">
          <span className="text-[11px] text-gray-400 dark:text-gray-600">Harbor v{version}</span>
        </div>
      )}
    </aside>
  );
}
