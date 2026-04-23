import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const WsContext = createContext(null);

export function WsProvider({ children }) {
  const wsRef = useRef(null);
  const [statuses, setStatuses] = useState({});
  const listenersRef = useRef(new Map());

  const subscribe = useCallback((instanceId, handler) => {
    if (!listenersRef.current.has(instanceId)) {
      listenersRef.current.set(instanceId, new Set());
    }
    listenersRef.current.get(instanceId).add(handler);
    return () => listenersRef.current.get(instanceId)?.delete(handler);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('harbor_token');
    if (!token) return;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'status_snapshot') {
          setStatuses(msg.statuses || {});
        } else if (msg.type === 'status_update') {
          setStatuses(prev => ({ ...prev, [msg.instance_id]: msg.status }));
        } else if (msg.type === 'state_changed') {
          listenersRef.current.get(msg.instance_id)?.forEach(h => h(msg));
        }
      } catch {}
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => ws.close();
  }, []);

  return (
    <WsContext.Provider value={{ statuses, subscribe }}>
      {children}
    </WsContext.Provider>
  );
}

export const useWs = () => useContext(WsContext);
