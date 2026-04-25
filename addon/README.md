# Harbor Companion Add-on

Harbor Companion is a Home Assistant add-on that bridges Harbor Fleet Manager and the Home Assistant Supervisor API. It runs inside Home Assistant and exposes a local HTTP API that Harbor calls remotely, enabling backup management, system updates, add-on control, logs, and host reboot/shutdown — features that require Supervisor access and are not available through an external Long-Lived Access Token.

## What it enables

When Harbor Companion is installed and configured, the following Harbor features become available for that instance:

- **Backups tab** — list, create, download, and restore full backups
- **Updates tab** — view and trigger Core, Supervisor, OS, and add-on updates
- **Add-ons tab** — list installed add-ons and restart them
- **System tab** — Supervisor version, OS version, hostname, and recent HA logs
- **Reboot / Shutdown** — host-level power control buttons in the instance header and dashboard card

## Installation

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**
2. Click the menu (⋮) → **Repositories** and add:
   ```
   https://github.com/avibarilan/Harbor
   ```
3. Find **Harbor Companion** in the store and click **Install**
4. Start the add-on and open the **Log** tab
5. Copy the secret printed in the logs — it looks like:
   ```
   X-Harbor-Secret: a3f9c2...
   ```

## Configuration in Harbor

1. Open the instance in Harbor → **Settings tab** → **Harbor Companion** section
2. Enter the Companion URL (see below for routing options)
3. Paste the secret from the add-on logs
4. Click **Connect companion** — Harbor will test connectivity before saving

## Companion URL options

### Direct IP access (simplest)
If Harbor can reach the Home Assistant host directly:
```
http://<ha-ip-address>:7779
```

### Cloudflare Tunnel (path-based routing)
If the instance is behind a Cloudflare Tunnel, add a path-based ingress rule in your tunnel config (`config.yml`):

```yaml
ingress:
  - hostname: your-ha-domain.com
    path: /harbor-companion
    service: http://localhost:7779
  - hostname: your-ha-domain.com
    service: http://localhost:8123
```

Then use `https://your-ha-domain.com/harbor-companion` as the Companion URL in Harbor.

### Nginx / Traefik proxy
Route `/harbor-companion` to `http://localhost:7779` and strip the prefix before forwarding.

## Security

- The add-on generates a cryptographically random 64-character hex secret on first run
- The secret is stored in `/data/harbor_secret.txt` (persisted across restarts and updates)
- Every request from Harbor must include the `X-Harbor-Secret` header
- Requests without a valid secret return `401 Unauthorized` immediately
- The `/health` endpoint is unauthenticated (used to verify connectivity)

## Troubleshooting

**"Companion connectivity test failed"**
- Verify the URL is reachable from Harbor's host (not from inside HA)
- For Cloudflare Tunnel: confirm the path rule is saved and the tunnel is running
- For direct IP: confirm port 7779 is open or forwarded

**Secret doesn't match**
- Open the add-on Log tab in HA — the secret is printed on every startup
- If you regenerated it: delete `/data/harbor_secret.txt` via SSH and restart the add-on

**Supervisor calls fail with 401**
- The add-on uses the `SUPERVISOR_TOKEN` environment variable injected by HA automatically
- Reinstalling the add-on reissues the token

**Backup download is slow**
- Backups are streamed through Harbor's backend — large backups will take time depending on network speed
