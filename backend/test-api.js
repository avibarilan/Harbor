// Harbor Supervisor API diagnostic script
// Run from the backend/ directory:  node test-api.js
//
// Loads ENCRYPTION_KEY + DATA_DIR from .env (if present) or the existing env.
// Reads the first instance from harbor.db, decrypts its token, then fires two
// requests and prints the full response — status, headers, and body.

import 'dotenv/config';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Decrypt ────────────────────────────────────────────────────────────────

function decrypt(ciphertext) {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      `ENCRYPTION_KEY is missing or too short (got ${key?.length ?? 0} chars, need 32).\n` +
      `Set it in backend/.env or export it before running this script.`
    );
  }
  const [ivHex, encHex] = ciphertext.split(':');
  const iv  = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(key.slice(0, 32), 'utf8'),
    iv
  );
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8').trim();
}

// ── Database ───────────────────────────────────────────────────────────────

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const dbPath  = path.join(dataDir, 'harbor.db');

console.log(`\n=== Harbor Supervisor API diagnostic ===`);
console.log(`DB path : ${dbPath}`);
console.log(`Node    : ${process.version}`);
console.log(`ENCRYPTION_KEY set: ${!!process.env.ENCRYPTION_KEY} (len=${process.env.ENCRYPTION_KEY?.length ?? 0})`);

let db;
try {
  db = new Database(dbPath, { readonly: true });
} catch (e) {
  console.error(`\n✗ Cannot open DB: ${e.message}`);
  console.error(`  Make sure DATA_DIR is set correctly or run from backend/.`);
  process.exit(1);
}

const instances = db.prepare('SELECT * FROM instances').all();
console.log(`\nInstances in DB: ${instances.length}`);

if (!instances.length) {
  console.error('✗ No instances found — adopt at least one instance first.');
  process.exit(1);
}

// Show all instances so the user can pick
instances.forEach((i, idx) => {
  console.log(`  [${idx}] id=${i.id}  name="${i.name}"  url="${i.url}"  type="${i.installation_type}"  status="${i.status}"`);
});

const inst = instances[0];
console.log(`\nUsing instance [0]: "${inst.name}" @ ${inst.url}`);

// ── Decrypt token ──────────────────────────────────────────────────────────

let token;
try {
  token = decrypt(inst.token_encrypted);
} catch (e) {
  console.error(`\n✗ Token decryption failed: ${e.message}`);
  process.exit(1);
}

console.log(`Token length    : ${token.length} chars`);
console.log(`Token prefix    : ${token.slice(0, 20)}...`);
console.log(`Token suffix    : ...${token.slice(-10)}`);
console.log(`Has whitespace? : leading=${/^\s/.test(token)}, trailing=${/\s$/.test(token)}`);
console.log(`Authorization   : Bearer ${token.slice(0, 20)}...[${token.length} chars total]`);

// ── HTTP helper ────────────────────────────────────────────────────────────

async function probe(label, url) {
  console.log(`\n--- ${label} ---`);
  console.log(`GET ${url}`);
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    console.error(`✗ Network error: ${e.message}`);
    return;
  }

  console.log(`Status : ${res.status} ${res.statusText}`);

  // Print all response headers
  console.log('Headers:');
  for (const [k, v] of res.headers.entries()) {
    console.log(`  ${k}: ${v}`);
  }

  const body = await res.text();
  console.log(`Body (first 1000 chars):\n${body.slice(0, 1000)}`);
  if (body.length > 1000) console.log(`  … (${body.length - 1000} more chars truncated)`);
}

// ── Run probes ─────────────────────────────────────────────────────────────

await probe('Standard HA REST — /api/config', `${inst.url}/api/config`);
await probe('Supervisor proxy — /api/hassio/info', `${inst.url}/api/hassio/info`);
await probe('Supervisor proxy — /api/hassio/core/info', `${inst.url}/api/hassio/core/info`);
await probe('Supervisor proxy — /api/hassio/os/info', `${inst.url}/api/hassio/os/info`);

console.log('\n=== Done ===\n');
