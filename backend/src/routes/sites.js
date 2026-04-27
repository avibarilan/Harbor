import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const db = getDb();
  const sites = db.prepare("SELECT * FROM sites WHERE name != '_harbor_system' ORDER BY name").all();
  const instances = db.prepare('SELECT id, site_id, name, url, installation_type, status, last_seen, ha_version, cloudflare_proxied, companion_enabled FROM instances').all();

  const instBySite = {};
  for (const inst of instances) {
    if (!instBySite[inst.site_id]) instBySite[inst.site_id] = [];
    instBySite[inst.site_id].push(inst);
  }

  const result = sites.map(s => ({
    ...s,
    tags: JSON.parse(s.tags || '[]'),
    instances: instBySite[s.id] || [],
  }));

  res.json(result);
});

router.post('/', (req, res) => {
  const { name, customer_name, tags = [], notes = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = getDb()
    .prepare('INSERT INTO sites (name, customer_name, tags, notes) VALUES (?, ?, ?, ?)')
    .run(name, customer_name || '', JSON.stringify(tags), notes);

  logAudit({ siteId: result.lastInsertRowid, action: 'site_created', details: `Site "${name}" created` });

  const site = getDb().prepare('SELECT * FROM sites WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...site, tags: JSON.parse(site.tags || '[]'), instances: [] });
});

router.put('/:id', (req, res) => {
  const { name, customer_name, tags, notes } = req.body;
  const site = getDb().prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  getDb().prepare(`
    UPDATE sites SET
      name = COALESCE(?, name),
      customer_name = COALESCE(?, customer_name),
      tags = COALESCE(?, tags),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(name, customer_name, tags ? JSON.stringify(tags) : null, notes, req.params.id);

  const updated = getDb().prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  res.json({ ...updated, tags: JSON.parse(updated.tags || '[]') });
});

router.delete('/:id', (req, res) => {
  const site = getDb().prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!site) return res.status(404).json({ error: 'Site not found' });

  getDb().prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
  logAudit({ siteId: req.params.id, action: 'site_deleted', details: `Site "${site.name}" deleted` });
  res.json({ ok: true });
});

export default router;
