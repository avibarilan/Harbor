import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { getInstance, getToken, callCompanion } from '../utils/haApi.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/companion', (req, res) => {
  const inst = getDb().prepare('SELECT id, companion_enabled, companion_ingress_token FROM instances WHERE id = ?').get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  res.json({
    enabled: !!inst.companion_enabled,
    ingress_token: inst.companion_ingress_token || null,
  });
});

router.post('/:id/companion/enable', async (req, res) => {
  const inst = getInstance(req.params.id);
  const token = getToken(inst);
  const base = inst.url.replace(/\/$/, '');

  // Discover ingress token via HA Supervisor API using the instance LLAT
  let ingressToken;
  try {
    const r = await fetch(`${base}/api/hassio/addons/harbor_companion/info`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 404) {
      return res.status(404).json({ error: 'Harbor Companion add-on not found. Please install it from the Home Assistant add-on store first.' });
    }
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`HA API error ${r.status}: ${text}`);
    }
    const data = await r.json();
    ingressToken = data?.data?.ingress_token;
    if (!ingressToken) throw new Error('ingress_token not present in add-on info response');
  } catch (e) {
    return res.status(400).json({ error: `Failed to discover companion: ${e.message}` });
  }

  // Health-check via Ingress before committing
  try {
    const testInst = { ...inst, companion_enabled: 1, companion_ingress_token: ingressToken };
    const health = await callCompanion(testInst, '/health');
    if (health.status !== 'ok') throw new Error('Companion returned non-ok status');
  } catch (e) {
    return res.status(400).json({ error: `Companion health check failed: ${e.message}` });
  }

  getDb().prepare('UPDATE instances SET companion_enabled = 1, companion_ingress_token = ? WHERE id = ?').run(ingressToken, inst.id);
  logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'companion_enabled', details: 'Companion enabled via Home Assistant Ingress' });
  res.json({ ok: true, enabled: true, ingress_token: ingressToken });
});

router.delete('/:id/companion', (req, res) => {
  const inst = getDb().prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });

  getDb().prepare('UPDATE instances SET companion_enabled = 0, companion_ingress_token = NULL WHERE id = ?').run(req.params.id);
  logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'companion_disabled', details: 'Companion disabled' });
  res.json({ ok: true });
});

export default router;
