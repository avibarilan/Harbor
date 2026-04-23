import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInstance, callHaWs } from '../utils/haApi.js';
import { logAudit } from '../utils/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/:id/users', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    const users = await callHaWs(inst, { type: 'config/auth/list' });
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/users', async (req, res) => {
  const { name, username, password, is_admin = false } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'name, username, password required' });

  const inst = getInstance(req.params.id);
  try {
    const user = await callHaWs(inst, {
      type: 'config/auth/create',
      name,
      username,
      password,
      group_ids: is_admin ? ['system-admin'] : ['system-users'],
    });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'user_created', details: `User "${username}" created` });
    res.status(201).json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id/users/:user_id', async (req, res) => {
  const inst = getInstance(req.params.id);
  try {
    await callHaWs(inst, { type: 'config/auth/delete', user_id: req.params.user_id });
    logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'user_deleted', details: `User ${req.params.user_id} deleted` });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
