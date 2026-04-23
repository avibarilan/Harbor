import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, haGet, haPost } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/scenes', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const states = await haGet(inst, '/api/states');
    const scenes = states
      .filter(s => s.entity_id.startsWith('scene.'))
      .map(s => ({
        entity_id: s.entity_id,
        friendly_name: s.attributes?.friendly_name || s.entity_id,
        state: s.state,
      }));
    res.json(scenes);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/scenes/:scene_id/activate', async (req, res) => {
  const inst = getInstance(req.params.id);
  const entityId = req.params.scene_id.includes('.') ? req.params.scene_id : `scene.${req.params.scene_id}`;
  try {
    await haPost(inst, '/api/services/scene/turn_on', { entity_id: entityId });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'scene_activated', details: entityId });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
