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

1. In Container Manager → Project → Create
2. Use "Upload docker-compose.yml" and paste the contents of `docker-compose.yml`
3. Add environment variables via the UI (JWT_SECRET, ENCRYPTION_KEY)
4. Create a bind mount from a Synology folder to `/data`
5. Start the project

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
