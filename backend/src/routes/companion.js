import { Router } from 'express';
import { randomBytes } from 'crypto';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const ONLINE_THRESHOLD_MS = 60_000;
const COMMAND_CACHE_SECONDS = 30;

// ── Unauthenticated: companion-facing routes ───────────────────────────────
export const companionPublicRouter = Router();

// Generate setup token — JWT-authenticated, called by Harbor frontend
companionPublicRouter.post('/token/:instanceId', requireAuth, (req, res) => {
  const harborPublicUrl = process.env.HARBOR_PUBLIC_URL || '';
  if (!harborPublicUrl) {
    return res.status(500).json({ error: 'HARBOR_PUBLIC_URL is not configured on the server' });
  }

  const db = getDb();
  const inst = db.prepare('SELECT id, site_id FROM instances WHERE id = ?').get(req.params.instanceId);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });

  // Delete any existing unused tokens for this instance
  db.prepare('DELETE FROM companion_tokens WHERE instance_id = ? AND used = 0').run(inst.id);

  // Generate a new shared secret; store it immediately so the companion can auth after registering
  const secret = randomBytes(32).toString('hex');
  db.prepare('UPDATE instances SET companion_secret = ?, companion_enabled = 0 WHERE id = ?').run(secret, inst.id);

  const payload = JSON.stringify({ harbor_url: harborPublicUrl, instance_id: inst.id, secret });
  const token = Buffer.from(payload).toString('base64');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO companion_tokens (instance_id, token, expires_at) VALUES (?, ?, ?)').run(inst.id, token, expiresAt);
  logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'companion_token_generated', details: 'Setup token generated' });

  res.json({ token, expires_at: expiresAt });
});

// Companion exchanges setup token on first startup
companionPublicRouter.post('/register', (req, res) => {
  const { setup_token, companion_version } = req.body ?? {};
  if (!setup_token) return res.status(400).json({ error: 'setup_token required' });

  let payload;
  try {
    payload = JSON.parse(Buffer.from(setup_token, 'base64').toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid token format' });
  }

  const { instance_id, secret } = payload;
  if (!instance_id || !secret) return res.status(400).json({ error: 'Invalid token payload' });

  const db = getDb();
  const tokenRow = db.prepare(
    "SELECT id FROM companion_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')"
  ).get(setup_token);

  if (!tokenRow) return res.status(401).json({ error: 'Token not found, already used, or expired' });

  db.prepare('UPDATE companion_tokens SET used = 1 WHERE id = ?').run(tokenRow.id);

  const inst = db.prepare('SELECT id, site_id FROM instances WHERE id = ?').get(instance_id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });

  db.prepare(`
    UPDATE instances SET
      companion_enabled = 1,
      companion_secret = ?,
      companion_last_seen = datetime('now'),
      companion_version = ?
    WHERE id = ?
  `).run(secret, companion_version || null, inst.id);

  logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'companion_registered', details: `Companion v${companion_version || 'unknown'} registered via token` });
  res.json({ success: true, instance_id: inst.id, poll_interval_seconds: 10 });
});

// Companion polls for pending commands
companionPublicRouter.get('/poll/:instanceId', (req, res) => {
  const db = getDb();
  const secret = req.headers['x-harbor-secret'];
  if (!secret) return res.status(401).json({ error: 'Missing X-Harbor-Secret' });

  const inst = db.prepare('SELECT id, companion_secret FROM instances WHERE id = ?').get(req.params.instanceId);
  if (!inst || inst.companion_secret !== secret) return res.status(401).json({ error: 'Invalid secret' });

  const version = req.headers['x-companion-version'] || null;
  db.prepare("UPDATE instances SET companion_last_seen = datetime('now'), companion_version = COALESCE(?, companion_version) WHERE id = ?").run(version, inst.id);

  const cmd = db.prepare(
    "SELECT id, command, payload FROM companion_commands WHERE instance_id = ? AND status = 'pending' ORDER BY id ASC LIMIT 1"
  ).get(inst.id);

  if (cmd) {
    db.prepare("UPDATE companion_commands SET status = 'processing' WHERE id = ?").run(cmd.id);
    return res.json({ command_id: cmd.id, command: cmd.command, payload: cmd.payload ? JSON.parse(cmd.payload) : null });
  }

  res.json({ command_id: null });
});

