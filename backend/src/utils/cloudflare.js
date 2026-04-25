import dns from 'dns';
import { promisify } from 'util';
import { getDb } from '../db/index.js';

const CACHE_KEY = 'cloudflare_ip_ranges';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const dnsLookup = promisify(dns.lookup);

function ipToUint32(ip) {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) >>> 0) + parseInt(octet, 10), 0) >>> 0;
}

function ipv4InCidr(ip, cidr) {
  const [subnet, bitStr] = cidr.split('/');
  const bits = parseInt(bitStr, 10);
  if (bits === 0) return true;
  const mask = (~0 << (32 - bits)) >>> 0;
  return (ipToUint32(ip) & mask) === (ipToUint32(subnet) & mask);
}

async function getCloudflareRanges() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM harbor_settings WHERE key = ?").get(CACHE_KEY);
  if (row) {
    try {
      const { ranges, ts } = JSON.parse(row.value);
      if (Date.now() - ts < CACHE_TTL_MS) return ranges;
    } catch {}
  }

  try {
    const [v4, v6] = await Promise.allSettled([
      fetch('https://www.cloudflare.com/ips-v4').then(r => r.text()),
      fetch('https://www.cloudflare.com/ips-v6').then(r => r.text()),
    ]);
    const ranges = [
      ...(v4.status === 'fulfilled' ? v4.value.trim().split('\n') : []),
      ...(v6.status === 'fulfilled' ? v6.value.trim().split('\n') : []),
    ].map(r => r.trim()).filter(Boolean);

    db.prepare("INSERT OR REPLACE INTO harbor_settings (key, value) VALUES (?, ?)").run(
      CACHE_KEY, JSON.stringify({ ranges, ts: Date.now() })
    );
    return ranges;
  } catch (e) {
    console.error('[cloudflare] failed to fetch IP ranges:', e.message);
    return [];
  }
}

export async function checkCloudflare(instanceUrl) {
  try {
    const { hostname } = new URL(instanceUrl);
    if (/^[\d.]+$/.test(hostname) || hostname === 'localhost') return false;

    let address, family;
    try {
      ({ address, family } = await dnsLookup(hostname, { family: 4 }));
    } catch {
      ({ address, family } = await dnsLookup(hostname));
    }
    if (family !== 4) return false;

    const ranges = await getCloudflareRanges();
    return ranges.some(cidr => cidr.includes('.') && ipv4InCidr(address, cidr));
  } catch {
    return false;
  }
}
