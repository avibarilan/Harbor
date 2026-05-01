import asyncio
import base64
import json
import logging
import os
from contextlib import asynccontextmanager

import httpx
import uvicorn
from fastapi import FastAPI

import supervisor as sup

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("harbor-companion")

VERSION = "1.5.0"
OPTIONS_FILE = "/data/options.json"
CONFIG_FILE = "/data/companion_config.json"

harbor_url = ""
instance_id = None
secret = ""
poll_interval_seconds = 10


def _decode_token(token: str) -> dict:
    padding = 4 - len(token) % 4
    if padding != 4:
        token += "=" * padding
    return json.loads(base64.b64decode(token).decode("utf-8"))


async def load_config() -> bool:
    global harbor_url, instance_id, secret

    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE) as f:
                cfg = json.load(f)
            harbor_url = cfg["harbor_url"]
            instance_id = cfg["instance_id"]
            secret = cfg["secret"]
            log.info(f"Loaded saved config — connecting to {harbor_url} as instance {instance_id}")
            return True
        except Exception as e:
            log.warning(f"Could not read companion_config.json: {e}")

    try:
        with open(OPTIONS_FILE) as f:
            opts = json.load(f)
    except Exception as e:
        log.error(f"Could not read options.json: {e}")
        return False

    token = opts.get("harbor_token", "").strip()
    if not token:
        log.error("harbor_token is empty in add-on options. Generate a setup token in Harbor → Instance Settings.")
        return False

    try:
        payload = _decode_token(token)
        harbor_url = payload["harbor_url"]
        instance_id = payload["instance_id"]
        secret = payload["secret"]
        log.info(f"Token decoded — will connect to {harbor_url} as instance {instance_id}")
        return True
    except Exception as e:
        log.error(f"Invalid harbor_token format: {e}")
        return False


async def register():
    global poll_interval_seconds

    if os.path.exists(CONFIG_FILE):
        log.info("Already registered (companion_config.json exists) — skipping registration")
        return

    try:
        with open(OPTIONS_FILE) as f:
            opts = json.load(f)
    except Exception as e:
        log.warning(f"Could not read options.json for registration: {e}")
        return

    token = opts.get("harbor_token", "").strip()
    if not token:
        return

    log.info(f"Registering with Harbor at {harbor_url}")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                f"{harbor_url}/api/companion/register",
                json={"setup_token": token, "companion_version": VERSION},
            )
        if r.status_code == 200:
            data = r.json()
            poll_interval_seconds = data.get("poll_interval_seconds", 10)
            log.info(f"Registered successfully. Poll interval: {poll_interval_seconds}s")
            with open(CONFIG_FILE, "w") as f:
                json.dump({"harbor_url": harbor_url, "instance_id": instance_id, "secret": secret}, f)
        elif r.status_code == 401:
            log.warning("Token already used or expired — companion may already be registered")
        else:
            log.warning(f"Registration failed {r.status_code}: {r.text}")
    except Exception as e:
        log.warning(f"Registration error: {e}")


