import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, haGet, haPost, getToken } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/health', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const [coreInfo, supervisorInfo, osInfo, hostInfo] = await Promise.allSettled([
      haGet(inst, '/api/hassio/core/info'),
      haGet(inst, '/api/hassio/supervisor/info'),
      haGet(inst, '/api/hassio/os/info'),
      haGet(inst, '/api/hassio/host/info'),
    ]);

    const safe = (r) => r.status === 'fulfilled' ? r.value?.data : null;
    res.json({
      core: safe(coreInfo),
      supervisor: safe(supervisorInfo),
      os: safe(osInfo),
      host: safe(hostInfo),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/logs', async (req, res) => {
  const inst = getInstance(req.params.id);
  const token = getToken(inst);
  try {
    const upstream = await fetch(`${inst.url}/api/error_log`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await upstream.text();
    res.setHeader('Content-Type', 'text/plain');
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
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

router.post('/:id/actions/reboot', async (req, res) => {
  const inst = getInstance(req.params.id);
  if (inst.installation_type !== 'Home Assistant OS') {
    return res.status(400).json({ error: 'Host reboot only available on Home Assistant OS' });
  }
  try {
    await haPost(inst, '/api/hassio/host/reboot');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'host_rebooted', details: 'Host reboot triggered' });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/actions/shutdown', async (req, res) => {
  const inst = getInstance(req.params.id);
  if (inst.installation_type !== 'Home Assistant OS') {
    return res.status(400).json({ error: 'Host shutdown only available on Home Assistant OS' });
  }
  try {
    await haPost(inst, '/api/hassio/host/shutdown');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'host_shutdown', details: 'Host shutdown triggered' });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
