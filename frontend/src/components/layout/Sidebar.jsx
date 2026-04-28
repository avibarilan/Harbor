import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard, Search, ScrollText, Settings,
  ChevronRight, ChevronLeft, MapPin, Anchor,
  Sun, Moon, LogOut,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWs } from '../../context/WsContext.jsx';
import { useSites } from '../../context/SitesContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
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
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [expandedLocs, setExpandedLocs] = useState({});
  const [collapsed, setCollapsed] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    api.get('/harbor/version').then(info => setVersion(info.version || '')).catch(() => {});
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
    'flex items-center transition-all duration-150',
    collapsed ? 'justify-center w-10 h-10 mx-auto rounded-md' : 'gap-2.5 px-3 py-2 mx-2 rounded-md',
    isActive
      ? collapsed
        ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
        : 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] font-medium border-l-2 border-[var(--color-accent)] rounded-l-none ml-0 pl-[11px]'
      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
  );

  const instCls = (isActive, indent = false) => clsx(
    'flex items-center gap-2 py-1.5 text-xs transition-colors border-l-2',
    indent ? 'pl-8 pr-2' : 'pl-4 pr-3',
    isActive
      ? 'border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium bg-[var(--color-accent-subtle)]'
      : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
  );

  const bottomBtn = clsx(
    'flex items-center transition-colors rounded-md',
    collapsed ? 'justify-center w-10 h-10 mx-auto' : 'gap-2 px-2 py-1.5 mx-1',
    'hover:bg-[var(--color-bg-hover)]'
  );

  return (
    <aside
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width:       collapsed ? 60 : 220,
        minWidth:    collapsed ? 60 : 220,
        transition:  'width 200ms ease, min-width 200ms ease',
        background:  'var(--color-bg-surface)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* Logo */}
      <Link
        to="/"
        className={clsx(
          'flex items-center shrink-0 h-14',
          'border-b border-[var(--color-border)]',
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-4'
        )}
      >
        <Anchor size={22} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
        {!collapsed && (
          <span
            className="font-semibold tracking-tight whitespace-nowrap overflow-hidden"
            style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-lg)' }}
          >
            Harbor
          </span>
        )}
      </Link>

      {/* Primary nav */}
      <nav className={clsx('py-3 space-y-0.5', collapsed && 'flex flex-col items-center')}>
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navCls} title={collapsed ? label : undefined}>
            <Icon size={16} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Instances list */}
      <div
        className="flex-1 overflow-y-auto min-h-0 pt-3 pb-2"
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5 py-1">
            {instances.slice(0, 12).map(inst => (
              <NavLink key={inst.id} to={`/instances/${inst.id}`} title={inst.name} className="py-1">
                <StatusDot status={statuses[inst.id] || inst.status} />
              </NavLink>
            ))}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 mb-1.5">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                Instances
              </span>
              <Link
                to="/adopt"
                className="text-[11px] font-medium hover:opacity-70 transition-opacity"
                style={{ color: 'var(--color-accent)' }}
              >
                + Add
              </Link>
            </div>

            {ungrouped.map(inst => (
              <NavLink key={inst.id} to={`/instances/${inst.id}`}
                className={({ isActive }) => instCls(isActive)}
              >
                <StatusDot status={statuses[inst.id] || inst.status} size="sm" />
                <span className="truncate">{inst.name}</span>
              </NavLink>
            ))}

            {locations.filter(l => byLocation[l.id]).map(loc => (
              <div key={loc.id}>
                <button
                  onClick={() => toggleLoc(loc.id)}
                  className="w-full flex items-center gap-1.5 pl-4 pr-3 py-1.5 text-xs transition-colors hover:bg-[var(--color-bg-hover)]"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <span
                    className="shrink-0 transition-transform duration-150"
                    style={{ transform: expandedLocs[loc.id] ? 'rotate(90deg)' : 'rotate(0)' }}
                  >
                    <ChevronRight size={11} />
                  </span>
                  <MapPin size={10} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                  <span className="truncate flex-1 text-left font-medium">{loc.name}</span>
                </button>
                {expandedLocs[loc.id] && (byLocation[loc.id] || []).map(inst => (
                  <NavLink key={inst.id} to={`/instances/${inst.id}`}
                    className={({ isActive }) => instCls(isActive, true)}
                  >
                    <StatusDot status={statuses[inst.id] || inst.status} size="sm" />
                    <span className="truncate">{inst.name}</span>
                  </NavLink>
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Bottom area */}
      <div
        className={clsx('shrink-0 py-2 flex flex-col gap-0.5', collapsed ? 'items-center' : 'px-1')}
        style={{ borderTop: '1px solid var(--color-border)' }}
      >
        {!collapsed && version && (
          <p
            className="px-2 pb-1 text-[11px]"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Harbor v{version}
          </p>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={bottomBtn}
          style={{ color: 'var(--color-text-secondary)' }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark'
            ? <Sun size={15} className="shrink-0" />
            : <Moon size={15} className="shrink-0" />}
          {!collapsed && (
            <span className="text-xs">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          )}
        </button>

        {/* User / logout */}
        <button
          onClick={logout}
          className={bottomBtn}
          style={{ color: 'var(--color-text-secondary)' }}
          title={collapsed ? `${user?.username} — Sign out` : 'Sign out'}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
            style={{ background: 'var(--color-accent)', fontSize: '10px' }}
          >
            {user?.username?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          {!collapsed && (
            <>
              <span className="text-xs truncate flex-1 text-left">{user?.username}</span>
              <LogOut size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            </>
          )}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={clsx(bottomBtn, collapsed ? '' : 'justify-end')}
          style={{ color: 'var(--color-text-tertiary)' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
    </aside>
  );
}
