import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Add-ons are now served via the companion command queue (GET_ADDONS, UPDATE_ADDON)
router.get('/:id/addons', (_req, res) => res.json([]));
router.post('/:id/addons/:slug/restart', (_req, res) => res.status(503).json({ error: 'Use companion command queue' }));
router.post('/:id/addons/:slug/start', (_req, res) => res.status(503).json({ error: 'Use companion command queue' }));
router.post('/:id/addons/:slug/stop', (_req, res) => res.status(503).json({ error: 'Use companion command queue' }));
router.delete('/:id/addons/:slug', (_req, res) => res.status(503).json({ error: 'Use companion command queue' }));

export default router;
