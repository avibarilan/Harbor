import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, haGet, haPost } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/updates', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const [coreInfo, supervisorInfo, osInfo, addonsInfo] = await Promise.allSettled([
      haGet(inst, '/api/hassio/core/info'),
      haGet(inst, '/api/hassio/supervisor/info'),
      haGet(inst, '/api/hassio/os/info'),
      haGet(inst, '/api/hassio/addons'),
    ]);

    const safe = (r) => r.status === 'fulfilled' ? r.value?.data : null;

    const core = safe(coreInfo);
    const supervisor = safe(supervisorInfo);
    const os = safe(osInfo);
    const addons = safe(addonsInfo)?.addons || [];

    const updates = {
      core: core ? { version: core.version, version_latest: core.version_latest, update_available: core.update_available } : null,
      supervisor: supervisor ? { version: supervisor.version, version_latest: supervisor.version_latest, update_available: supervisor.update_available } : null,
      os: os ? { version: os.version, version_latest: os.version_latest, update_available: os.update_available } : null,
      addons: addons.filter(a => a.update_available),
    };

    res.json(updates);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/updates/core', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await haPost(inst, '/api/hassio/core/update');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'core_update_triggered', details: 'HA Core update triggered' });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/updates/supervisor', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await haPost(inst, '/api/hassio/supervisor/update');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'supervisor_update_triggered', details: 'Supervisor update triggered' });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/updates/os', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await haPost(inst, '/api/hassio/os/update');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'os_update_triggered', details: 'Home Assistant OS update triggered' });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