async def execute_command(command_id: int, command: str, payload: dict | None):
    result = None
    error = None
    status = "done"

    try:
        if command == "GET_UPDATES":
            result = await sup.get_updates()
        elif command == "GET_ADDONS":
            result = await sup.list_addons()
        elif command == "GET_BACKUPS":
            result = await sup.list_backups()
        elif command == "GET_SYSTEM":
            result = await sup.get_info()
        elif command == "REBOOT_HOST":
            result = await sup.reboot_host()
        elif command == "RESTART_HA":
            result = await sup.restart_core()
        elif command == "SHUTDOWN_HOST":
            result = await sup.shutdown_host()
        elif command == "UPDATE_CORE":
            result = await sup.update_core()
        elif command == "UPDATE_SUPERVISOR":
            result = await sup.update_supervisor()
        elif command == "UPDATE_OS":
            result = await sup.update_os()
        elif command == "UPDATE_ADDON":
            slug = (payload or {}).get("addon_slug")
            if not slug:
                raise ValueError("UPDATE_ADDON requires addon_slug in payload")
            result = await sup.update_addon(slug)
        elif command == "ADDON_START":
            slug = (payload or {}).get("slug")
            if not slug:
                raise ValueError("ADDON_START requires slug in payload")
            result = await sup.start_addon(slug)
        elif command == "ADDON_STOP":
            slug = (payload or {}).get("slug")
            if not slug:
                raise ValueError("ADDON_STOP requires slug in payload")
            result = await sup.stop_addon(slug)
        elif command == "ADDON_RESTART":
            slug = (payload or {}).get("slug")
            if not slug:
                raise ValueError("ADDON_RESTART requires slug in payload")
            result = await sup.restart_addon(slug)
        elif command == "ADDON_UNINSTALL":
            slug = (payload or {}).get("slug")
            if not slug:
                raise ValueError("ADDON_UNINSTALL requires slug in payload")
            result = await sup.uninstall_addon(slug)
        elif command == "ADDON_GET_LOGS":
            slug = (payload or {}).get("slug")
            if not slug:
                raise ValueError("ADDON_GET_LOGS requires slug in payload")
            result = await sup.get_addon_logs(slug)
        elif command == "ADDON_GET_CONFIG":
            slug = (payload or {}).get("slug")
            if not slug:
                raise ValueError("ADDON_GET_CONFIG requires slug in payload")
            result = await sup.get_addon_options(slug)
        elif command == "ADDON_SET_CONFIG":
            slug = (payload or {}).get("slug")
            options = (payload or {}).get("options")
            if not slug:
                raise ValueError("ADDON_SET_CONFIG requires slug in payload")
            result = await sup.set_addon_options(slug, options or {})
        elif command == "BACKUP_NOW":
            name = (payload or {}).get("name", "harbor-backup")
            result = await sup.create_backup_named(name)
        elif command == "DELETE_BACKUP":
            slug = (payload or {}).get("slug")
            if not slug:
                raise ValueError("DELETE_BACKUP requires slug in payload")
            result = await sup.delete_backup(slug)
        elif command == "DOWNLOAD_BACKUP":
            slug = (payload or {}).get("slug")
            if not slug:
                raise ValueError("DOWNLOAD_BACKUP requires slug in payload")
            content_b64 = await sup.download_backup_b64(slug)
            result = {"content": content_b64}
        elif command == "RESTORE_BACKUP":
            slug = (payload or {}).get("slug")
            if not slug:
                raise ValueError("RESTORE_BACKUP requires slug in payload")
            result = await sup.restore_backup(slug)
        else:
            error = f"Unknown command: {command}"
            status = "error"
    except Exception as e:
        log.error(f"Command {command} failed: {e}")
        error = str(e)
        status = "error"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            await client.post(
                f"{harbor_url}/api/companion/result/{command_id}",
                headers={"X-Harbor-Secret": secret},
                json={"instance_id": instance_id, "status": status, "result": result, "error": error},
            )
    except Exception as e:
        log.warning(f"Failed to post result for command {command_id}: {e}")


async def check_for_updates():
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get("https://api.github.com/repos/avibarilan/Harbor/releases/latest")
        if r.status_code == 200:
            latest = r.json().get("tag_name", "").lstrip("v")
            if latest and latest > VERSION:
                log.info(f"Harbor Companion update available: v{latest}. Update via Home Assistant add-on store.")
    except Exception:
        pass


async def poll_loop():
    last_update_check = 0.0
    update_check_interval = 6 * 3600

    while True:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.get(
                    f"{harbor_url}/api/companion/poll/{instance_id}",
                    headers={"X-Harbor-Secret": secret, "X-Companion-Version": VERSION},
                )
            if r.status_code == 200:
                data = r.json()
                if data.get("command_id"):
                    asyncio.create_task(
                        execute_command(data["command_id"], data["command"], data.get("payload"))
                    )
            elif r.status_code == 401:
                log.error("Auth rejected by Harbor — secret mismatch. Re-generate a setup token.")
        except Exception as e:
            log.warning(f"Poll failed: {e}")

        now = asyncio.get_event_loop().time()
        if now - last_update_check > update_check_interval:
            last_update_check = now
            asyncio.create_task(check_for_updates())

        await asyncio.sleep(poll_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("=" * 60)
    log.info(f"Harbor Companion v{VERSION} starting")
    log.info(f"SUPERVISOR_TOKEN length: {len(sup.SUPERVISOR_TOKEN)} chars")
    log.info("=" * 60)

    ok = await load_config()
    if ok:
        await register()
        asyncio.create_task(poll_loop())
    else:
        log.error("Companion not configured — running in limited mode (health endpoint only)")
    yield


app = FastAPI(title="Harbor Companion", version=VERSION, lifespan=lifespan)


@app.get("/health")
async def health():
    try:
        ha_version = await sup.get_ha_version()
    except Exception:
        ha_version = "unknown"
    return {"status": "ok", "version": VERSION, "ha_version": ha_version}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7779, log_level="info")
