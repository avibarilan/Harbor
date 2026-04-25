import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt } from '../utils/encryption.js';
import { logAudit } from '../utils/audit.js';
import { callCompanion } from '../utils/haApi.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/companion', (req, res) => {
  const inst = getDb().prepare('SELECT id, companion_url, companion_enabled FROM instances WHERE id = ?').get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  res.json({
    enabled: !!inst.companion_enabled,
    url: inst.companion_url || null,
  });
});

router.post('/:id/companion', async (req, res) => {
  const { companion_url, companion_secret } = req.body;
  if (!companion_url || !companion_secret) {
    return res.status(400).json({ error: 'companion_url and companion_secret required' });
  }

  const inst = getDb().prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });

  const cleanUrl = companion_url.replace(/\/$/, '');

  // Test connectivity before saving
  try {
    const testInst = { ...inst, companion_url: cleanUrl, companion_secret: null, companion_enabled: 1, _companion_secret_plain: companion_secret };
    const health = await callCompanion(testInst, '/health', 'GET');
    if (health.status !== 'ok') throw new Error('Companion returned non-ok status');
  } catch (e) {
    return res.status(400).json({ error: `Companion connectivity test failed: ${e.message}` });
  }

  const secretEncrypted = encrypt(companion_secret);
  getDb().prepare(`
    UPDATE instances SET companion_url = ?, companion_secret = ?, companion_enabled = 1 WHERE id = ?
  `).run(cleanUrl, secretEncrypted, req.params.id);

  logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'companion_configured', details: `Companion configured at ${cleanUrl}` });
  res.json({ ok: true, enabled: true, url: cleanUrl });
});

router.delete('/:id/companion', (req, res) => {
  const inst = getDb().prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });

  getDb().prepare('UPDATE instances SET companion_url = NULL, companion_secret = NULL, companion_enabled = 0 WHERE id = ?').run(req.params.id);
  logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'companion_removed', details: 'Companion configuration removed' });
  res.json({ ok: true });
});

export default router;
