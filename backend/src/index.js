import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

import { initDb } from './db/index.js';
import { initDefaultAdmin } from './db/seed.js';
import { WebSocketManager } from './websocket/WebSocketManager.js';
import { attachHarborWs } from './websocket/harborWs.js';

import authRoutes from './routes/auth.js';
import sitesRoutes from './routes/sites.js';
import locationsRoutes from './routes/locations.js';
import instancesRoutes from './routes/instances.js';
import entitiesRoutes from './routes/entities.js';
import automationsRoutes from './routes/automations.js';
import scriptsRoutes from './routes/scripts.js';
import scenesRoutes from './routes/scenes.js';
import usersRoutes from './routes/users.js';
import addonsRoutes from './routes/addons.js';
import updatesRoutes from './routes/updates.js';
import backupsRoutes from './routes/backups.js';
import systemRoutes from './routes/system.js';
import searchRoutes from './routes/search.js';
import auditRoutes from './routes/audit.js';
import settingsRoutes from './routes/settings.js';
import harborRoutes, { scheduleUpdateCheck } from './routes/harbor.js';
import companionRoutes, { companionPublicRouter } from './routes/companion.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/instances', instancesRoutes);
app.use('/api/instances', entitiesRoutes);
app.use('/api/instances', automationsRoutes);
app.use('/api/instances', scriptsRoutes);
app.use('/api/instances', scenesRoutes);
app.use('/api/instances', usersRoutes);
app.use('/api/instances', addonsRoutes);
app.use('/api/instances', updatesRoutes);
app.use('/api/instances', backupsRoutes);
app.use('/api/instances', systemRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/harbor', harborRoutes);
app.use('/api/companion', companionPublicRouter);
app.use('/api/instances', companionRoutes);

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

async function start() {
  initDb();
  await initDefaultAdmin();

  const wsManager = new WebSocketManager();
  wsManager.start();

  attachHarborWs(httpServer, wsManager);

  httpServer.listen(PORT, () => {
    console.log(`Harbor running on http://localhost:${PORT}`);
    scheduleUpdateCheck();
  });
}

start().catch(err => {
  console.error('Failed to start Harbor:', err);
  process.exit(1);
});
