import { getDb } from '../db/index.js';

export function logAudit({ instanceId = null, siteId = null, action, details = '' }) {
  getDb()
    .prepare('INSERT INTO audit_log (instance_id, site_id, action, details) VALUES (?, ?, ?, ?)')
    .run(instanceId, siteId, action, details);
}
