# Safety Digital

Safety Digital is Sugihara's SHE workspace. This first release is a responsive placeholder interface with a Dashboard and sections for Safety, Health, and Environmental. The Environmental section contains pages for Red Tag, Hiyari Hatto, Waste, and Environmental Findings. There are no forms, accounts, stored reports, or live metrics yet.

The app is a static site served by Nginx in Docker. It requires no database or environment variables. The supplied Sugihara logo is stored in `public/brand/`, and the app uses `1.png`. The layout takes cues from the supplied CMMS screenshot; the green theme represents the SHE department. The Findings page lists issue topics from the supplied environmental reporting poster.

## Deploy on the AI PC

### 1. Prerequisites

- On the Linux AI PC, install Docker Engine with the Compose plugin and Git. Confirm `docker compose version` works and that your user can run Docker commands.
- Ensure TCP port `3600` is free. The existing `compose.yaml` binds only to `127.0.0.1:3600`, so the app is reachable from the AI PC and a tunnel running on that same PC.

### 2. Get the project

You already created `/srv/apps/she` on the AI PC. If that directory is **empty**, clone the repository into it:

```sh
cd /srv/apps/she
git clone https://github.com/digitalsgisb/she.git .
```

If `/srv/apps/she` is **already a clone** of this repository, run `cd /srv/apps/she && git pull` instead. If it contains other files and is not a Git checkout, move or back up those files before cloning; Git will not clone into a non-empty directory. If the repository is private, authenticate with a GitHub account that has access. Do not put a GitHub token in the clone URL or in this repository.

### 3. Build and start

```sh
cd /srv/apps/she
docker compose up -d --build
docker compose ps
```

Open `http://localhost:3600` on the AI PC. The dashboard should appear. To check the web server directly, open `http://localhost:3600/healthz`; it should return `ok`. The container is configured to restart unless stopped manually.

If the page does not open, inspect the logs:

```sh
docker compose logs --tail=100 safety-digital
```

### 4. Connect `she.sugidigital.org` when the tunnel is ready

This repository does **not** create or configure a Cloudflare Tunnel. If `cloudflared` is installed and running **on the AI PC**, use the following route in the Cloudflare dashboard:

| Setting | Value |
| --- | --- |
| Route type | Published application |
| Hostname | `she.sugidigital.org` |
| Service | HTTP |
| Service URL | `http://localhost:3600` |

In Cloudflare, go to **Networking → Tunnels**, choose or create the tunnel, then add a **Published application** route with the values above. Follow Cloudflare's on-screen instructions to install and run `cloudflared` on the AI PC. Verify `http://localhost:3600` works locally first, then visit `https://she.sugidigital.org` after the tunnel connects. Keep tunnel tokens and credentials out of Git.

If `cloudflared` runs in **another Docker container**, `localhost` refers to that container, not the AI PC. Attach it to the same Docker network as this app and route to `http://safety-digital:80`, or run `cloudflared` directly on the AI PC. The current Compose file is designed for the latter setup.

Cloudflare's [tunnel setup guide](https://developers.cloudflare.com/tunnel/get-started/) has the current dashboard instructions.

### 5. Update or stop

From the project directory on the AI PC:

```sh
git pull
docker compose up -d --build
```

To stop the app:

```sh
docker compose down
```

## Project files

- `index.html`, `styles.css`, `script.js`: dashboard and placeholder pages. Navigation uses URL fragments and needs no backend.
- `Dockerfile`, `nginx.conf`, `compose.yaml`: Nginx image, local port mapping, and health check.
- `public/brand/`: supplied logo variants.
