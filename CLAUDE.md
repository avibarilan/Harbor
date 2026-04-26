# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Harbor Is

Harbor is a fleet management platform for smart home service providers managing multiple Home Assistant (HA) installations. It follows the Unifi Site Manager model: own the fleet layer UI, and for things that can't be rebuilt cleanly (Zigbee pairing, Lovelace dashboard editing, YAML files), provide an "Open in Home Assistant" button. The two-level hierarchy is **Sites** (a customer/location) containing one or more **Instances** (individual HA installations).

## Development Commands

```bash
# Backend — runs on http://localhost:3000
cd backend && npm install && npm run dev   # nodemon, auto-reloads

# Frontend — runs on http://localhost:5173 (proxies /api and /ws to :3000)
cd frontend && npm install && npm run dev  # Vite dev server

# Build for production (outputs to backend/public/)
cd frontend && npm run build
```

**Required env vars** (copy `.env.example` to `backend/.env`):
- `JWT_SECRET` — any long random string
- `ENCRYPTION_KEY` — exactly 32 characters (AES-256 key for LLAT tokens)
- `DATA_DIR` — defaults to `./data` (SQLite lives here as `harbor.db`)

On first run with no users in the DB, the default admin account `admin / changeme` is printed to the console and created automatically.

## Architecture

### Monorepo layout
- `backend/` — Node.js + Express, ES modules (`"type": "module"`), entry point `src/index.js`
- `frontend/` — React + Vite, entry point `src/main.jsx`
- Production: `npm run build` in `/frontend` outputs to `backend/public/`; Express serves it as static files with a catch-all SPA fallback

### Backend key patterns

**Database** (`backend/src/db/index.js`): single `better-sqlite3` instance, WAL mode, foreign keys on. Always get it via `getDb()` — never import the `db` variable directly. Schema is created inline in `initDb()`. Post-v1 column additions are done via `ALTER TABLE` with a `try/catch` immediately after schema creation (SQLite has no `IF NOT EXISTS` for `ADD COLUMN`).

**instances table columns**: `id, site_id, name, url, token_encrypted, installation_type, status, last_seen, ha_version, cloudflare_proxied, companion_enabled, companion_ingress_token, created_at`. The `cloudflare_proxied` column (INTEGER 0/1) was added in v1.1 via migration. The `companion_enabled` (INTEGER 0/1) and `companion_ingress_token` (TEXT, the HA Ingress token for the companion add-on) columns were added in v1.3 via migration. The previously-used `companion_url` and `companion_secret` columns were dropped in v1.3 when the companion switched to HA Ingress.

**HA API proxy** (`backend/src/utils/haApi.js`): all routes that talk to Home Assistant use `haGet`, `haPost`, `haDelete` from this module. They decrypt the LLAT, attach it as `Authorization: Bearer`, and throw errors with `.status` set so route handlers can forward the status code. `baseUrl(inst)` (private helper) trims trailing slashes before building URLs — all URL construction goes through it. For commands only available via HA's WebSocket API (user management, entity/area registry), use `callHaWs` — it opens a one-shot authenticated WS connection, sends the command, and resolves/rejects the promise. For Supervisor-level operations when the companion is configured, use `callCompanion(inst, path, method, body)` or `streamCompanion(inst, path)` — these construct the URL as `{instance_url}/api/hassio_ingress/{companion_ingress_token}{path}` and authenticate with the same LLAT (`Authorization: Bearer`) used for all other HA API calls. No shared secret is involved.

**Token encryption** (`backend/src/utils/encryption.js`): LLAT tokens are encrypted with AES-256-CBC before being written to SQLite. The IV is prepended to the ciphertext as `iv_hex:enc_hex`. Never store or log a raw token.

**Audit logging** (`backend/src/utils/audit.js`): every significant user action must call `logAudit({ instanceId, siteId, action, details })`. All routes already do this — maintain the pattern for any new actions.

