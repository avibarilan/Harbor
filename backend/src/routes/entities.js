import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, haPost } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/entities', (req, res) => {
  const { domain } = req.query;
  let query = 'SELECT * FROM entity_cache WHERE instance_id = ?';
  const params = [req.params.id];

  if (domain && domain !== 'all') {
    query += ' AND entity_id LIKE ?';
    params.push(`${domain}.%`);
  }

  query += ' ORDER BY entity_id';
  const rows = getDb().prepare(query).all(...params);

  const entities = rows.map(r => ({
    ...r,
    attributes: JSON.parse(r.attributes_json || '{}'),
  }));

  res.json(entities);
});

router.post('/:id/entities/call', async (req, res) => {
  const { entity_id, service, data = {} } = req.body;
  if (!entity_id || !service) return res.status(400).json({ error: 'entity_id and service required' });

  const inst = getInstance(req.params.id);
  const [domain] = entity_id.split('.');

  try {
    await haPost(inst, `/api/services/${domain}/${service}`, { entity_id, ...data });
    logAudit({
      instanceId: inst.id,
      siteId: inst.site_id,
      action: 'service_called',
      details: `${domain}.${service} on ${entity_id}`,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
