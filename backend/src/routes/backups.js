import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, haGet, haPost, getToken } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/backups', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const data = await haGet(inst, '/api/hassio/backups');
    res.json(data?.data?.backups || []);
  } catch (e) {
    // Supervisor API absent on non-OS/Supervised installs — not an error
    if (e.status === 401 || e.status === 404) return res.json([]);
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/backups', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const result = await haPost(inst, '/api/hassio/backups/new/full', { name: `Harbor backup ${new Date().toISOString().slice(0, 10)}` });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'backup_triggered', details: 'Manual full backup triggered' });
    res.json({ ok: true, slug: result?.data?.slug });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/:id/backups/schedule', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    // Stored locally in Harbor settings as HA doesn't have native schedule API
    const { getDb } = await import('../db/index.js');
    const row = getDb().prepare("SELECT value FROM harbor_settings WHERE key = ?").get(`backup_schedule_${inst.id}`);
    res.json(row ? JSON.parse(row.value) : { enabled: false, schedule: '0 3 * * *' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/backups/schedule', async (req, res) => {
  const inst = getInstance(req.params.id);
  const { enabled, schedule } = req.body;
  try {
    const { getDb } = await import('../db/index.js');
    const val = JSON.stringify({ enabled: !!enabled, schedule: schedule || '0 3 * * *' });
    getDb().prepare("INSERT OR REPLACE INTO harbor_settings (key, value) VALUES (?, ?)").run(`backup_schedule_${inst.id}`, val);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/backups/:backup_slug/download', async (req, res) => {
  const inst = getInstance(req.params.id);
  const token = getToken(inst);
  const url = `${inst.url}/api/hassio/backups/${req.params.backup_slug}/download`;

  try {
    const upstream = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!upstream.ok) return res.status(upstream.status).json({ error: `Upstream error ${upstream.status}` });

    res.setHeader('Content-Type', 'application/x-tar');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.backup_slug}.tar"`);
    if (upstream.headers.get('content-length')) {
      res.setHeader('Content-Length', upstream.headers.get('content-length'));
    }

    upstream.body.pipeTo(new WritableStream({
      write(chunk) { res.write(chunk); },
      close() { res.end(); },
      abort(err) { res.destroy(err); },
    }));

    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'backup_downloaded', details: `Backup ${req.params.backup_slug} downloaded` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/backups/:backup_slug/restore', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await haPost(inst, `/api/hassio/backups/${req.params.backup_slug}/restore/full`);
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'backup_restored', details: `Backup ${req.params.backup_slug} restore triggered` });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
