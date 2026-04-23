import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../api/client.js';

const SitesContext = createContext(null);

export function SitesProvider({ children }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/sites');
      setSites(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <SitesContext.Provider value={{ sites, loading, refresh }}>
      {children}
    </SitesContext.Provider>
  );
}

export const useSites = () => useContext(SitesContext);
