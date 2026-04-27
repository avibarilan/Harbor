import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, callCompanion } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/addons', async (req, res) => {
  const inst = getInstance(req.params.id);
  if (!inst.companion_enabled) return res.json([]);
  try {
    const data = await callCompanion(inst, '/addons');
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/addons/:slug/restart', async (req, res) => {
  const inst = getInstance(req.params.id);
  if (!inst.companion_enabled) return res.status(503).json({ error: 'Companion not configured' });
  try {
    const data = await callCompanion(inst, `/addons/${req.params.slug}/restart`, 'POST');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'addon_restarted', details: `Add-on ${req.params.slug} restarted` });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/addons/:slug/start', async (req, res) => {
  const inst = getInstance(req.params.id);
  if (!inst.companion_enabled) return res.status(503).json({ error: 'Companion not configured' });
  try {
    const data = await callCompanion(inst, `/addons/${req.params.slug}/start`, 'POST');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'addon_started', details: `Add-on ${req.params.slug} started` });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/addons/:slug/stop', async (req, res) => {
  const inst = getInstance(req.params.id);
  if (!inst.companion_enabled) return res.status(503).json({ error: 'Companion not configured' });
  try {
    const data = await callCompanion(inst, `/addons/${req.params.slug}/stop`, 'POST');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'addon_stopped', details: `Add-on ${req.params.slug} stopped` });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.delete('/:id/addons/:slug', async (req, res) => {
  const inst = getInstance(req.params.id);
  if (!inst.companion_enabled) return res.status(503).json({ error: 'Companion not configured' });
  try {
    const data = await callCompanion(inst, `/addons/${req.params.slug}`, 'DELETE');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'addon_uninstalled', details: `Add-on ${req.params.slug} uninstalled` });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
