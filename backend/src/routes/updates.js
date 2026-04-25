import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, callCompanion } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/updates', async (req, res) => {
  const inst = getInstance(req.params.id);
  if (!inst.companion_enabled) return res.json({ supervisor_unavailable: true });
  try {
    const data = await callCompanion(inst, '/updates');
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/updates/core', async (req, res) => {
  const inst = getInstance(req.params.id);
  if (!inst.companion_enabled) return res.status(503).json({ error: 'Companion not configured' });
  try {
    const data = await callCompanion(inst, '/updates/core', 'POST');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'update_core', details: 'Core update triggered' });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/updates/supervisor', async (req, res) => {
  const inst = getInstance(req.params.id);
  if (!inst.companion_enabled) return res.status(503).json({ error: 'Companion not configured' });
  try {
    const data = await callCompanion(inst, '/updates/supervisor', 'POST');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'update_supervisor', details: 'Supervisor update triggered' });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/updates/os', async (req, res) => {
  const inst = getInstance(req.params.id);
  if (!inst.companion_enabled) return res.status(503).json({ error: 'Companion not configured' });
  try {
    const data = await callCompanion(inst, '/updates/os', 'POST');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'update_os', details: 'OS update triggered' });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/updates/addon/:slug', async (req, res) => {
  const inst = getInstance(req.params.id);
  if (!inst.companion_enabled) return res.status(503).json({ error: 'Companion not configured' });
  try {
    const data = await callCompanion(inst, `/updates/addon/${req.params.slug}`, 'POST');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'update_addon', details: `Add-on ${req.params.slug} update triggered` });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
