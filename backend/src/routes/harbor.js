import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import fs from 'fs';
import Docker from 'dockerode';

const router = Router();
router.use(requireAuth);

const DOCKER_IMAGE = 'avibarilan/harbor';
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function getCurrentVersion() {
  return process.env.HARBOR_VERSION || 'Dev';
}

// Returns true if semver a is strictly greater than b (strips leading 'v')
function semverGt(a, b) {
  const parse = v => v.replace(/^v/, '').split('.').map(Number);
  const [aMaj, aMin, aPatch] = parse(a);
  const [bMaj, bMin, bPatch] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPatch > bPatch;
}

async function fetchLatestDockerTag() {
  const res = await fetch(
    'https://hub.docker.com/v2/repositories/avibarilan/harbor/tags?page_size=50',
    { headers: { 'User-Agent': 'Harbor-UpdateChecker/1.0' } }
  );
  if (!res.ok) throw new Error(`Docker Hub API returned ${res.status}`);
  const data = await res.json();
  const semverRe = /^v(\d+\.\d+\.\d+)$/;
  let highest = null;
  for (const tag of (data.results || [])) {
    const m = semverRe.exec(tag.name);
    if (m && (!highest || semverGt(m[1], highest))) highest = m[1];
  }
  if (!highest) throw new Error('No versioned tags found on Docker Hub');
  return highest;
}

async function checkForUpdates() {
  try {
    const latestVersion = await fetchLatestDockerTag();
    const db = getDb();
    const upsert = db.prepare('INSERT OR REPLACE INTO harbor_settings (key, value) VALUES (?, ?)');
    upsert.run('latest_version', JSON.stringify(latestVersion));
    upsert.run('last_update_check', JSON.stringify(new Date().toISOString()));
    console.log(`Harbor update check: current=${getCurrentVersion()}, latest=${latestVersion}`);
  } catch (err) {
    console.warn('Harbor update check failed:', err.message);
  }
}

export function scheduleUpdateCheck() {
  // Delay the first check so the server is fully started
  setTimeout(checkForUpdates, 15_000);
  setInterval(checkForUpdates, SIX_HOURS_MS);
}

function getDocker() {
  return new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
}

async function isDockerAvailable() {
  try {
    await getDocker().ping();
    return true;
  } catch {
    return false;
  }
}

function getContainerId() {
  try {
    return fs.readFileSync('/etc/hostname', 'utf8').trim();
  } catch {
    return null;
  }
}

function getCachedUpdateInfo() {
  const db = getDb();
  const rows = db.prepare(
    "SELECT key, value FROM harbor_settings WHERE key IN ('latest_version', 'latest_release_url', 'last_update_check')"
  ).all();
  const info = {};
  for (const row of rows) {
    try { info[row.key] = JSON.parse(row.value); } catch { info[row.key] = row.value; }
  }
  return info;
}

// GET /api/harbor/version
router.get('/version', async (req, res) => {
  const currentVersion = getCurrentVersion();
  const cached = getCachedUpdateInfo();
  const latestVersion = cached.latest_version || null;
  const isDevMode = currentVersion.toLowerCase() === 'dev';
  const updateAvailable = latestVersion && !isDevMode
    ? semverGt(latestVersion, currentVersion)
    : false;

  res.json({
    version: currentVersion,
    latestVersion,
    updateAvailable,
    releaseUrl: 'https://hub.docker.com/r/avibarilan/harbor/tags',
    lastChecked: cached.last_update_check || null,
    dockerAvailable: await isDockerAvailable(),
  });
});

// POST /api/harbor/check-updates  — manual refresh against Docker Hub
router.post('/check-updates', async (req, res) => {
  try {
    await checkForUpdates();
    const currentVersion = getCurrentVersion();
    const cached = getCachedUpdateInfo();
    const latestVersion = cached.latest_version || null;
    const isDevMode = currentVersion.toLowerCase() === 'dev';
    const updateAvailable = latestVersion && !isDevMode
      ? semverGt(latestVersion, currentVersion)
      : false;

    res.json({
      version: currentVersion,
      latestVersion,
      updateAvailable,
      releaseUrl: 'https://hub.docker.com/r/avibarilan/harbor/tags',
      lastChecked: cached.last_update_check || null,
      dockerAvailable: await isDockerAvailable(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/harbor/update  — pull new image and hot-swap the container
router.post('/update', async (req, res) => {
  if (!(await isDockerAvailable())) {
    return res.status(503).json({ error: 'Docker socket not available. Manual update required.' });
  }

  const cached = getCachedUpdateInfo();
  const latestVersion = cached.latest_version;
  if (!latestVersion) {
    return res.status(400).json({ error: 'No update information available. Check for updates first.' });
  }

  const currentVersion = getCurrentVersion();
  if (currentVersion !== 'dev' && !semverGt(latestVersion, currentVersion)) {
    return res.status(400).json({ error: 'Already running the latest version.' });
  }

  const newImageName = `${DOCKER_IMAGE}:latest`;

  try {
    const docker = getDocker();

    // 1. Pull the new image (may take 30–120 s on slow connections)
    console.log(`Harbor: pulling ${newImageName}…`);
    await new Promise((resolve, reject) => {
      docker.pull(newImageName, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (err) => (err ? reject(err) : resolve()));
      });
    });
    console.log('Harbor: image pull complete');

    // 2. Inspect the current container to replicate its config
    const containerId = getContainerId();
    if (!containerId) {
      return res.status(500).json({ error: 'Could not determine current container ID.' });
    }

    const container = docker.getContainer(containerId);
    const inspect = await container.inspect();
    const containerName = inspect.Name.replace(/^\//, '');

    // 3. Build the config for the replacement container
    const newContainerConfig = {
      name: containerName,
      Image: newImageName,
      Env: inspect.Config.Env,
      ExposedPorts: inspect.Config.ExposedPorts,
      Labels: inspect.Config.Labels,
      HostConfig: {
        Binds: inspect.HostConfig.Binds,
        PortBindings: inspect.HostConfig.PortBindings,
        RestartPolicy: inspect.HostConfig.RestartPolicy,
        NetworkMode: inspect.HostConfig.NetworkMode,
      },
    };

    logAudit({
      action: 'harbor_update_started',
      details: JSON.stringify({ from: currentVersion, to: latestVersion }),
    });

    // 4. Launch the update-runner helper using the NEW image.
    //    The helper sleeps 8 s, stops the old container, removes it, and starts a new one.
    //    It runs in its own container (outside our PID namespace) so it survives our shutdown.
    const configB64 = Buffer.from(JSON.stringify(newContainerConfig)).toString('base64');

    const helper = await docker.createContainer({
      Image: newImageName,
      Cmd: ['node', 'src/updateRunner.js'],
      Env: [
        `OLD_CONTAINER_ID=${containerId}`,
        `NEW_CONTAINER_CONFIG_B64=${configB64}`,
      ],
      HostConfig: {
        Binds: ['/var/run/docker.sock:/var/run/docker.sock'],
        AutoRemove: true,
      },
    });
    await helper.start();

    // 5. Respond before the helper kills us (~8 s from now)
    res.json({ ok: true, version: latestVersion });
  } catch (err) {
    console.error('Harbor update failed:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

export default router;
