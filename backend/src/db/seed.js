import bcrypt from 'bcryptjs';
import { getDb } from './index.js';

export async function initDefaultAdmin() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as n FROM users').get();
  if (count.n > 0) return;

  const hash = await bcrypt.hash('changeme', 10);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash);
  console.log('\n========================================');
  console.log('  Harbor first-run setup');
  console.log('  Default credentials: admin / changeme');
  console.log('  Change your password in Settings!');
  console.log('========================================\n');
}
