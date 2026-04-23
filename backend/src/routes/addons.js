import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, haGet, haPost } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/addons', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const data = await haGet(inst, '/api/hassio/addons');
    res.json(data?.data?.addons || []);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/addons/:addon_slug/update', async (req, res) => {
  const inst = getInstance(req.params.id);
  const { addon_slug } = req.params;
  try {
    await haPost(inst, `/api/hassio/addons/${addon_slug}/update`);
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'addon_update_triggered', details: `Add-on ${addon_slug} update triggered` });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
