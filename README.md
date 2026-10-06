# SHE Digital

SHE Digital is Sugihara's SHE workspace. The Dashboard summarizes Safety, Health, and Environmental in one place. Each top-level section opens its own landing page so more features can be added without replacing the section overview. Safety currently has the Daily Safety Patrol Checklist and a separate Patrol Overview & History page. Health has a landing page ready for future modules; Environmental lists planned Red Tag, Hiyari Hatto, Waste, and Environmental Findings pages.

## Daily Safety Patrol Checklist

The patrol page now includes a **Checklist** selector and **Create checklist** builder. Any signed-in user can create a shared checklist with a title, description, and up to 100 questions. Questions support OK / NOT OK / N/A, written answers, multiple choice, and photo uploads, with required settings and question reordering. Users edit their own checklists; Executives and Admins can edit all checklists. Each submission stores its checklist definition so later changes preserve the original report. Conflicting edits and submissions using an outdated checklist revision are rejected with a reload message.

**Patrol Overview & History** opens to **Day**, with a date picker and Week / Month options. Daily report cards show the inspector, findings count, remarks, and attachment thumbnails before the activity charts. JPEG, PNG, GIF, and WebP photos open full size in a new tab; HEIC and other files remain downloadable. Required photo questions must be uploaded before a custom patrol appears in completed reports. If an upload fails, the saved patrol detail allows the missing question photos to be added and the submission finished.

Open reports, patrol details, checklist selectors, and dashboard counts refresh from the shared server every **5 seconds** while the page is visible, and reconnect when the device comes online or the page becomes visible. All devices must use the same deployed SHE Digital URL. Existing report permissions still apply: Users see their own reports; Executives and Admins see all reports. Unsubmitted form drafts remain on the current device. Deploy the updated application with `docker compose up -d --build --force-recreate` to make these changes available on the live server.

Open **Safety → Daily Safety Patrol Checklist** to submit an inspection. The form includes the inspector (Sara, Aman, or another name), all 23 items from the supplied checklist with OK / NOT OK / N/A choices, a required 1–3 star overall rating, remarks, and up to 10 attachments of 1 GB each. Answers and remarks are saved as a local draft on the current device while the form is open; attachments must be selected again after a reload. Submission requires a connection.

The **Safety → Patrol Overview & History** page shows weekly and monthly monitoring, including completed patrols, patrols with findings, NOT OK answers, OK rate excluding N/A, activity, and findings by section. Its history can be searched or filtered to patrols with findings, and each record opens its full answers and attachments. The **Safety** landing page links to both patrol features and summarizes the current month. Users see their own patrols and monitoring; Executives and Admins see all patrols. Only Admins manage accounts. Existing user databases migrate automatically to support the Executive role. Patrols and attachment files are stored beside the SQLite database, so the existing Docker volume persists them. All patrol endpoints require a signed-in session; submissions and uploads also require the CSRF token.

On phones and in the installed PWA, a SHE-green bottom bar provides quick links to Home, Patrol, History, and Orders. **More** opens the full sidebar with Safety, Health, Environmental, My Account, and User Management for admins. The bar stays out of the way of the patrol form's submit controls and respects phone safe areas.

## CMMS SHE work orders

SHE Digital now has a **SHE Work Orders** page. It reads live CMMS orders whose responsible department is `SHE`, supports issuing an order with an issue photo, shows status, maintenance notes and evidence, allows SHE follow-up notes and photos, and lets users close or return a resolved job. CMMS remains the authoritative work-order database. SHE Digital checks its own login and CSRF token before forwarding each action. A dedicated CMMS requester account represents the SHE department; SHE Digital records the individual Safety user's display name in the reported-by field and follow-up/verification notes. CMMS activity actor IDs therefore identify the integration account, while the text records the Safety user.

1. Deploy the accompanying CMMS changes in the `cmms` checkout. They notify SHE requester accounts about newly issued SHE orders and allow department requesters to add notes and evidence to their department's jobs.
2. In CMMS **Users → People**, create a dedicated active user with role **Requester**, department exactly **SHE**, and plant access for the plant(s) SHE Digital should show. Use a strong unique password. Configure CMMS Web Push VAPID keys if phone notifications are required.
3. In the SHE Digital deployment directory, copy `.env.example` to `.env` and set `CMMS_URL`, `CMMS_USERNAME`, and `CMMS_PASSWORD`. `CMMS_URL` must be reachable by the SHE Digital container. When both apps run on the same Docker host and CMMS publishes port 3300, `http://host.docker.internal:3300` works with the supplied Compose file. Keep `.env` private; it is ignored by Git.
4. Rebuild and restart both applications. Sign in to SHE Digital and open **SHE Work Orders**. Select a plant, issue a test order, attach a photo, and confirm the order appears in CMMS. After maintenance resolves it, review its summary and completion photo, then close or return it from SHE Digital.

SHE Digital refreshes the work-order list every 30 seconds while open and shows an in-app alert for newly seen orders. On the work-order page, choose **Enable alerts** to register that device for Web Push through CMMS. Push requires the CMMS VAPID configuration and HTTPS for phone access. On iPhone and iPad, install SHE Digital to the Home Screen first. The PWA has 192 px and 512 px install icons, a maskable icon, and an Apple touch icon. The Account page includes installation guidance. Use HTTPS on phones for PWA installation, authentication, and notifications. The shell can load from cache offline, but sign-in, patrol submissions, and work-order actions need a connection.

The app includes a login page and account management. Admins can create users, edit names and roles, activate or deactivate accounts, and reset passwords. Password fields have a Show/Hide control for text being entered; stored passwords cannot be displayed because only hashes are kept. Every user can change their own password. Account data and sessions are stored in a persistent SQLite database inside a Docker named volume. The app uses Python's standard library and needs no package installation during the image build.

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

`docker compose build` alone only creates an image; it does not replace the running container. The `up` command above starts the new image. After updating, close any already-open SHE Digital tabs and open the site again. The HTML now references versioned CSS and JavaScript URLs so the browser loads matching files. If a tab still looks old, use a hard refresh (`Ctrl+F5`). Check `docker compose ps` to confirm the rebuilt container is running.

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