**WebSocket pipeline**: `WebSocketManager` (extends `EventEmitter`) maintains one persistent HA WebSocket connection per adopted instance. On connect it subscribes to `state_changed` and bulk-fetches all states via `get_states` (msg id 2). It writes every state change to `entity_cache` and emits `status_update` / `state_changed` events. On every successful `auth_ok`, `_refreshInstanceMeta` fetches `/api/config` to re-detect `installation_type` and `ha_version`, and updates the DB if they changed. `harborWs.js` opens a `WebSocketServer` at `/ws`, authenticates browser clients via JWT query param, sends a `status_snapshot` on connect, then relays both event types to all connected browser clients.

**Instance lifecycle signals**: routes communicate with `WebSocketManager` via `process.emit('harbor:instance_added' | 'harbor:instance_updated' | 'harbor:instance_removed', id)`. The manager listens for these in `start()`.

**Route organisation**: all instance-scoped routes are mounted at `/api/instances` in `index.js`. Each resource lives in its own file (`entities.js`, `automations.js`, etc.) and receives `/:id/...` paths relative to that mount.

**`POST /api/instances/0/test`**: the `id=0` sentinel means an ad-hoc connectivity test (used by the adoption wizard before the instance exists in the DB). The route handles this case explicitly before the normal "look up instance" path.

**Cloudflare detection** (`backend/src/utils/cloudflare.js`): `checkCloudflare(instanceUrl)` does a DNS A-record lookup on the hostname and checks the resolved IP against Cloudflare's published IPv4 ranges (`https://www.cloudflare.com/ips-v4`). Ranges are cached in `harbor_settings` with key `cloudflare_ip_ranges` for 24 hours. Detection runs in the background after adoption and on `PUT /:id` when the URL changes. Result is stored as `cloudflare_proxied = 1` in the instances table. Local IPs and bare IP addresses are never sent to Cloudflare's range list.

### Harbor Companion add-on

The `/addon/harbor-companion` directory contains a Home Assistant add-on that bridges Harbor and the Supervisor API. It runs inside HA on port 7779 and is accessed exclusively through Home Assistant's native **Ingress** system — the port is never exposed externally and no shared secret is needed.

**Add-on structure**:
- `config.yaml` — HA add-on manifest (slug: `harbor_companion`, `ingress: true`, `ingress_port: 7779`)
- `Dockerfile` — Alpine + Python + FastAPI, built by HA's add-on system
- `app/main.py` — FastAPI app; no auth middleware — security is handled entirely by HA Ingress
- `app/supervisor.py` — async Supervisor API client using `SUPERVISOR_TOKEN` (injected by HA)
- `rootfs/etc/services.d/harbor-companion/run` — s6 service runner

**Ingress-based companion URL**: `{instance_url}/api/hassio_ingress/{companion_ingress_token}{path}`. The `companion_ingress_token` is discovered on first enable by calling `GET {instance_url}/api/hassio/addons/harbor_companion/info` with the instance LLAT and reading `data.ingress_token` from the response.

**Backend companion proxy** (`backend/src/utils/haApi.js`): `callCompanion(inst, path, method, body)` builds the Ingress URL and attaches `Authorization: Bearer {llat}`. `streamCompanion(inst, path)` returns the raw fetch response for binary streaming (backup downloads). Both throw errors with `.status` for route handlers.

**Companion routes** (`backend/src/routes/companion.js`):
- `GET /:id/companion` — returns `{ enabled, ingress_token }`
- `POST /:id/companion/enable` — auto-discovers the Ingress token from HA, health-checks via Ingress, stores `companion_ingress_token` and sets `companion_enabled = 1`
- `DELETE /:id/companion` — sets `companion_enabled = 0` and clears `companion_ingress_token`

**Tab unlocking**: When `companion_enabled = 1` on an instance, the backups, addons, updates, and system routes proxy to the companion instead of returning the "not available" response. The frontend tab components check `inst.companion_enabled` and render either the full management UI or the "Open in HA" placeholder accordingly.

**Dashboard / action buttons**: When `companion_enabled` is true, a `PlugZap` icon appears on dashboard instance rows, and Reboot + Shutdown buttons appear in `InstanceActionButtons` alongside the existing Restart button.

### Supervisor API — external LLAT limitation

