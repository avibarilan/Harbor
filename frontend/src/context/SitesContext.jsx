import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../api/client.js';

const SitesContext = createContext(null);

export function SitesProvider({ children }) {
  const [instances, setInstances] = useState([]);
  const [locations, setLocations] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [insts, locs, sts] = await Promise.all([
        api.get('/instances'),
        api.get('/locations'),
        api.get('/sites'),
      ]);
      setInstances(Array.isArray(insts) ? insts : []);
      setLocations(Array.isArray(locs) ? locs : []);
      setSites(Array.isArray(sts) ? sts : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <SitesContext.Provider value={{ instances, locations, sites, loading, refresh }}>
      {children}
    </SitesContext.Provider>
  );
}

export const useSites = () => useContext(SitesContext);
