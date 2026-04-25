import WebSocket from 'ws';
import { getDb } from '../db/index.js';
import { decrypt } from '../utils/encryption.js';
import { EventEmitter } from 'events';

const BACKOFF_BASE = 2000;
const BACKOFF_MAX = 60000;

// Infer installation type from /api/config without Supervisor API access.
// 'hassio' in components = Supervisor present; 'homeassistant_hardware' = HAOS specifically.
function inferInstallationType(config) {
  if (config.installation_type && config.installation_type !== 'unknown') {
    return config.installation_type;
  }
  const components = config.components || [];
  if (components.includes('hassio')) {
    return components.includes('homeassistant_hardware')
      ? 'Home Assistant OS'
      : 'Home Assistant Supervised';
  }
  return config.installation_type || null;
}

async function fetchInstallationMeta(url, token, currentType) {
  try {
    const configRes = await fetch(`${url}/api/config`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!configRes.ok) return { installationType: currentType, haVersion: null };
    const config = await configRes.json();
    return {
      installationType: inferInstallationType(config) || currentType,
      haVersion: config.version || null,
    };
  } catch {
    return { installationType: currentType, haVersion: null };
  }
}

export class WebSocketManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // instanceId -> { ws, status, backoffMs, timer }
  }

  start() {
    const instances = getDb().prepare('SELECT * FROM instances').all();
    for (const inst of instances) this._connect(inst);

    // Listen for runtime instance changes
    process.on('harbor:instance_added',   (id) => this._connectById(id));
    process.on('harbor:instance_updated', (id) => { this._disconnect(id); this._connectById(id); });
    process.on('harbor:instance_removed', (id) => this._disconnect(id));
  }

  _connectById(id) {
    const inst = getDb().prepare('SELECT * FROM instances WHERE id = ?').get(id);
    if (inst) this._connect(inst);
  }

  _connect(inst) {
    if (this.connections.has(inst.id)) this._disconnect(inst.id);

    const state = { ws: null, status: 'disconnected', backoffMs: BACKOFF_BASE, timer: null };
    this.connections.set(inst.id, state);
    this._attempt(inst, state);
  }

  _attempt(inst, state) {
    let token;
    try {
      token = decrypt(inst.token_encrypted).trim();
    } catch {
      this._setStatus(inst, state, 'auth_failed');
      return;
    }

    const wsUrl = inst.url.replace(/^http/, 'ws') + '/api/websocket';
    let ws;
    try {
      ws = new WebSocket(wsUrl, { handshakeTimeout: 10000 });
    } catch {
      this._scheduleReconnect(inst, state);
      return;
    }

    state.ws = ws;

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: token }));
      } else if (msg.type === 'auth_ok') {
        state.backoffMs = BACKOFF_BASE;
        this._setStatus(inst, state, 'connected');
        this._subscribeStateChanges(inst, ws);
        this._syncAllStates(inst, ws);
        this._refreshInstanceMeta(inst, token);
      } else if (msg.type === 'auth_invalid') {
        this._setStatus(inst, state, 'auth_failed');
        ws.terminate();
      } else if (msg.type === 'event' && msg.event?.event_type === 'state_changed') {
        this._handleStateChanged(inst, msg.event.data);
      }
    });

    ws.on('close', () => {
      if (state.status !== 'auth_failed') {
        this._setStatus(inst, state, 'disconnected');
        this._scheduleReconnect(inst, state);
      }
    });

    ws.on('error', () => {});
  }

  // Re-detect installation_type and ha_version on every successful connection
  async _refreshInstanceMeta(inst, token) {
    try {
      const { installationType, haVersion } = await fetchInstallationMeta(
        inst.url, token, inst.installation_type
      );

      const db = getDb();
      const updates = [];
      const params = [];

      if (installationType && installationType !== inst.installation_type) {
        updates.push('installation_type = ?');
        params.push(installationType);
      }
      if (haVersion && haVersion !== inst.ha_version) {
        updates.push('ha_version = ?');
        params.push(haVersion);
      }

      if (updates.length) {
        params.push(inst.id);
        db.prepare(`UPDATE instances SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        // Patch local inst so reconnect logic uses the updated type
        inst.installation_type = installationType || inst.installation_type;
        inst.ha_version = haVersion || inst.ha_version;
      }
    } catch {}
  }

  _subscribeStateChanges(inst, ws) {
    ws.send(JSON.stringify({ id: 1, type: 'subscribe_events', event_type: 'state_changed' }));
  }

  async _syncAllStates(inst, ws) {
    ws.send(JSON.stringify({ id: 2, type: 'get_states' }));

    const handler = (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (msg.id !== 2 || msg.type !== 'result' || !msg.success) return;
      ws.off('message', handler);

      const db = getDb();
      const upsert = db.prepare(`
        INSERT INTO entity_cache (instance_id, entity_id, state, attributes_json, last_updated)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(instance_id, entity_id) DO UPDATE SET
          state = excluded.state,
          attributes_json = excluded.attributes_json,
          last_updated = excluded.last_updated
      `);

      const batch = db.transaction((states) => {
        for (const s of states) {
          upsert.run(inst.id, s.entity_id, s.state, JSON.stringify(s.attributes || {}), s.last_updated);
        }
      });
      batch(msg.result || []);
    };

    ws.on('message', handler);
  }

  _handleStateChanged(inst, data) {
    const newState = data?.new_state;
    if (!newState) return;

    getDb().prepare(`
      INSERT INTO entity_cache (instance_id, entity_id, state, attributes_json, last_updated)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(instance_id, entity_id) DO UPDATE SET
        state = excluded.state,
        attributes_json = excluded.attributes_json,
        last_updated = excluded.last_updated
    `).run(inst.id, newState.entity_id, newState.state, JSON.stringify(newState.attributes || {}), newState.last_updated);

    this.emit('state_changed', { instance_id: inst.id, new_state: newState });
  }

  _setStatus(inst, state, status) {
    state.status = status;
    const ts = status === 'connected' ? new Date().toISOString() : undefined;
    if (ts) {
      getDb().prepare('UPDATE instances SET status = ?, last_seen = ? WHERE id = ?').run(status, ts, inst.id);
    } else {
      getDb().prepare('UPDATE instances SET status = ? WHERE id = ?').run(status, inst.id);
    }
    this.emit('status_update', { instance_id: inst.id, status });
  }

  _scheduleReconnect(inst, state) {
    clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      const fresh = getDb().prepare('SELECT * FROM instances WHERE id = ?').get(inst.id);
      if (fresh) this._attempt(fresh, state);
    }, state.backoffMs);
    state.backoffMs = Math.min(state.backoffMs * 2, BACKOFF_MAX);
  }

  _disconnect(id) {
    const state = this.connections.get(id);
    if (!state) return;
    clearTimeout(state.timer);
    state.ws?.terminate();
    this.connections.delete(id);
  }

  getStatus(instanceId) {
    return this.connections.get(instanceId)?.status || 'disconnected';
  }

  getAllStatuses() {
    const out = {};
    for (const [id, state] of this.connections) out[id] = state.status;
    return out;
  }
}
