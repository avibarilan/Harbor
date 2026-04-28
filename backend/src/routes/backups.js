import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Backups are now served via the companion command queue (GET_BACKUPS, BACKUP_NOW)
router.get('/:id/backups', (_req, res) => res.json([]));
router.post('/:id/backups', (_req, res) => res.status(503).json({ error: 'Use companion command queue' }));
router.get('/:id/backups/:slug/info', (_req, res) => res.status(503).json({ error: 'Use companion command queue' }));
router.post('/:id/backups/:slug/restore', (_req, res) => res.status(503).json({ error: 'Use companion command queue' }));
router.delete('/:id/backups/:slug', (_req, res) => res.status(503).json({ error: 'Use companion command queue' }));
router.get('/:id/backups/:slug/download', (_req, res) => res.status(503).json({ error: 'Backup download not supported in poll mode' }));

export default router;
