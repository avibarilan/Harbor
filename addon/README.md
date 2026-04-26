# Harbor Companion Add-on

Harbor Companion is a Home Assistant add-on that bridges Harbor Fleet Manager and the Home Assistant Supervisor API. It runs inside Home Assistant and is accessed by Harbor through Home Assistant's native **Ingress** system — no port forwarding, no extra Cloudflare configuration, and no shared secrets required.

## What it enables

When Harbor Companion is installed and enabled, the following Harbor features become available for that instance:

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
4. Start the add-on — no manual configuration needed

## Enabling in Harbor

1. Open the instance in Harbor → **Settings tab** → **Harbor Companion** section
2. Click **Enable Companion**
3. Harbor automatically discovers the companion via the HA API and connects through Ingress

That's it. No URL, no port, no secret to copy.

## How it works

Harbor Companion uses Home Assistant's native Ingress system:

- The add-on runs on port 7779 **inside** Home Assistant — this port is never exposed externally
- HA creates a secure proxy path at `/api/hassio_ingress/{token}/` routed to the add-on
- Harbor discovers this token by calling `GET {instance_url}/api/hassio/addons/harbor_companion/info` using the instance's Long-Lived Access Token
- All subsequent companion API calls use the same LLAT that Harbor already uses for the instance — no additional credentials

## No additional Cloudflare configuration needed

Because companion requests flow through the existing HA URL via Ingress, no separate Cloudflare subdomain, path-based ingress rules, or port forwarding is required. If your HA instance is already behind a Cloudflare Tunnel, companion works automatically through the same tunnel.

## Security

- The add-on is only reachable through Home Assistant's Ingress proxy — it cannot be accessed directly from the internet
- Authentication is provided by the same Long-Lived Access Token Harbor already uses for the instance
- HA validates the Ingress token on every request before forwarding to the add-on

## Troubleshooting

**"Harbor Companion add-on not found"**
- Verify the add-on is installed and **running** in Home Assistant
- The slug must be `harbor_companion` — check Settings → Add-ons

**"Companion health check failed"**
- Check the add-on log in HA for startup errors
- Ensure the add-on has `hassio_role: manager` (set automatically by the add-on manifest)

**Supervisor calls fail with 401**
- The add-on uses the `SUPERVISOR_TOKEN` environment variable injected by HA automatically
- Reinstalling the add-on reissues the token

**Backup download is slow**
- Backups are streamed through Harbor's backend — large backups will take time depending on network speed
