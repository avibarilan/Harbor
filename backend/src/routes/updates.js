import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Updates are now served via the companion command queue (GET_UPDATES, UPDATE_CORE, etc.)
// These stubs prevent 404s from old bookmarks/clients.
router.get('/:id/updates', (_req, res) => res.json({ supervisor_unavailable: true }));
router.post('/:id/updates/core', (_req, res) => res.status(503).json({ error: 'Use companion command queue' }));
router.post('/:id/updates/supervisor', (_req, res) => res.status(503).json({ error: 'Use companion command queue' }));
router.post('/:id/updates/os', (_req, res) => res.status(503).json({ error: 'Use companion command queue' }));
router.post('/:id/updates/addon/:slug', (_req, res) => res.status(503).json({ error: 'Use companion command queue' }));

export default router;
