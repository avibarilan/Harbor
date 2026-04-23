import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

export function attachHarborWs(server, wsManager) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (client, req) => {
    // Authenticate via ?token= query param
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      client.close(4001, 'Unauthorized');
      return;
    }

    // Send initial status snapshot
    const statuses = wsManager.getAllStatuses();
    client.send(JSON.stringify({ type: 'status_snapshot', statuses }));

    // Relay status updates
    const onStatus = (data) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ type: 'status_update', ...data }));
      }
    };

    // Relay state changes
    const onState = (data) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ type: 'state_changed', ...data }));
      }
    };

    wsManager.on('status_update', onStatus);
    wsManager.on('state_changed', onState);

    client.on('close', () => {
      wsManager.off('status_update', onStatus);
      wsManager.off('state_changed', onState);
    });

    client.on('error', () => {});
  });
}
