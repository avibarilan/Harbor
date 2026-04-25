import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

// Load .env if present
try {
  const envPath = new URL('.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {}

const ALGORITHM = 'aes-256-cbc';

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) throw new Error('ENCRYPTION_KEY env var missing or too short (need 32 chars)');
  return Buffer.from(key.slice(0, 32), 'utf8');
}

function decrypt(ciphertext) {
  const [ivHex, encHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

const dataDir = process.env.DATA_DIR || './data';
const db = new Database(path.join(dataDir, 'harbor.db'), { readonly: true });

const instance = db.prepare('SELECT * FROM instances ORDER BY id LIMIT 1').get();
if (!instance) {
  console.error('No instances found in database.');
  process.exit(1);
}

console.log(`Instance: [${instance.id}] ${instance.name} — ${instance.url}`);
console.log(`Installation type: ${instance.installation_type}`);

const token = decrypt(instance.token_encrypted);
const url = `${instance.url.replace(/\/$/, '')}/api/hassio/backups`;
console.log(`\nGET ${url}\n`);

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
});

console.log(`Status: ${res.status} ${res.statusText}`);
const body = await res.text();
try {
  console.log('\nBody (parsed JSON):');
  console.log(JSON.stringify(JSON.parse(body), null, 2));
} catch {
  console.log('\nBody (raw):');
  console.log(body);
}
