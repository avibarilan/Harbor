import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const db = getDb();
  const locations = db.prepare('SELECT * FROM locations ORDER BY name').all();
  const counts = db.prepare(
    'SELECT location_id, COUNT(*) as count FROM instances WHERE location_id IS NOT NULL GROUP BY location_id'
  ).all();
  const countMap = {};
  for (const row of counts) countMap[row.location_id] = row.count;
  res.json(locations.map(l => ({ ...l, instance_count: countMap[l.id] || 0 })));
});

router.post('/', (req, res) => {
  const { name, notes = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const result = getDb()
    .prepare('INSERT INTO locations (name, notes) VALUES (?, ?)')
    .run(name.trim(), notes);

  logAudit({ action: 'location_created', details: `Location "${name}" created` });
  const loc = getDb().prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...loc, instance_count: 0 });
});

router.put('/:id', (req, res) => {
  const { name, notes } = req.body;
  const loc = getDb().prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  if (!loc) return res.status(404).json({ error: 'Location not found' });

  getDb().prepare('UPDATE locations SET name = COALESCE(?, name), notes = COALESCE(?, notes) WHERE id = ?')
    .run(name || null, notes ?? null, req.params.id);

  const updated = getDb().prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const loc = getDb().prepare('SELECT * FROM locations WHERE id = ?').get(req.params.id);
  if (!loc) return res.status(404).json({ error: 'Location not found' });

  // Unassign instances from this location before deleting
  getDb().prepare('UPDATE instances SET location_id = NULL WHERE location_id = ?').run(req.params.id);
  getDb().prepare('DELETE FROM locations WHERE id = ?').run(req.params.id);
  logAudit({ action: 'location_deleted', details: `Location "${loc.name}" deleted` });
  res.json({ ok: true });
});

export default router;
