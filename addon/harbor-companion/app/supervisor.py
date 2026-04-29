import logging
import os

import httpx

log = logging.getLogger("harbor-companion")

SUPERVISOR_TOKEN = os.environ.get("SUPERVISOR_TOKEN", "").strip()
BASE_URL = "http://supervisor"


def _client():
    return httpx.AsyncClient(
        base_url=BASE_URL,
        headers={"Authorization": f"Bearer {SUPERVISOR_TOKEN}"},
        timeout=30.0,
    )


class SupervisorError(Exception):
    def __init__(self, message: str, status: int = 500):
        super().__init__(message)
        self.status = status


async def _get(path: str):
    async with _client() as c:
        r = await c.get(path)
        if not r.is_success:
            raise SupervisorError(f"Supervisor {r.status_code}: {r.text}", r.status_code)
        return r.json()


async def _post(path: str, body: dict | None = None):
    async with _client() as c:
        r = await c.post(path, json=body)
        if not r.is_success:
            raise SupervisorError(f"Supervisor {r.status_code}: {r.text}", r.status_code)
        return r.json()


async def _delete(path: str):
    async with _client() as c:
        r = await c.delete(path)
        if not r.is_success:
            raise SupervisorError(f"Supervisor {r.status_code}: {r.text}", r.status_code)
        return r.json()


async def get_info() -> dict:
    core = await _get("/core/info")
    sup = await _get("/supervisor/info")
    os_info = await _get("/os/info")
    host = await _get("/host/info")
    return {
        "core_version": core.get("data", {}).get("version"),
        "supervisor_version": sup.get("data", {}).get("version"),
        "os_version": os_info.get("data", {}).get("version"),
        "installation_type": host.get("data", {}).get("deployment"),
        "hostname": host.get("data", {}).get("hostname"),
        "arch": host.get("data", {}).get("arch"),
    }


async def get_ingress_token() -> str:
    data = await _get("/addons/self/info")
    ingress_entry = data.get("data", {}).get("ingress_entry", "")
    if not ingress_entry:
        raise SupervisorError("ingress_entry missing from /addons/self/info response")
    token = ingress_entry.rstrip("/").rsplit("/", 1)[-1]
    if not token:
        raise SupervisorError(f"Could not extract token from ingress_entry: {ingress_entry!r}")
    log.info(f"Ingress token extracted from ingress_entry: {token[:8]}…")
    return token


async def get_ha_version() -> str:
    info = await _get("/core/info")
    return info.get("data", {}).get("version", "unknown")


async def list_backups() -> list:
    data = await _get("/backups")
    return data.get("data", {}).get("backups", [])


async def get_backup_info(slug: str) -> dict:
    data = await _get(f"/backups/{slug}/info")
    return data.get("data", {})


async def create_backup() -> dict:
    data = await _post("/backups/new/full")
    return data.get("data", {})


async def create_backup_named(name: str) -> dict:
    data = await _post("/backups/new/full", {"name": name})
    return data.get("data", {})


async def delete_backup(slug: str) -> dict:
    return await _delete(f"/backups/{slug}")


async def restore_backup(slug: str) -> dict:
    data = await _post(f"/backups/{slug}/restore/full")
    return data.get("data", {})


async def download_backup_stream(slug: str):
    """Returns an httpx response for streaming the backup file."""
    client = _client()
    req = client.build_request("GET", f"/backups/{slug}/download")
    return await client.send(req, stream=True), client


async def get_updates() -> dict:
    core = await _get("/core/info")
    sup = await _get("/supervisor/info")
    os_info = await _get("/os/info")
    addons_data = await _get("/addons")

    core_d = core.get("data", {})
    sup_d = sup.get("data", {})
    os_d = os_info.get("data", {})

    addon_updates = [
        {
            "slug": a["slug"],
            "name": a["name"],
            "version": a.get("version"),
            "version_latest": a.get("version_latest"),
        }
        for a in addons_data.get("data", {}).get("addons", [])
        if a.get("update_available")
    ]

    return {
        "core": {
            "version": core_d.get("version"),
            "version_latest": core_d.get("version_latest"),
            "update_available": core_d.get("update_available", False),
        },
        "supervisor": {
            "version": sup_d.get("version"),
            "version_latest": sup_d.get("version_latest"),
            "update_available": sup_d.get("update_available", False),
        },
        "os": {
            "version": os_d.get("version"),
            "version_latest": os_d.get("version_latest"),
            "update_available": os_d.get("update_available", False),
        },
        "addons": addon_updates,
    }


async def update_core() -> dict:
    return await _post("/core/update")


async def update_supervisor() -> dict:
    return await _post("/supervisor/update")


async def update_os() -> dict:
    return await _post("/os/update")


async def update_addon(slug: str) -> dict:
    return await _post(f"/addons/{slug}/update")


async def list_addons() -> list:
    data = await _get("/addons")
    return [
        {
            "slug": a["slug"],
            "name": a["name"],
            "state": a.get("state"),
            "version": a.get("version"),
            "version_latest": a.get("version_latest"),
            "update_available": a.get("update_available", False),
            "icon": a.get("icon"),
        }
        for a in data.get("data", {}).get("addons", [])
    ]


async def restart_addon(slug: str) -> dict:
    return await _post(f"/addons/{slug}/restart")


async def get_logs() -> str:
    async with _client() as c:
        r = await c.get("/core/logs")
        if not r.is_success:
            raise SupervisorError(f"Supervisor {r.status_code}: {r.text}", r.status_code)
        return r.text


async def restart_core() -> dict:
    return await _post("/core/restart")


async def reboot_host() -> dict:
    return await _post("/host/reboot")


async def shutdown_host() -> dict:
    return await _post("/host/shutdown")
