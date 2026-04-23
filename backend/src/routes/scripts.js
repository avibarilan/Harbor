import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, haGet, haPost } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/scripts', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const states = await haGet(inst, '/api/states');
    const scripts = states
      .filter(s => s.entity_id.startsWith('script.'))
      .map(s => ({
        entity_id: s.entity_id,
        friendly_name: s.attributes?.friendly_name || s.entity_id,
        state: s.state,
        last_triggered: s.attributes?.last_triggered,
      }));
    res.json(scripts);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/scripts/:script_id/run', async (req, res) => {
  const inst = getInstance(req.params.id);
  const entityId = req.params.script_id.includes('.') ? req.params.script_id : `script.${req.params.script_id}`;
  try {
    await haPost(inst, '/api/services/script/turn_on', { entity_id: entityId });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'script_run', details: entityId });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
