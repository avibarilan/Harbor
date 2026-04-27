import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { getInstance } from '../utils/haApi.js';

// ── Unauthenticated: companion add-on phones home on startup ───────────────
export const companionPublicRouter = Router();

companionPublicRouter.post('/register', (req, res) => {
  const { instance_id, companion_url, secret } = req.body ?? {};
  if (!instance_id || !companion_url || !secret) {
    return res.status(400).json({ error: 'instance_id, companion_url, and secret are required' });
  }

  const db = getDb();
  const inst = db.prepare('SELECT id, site_id FROM instances WHERE id = ?').get(instance_id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });

  db.prepare(
    'UPDATE instances SET companion_enabled = 1, companion_url = ?, companion_secret = ?, companion_registration_secret = NULL WHERE id = ?'
  ).run(companion_url.replace(/\/$/, ''), secret, inst.id);

  logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'companion_registered', details: `Companion registered from ${companion_url}` });
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
  getDb().prepare(
    'UPDATE instances SET companion_enabled = 0, companion_url = NULL, companion_secret = NULL, companion_registration_secret = NULL WHERE id = ?'
  ).run(inst.id);
  logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'companion_enable_initiated', details: 'Awaiting companion phone-home' });
  res.json({ ok: true, pending: true, instance_id: inst.id });
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
