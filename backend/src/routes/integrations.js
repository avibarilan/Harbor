import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, haGet, haPost, haDelete, haPatch } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/integrations', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const [entries, flows] = await Promise.all([
      haGet(inst, '/api/config/config_entries/entry').catch(() => []),
      haGet(inst, '/api/config/config_entries/flow').catch(() => []),
    ]);
    res.json({
      entries: Array.isArray(entries) ? entries : [],
      flows: Array.isArray(flows) ? flows : [],
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.delete('/:id/integrations/flows/:flowId', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await haDelete(inst, `/api/config/config_entries/flow/${req.params.flowId}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/integrations/:entryId/reload', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await haPost(inst, `/api/config/config_entries/entry/${req.params.entryId}/reload`);
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'integration_reloaded', details: req.params.entryId });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/integrations/:entryId/disable', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await haPatch(inst, `/api/config/config_entries/entry/${req.params.entryId}`, { disabled_by: 'user' });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'integration_disabled', details: req.params.entryId });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/integrations/:entryId/enable', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await haPatch(inst, `/api/config/config_entries/entry/${req.params.entryId}`, { disabled_by: null });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'integration_enabled', details: req.params.entryId });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.delete('/:id/integrations/:entryId', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await haDelete(inst, `/api/config/config_entries/entry/${req.params.entryId}`);
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'integration_deleted', details: req.params.entryId });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
