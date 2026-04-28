import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, haGet, haPost } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/sysconfig', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const config = await haGet(inst, '/api/config');
    res.json({
      version: config.version,
      installation_type: config.installation_type,
      location_name: config.location_name,
      time_zone: config.time_zone,
      unit_system: config.unit_system,
      currency: config.currency,
      country: config.country,
      language: config.language,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/actions/restart', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await haPost(inst, '/api/services/homeassistant/restart');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'core_restarted', details: 'Home Assistant Core restarted' });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