// Companion posts command result
companionPublicRouter.post('/result/:commandId', (req, res) => {
  const { instance_id, status, result, error } = req.body ?? {};
  if (!instance_id) return res.status(400).json({ error: 'instance_id required' });

  const db = getDb();
  const secret = req.headers['x-harbor-secret'];
  const inst = db.prepare('SELECT id, companion_secret FROM instances WHERE id = ?').get(instance_id);
  if (!inst || inst.companion_secret !== secret) return res.status(401).json({ error: 'Invalid secret' });

  const cmd = db.prepare('SELECT id, instance_id FROM companion_commands WHERE id = ?').get(req.params.commandId);
  if (!cmd || cmd.instance_id !== inst.id) return res.status(404).json({ error: 'Command not found' });

  db.prepare(`
    UPDATE companion_commands SET
      status = ?,
      result = ?,
      error = ?,
      completed_at = datetime('now')
    WHERE id = ?
  `).run(
    status === 'error' ? 'error' : 'done',
    result !== undefined ? JSON.stringify(result) : null,
    error || null,
    cmd.id,
  );

  res.json({ success: true });
});

// ── JWT-authenticated instance-scoped companion routes ─────────────────────
const router = Router();
router.use(requireAuth);

router.delete('/:id/companion', (req, res) => {
  const db = getDb();
  const inst = db.prepare('SELECT id, site_id FROM instances WHERE id = ?').get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });

  db.prepare('UPDATE instances SET companion_enabled = 0, companion_secret = NULL, companion_last_seen = NULL, companion_version = NULL WHERE id = ?').run(inst.id);
  db.prepare('DELETE FROM companion_tokens WHERE instance_id = ? AND used = 0').run(inst.id);
  logAudit({ instanceId: inst.id, siteId: inst.site_id, action: 'companion_disabled', details: 'Companion disabled' });
  res.json({ ok: true });
});

router.get('/:id/companion/status', (req, res) => {
  const db = getDb();
  const inst = db.prepare('SELECT id, companion_enabled, companion_last_seen, companion_version FROM instances WHERE id = ?').get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });

  const lastSeen = inst.companion_last_seen ? new Date(inst.companion_last_seen) : null;
  const online = !!(lastSeen && Date.now() - lastSeen.getTime() < ONLINE_THRESHOLD_MS);

  res.json({
    enabled: !!inst.companion_enabled,
    online,
    last_seen: inst.companion_last_seen || null,
    version: inst.companion_version || null,
  });
});

router.post('/:id/companion/command', (req, res) => {
  const { command, payload } = req.body ?? {};
  if (!command) return res.status(400).json({ error: 'command required' });

  const db = getDb();
  const inst = db.prepare('SELECT id, site_id, companion_enabled, companion_last_seen FROM instances WHERE id = ?').get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Instance not found' });
  if (!inst.companion_enabled) return res.status(400).json({ error: 'Companion not connected' });

  const lastSeen = inst.companion_last_seen ? new Date(inst.companion_last_seen) : null;
  if (!lastSeen || Date.now() - lastSeen.getTime() >= ONLINE_THRESHOLD_MS) {
    return res.status(503).json({ error: 'Companion offline' });
  }

  // Return cached result for GET_* commands if completed within the last 30s
  if (command.startsWith('GET_')) {
    const cached = db.prepare(`
      SELECT id FROM companion_commands
      WHERE instance_id = ? AND command = ? AND status = 'done'
        AND completed_at > datetime('now', '-${COMMAND_CACHE_SECONDS} seconds')
      ORDER BY id DESC LIMIT 1
    `).get(inst.id, command);
    if (cached) return res.json({ command_id: cached.id, cached: true });
  }

  const result = db.prepare(
    'INSERT INTO companion_commands (instance_id, command, payload) VALUES (?, ?, ?)'
  ).run(inst.id, command, payload ? JSON.stringify(payload) : null);

  res.json({ command_id: result.lastInsertRowid });
});

router.get('/:id/companion/result/:commandId', (req, res) => {
  const db = getDb();
  const cmd = db.prepare('SELECT * FROM companion_commands WHERE id = ? AND instance_id = ?').get(
    req.params.commandId, req.params.id
  );
  if (!cmd) return res.status(404).json({ error: 'Command not found' });

  res.json({
    status: cmd.status,
    result: cmd.result ? JSON.parse(cmd.result) : null,
    error: cmd.error || null,
    created_at: cmd.created_at,
    completed_at: cmd.completed_at || null,
  });
});

export default router;
