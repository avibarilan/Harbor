import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, haGet } from '../utils/haApi.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q || q.length < 2) return res.json([]);

  const db = getDb();
  const instances = db.prepare(`
    SELECT i.id, i.name, i.site_id, i.status, s.name as site_name
    FROM instances i
    JOIN sites s ON s.id = i.site_id
  `).all();

  const results = [];

  // Search entity cache
  const entityRows = db.prepare(`
    SELECT ec.*, i.name as instance_name, i.site_id, s.name as site_name
    FROM entity_cache ec
    JOIN instances i ON i.id = ec.instance_id
    JOIN sites s ON s.id = i.site_id
    WHERE LOWER(ec.entity_id) LIKE ? OR LOWER(ec.attributes_json) LIKE ?
    LIMIT 50
  `).all(`%${q}%`, `%${q}%`);

  for (const row of entityRows) {
    const attrs = JSON.parse(row.attributes_json || '{}');
    results.push({
      result_type: 'entity',
      site_id: row.site_id,
      site_name: row.site_name,
      instance_id: row.instance_id,
      instance_name: row.instance_name,
      entity_id: row.entity_id,
      friendly_name: attrs.friendly_name || row.entity_id,
      state: row.state,
    });
  }

  // Search automations, scripts, scenes via live HA calls for connected instances
  const connectedInstances = instances.filter(i => i.status === 'connected');

  await Promise.allSettled(connectedInstances.map(async (inst) => {
    try {
      const haInst = getInstance(inst.id);
      const states = await haGet(haInst, '/api/states');

      for (const s of states) {
        const domain = s.entity_id.split('.')[0];
        if (!['automation', 'script', 'scene'].includes(domain)) continue;

        const name = (s.attributes?.friendly_name || s.entity_id).toLowerCase();
        if (!name.includes(q) && !s.entity_id.toLowerCase().includes(q)) continue;

        results.push({
          result_type: domain,
          site_id: inst.site_id,
          site_name: inst.site_name,
          instance_id: inst.id,
          instance_name: inst.name,
          entity_id: s.entity_id,
          friendly_name: s.attributes?.friendly_name || s.entity_id,
          state: s.state,
        });
      }
    } catch {}
  }));

  // Deduplicate entities that appear in both cache and live results
  const seen = new Set();
  const deduped = results.filter(r => {
    const key = `${r.instance_id}:${r.entity_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.json(deduped.slice(0, 100));
});

export default router;
