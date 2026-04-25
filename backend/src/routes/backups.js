import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, callCompanion, streamCompanion } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

function getInst(id) {
  return getInstance(id);
}

router.get('/:id/backups', async (req, res) => {
  const inst = getInst(req.params.id);
  if (!inst.companion_enabled) return res.json([]);
  try {
    const data = await callCompanion(inst, '/backups');
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/backups', async (req, res) => {
  const inst = getInst(req.params.id);
  if (!inst.companion_enabled) return res.status(503).json({ error: 'Companion not configured' });
  try {
    const data = await callCompanion(inst, '/backups/new', 'POST');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'backup_created', details: 'Full backup triggered via Companion' });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/:id/backups/:slug/info', async (req, res) => {
  const inst = getInst(req.params.id);
  if (!inst.companion_enabled) return res.status(503).json({ error: 'Companion not configured' });
  try {
    const data = await callCompanion(inst, `/backups/${req.params.slug}/info`);
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/backups/:slug/restore', async (req, res) => {
  const inst = getInst(req.params.id);
  if (!inst.companion_enabled) return res.status(503).json({ error: 'Companion not configured' });
  try {
    const data = await callCompanion(inst, `/backups/${req.params.slug}/restore`, 'POST');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'backup_restored', details: `Backup ${req.params.slug} restore triggered` });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/:id/backups/:slug/download', async (req, res) => {
  const inst = getInst(req.params.id);
  if (!inst.companion_enabled) return res.status(503).json({ error: 'Companion not configured' });
  try {
    const upstream = await streamCompanion(inst, `/backups/${req.params.slug}/download`);
    res.setHeader('Content-Type', 'application/tar+gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.slug}.tar.gz"`);
    const reader = upstream.body.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) { res.end(); return; }
      res.write(Buffer.from(value));
      await pump();
    };
    await pump();
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
