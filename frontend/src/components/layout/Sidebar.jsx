import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Search, ScrollText, Settings, ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useWs } from '../../context/WsContext.jsx';
import { useSites } from '../../context/SitesContext.jsx';
import StatusDot from '../ui/StatusDot.jsx';
import clsx from 'clsx';

const navItems = [
  { to: '/',        label: 'Dashboard', icon: LayoutDashboard },
  { to: '/search',  label: 'Search',    icon: Search },
  { to: '/audit',   label: 'Audit Log', icon: ScrollText },
  { to: '/settings',label: 'Settings',  icon: Settings },
];

export default function Sidebar() {
  const { sites } = useSites();
  const [expanded, setExpanded] = useState({});
  const { statuses } = useWs();

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

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
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => clsx(
              'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors',
              isActive
                ? 'bg-harbor-50 text-harbor-700 font-medium dark:bg-harbor-900/30 dark:text-harbor-400'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            )}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Sites */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="flex items-center justify-between px-2 py-2 mt-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sites</span>
          <Link to="/adopt" className="text-xs text-harbor-600 hover:text-harbor-700 font-medium">+ Add</Link>
        </div>
        {sites.map(site => (
          <div key={site.id}>
            <button
              onClick={() => toggle(site.id)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {expanded[site.id] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span className="truncate flex-1 text-left font-medium text-xs">{site.name}</span>
            </button>
            {expanded[site.id] && site.instances?.map(inst => (
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
    </aside>
  );
}
