import { getDb } from '../db/index.js';
import { decrypt } from './encryption.js';
import WebSocket from 'ws';

function baseUrl(inst) {
  return inst.url.replace(/\/$/, '');
}

export function getInstance(id) {
  const inst = getDb().prepare('SELECT * FROM instances WHERE id = ?').get(id);
  if (!inst) throw Object.assign(new Error('Instance not found'), { status: 404 });
  return inst;
}

export function getToken(inst) {
  return decrypt(inst.token_encrypted).trim();
}

export async function haGet(inst, path) {
  const token = getToken(inst);
  const res = await fetch(`${baseUrl(inst)}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(new Error(`HA API error ${res.status}: ${text}`), { status: res.status });
  }
  return res.json();
}

export async function haPost(inst, path, body) {
  const token = getToken(inst);
  const res = await fetch(`${baseUrl(inst)}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(new Error(`HA API error ${res.status}: ${text}`), { status: res.status });
  }
  return res.json().catch(() => ({}));
}

export async function haDelete(inst, path) {
  const token = getToken(inst);
  const res = await fetch(`${baseUrl(inst)}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(new Error(`HA API error ${res.status}: ${text}`), { status: res.status });
  }
  return res.json().catch(() => ({}));
}

export function callHaWs(inst, message) {
  return new Promise((resolve, reject) => {
    const token = getToken(inst);
    const wsUrl = baseUrl(inst).replace(/^http/, 'ws') + '/api/websocket';
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => { ws.terminate(); reject(new Error('WS timeout')); }, 10000);
    let msgId = 1;

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'auth_required') {
        ws.send(JSON.stringify({ type: 'auth', access_token: token }));
      } else if (msg.type === 'auth_ok') {
        ws.send(JSON.stringify({ ...message, id: msgId }));
      } else if (msg.type === 'auth_invalid') {
        clearTimeout(timeout);
        ws.terminate();
        reject(new Error('auth_invalid'));
      } else if (msg.type === 'result' && msg.id === msgId) {
        clearTimeout(timeout);
        ws.terminate();
        if (msg.success) resolve(msg.result);
        else reject(new Error(msg.error?.message || 'WS command failed'));
      }
    });

    ws.on('error', (e) => { clearTimeout(timeout); reject(e); });
  });
}
