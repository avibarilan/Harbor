import { useState, useEffect } from 'react';
import { api } from '../api/client.js';

// Fetches update + backup summary for a single instance card.
// Only fires when status is 'connected'.
export function useInstanceMeta(instanceId, status) {
  const [updates, setUpdates] = useState(null);
  const [latestBackup, setLatestBackup] = useState(undefined); // undefined = not loaded
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status !== 'connected') return;
    setLoading(true);

    Promise.allSettled([
      api.get(`/instances/${instanceId}/updates`),
      api.get(`/instances/${instanceId}/backups`),
    ]).then(([updatesRes, backupsRes]) => {
      if (updatesRes.status === 'fulfilled') {
        const u = updatesRes.value;
        const count =
          (u.core?.update_available ? 1 : 0) +
          (u.supervisor?.update_available ? 1 : 0) +
          (u.os?.update_available ? 1 : 0) +
          (u.addons?.length || 0);
        setUpdates(count);
      }
      if (backupsRes.status === 'fulfilled') {
        const backups = backupsRes.value;
        if (!backups.length) { setLatestBackup(null); return; }
        const sorted = [...backups].sort((a, b) => new Date(b.date) - new Date(a.date));
        setLatestBackup(sorted[0]);
      } else {
        setLatestBackup(null);
      }
    }).finally(() => setLoading(false));
  }, [instanceId, status]);

  const backupAgeWarning = (() => {
    if (latestBackup === undefined) return false;
    if (latestBackup === null) return true;
    const age = (Date.now() - new Date(latestBackup.date)) / (1000 * 60 * 60 * 24);
    return age > 7;
  })();

  return { updates, backupAgeWarning, loading };
}
