import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Search, ScrollText, Settings, ChevronRight, ChevronDown, MapPin, Bell } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWs } from '../../context/WsContext.jsx';
import { useSites } from '../../context/SitesContext.jsx';
import { api } from '../../api/client.js';
import StatusDot from '../ui/StatusDot.jsx';
import clsx from 'clsx';

export default function Sidebar() {
  const { instances, locations } = useSites();
  const { statuses } = useWs();
  const [expandedLocs, setExpandedLocs] = useState({});
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    api.get('/harbor/version').then(info => {
      setUpdateAvailable(info.updateAvailable || false);
      setVersion(info.version || '');
    }).catch(() => {});
  }, []);

  const toggleLoc = (id) => setExpandedLocs(e => ({ ...e, [id]: !e[id] }));

  // Split instances into location groups + ungrouped
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

  return (
    <aside className="w-56 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="w-7 h-7 rounded-lg bg-harbor-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">H</span>
        </div>
        <span className="font-semibold text-gray-900 dark:text-white tracking-tight">Harbor</span>
      </Link>

      {/* Nav */}
      <nav className="px-2 py-3 space-y-0.5">
        <NavLink
          to="/"
          end
          className={({ isActive }) => clsx(
            'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors',
            isActive ? 'bg-harbor-50 text-harbor-700 font-medium dark:bg-harbor-900/30 dark:text-harbor-400'
                     : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          )}
        >
          <LayoutDashboard size={16} /> Dashboard
        </NavLink>
        <NavLink
          to="/search"
          className={({ isActive }) => clsx(
            'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors',
            isActive ? 'bg-harbor-50 text-harbor-700 font-medium dark:bg-harbor-900/30 dark:text-harbor-400'
                     : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          )}
        >
          <Search size={16} /> Search
        </NavLink>
        <NavLink
          to="/audit"
          className={({ isActive }) => clsx(
            'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors',
            isActive ? 'bg-harbor-50 text-harbor-700 font-medium dark:bg-harbor-900/30 dark:text-harbor-400'
                     : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          )}
        >
          <ScrollText size={16} /> Audit Log
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => clsx(
            'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors',
            isActive ? 'bg-harbor-50 text-harbor-700 font-medium dark:bg-harbor-900/30 dark:text-harbor-400'
                     : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          )}
        >
          <Settings size={16} /> Settings
          {updateAvailable && (
            <span className="ml-auto flex items-center">
              <Bell size={12} className="text-amber-500 animate-pulse" />
            </span>
          )}
        </NavLink>
      </nav>

      {/* Instances list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="flex items-center justify-between px-2 py-2 mt-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Instances</span>
          <Link to="/adopt" className="text-xs text-harbor-600 hover:text-harbor-700 font-medium">+ Add</Link>
        </div>

        {/* Ungrouped instances */}
        {ungrouped.map(inst => (
          <NavLink
            key={inst.id}
            to={`/instances/${inst.id}`}
            className={({ isActive }) => clsx(
              'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
              isActive
                ? 'bg-harbor-50 text-harbor-700 dark:bg-harbor-900/30 dark:text-harbor-400'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800'
            )}
          >
            <StatusDot status={statuses[inst.id] || inst.status} size="sm" />
            <span className="truncate">{inst.name}</span>
          </NavLink>
        ))}

        {/* Location groups */}
        {locations.filter(l => byLocation[l.id]).map(loc => (
          <div key={loc.id}>
            <button
              onClick={() => toggleLoc(loc.id)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {expandedLocs[loc.id] ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <MapPin size={11} className="text-gray-400 shrink-0" />
              <span className="truncate flex-1 text-left font-medium">{loc.name}</span>
            </button>
            {expandedLocs[loc.id] && (byLocation[loc.id] || []).map(inst => (
              <NavLink
                key={inst.id}
                to={`/instances/${inst.id}`}
                className={({ isActive }) => clsx(
                  'flex items-center gap-2 pl-7 pr-2 py-1 rounded-lg text-xs transition-colors',
                  isActive
                    ? 'bg-harbor-50 text-harbor-700 dark:bg-harbor-900/30 dark:text-harbor-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800'
                )}
              >
                <StatusDot status={statuses[inst.id] || inst.status} size="sm" />
                <span className="truncate">{inst.name}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* Version */}
      {version && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-gray-600">Harbor v{version}</span>
          {updateAvailable && (
            <span className="badge badge-yellow text-xs">Update</span>
          )}
        </div>
      )}
    </aside>
  );
}