The Home Assistant Supervisor API (`/api/hassio/…`) is **not accessible** through an external Long-Lived Access Token (LLAT). Requests return 401. When the Harbor Companion add-on is **not** configured for an instance, all Supervisor-dependent features fall back to "Open in Home Assistant" placeholders:

- **Backups tab** — `BackupsTab.jsx` shows a redirect prompt. `routes/backups.js` returns `[]`.
- **Add-ons tab** — `AddonsTab.jsx` shows a redirect prompt. `routes/addons.js` returns `[]`.
- **Updates tab** — `UpdatesTab.jsx` shows a redirect prompt. `routes/updates.js` returns `{ supervisor_unavailable: true }`.
- **System tab** — `SystemTab.jsx` shows basic info from `/api/config` (version, location, timezone, units). No logs viewer. `routes/system.js` exposes `GET /:id/sysconfig`.
- **Reboot / Shutdown** — only available when companion is enabled (`POST /:id/actions/reboot` and `POST /:id/actions/shutdown`). When companion is disabled, only **Restart** (`POST /api/services/homeassistant/restart`) is shown.
- `installation_type` badge removed from instance detail header. The field is still stored and used internally by `inferInstallationType` (component-based, reads `hassio` and `homeassistant_hardware` from `/api/config`), but never shown in UI.

Do not add any new routes that call `/api/hassio/…` directly — they will always 401. Use the Harbor Companion add-on path (`callCompanion`) for Supervisor features.

### installation_type detection

`/api/config` returns `installation_type` in most HA versions. When it's absent or `'unknown'`, Harbor infers it from the components list:
- `hassio` in components + `homeassistant_hardware` → `'Home Assistant OS'`
- `hassio` in components only → `'Home Assistant Supervised'`
- neither → `config.installation_type` or `'unknown'`

This runs in `inferInstallationType` (shared by `routes/instances.js` and `WebSocketManager._refreshInstanceMeta`). No Supervisor API calls are made.

### Frontend key patterns

**Context hierarchy** (outermost → innermost):
`ThemeProvider` → `AuthProvider` → `WsProvider` → `SitesProvider` → `ToastProvider` → `AppShell`

- `AuthContext` — JWT token in `localStorage` as `harbor_token`, auto-redirects to `/login` on 401
- `ThemeContext` — `dark`/`light` class toggled on `<html>`, `spacious`/`compact` density, both in `localStorage`
- `WsContext` — single browser WebSocket to `/ws?token=…`; exposes `statuses` (Map of instanceId → status string) and `subscribe(instanceId, handler)` for per-instance `state_changed` listeners
- `SitesContext` — fetches `/api/sites` once, shared by Sidebar and Dashboard; call `refresh()` after mutations. The sites API includes `cloudflare_proxied` on each instance object.
- `ToastContext` — call `toast(message, type)` anywhere inside the provider tree

**API client** (`frontend/src/api/client.js`): `api.get/post/put/delete` — thin wrappers that attach the JWT and throw on non-2xx. `downloadFile(path, filename)` streams a blob to the browser's download mechanism.

**CSS utilities** (`frontend/src/index.css`): Tailwind component classes are defined here — `.btn`, `.btn-sm/md/lg`, `.btn-primary/secondary/danger/ghost`, `.card`, `.input`, `.label`, `.badge`, `.badge-{green|red|orange|blue|gray|yellow}`. Also defines `.status-pulse` (pulsing animation for connected status dots) and `.people-panel` (slide-in animation for the people presence hover panel).

**Status dot colours**: `connected` = green (with pulse animation), `disconnected` = red, `auth_failed` = orange, `unknown` = gray. Encoded in `StatusDot.jsx`.

**Instance actions**: Only **Restart** is available (`InstanceActionButtons.jsx`). The button is disabled when `status !== 'connected'` with an "Instance offline" tooltip. Reboot and Shutdown were removed because they required the Supervisor API.

