import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 50);
  const offset = (page - 1) * limit;

  const db = getDb();

  const total = db.prepare('SELECT COUNT(*) as n FROM audit_log').get().n;
  const rows = db.prepare(`
    SELECT a.*, i.name as instance_name, s.name as site_name
    FROM audit_log a
    LEFT JOIN instances i ON i.id = a.instance_id
    LEFT JOIN sites s ON s.id = a.site_id
    ORDER BY a.timestamp DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  res.json({ total, page, limit, rows });
});

export default router;
