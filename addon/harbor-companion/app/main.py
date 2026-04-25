import os
import secrets
import logging
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.responses import StreamingResponse
import supervisor as sup

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("harbor-companion")

VERSION = "1.0.0"
SECRET_FILE = Path("/data/harbor_secret.txt")

_secret: str = ""


def load_or_create_secret() -> str:
    if SECRET_FILE.exists():
        s = SECRET_FILE.read_text().strip()
        if s:
            return s
    s = secrets.token_hex(32)
    SECRET_FILE.write_text(s)
    return s


app = FastAPI(title="Harbor Companion", version=VERSION)


@app.on_event("startup")
async def startup():
    global _secret
    _secret = load_or_create_secret()
    token_preview = sup.SUPERVISOR_TOKEN[:10] + "..." if sup.SUPERVISOR_TOKEN else "(empty)"
    log.info("=" * 60)
    log.info("Harbor Companion started")
    log.info(f"SUPERVISOR_TOKEN (first 10 chars): {token_preview!r}")
    log.info(f"X-Harbor-Secret: {_secret}")
    log.info("Copy this secret into Harbor → Instance Settings → Companion")
    log.info("=" * 60)


@app.middleware("http")
async def strip_prefix(request: Request, call_next):
    if request.url.path.startswith("/harbor-companion"):
        scope = request.scope
        scope["path"] = scope["path"][len("/harbor-companion"):]
        if not scope["path"]:
            scope["path"] = "/"
    return await call_next(request)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.url.path == "/health":
        return await call_next(request)
    provided = request.headers.get("X-Harbor-Secret", "")
    if not secrets.compare_digest(provided, _secret):
        return Response(content='{"detail":"Unauthorized"}', status_code=401, media_type="application/json")
    return await call_next(request)


def _sup_error(e: sup.SupervisorError):
    raise HTTPException(status_code=e.status, detail=str(e))


# ── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    try:
        ha_version = await sup.get_ha_version()
    except Exception:
        ha_version = "unknown"
    return {"status": "ok", "version": VERSION, "ha_version": ha_version}


# ── System info & actions ────────────────────────────────────────────────────

@app.get("/info")
async def info():
    try:
        return await sup.get_info()
    except sup.SupervisorError as e:
        _sup_error(e)


@app.get("/logs")
async def logs():
    try:
        text = await sup.get_logs()
        return {"logs": text}
    except sup.SupervisorError as e:
        _sup_error(e)


@app.post("/restart")
async def restart():
    try:
        return await sup.restart_core()
    except sup.SupervisorError as e:
        _sup_error(e)


@app.post("/reboot")
async def reboot():
    try:
        return await sup.reboot_host()
    except sup.SupervisorError as e:
        _sup_error(e)


@app.post("/shutdown")
async def shutdown():
    try:
        return await sup.shutdown_host()
    except sup.SupervisorError as e:
        _sup_error(e)


# ── Backups ──────────────────────────────────────────────────────────────────

@app.get("/backups")
async def list_backups():
    try:
        return await sup.list_backups()
    except sup.SupervisorError as e:
        _sup_error(e)


@app.post("/backups/new")
async def create_backup():
    try:
        return await sup.create_backup()
    except sup.SupervisorError as e:
        _sup_error(e)


@app.get("/backups/{slug}/info")
async def backup_info(slug: str):
    try:
        return await sup.get_backup_info(slug)
    except sup.SupervisorError as e:
        _sup_error(e)


@app.post("/backups/{slug}/restore")
async def restore_backup(slug: str):
    try:
        return await sup.restore_backup(slug)
    except sup.SupervisorError as e:
        _sup_error(e)


@app.get("/backups/{slug}/download")
async def download_backup(slug: str):
    try:
        response, client = await sup.download_backup_stream(slug)
        if not response.is_success:
            await response.aclose()
            await client.aclose()
            raise HTTPException(status_code=response.status_code, detail="Backup download failed")

        async def stream():
            try:
                async for chunk in response.aiter_bytes():
                    yield chunk
            finally:
                await response.aclose()
                await client.aclose()

        return StreamingResponse(
            stream(),
            media_type="application/tar+gzip",
            headers={"Content-Disposition": f'attachment; filename="{slug}.tar.gz"'},
        )
    except sup.SupervisorError as e:
        _sup_error(e)


# ── Updates ──────────────────────────────────────────────────────────────────

@app.get("/updates")
async def get_updates():
    try:
        return await sup.get_updates()
    except sup.SupervisorError as e:
        _sup_error(e)


@app.post("/updates/core")
async def update_core():
    try:
        return await sup.update_core()
    except sup.SupervisorError as e:
        _sup_error(e)


@app.post("/updates/supervisor")
async def update_supervisor():
    try:
        return await sup.update_supervisor()
    except sup.SupervisorError as e:
        _sup_error(e)


@app.post("/updates/os")
async def update_os():
    try:
        return await sup.update_os()
    except sup.SupervisorError as e:
        _sup_error(e)


@app.post("/updates/addon/{slug}")
async def update_addon(slug: str):
    try:
        return await sup.update_addon(slug)
    except sup.SupervisorError as e:
        _sup_error(e)


# ── Add-ons ──────────────────────────────────────────────────────────────────

@app.get("/addons")
async def list_addons():
    try:
        return await sup.list_addons()
    except sup.SupervisorError as e:
        _sup_error(e)


@app.post("/addons/{slug}/restart")
async def restart_addon(slug: str):
    try:
        return await sup.restart_addon(slug)
    except sup.SupervisorError as e:
        _sup_error(e)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7779, log_level="info")
