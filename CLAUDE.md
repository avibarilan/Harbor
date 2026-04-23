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

**Database** (`backend/src/db/index.js`): single `better-sqlite3` instance, WAL mode, foreign keys on. Always get it via `getDb()` — never import the `db` variable directly. Schema is created inline in `initDb()`.

**HA API proxy** (`backend/src/utils/haApi.js`): all routes that talk to Home Assistant use `haGet`, `haPost`, `haDelete` from this module. They decrypt the LLAT, attach it as `Authorization: Bearer`, and throw errors with `.status` set so route handlers can forward the status code. For commands only available via HA's WebSocket API (user management), use `callHaWs` — it opens a one-shot authenticated WS connection, sends the command, and resolves/rejects the promise.

**Token encryption** (`backend/src/utils/encryption.js`): LLAT tokens are encrypted with AES-256-CBC before being written to SQLite. The IV is prepended to the ciphertext as `iv_hex:enc_hex`. Never store or log a raw token.

**Audit logging** (`backend/src/utils/audit.js`): every significant user action must call `logAudit({ instanceId, siteId, action, details })`. All routes already do this — maintain the pattern for any new actions.

**WebSocket pipeline**: `WebSocketManager` (extends `EventEmitter`) maintains one persistent HA WebSocket connection per adopted instance. On connect it subscribes to `state_changed` and bulk-fetches all states via `get_states` (msg id 2). It writes every state change to `entity_cache` and emits `status_update` / `state_changed` events. `harborWs.js` opens a `WebSocketServer` at `/ws`, authenticates browser clients via JWT query param, sends a `status_snapshot` on connect, then relays both event types to all connected browser clients.

**Instance lifecycle signals**: routes communicate with `WebSocketManager` via `process.emit('harbor:instance_added' | 'harbor:instance_updated' | 'harbor:instance_removed', id)`. The manager listens for these in `start()`.

**Route organisation**: all instance-scoped routes are mounted at `/api/instances` in `index.js`. Each resource lives in its own file (`entities.js`, `automations.js`, etc.) and receives `/:id/...` paths relative to that mount.

**`POST /api/instances/0/test`**: the `id=0` sentinel means an ad-hoc connectivity test (used by the adoption wizard before the instance exists in the DB). The route handles this case explicitly before the normal "look up instance" path.

### Frontend key patterns

**Context hierarchy** (outermost → innermost):
`ThemeProvider` → `AuthProvider` → `WsProvider` → `SitesProvider` → `ToastProvider` → `AppShell`

- `AuthContext` — JWT token in `localStorage` as `harbor_token`, auto-redirects to `/login` on 401
- `ThemeContext` — `dark`/`light` class toggled on `<html>`, `spacious`/`compact` density, both in `localStorage`
- `WsContext` — single browser WebSocket to `/ws?token=…`; exposes `statuses` (Map of instanceId → status string) and `subscribe(instanceId, handler)` for per-instance `state_changed` listeners
- `SitesContext` — fetches `/api/sites` once, shared by Sidebar and Dashboard; call `refresh()` after mutations
- `ToastContext` — call `toast(message, type)` anywhere inside the provider tree

**API client** (`frontend/src/api/client.js`): `api.get/post/put/delete` — thin wrappers that attach the JWT and throw on non-2xx. `downloadFile(path, filename)` streams a blob to the browser's download mechanism.

**CSS utilities** (`frontend/src/index.css`): Tailwind component classes are defined here — `.btn`, `.btn-sm/md/lg`, `.btn-primary/secondary/danger/ghost`, `.card`, `.input`, `.label`, `.badge`, `.badge-{green|red|orange|blue|gray|yellow}`. Use these instead of raw Tailwind for interactive elements.

**Status dot colours**: `connected` = green, `disconnected` = red, `auth_failed` = orange, `unknown` = gray. These are encoded in `StatusDot.jsx` and `WsContext`.

**Instance actions gating**: Restart is always available. Reboot and Shutdown are only shown/enabled when `installation_type === 'Home Assistant OS'`. Action buttons are disabled when `status !== 'connected'` with an "Instance offline" tooltip. This logic lives in `InstanceActionButtons.jsx` and must be preserved everywhere instance actions appear.

**`useInstanceMeta(instanceId, status)`** (`frontend/src/hooks/useInstanceMeta.js`): fetches update count and latest backup date for a single instance. Only fires when `status === 'connected'`. Used on dashboard cards to show update/backup warning badges without blocking render.

### Supervisor API vs standard REST API

HA exposes two API surfaces accessed via the same LLAT:
- **Standard REST** (`/api/...`): entities, services, automations, scripts, scenes, error log
- **Supervisor API** (`/api/hassio/...`): add-ons, OS/Supervisor/Core version info and updates, backups, host reboot/shutdown

Supervisor endpoints are only present on **Home Assistant OS** and **Home Assistant Supervised** installation types. Routes that call Supervisor endpoints (system, updates, addons, backups) will return HA API errors on Container/Core installs — the frontend should handle this gracefully.

## Release & Update Process

### Tagging a release
```bash
# 1. Update VERSION file to the new version (e.g. 1.1.0)
# 2. Commit the change
git add VERSION && git commit -m "chore: bump version to 1.1.0"

# 3. Tag and push — this triggers the GitHub Actions release workflow
git tag v1.1.0 && git push origin main --tags
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
