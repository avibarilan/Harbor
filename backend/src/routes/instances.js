import { Router } from 'express';
import { getDb, getSystemSiteId } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { logAudit } from '../utils/audit.js';
import { checkCloudflare } from '../utils/cloudflare.js';

const router = Router();
router.use(requireAuth);

async function testConnection(url, token) {
  const res = await fetch(`${url}/api/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw Object.assign(new Error('Invalid token'), { code: 'auth_failed' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

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
  return config.installation_type || 'unknown';
}

const INST_COLS = 'id, site_id, location_id, name, url, installation_type, status, last_seen, ha_version, cloudflare_proxied, companion_enabled, companion_last_seen, companion_version, created_at';

router.get('/', (req, res) => {
  const instances = getDb().prepare(`SELECT ${INST_COLS} FROM instances ORDER BY name`).all();
  const now = Date.now();
  res.json(instances.map(inst => ({
    ...inst,
    companion_online: inst.companion_enabled === 1 && !!inst.companion_last_seen &&
      (now - new Date(inst.companion_last_seen).getTime() < 60_000),
  })));
});

router.post('/', async (req, res) => {
  const { name, url, location_id } = req.body;
  const token = (req.body.token || '').trim();
  if (!name || !url || !token) return res.status(400).json({ error: 'name, url, token required' });

  const cleanUrl = url.replace(/\/$/, '');

  let config;
  try {
    config = await testConnection(cleanUrl, token);
  } catch (e) {
    return res.status(400).json({ error: `Connection failed: ${e.message}` });
  }

  try {
    const installationType = inferInstallationType(config);
    const haVersion = config.version || null;
    const tokenEncrypted = encrypt(token);
    const siteId = getSystemSiteId();
    const locId = location_id ? parseInt(location_id, 10) : null;

    const result = getDb().prepare(`
      INSERT INTO instances (site_id, location_id, name, url, token_encrypted, installation_type, status, ha_version)
      VALUES (?, ?, ?, ?, ?, ?, 'disconnected', ?)
    `).run(siteId, locId, name, cleanUrl, tokenEncrypted, installationType, haVersion);

    const instId = result.lastInsertRowid;

    checkCloudflare(cleanUrl).then(proxied => {
      if (proxied) getDb().prepare('UPDATE instances SET cloudflare_proxied = 1 WHERE id = ?').run(instId);
    }).catch(() => {});

    logAudit({
      instanceId: instId,
      siteId,
      action: 'instance_adopted',
      details: `Instance "${name}" adopted (${installationType}, v${haVersion})`,
    });

    const inst = getDb().prepare(`SELECT ${INST_COLS} FROM instances WHERE id = ?`).get(instId);
    process.emit('harbor:instance_added', inst.id);
    res.status(201).json(inst);
  } catch (err) {
    console.error('[instances] adopt error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const inst = getDb().prepare(`SELECT ${INST_COLS} FROM instances WHERE id = ?`).get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  res.json(inst);
});

router.put('/:id', async (req, res) => {
  const { name, url, location_id } = req.body;
  const token = req.body.token ? req.body.token.trim() : undefined;
  const inst = getDb().prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });

  let tokenEncrypted = inst.token_encrypted;
  let haVersion = inst.ha_version;
  let installationType = inst.installation_type;

  if (token) {
    const cleanUrl = (url || inst.url).replace(/\/$/, '');
    try {
      const config = await testConnection(cleanUrl, token);
      haVersion = config.version || haVersion;
      installationType = inferInstallationType(config) || installationType;
    } catch (e) {
      return res.status(400).json({ error: `Connection test failed: ${e.message}` });
    }
    tokenEncrypted = encrypt(token);
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'instance_token_updated', details: `Token updated for "${inst.name}"` });
  }

  const newUrl = url ? url.replace(/\/$/, '') : null;
  const locId = location_id !== undefined ? (location_id ? parseInt(location_id, 10) : null) : undefined;

  getDb().prepare(`
    UPDATE instances SET
      name = COALESCE(?, name),
      url = COALESCE(?, url),
      token_encrypted = ?,
      ha_version = ?,
      installation_type = ?,
      location_id = CASE WHEN ? IS NOT NULL THEN ? ELSE location_id END
    WHERE id = ?
  `).run(name || null, newUrl, tokenEncrypted, haVersion, installationType, locId, locId, req.params.id);

  if (url) {
    const checkUrl = newUrl || inst.url;
    checkCloudflare(checkUrl).then(proxied => {
      getDb().prepare('UPDATE instances SET cloudflare_proxied = ? WHERE id = ?').run(proxied ? 1 : 0, req.params.id);
    }).catch(() => {});
  }

  if (token) process.emit('harbor:instance_updated', inst.id);

  const updated = getDb().prepare(`SELECT ${INST_COLS} FROM instances WHERE id = ?`).get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const inst = getDb().prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });

  getDb().prepare('DELETE FROM instances WHERE id = ?').run(req.params.id);
  logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'instance_removed', details: `Instance "${inst.name}" removed` });
  process.emit('harbor:instance_removed', inst.id);
  res.json({ ok: true });
});

router.post('/:id/test', async (req, res) => {
  let token, url;
  if (req.params.id === '0') {
    if (!req.body.url || !req.body.token) return res.status(400).json({ error: 'url and token required' });
    token = req.body.token.trim();
    url = req.body.url.replace(/\/$/, '');
  } else {
    const inst = getDb().prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
    if (!inst) return res.status(404).json({ error: 'Instance not found' });
    token = req.body.token ? req.body.token.trim() : decrypt(inst.token_encrypted).trim();
    url = (req.body.url || inst.url).replace(/\/$/, '');
  }

  try {
    const config = await testConnection(url, token);
    res.json({ ok: true, version: config.version, installation_type: inferInstallationType(config) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

export default router;
