import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

function getInitialTheme() {
  const stored = localStorage.getItem('harbor_theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const [density, setDensity] = useState(() => localStorage.getItem('harbor_density') || 'spacious');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('harbor_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('harbor_density', density);
  }, [density]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');
  const toggleDensity = () => setDensity(d => d === 'spacious' ? 'compact' : 'spacious');

  return (
    <ThemeContext.Provider value={{ theme, density, toggleTheme, toggleDensity }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
