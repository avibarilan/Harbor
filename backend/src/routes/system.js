import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, haGet, haPost } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const RELOAD_DOMAINS = new Set([
  'automation', 'script', 'scene', 'input_boolean',
  'input_select', 'input_number', 'input_text', 'timer', 'schedule',
]);

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

router.post('/:id/config-check', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const result = await haPost(inst, '/api/config/core/check_config');
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/reload-yaml', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await haPost(inst, '/api/services/homeassistant/reload_all');
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'yaml_reloaded', details: 'All YAML reloaded' });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/reload/:domain', async (req, res) => {
  const inst = getInstance(req.params.id);
  const { domain } = req.params;
  if (!RELOAD_DOMAINS.has(domain)) return res.status(400).json({ error: 'Invalid domain' });
  try {
    await haPost(inst, `/api/services/${domain}/reload`);
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/:id/logbook', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const start = req.query.start || new Date(Date.now() - 60000).toISOString();
    let path = `/api/logbook/${encodeURIComponent(start)}`;
    const qs = [];
    if (req.query.end) qs.push(`end_time=${encodeURIComponent(req.query.end)}`);
    if (req.query.entity_id) qs.push(`entity_id=${encodeURIComponent(req.query.entity_id)}`);
    if (qs.length) path += '?' + qs.join('&');
    const data = await haGet(inst, path);
    const arr = Array.isArray(data) ? data : [];
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 500) : arr.length;
    const slice = arr.slice(-limit);

    // Enrich binary_sensor events with device_class from entity cache
    const db = getDb();
    const stmt = db.prepare('SELECT attributes_json FROM entity_cache WHERE instance_id = ? AND entity_id = ?');
    const enriched = slice.map(event => {
      const domain = event.domain || (event.entity_id ? event.entity_id.split('.')[0] : '');
      if (domain === 'binary_sensor' && event.entity_id && !event.attributes?.device_class) {
        const row = stmt.get(inst.id, event.entity_id);
        if (row) {
          try {
            const attrs = JSON.parse(row.attributes_json || '{}');
            if (attrs.device_class) {
              return { ...event, attributes: { ...(event.attributes || {}), device_class: attrs.device_class } };
            }
          } catch {}
        }
      }
      return event;
    });

    res.json(enriched);
  } catch (e) {
    res.status(e.status || 500).json([]);
  }
});

export default router;
