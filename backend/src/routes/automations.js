import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, haGet, haPost, haDelete } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/automations', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const states = await haGet(inst, '/api/states');
    const automations = states
      .filter(s => s.entity_id.startsWith('automation.'))
      .map(s => ({
        entity_id: s.entity_id,
        friendly_name: s.attributes?.friendly_name || s.entity_id,
        state: s.state,
        enabled: s.state !== 'unavailable',
        last_triggered: s.attributes?.last_triggered,
        id: s.attributes?.id,
      }));
    res.json(automations);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/automations/:auto_id/toggle', async (req, res) => {
  const inst = getInstance(req.params.id);
  const entityId = req.params.auto_id.includes('.') ? req.params.auto_id : `automation.${req.params.auto_id}`;
  try {
    const state = await haGet(inst, `/api/states/${entityId}`);
    const service = state.state === 'on' ? 'turn_off' : 'turn_on';
    await haPost(inst, `/api/services/automation/${service}`, { entity_id: entityId });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'automation_toggled', details: `${entityId} → ${service}` });
    res.json({ ok: true, new_state: service === 'turn_on' ? 'on' : 'off' });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/automations/:auto_id/trigger', async (req, res) => {
  const inst = getInstance(req.params.id);
  const entityId = req.params.auto_id.includes('.') ? req.params.auto_id : `automation.${req.params.auto_id}`;
  try {
    await haPost(inst, '/api/services/automation/trigger', { entity_id: entityId });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'automation_triggered', details: entityId });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.delete('/:id/automations/:auto_id', async (req, res) => {
  const inst = getInstance(req.params.id);
  const autoId = req.params.auto_id.replace('automation.', '');
  try {
    await haDelete(inst, `/api/config/automation/config/${autoId}`);
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'automation_deleted', details: `automation.${autoId}` });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
