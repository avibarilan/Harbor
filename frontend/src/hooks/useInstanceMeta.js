import { useState, useCallback } from 'react';
import { api } from '../api/client.js';

// Stub — backup and update badges removed (Supervisor API not accessible externally).
// Kept for import compatibility; returns empty values so callers don't need updating.
export function useInstanceMeta(_instanceId, _status) {
  return { updates: null, backupStatus: null, backupDate: null, backupAgeWarning: false, loading: false };
}

export function usePeoplePresence(instanceId, status, enabled) {
  const [people, setPeople] = useState(null);

  const load = useCallback(() => {
    if (!enabled || status !== 'connected' || people !== null) return;
    api.get(`/instances/${instanceId}/entities?domain=person`)
      .then(entities => {
        setPeople(entities.map(e => ({
          entity_id: e.entity_id,
          name: e.attributes?.friendly_name || e.entity_id.split('.')[1]?.replace(/_/g, ' ') || e.entity_id,
          state: e.state,
        })));
      })
      .catch(() => setPeople([]));
  }, [instanceId, status, enabled, people]);

  return { people, load };
}
