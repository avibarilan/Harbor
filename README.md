# Harbor

A professional fleet management platform for smart home service providers who manage multiple Home Assistant installations.

## Quick Start

### 1. Clone and configure

```bash
cp .env.example .env
# Edit .env — set a strong JWT_SECRET and a 32-character ENCRYPTION_KEY
```

### 2. Docker (recommended)

```bash
docker compose up -d
```

Harbor will be available at `http://localhost:3000`.

Default credentials on first run: **admin / changeme** — change in Settings immediately.

### 3. Development

```bash
# Backend (Terminal 1)
cd backend && npm install && npm run dev

# Frontend (Terminal 2)
cd frontend && npm install && npm run dev
```

Frontend dev server runs on `http://localhost:5173` and proxies `/api` and `/ws` to the backend.

---

## Synology Container Manager Deployment

Harbor publishes a pre-built Docker image to Docker Hub on every push to `main` — no file copying required.

### First-time setup

1. SSH into your Synology (or use Container Manager → Project → Create via the UI)
2. Create a `docker-compose.yml` with the contents from this repo (image is `avibarilan/harbor:latest`)
3. All environment variables are already hardcoded in `docker-compose.yml` — no extra configuration needed
4. Run:
   ```bash
   docker-compose pull && docker-compose up -d
   ```

### Updating

**Via SSH:**
```bash
docker-compose pull && docker-compose up -d
```

**Via Container Manager UI:**
Container Manager → select the harbor container → Stop → Action → Pull latest image → Start

---

## Cloudflare Tunnel

Harbor runs plain HTTP internally. Expose it externally via Cloudflare Tunnel:

1. Create a tunnel in the Cloudflare Zero Trust dashboard
2. Point it at `http://localhost:3000` (or your Docker host IP)
3. Set your public hostname (e.g. `harbor.yourdomain.com`)
4. Optionally enable Cloudflare Access for an extra auth layer

No HTTPS configuration needed inside Harbor — Cloudflare handles TLS termination.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default: 3000) |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `ENCRYPTION_KEY` | Yes | 32-character key for AES-256 token encryption |
| `DATA_DIR` | No | Path for SQLite database file (default: ./data) |
