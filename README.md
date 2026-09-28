# Safety Digital

Safety Digital is Sugihara's SHE workspace. It has a Dashboard and sections for Safety, Health, and Environmental. The Environmental section contains placeholder pages for Red Tag, Hiyari Hatto, Waste, and Environmental Findings. Reporting forms and live metrics are still planned.

The app includes a login page and account management. Admins can create users, edit names and roles, activate or deactivate accounts, and reset passwords. Every user can change their own password. Account data and sessions are stored in a persistent SQLite database inside a Docker named volume. The app uses Python's standard library and needs no package installation during the image build.

The supplied Sugihara logo is stored in `public/brand/`, and the app uses `1.png`. The layout takes cues from the supplied CMMS screenshot; the green theme represents the SHE department. The Findings page lists issue topics from the supplied environmental reporting poster.

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

### 3. Build and create the first admin

```sh
cd /srv/apps/she
docker compose build
docker compose run --rm -it safety-digital python server.py create-admin
```

The command prompts for an admin username, display name, and password of at least 12 characters. The password is entered interactively and is not stored in a command, environment file, or Git. Run this only once. Later accounts are created in **User Management** after an admin signs in.

### 4. Start and verify

```sh
cd /srv/apps/she
docker compose up -d --build
docker compose ps
```

Open `http://localhost:3600` on the AI PC and sign in with the admin account. If the AI PC has no graphical browser, test the server from its terminal with `curl http://localhost:3600/healthz`; it should return `ok`. The container is configured to restart unless stopped manually.

If the page does not open, inspect the logs:

```sh
docker compose logs --tail=100 safety-digital
```

### 5. Connect `she.sugidigital.org` when the tunnel is ready

This repository does **not** create or configure a Cloudflare Tunnel. If `cloudflared` is installed and running **on the AI PC**, use the following route in the Cloudflare dashboard:

| Setting | Value |
| --- | --- |
| Route type | Published application |
| Hostname | `she.sugidigital.org` |
| Service | HTTP |
| Service URL | `http://localhost:3600` |

In Cloudflare, go to **Networking → Tunnels**, choose or create the tunnel, then add a **Published application** route with the values above. Follow Cloudflare's on-screen instructions to install and run `cloudflared` on the AI PC. Verify `http://localhost:3600` works locally first, then visit `https://she.sugidigital.org` after the tunnel connects. Keep tunnel tokens and credentials out of Git.

If `cloudflared` runs in **another Docker container**, `localhost` refers to that container, not the AI PC. Attach it to the same Docker network as this app and route to `http://safety-digital:8000`, or run `cloudflared` directly on the AI PC. The current Compose file is designed for the latter setup.

Cloudflare's [tunnel setup guide](https://developers.cloudflare.com/tunnel/get-started/) has the current dashboard instructions.

### 6. Update, back up, or stop

From the project directory on the AI PC:

```sh
git pull
docker compose up -d --build --force-recreate
```

`docker compose build` alone only creates an image; it does not replace the running container. The `up` command above starts the new image. After updating, close any already-open Safety Digital tabs and open the site again. The HTML now references versioned CSS and JavaScript URLs so the browser loads matching files. If a tab still looks old, use a hard refresh (`Ctrl+F5`). Check `docker compose ps` to confirm the rebuilt container is running.

To stop the app:

```sh
docker compose down
```

The `safety_data` Docker volume contains the SQLite database. `docker compose down` keeps it; do not use `docker compose down -v` unless you intend to erase the accounts and sessions. Back up the volume before moving to another PC or making major changes.

To run the account API checks locally where Python is installed:

```sh
python -m unittest -v test_server.py
```

## Project files

- `index.html`, `styles.css`, `script.js`: sign-in, dashboard, navigation, placeholder pages, and user management UI.
- `favicon.svg`: a green SHE leaf browser icon, separate from the Sugihara logo.
- `server.py`: HTTP server, SQLite database, authentication, and user management API.
- `Dockerfile`, `compose.yaml`: Python image, persistent volume, local port mapping, and health check.
- `public/brand/`: supplied logo variants.
