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

async function run() {
  console.log('[updateRunner] Harbor update helper started');
  console.log(`[updateRunner] Will replace container ${OLD_CONTAINER_ID} with image ${newContainerConfig.Image}`);

  // Wait for old Harbor to finish sending its HTTP response to the browser
  await new Promise(r => setTimeout(r, 8000));

  // Stop old container
  console.log('[updateRunner] Stopping old container...');
  const old = docker.getContainer(OLD_CONTAINER_ID);
  try {
    await old.stop({ t: 15 });
    console.log('[updateRunner] Old container stopped');
  } catch (err) {
    console.log(`[updateRunner] Stop error (may already be stopped): ${err.message}`);
  }

  // Remove old container
  try {
    await old.remove();
    console.log('[updateRunner] Old container removed');
  } catch (err) {
    console.log(`[updateRunner] Remove error, trying force: ${err.message}`);
    try { await old.remove({ force: true }); } catch {}
  }

  // Create and start new container
  console.log(`[updateRunner] Creating new container "${newContainerConfig.name}"...`);
  const newContainer = await docker.createContainer(newContainerConfig);
  await newContainer.start();

  console.log('[updateRunner] Harbor updated and restarted successfully!');
}

run().catch(err => {
  console.error('[updateRunner] Fatal:', err.message);
  process.exit(1);
});
