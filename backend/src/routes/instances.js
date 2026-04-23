import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { logAudit } from '../utils/audit.js';

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

router.post('/', async (req, res) => {
  const { site_id, name, url, token } = req.body;
  if (!site_id || !name || !url || !token) return res.status(400).json({ error: 'site_id, name, url, token required' });

  const site = getDb().prepare('SELECT * FROM sites WHERE id = ?').get(site_id);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  const cleanUrl = url.replace(/\/$/, '');

  let config;
  try {
    config = await testConnection(cleanUrl, token);
  } catch (e) {
    return res.status(400).json({ error: `Connection failed: ${e.message}` });
  }

  try {
    const installationType = config.installation_type || 'unknown';
    const haVersion = config.version || null;
    const tokenEncrypted = encrypt(token);

    const result = getDb().prepare(`
      INSERT INTO instances (site_id, name, url, token_encrypted, installation_type, status, ha_version)
      VALUES (?, ?, ?, ?, ?, 'disconnected', ?)
    `).run(site_id, name, cleanUrl, tokenEncrypted, installationType, haVersion);

    logAudit({
      instanceId: result.lastInsertRowid,
      siteId: site_id,
      action: 'instance_adopted',
      details: `Instance "${name}" adopted (${installationType}, v${haVersion})`,
    });

    const inst = getDb().prepare('SELECT id, site_id, name, url, installation_type, status, last_seen, ha_version, created_at FROM instances WHERE id = ?').get(result.lastInsertRowid);

    process.emit('harbor:instance_added', inst.id);
    res.status(201).json(inst);
  } catch (err) {
    console.error('[instances] adopt error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const inst = getDb().prepare('SELECT id, site_id, name, url, installation_type, status, last_seen, ha_version, created_at FROM instances WHERE id = ?').get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  res.json(inst);
});

router.put('/:id', async (req, res) => {
  const { name, url, token } = req.body;
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
      installationType = config.installation_type || installationType;
    } catch (e) {
      return res.status(400).json({ error: `Connection test failed: ${e.message}` });
    }
  }

  try {
    if (token) {
      tokenEncrypted = encrypt(token);
      logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'instance_token_updated', details: `Token updated for "${inst.name}"` });
    }

    getDb().prepare(`
      UPDATE instances SET
        name = COALESCE(?, name),
        url = COALESCE(?, url),
        token_encrypted = ?,
        ha_version = ?,
        installation_type = ?
      WHERE id = ?
    `).run(name, url ? url.replace(/\/$/, '') : null, tokenEncrypted, haVersion, installationType, req.params.id);

    if (token) process.emit('harbor:instance_updated', inst.id);

    const updated = getDb().prepare('SELECT id, site_id, name, url, installation_type, status, last_seen, ha_version, created_at FROM instances WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('[instances] update error:', err);
    res.status(500).json({ error: err.message });
  }
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
  // id=0 means ad-hoc test (adoption flow) — url and token must be in body
  let token, url;
  if (req.params.id === '0') {
    if (!req.body.url || !req.body.token) return res.status(400).json({ error: 'url and token required' });
    token = req.body.token;
    url = req.body.url.replace(/\/$/, '');
  } else {
    const inst = getDb().prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
    if (!inst) return res.status(404).json({ error: 'Instance not found' });
    token = req.body.token ? req.body.token : decrypt(inst.token_encrypted);
    url = (req.body.url || inst.url).replace(/\/$/, '');
  }

  try {
    const config = await testConnection(url, token);
    res.json({ ok: true, version: config.version, installation_type: config.installation_type });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

export default router;
