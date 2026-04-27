import asyncio
import json
import logging

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
import supervisor as sup

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("harbor-companion")

VERSION = "1.2.0"

app = FastAPI(title="Harbor Companion", version=VERSION)


@app.middleware("http")
async def strip_prefix(request: Request, call_next):
    if request.scope["path"].startswith("/companion"):
        request.scope["path"] = request.scope["path"][len("/companion"):]
        if not request.scope["path"]:
            request.scope["path"] = "/"
    return await call_next(request)


async def _register_with_harbor():
    """POST registration details to Harbor so it can reach this companion directly."""
    try:
        with open("/data/options.json") as f:
            opts = json.load(f)
    except Exception as e:
        log.warning(f"Could not read options.json: {e} — skipping Harbor registration")
        return

    harbor_url = opts.get("harbor_url", "").strip().rstrip("/")
    instance_id = str(opts.get("instance_id", "")).strip()
    harbor_secret = opts.get("harbor_secret", "").strip()
    companion_url = opts.get("companion_url", "").strip().rstrip("/")

    if not harbor_url or not instance_id or not harbor_secret:
        log.info("Harbor registration not configured in add-on options — skipping")
        return

    log.info(f"Registering with Harbor at {harbor_url} (instance {instance_id})")
    log.info(f"companion_url being sent: '{companion_url}'")

    payload = {"instance_id": instance_id, "secret": harbor_secret}
    if companion_url:
        payload["companion_url"] = companion_url

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(f"{harbor_url}/api/companion/register", json=payload)
        if r.is_success:
            log.info(f"Registered with Harbor successfully (companion_url={companion_url or 'not set'})")
        else:
            log.warning(f"Harbor registration failed {r.status_code}: {r.text}")
    except Exception as e:
        log.warning(f"Harbor registration error: {e}")


@app.on_event("startup")
async def startup():
    log.info("=" * 60)
    log.info("Harbor Companion started - accessible via Home Assistant Ingress")
    log.info(f"SUPERVISOR_TOKEN length: {len(sup.SUPERVISOR_TOKEN)} chars")
    log.info("=" * 60)
    asyncio.create_task(_register_with_harbor())


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
