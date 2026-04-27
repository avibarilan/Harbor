import { Router } from 'express';
import { randomBytes } from 'crypto';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { getInstance } from '../utils/haApi.js';

// ── Unauthenticated: companion add-on phones home on startup ───────────────
export const companionPublicRouter = Router();

companionPublicRouter.post('/register', (req, res) => {
  const { instance_id, secret, companion_url } = req.body ?? {};
  if (!instance_id || !secret) {
    return res.status(400).json({ error: 'instance_id and secret are required' });
  }

  const db = getDb();
  const inst = db.prepare('SELECT id, site_id, companion_registration_secret FROM instances WHERE id = ?').get(instance_id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  if (!inst.companion_registration_secret || inst.companion_registration_secret !== secret) {
    return res.status(401).json({ error: 'Invalid registration secret' });
  }

  const params = [secret, inst.id];
  let urlClause = '';
  if (companion_url) {
    urlClause = 'companion_url = ?,';
    params.unshift(companion_url.replace(/\/$/, ''));
  }

  db.prepare(
    `UPDATE instances SET ${urlClause} companion_enabled = 1, companion_secret = ?, companion_registration_secret = NULL WHERE id = ?`
  ).run(...params);

  logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'companion_registered', details: companion_url ? `Companion registered from ${companion_url}` : 'Companion registered' });
  res.json({ ok: true });
});

// ── Authenticated instance routes ──────────────────────────────────────────
const router = Router();
router.use(requireAuth);

router.get('/:id/companion', (req, res) => {
  const inst = getDb().prepare(
    'SELECT id, companion_enabled, companion_url, companion_registration_secret FROM instances WHERE id = ?'
  ).get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  res.json({
    enabled: !!inst.companion_enabled,
    pending: !inst.companion_enabled && !!inst.companion_registration_secret,
    companion_url: inst.companion_url || null,
  });
});

router.post('/:id/companion/enable', (req, res) => {
  const inst = getInstance(req.params.id);
  const companionUrl = (req.body?.companion_url || '').trim().replace(/\/$/, '') || null;
  const registrationSecret = randomBytes(32).toString('hex');

  getDb().prepare(
    'UPDATE instances SET companion_enabled = 0, companion_url = ?, companion_secret = NULL, companion_registration_secret = ? WHERE id = ?'
  ).run(companionUrl, registrationSecret, inst.id);

  logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'companion_enable_initiated', details: 'Awaiting companion phone-home' });
  res.json({ ok: true, pending: true, instance_id: inst.id, registration_secret: registrationSecret });
});

router.delete('/:id/companion', (req, res) => {
  const inst = getDb().prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });

  getDb().prepare(
    'UPDATE instances SET companion_enabled = 0, companion_url = NULL, companion_secret = NULL, companion_registration_secret = NULL WHERE id = ?'
  ).run(req.params.id);
  logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'companion_disabled', details: 'Companion disabled' });
  res.json({ ok: true });
});

export default router;
