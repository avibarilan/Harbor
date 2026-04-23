import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('harbor_theme') || 'light');
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
