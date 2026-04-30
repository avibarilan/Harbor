import { api } from '../api/client.js';

const POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 30_000;

export async function runCompanionCommand(instanceId, command, payload, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const body = { command };
  if (payload !== undefined) body.payload = payload;

  const { command_id } = await api.post(`/instances/${instanceId}/companion/command`, body);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const res = await api.get(`/instances/${instanceId}/companion/result/${command_id}`);
    if (res.status === 'done') return res.result;
    if (res.status === 'error') throw new Error(res.error || 'Command failed');
  }
  throw new Error(`Timed out waiting for companion (${timeoutMs / 1000}s)`);
}
