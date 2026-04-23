import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = getDb().prepare("SELECT key, value FROM harbor_settings WHERE key NOT LIKE 'backup_schedule_%'").all();
  const settings = {};
  for (const row of rows) {
    try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
  }
  res.json(settings);
});

router.put('/', (req, res) => {
  const db = getDb();
  const upsert = db.prepare('INSERT OR REPLACE INTO harbor_settings (key, value) VALUES (?, ?)');

  const updates = db.transaction(() => {
    for (const [key, value] of Object.entries(req.body)) {
      if (key.startsWith('backup_schedule_')) continue; // managed separately
      upsert.run(key, JSON.stringify(value));
    }
  });
  updates();
  res.json({ ok: true });
});

export default router;
