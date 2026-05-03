// Harbor self-update runner
// Invoked inside a short-lived helper container spawned by the update route.
// The helper uses the NEW Harbor image so this file must live in every release.
//
// Required env vars:
//   OLD_CONTAINER_ID         - ID of the currently-running Harbor container to replace
//   NEW_CONTAINER_CONFIG_B64 - base64-encoded JSON of the new container create config

import Docker from 'dockerode';

const OLD_CONTAINER_ID = process.env.OLD_CONTAINER_ID;
const configB64 = process.env.NEW_CONTAINER_CONFIG_B64;

if (!OLD_CONTAINER_ID || !configB64) {
  console.error('[updateRunner] Missing required env vars OLD_CONTAINER_ID / NEW_CONTAINER_CONFIG_B64');
  process.exit(1);
}

const newContainerConfig = JSON.parse(Buffer.from(configB64, 'base64').toString('utf8'));
const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

// Locate the Harbor container to replace. Tries OLD_CONTAINER_ID first,
// then falls back to name "harbor" and image-based discovery.
async function findOldContainer() {
  // Primary: use the ID passed from the update route
  try {
    const c = docker.getContainer(OLD_CONTAINER_ID);
    const info = await c.inspect();
    console.log(`[updateRunner] Located container "${info.Name}" (${OLD_CONTAINER_ID.slice(0, 12)}) status=${info.State.Status}`);
    return c;
  } catch (err) {
    console.warn(`[updateRunner] Direct ID lookup failed: ${err.message}`);
  }

  console.log('[updateRunner] Falling back to name/image discovery...');
  const all = await docker.listContainers({ all: true });

  // Fallback 1: name "harbor"
  const byName = all.find(c => c.Names?.some(n => n === '/harbor'));
  if (byName) {
    console.log(`[updateRunner] Fallback: found by name "harbor" (${byName.Id.slice(0, 12)})`);
    return docker.getContainer(byName.Id);
  }

  // Fallback 2: name contains the first 12 chars of OLD_CONTAINER_ID
  const byIdPrefix = all.find(c => c.Names?.some(n => n.includes(OLD_CONTAINER_ID.slice(0, 12))));
  if (byIdPrefix) {
    console.log(`[updateRunner] Fallback: found by ID prefix (${byIdPrefix.Id.slice(0, 12)})`);
    return docker.getContainer(byIdPrefix.Id);
  }

  // Fallback 3: image contains "avibarilan/harbor"
  const byImage = all.find(c => c.Image?.includes('avibarilan/harbor'));
  if (byImage) {
    console.log(`[updateRunner] Fallback: found by image "avibarilan/harbor" (${byImage.Id.slice(0, 12)})`);
    return docker.getContainer(byImage.Id);
  }

  return null;
}

async function run() {
  console.log('[updateRunner] Harbor update helper started');
  console.log(`[updateRunner] Old container ID : ${OLD_CONTAINER_ID.slice(0, 12)}`);
  console.log(`[updateRunner] New image        : ${newContainerConfig.Image}`);
  console.log(`[updateRunner] Container name   : ${newContainerConfig.name}`);

  // Wait for old Harbor to finish sending its HTTP response to the browser
  console.log('[updateRunner] Waiting 8 s for response delivery...');
  await new Promise(r => setTimeout(r, 8000));

  // ── Step 1: Locate the old container ──────────────────────────────────────
  const old = await findOldContainer();
  if (!old) {
    console.error('[updateRunner] Cannot locate Harbor container — aborting');
    process.exit(1);
  }

  // ── Step 2: Stop the old container ────────────────────────────────────────
  console.log('[updateRunner] Stopping old container...');
  try {
    await old.stop({ t: 15 });
    console.log('[updateRunner] Old container stopped');
  } catch (err) {
    console.warn(`[updateRunner] Stop warning (may already be stopped): ${err.message}`);
  }

  // ── Step 3: Start on new image — primary path ─────────────────────────────
  // We remove the old container and recreate from the freshly-pulled tag so
  // Docker resolves the image to the new digest. container.restart() is NOT
  // used because it restarts in-place against the old image digest.
  console.log('[updateRunner] Removing old container...');
  try {
    await old.remove();
    console.log('[updateRunner] Old container removed');
  } catch (err) {
    console.warn(`[updateRunner] Remove warning: ${err.message} — will try force-remove`);
    try {
      await old.remove({ force: true });
      console.log('[updateRunner] Old container force-removed');
    } catch (err2) {
      console.warn(`[updateRunner] Force-remove also failed: ${err2.message}`);
    }
  }

  console.log(`[updateRunner] Creating new container "${newContainerConfig.name}"...`);
  try {
    const newC = await docker.createContainer(newContainerConfig);
    console.log(`[updateRunner] New container created (${newC.id.slice(0, 12)}), starting...`);
    await newC.start();
    console.log('[updateRunner] Harbor updated and started successfully!');
    return;
  } catch (err) {
    console.error(`[updateRunner] Create/start failed: ${err.message}`);
  }

  // ── Step 4: Fallback — force-remove anything with the same name, then recreate ──
  console.log('[updateRunner] Fallback: force-removing any container with the same name...');
  try {
    const all = await docker.listContainers({ all: true });
    const stale = all.find(c => c.Names?.some(n => n === `/${newContainerConfig.name}`));
    if (stale) {
      await docker.getContainer(stale.Id).remove({ force: true });
      console.log(`[updateRunner] Stale container removed (${stale.Id.slice(0, 12)})`);
    }
  } catch (err) {
    console.warn(`[updateRunner] Fallback cleanup failed: ${err.message}`);
  }

  console.log(`[updateRunner] Fallback: creating "${newContainerConfig.name}" again...`);
  try {
    const newC = await docker.createContainer(newContainerConfig);
    await newC.start();
    console.log('[updateRunner] Harbor started via fallback path!');
  } catch (err) {
    console.error(`[updateRunner] Fatal: fallback create/start failed: ${err.message}`);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('[updateRunner] Unhandled error:', err.message);
  process.exit(1);
});