**`usePeoplePresence(instanceId, status, enabled)`** (`frontend/src/hooks/useInstanceMeta.js`): lazily fetches `person.*` entities from the entity cache when `enabled` is true; used by dashboard cards to show presence on hover. `useInstanceMeta` is a stub that returns empty values (backup/updates badges removed).

**Dashboard design** (`DashboardPage.jsx`): site-grouped cards — one card per site, with instance rows stacked inside. Each card has:
- 4-px left border accent: green (all connected), red (any disconnected), orange (any auth_failed) — worst status wins
- Site name header (large) + customer name (small)
- Per instance: StatusDot + instance name, HA version, Cloudflare icon (`Cloud` from lucide), Restart button, Open-in-HA link
- Disconnected instance rows: grayed out, "Last seen X ago" below name
- Auth-failed instance rows: orange badge + "Update token in Settings" hint
- People presence panel: animates in on hover using `usePeoplePresence`; shows 🏠/📍 per person entity
- Hover: card lifts (`hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200`)
- Empty state (no instances): Anchor icon, "No instances yet", "Add Instance" button
Fleet summary bar: Sites / Instances / Online / Offline pills — Online and Offline are clickable filters. Tag filter pills below if any sites have tags.

**Entities tab area grouping** (`EntitiesTab.jsx`): fetches `/api/instances/:id/entities/areas` (which uses `callHaWs` with `config/area_registry/list` and `config/entity_registry/list`) alongside the entity cache. Groups the filtered entities by area using collapsible `AreaSection` components. Entities with no `area_id` go into "Unassigned". Domain filter pills work across all areas simultaneously. Falls back to flat grid if area data is unavailable.

## Release & Update Process

### Tagging a release
```bash
# 1. Update VERSION file to the new version (e.g. 1.2.0)
# 2. Commit the change
git add VERSION && git commit -m "chore: bump version to 1.2.0"

# 3. Tag and push — this triggers the GitHub Actions release workflow
git tag v1.2.0 && git push origin main --tags
```

### GitHub Actions workflow (`.github/workflows/release.yml`)
Triggers on `v*` tags. It:
1. Verifies the tag version matches the `VERSION` file
2. Builds a multi-platform Docker image (`linux/amd64`, `linux/arm64`) with `--build-arg VERSION=<semver>`
3. Pushes to GHCR as `ghcr.io/avibarilan/harbor:latest` and `ghcr.io/avibarilan/harbor:v<version>`

`GITHUB_TOKEN` is used automatically — no extra secrets needed.

### Self-update mechanism
- On startup (after 15 s) and every 6 hours, Harbor checks `https://api.github.com/repos/avibarilan/Harbor/releases/latest` and caches the result in `harbor_settings`.
- Settings page → **Harbor Updates** section shows current/latest version and a "Check for updates" button.
- When an update is available and the Docker socket is mounted, an **"Update to vX.X.X"** button appears.
- Clicking it: Harbor pulls the new image, then launches a short-lived **helper container** (using the new image running `src/updateRunner.js`). The helper waits 8 s, stops + removes the old container, and starts the new one with the original port/volume/env config. The Docker socket must be mounted at `/var/run/docker.sock`.
- The `HARBOR_VERSION` env var is set at image build time via `--build-arg`. Running outside Docker shows `dev`.
- **Data safety**: volumes are preserved — the helper re-uses the exact same `HostConfig.Binds` from the inspected container, so `/data` is never touched.

### Docker socket requirement
```yaml
# docker-compose.yml — already included:
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```
Without this mount, the update button is hidden and a note is shown explaining manual update is required.

## Docker Hub Deployment

- **Image**: `avibarilan/harbor`
- Published automatically on every push to `main` via `.github/workflows/docker-publish.yml`
- Tags pushed: `latest` and the full Git SHA (e.g. `avibarilan/harbor:abc1234...`)
- Synology NAS pulls the pre-built image — no file copying or local build needed

**To update on Synology via SSH:**
```bash
docker-compose pull && docker-compose up -d
```

**Required GitHub secrets** (Settings → Secrets → Actions):
- `DOCKERHUB_USERNAME` — Docker Hub username
- `DOCKERHUB_TOKEN` — Docker Hub access token (not your password)
