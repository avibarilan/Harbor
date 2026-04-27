import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../api/client.js';

const SitesContext = createContext(null);

export function SitesProvider({ children }) {
  const [instances, setInstances] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [insts, locs] = await Promise.all([
        api.get('/instances'),
        api.get('/locations'),
      ]);
      setInstances(Array.isArray(insts) ? insts : []);
      setLocations(Array.isArray(locs) ? locs : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <SitesContext.Provider value={{ instances, locations, loading, refresh }}>
      {children}
    </SitesContext.Provider>
  );
}

export const useSites = () => useContext(SitesContext);
