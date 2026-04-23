import { Sun, Moon, AlignJustify, LayoutGrid, LogOut, User } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useState, useRef, useEffect } from 'react';

export default function TopBar() {
  const { theme, density, toggleTheme, toggleDensity } = useTheme();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-12 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center px-4 gap-3 shrink-0">
      <div className="flex-1" />

      {/* Theme toggle */}
      <button onClick={toggleTheme} className="btn-ghost btn-sm" title="Toggle theme">
        {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
      </button>

      {/* Density toggle */}
      <button onClick={toggleDensity} className="btn-ghost btn-sm" title={`Switch to ${density === 'spacious' ? 'compact' : 'spacious'} mode`}>
        {density === 'spacious' ? <AlignJustify size={15} /> : <LayoutGrid size={15} />}
      </button>

      {/* User menu */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <User size={15} />
          <span className="font-medium">{user?.username}</span>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-40 card shadow-lg py-1 z-50">
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
