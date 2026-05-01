import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, haGet, haPost, callHaWs } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

// ── Areas ──────────────────────────────────────────────────────────────

router.get('/:id/areas', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const [areas, devices] = await Promise.all([
      callHaWs(inst, { type: 'config/area_registry/list' }),
      callHaWs(inst, { type: 'config/device_registry/list' }).catch(() => []),
    ]);
    const countByArea = {};
    for (const d of (Array.isArray(devices) ? devices : [])) {
      if (d.area_id) countByArea[d.area_id] = (countByArea[d.area_id] || 0) + 1;
    }
    const result = (Array.isArray(areas) ? areas : []).map(a => ({
      ...a,
      device_count: countByArea[a.area_id] || 0,
    }));
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/areas', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const area = await callHaWs(inst, { type: 'config/area_registry/create', name: req.body.name });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'area_created', details: req.body.name });
    res.json(area);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.put('/:id/areas/:areaId', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const area = await callHaWs(inst, { type: 'config/area_registry/update', area_id: req.params.areaId, name: req.body.name });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'area_updated', details: req.params.areaId });
    res.json(area);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.delete('/:id/areas/:areaId', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await callHaWs(inst, { type: 'config/area_registry/delete', area_id: req.params.areaId });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'area_deleted', details: req.params.areaId });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ── Labels ─────────────────────────────────────────────────────────────

router.get('/:id/labels', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const labels = await callHaWs(inst, { type: 'config/label_registry/list' });
    res.json(Array.isArray(labels) ? labels : []);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/labels', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const label = await callHaWs(inst, { type: 'config/label_registry/create', name: req.body.name, color: req.body.color || null });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'label_created', details: req.body.name });
    res.json(label);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.put('/:id/labels/:labelId', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const label = await callHaWs(inst, { type: 'config/label_registry/update', label_id: req.params.labelId, name: req.body.name, color: req.body.color ?? null });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'label_updated', details: req.params.labelId });
    res.json(label);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.delete('/:id/labels/:labelId', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await callHaWs(inst, { type: 'config/label_registry/delete', label_id: req.params.labelId });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'label_deleted', details: req.params.labelId });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ── Zones ──────────────────────────────────────────────────────────────

router.get('/:id/zones', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const states = await haGet(inst, '/api/states');
    const zones = (Array.isArray(states) ? states : [])
      .filter(s => s.entity_id?.startsWith('zone.'))
      .map(s => ({
        entity_id: s.entity_id,
        name: s.attributes?.friendly_name || s.entity_id.replace('zone.', ''),
        latitude: s.attributes?.latitude,
        longitude: s.attributes?.longitude,
        radius: s.attributes?.radius,
        passive: s.attributes?.passive || false,
        icon: s.attributes?.icon,
      }));
    res.json(zones);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/:id/zones', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await haPost(inst, '/api/services/zone/create', req.body);
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'zone_created', details: req.body.name });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.put('/:id/zones/:entityId', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await haPost(inst, '/api/services/zone/edit', { entity_id: req.params.entityId, ...req.body });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'zone_updated', details: req.params.entityId });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.delete('/:id/zones/:entityId', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await haPost(inst, '/api/services/zone/delete', { entity_id: req.params.entityId });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'zone_deleted', details: req.params.entityId });
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default router;
