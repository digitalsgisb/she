# SHE Digital

SHE Digital is Sugihara's SHE workspace. Dashboards are separated into Safety, Health, and Environment. Safety has the Daily Safety Patrol Checklist and Patrol History. Health has a landing page ready for future modules. Environmental includes public Environment, Hiyari Hatto and Kaizen reporting, Executive form management and a SHE follow-up inbox. Safety also includes Red Tag / Safety genba and a phone-focused PIC action inbox. Waste remains a planned module.

## Executive dashboards

The Safety department's five requested dashboards and FR-SH-12 Hiyari Hatto form are now available. See [dashboard data entry, template workflow and deployment](docs/five-dashboards.md). Historical spreadsheet rows have not been imported; checked monthly figures can be entered in the new registers.

The dashboard entry lets users choose **Safety**, **Health**, or **Environment**. The Safety header includes a **Safety module** selector for Patrol and Red Tag / Safety genba. The Environment header includes reporting-area, period and date filters. Health has its own dashboard with an empty state until health modules are added. Statistical dashboards remain Executive/Admin only and respect each account's module permissions.

Dashboard headers use the SHE green theme with area navigation and filters above the figures and charts. Charts retain Overview and secondary tabs, period filters and automatic refresh. Layouts adapt to desktop and phones; scrolling is available for longer content. Selecting a chart opens matching records as **dark green photo cards** with a status badge, date, short description and key details. Each card opens the original full record. Missing photos show a clear empty state. Photos use authenticated endpoints and are loaded only for the current result page.


The combined summary page has been removed. Each area dashboard has its own page; forms, genba findings, PIC actions and patrol history stay on their working pages. Patrol charts include follow-up distribution, OK / NOT OK / N/A answers, NOT OK sections, activity, inspectors, checklist use and overall ratings. Incomplete patrol submissions and written/choice answers are excluded from inspection counts. The OK rate excludes N/A. Follow-up counts apply to patrols with original NOT OK answers, so clear patrols do not inflate the backlog.

Red Tag has status/rank pies, section/stop bars, activity and PIC follow-up. Environmental has status/factory pies, topic/location/workflow bars and activity, with Environment, Hiyari Hatto, Kaizen or all-area filters. Month, Year and All dates views use Kuala Lumpur dates; selected-period totals are separate from the all-date backlog. Totals use the full database. Dashboards refresh every 30 seconds while visible. Dashboards and statistical data endpoints are available to Administrator and Executive roles; PIC screens retain their simple action workflow.

Hover a chart segment, bar, activity point or summary figure to see its count. Click it (or press Enter/Space) to open a paginated list matching the chart category and period, then open the original finding, report or patrol. “Other entries” includes the categories grouped by the chart; PIC workload links also match the section. Patrol answer charts show matching checklist answers and distinct patrol counts separately. Returning to a dashboard restores its period and chart tab. Dashboard navigation and tab changes use short transitions and respect reduced-motion preferences. Filtered record endpoints retain Executive/Admin and module access checks.

## Red Tag / Tuesday safety genba

Record genba hazards with before pictures, assign section/PIC accounts, print dated physical forms, and export finding details for Google Sheets. PICs receive assigned findings in **My Red Tag Actions**, take or select after photos on their phone, and send completed actions for SHE verification. All accounts share workspace features. Roles control privileged actions; per-account feature checkboxes have been removed. See [setup, PIC workflow, printing and export](docs/red-tag-genba.md). Deploy the updated server before using these features.

## Public SHE reporting and environmental programme

The public **`/report`** page needs no login and offers **Environment**, **Hiyari Hatto**, and **Kaizen**. Share `https://she.sugidigital.org/report` after deploying this version. Environment includes water leakage, oil / chemical spillage, improper waste disposal, waste segregation, drainage / discharge, equipment leakage, energy wastage, and other concerns. Hiyari Hatto and Kaizen initially collect near misses and improvement ideas for SHE review.

Reports collect name, optional contact / department, plant, location, form answers, and up to three JPEG, PNG or WebP photos (2 MB per photo). Guests receive a reference number. All signed-in staff, including Operators, can view all reports and photos in **Environmental → SHE Reporting Inbox**. Operators have read-only access; only Executives and Admins can record follow-up actions, manage forms, or retry/link work orders. Photos are stored with the report in SQLite; they are not automatically copied to CMMS. The inbox shows the latest 500 reports, with search and filters. Follow-up actions record the actor, date, note, and Open / In progress / Resolved / Closed status.

**Environmental → Reporting Forms** lets Executives and Admins create, edit, preview, and delete forms. Edit the title, description, icon, reporting area and workflow; add, remove, reorder and edit questions. Questions support short/long answers, choices, numbers and dates, with optional required answers. Name, contact, plant, location and photos are shared fields. Deletion removes a form from the public portal while retaining existing reports. Reports store their original form definition. Stale form submissions and conflicting edits are rejected.

**Water leakage automatically attempts to issue a CMMS Kaizen work order**, under the configured SHE requester account, with the reporter's name, plant, location, answers and SHE reference. Other environmental forms initially go to SHE review. Executives can change the workflow per form. Configure the existing `CMMS_URL`, `CMMS_USERNAME` and `CMMS_PASSWORD` before using automatic orders. Reports are committed before the remote request. A known failure can be retried from the report detail. For uncertain remote results (including interrupted requests), search CMMS for the SHE reference, then link the matching existing SHE Kaizen order. If no order exists, manually issue a SHE Kaizen order containing that reference and link it. This avoids blind retries that could duplicate an order. Follow-up status in SHE is separate from CMMS work-order status; the **Open work order** link opens the existing CMMS workflow.

Submission retries retain the same request key and body to avoid duplicate reports and orders. Public submissions require a short-lived reporting token and same-origin requests. The process applies a limit of 300 submissions per client IP per 10 minutes; behind a reverse proxy this may be a shared address, so account for that when planning a large launch. Keep this endpoint online and use the same deployed URL on all devices. Database backups must include the reports and their photo data.

### Reusing the already printed QR

The supplied QR decodes to **`https://cmms.sugidigital.org/requester?plant=port-klang`**. It points at a general requester entry, rather than a dedicated environmental QR identifier. The printed code cannot be rewritten. It can be reused if the owner of that CMMS hostname changes what the exact URL does.

After confirming with the CMMS owner that this exact link is retired, configure a **temporary HTTP 302 redirect**, at CMMS or its reverse proxy, from that exact hostname + `/requester` + `plant=port-klang` to `https://she.sugidigital.org/report`. Match only that GET navigation; keep CMMS APIs and other routes working. Do not redirect the entire CMMS hostname. Use 302 during rollout so the destination can be adjusted without a permanent cached redirect. Test the original QR on a phone before announcing the programme.

The owner has confirmed the old QR link is retired and should go directly to SHE reporting. The adjacent CMMS checkout (`../CMMS/apps/api/src/server.ts`) now implements the temporary 302 redirect for this exact hostname, path and single `plant=port-klang` query parameter, with caching disabled. Deploy SHE Digital first, then rebuild and restart CMMS to activate it. No live redirect or CMMS shutdown has been applied. Keep the CMMS hostname reachable; its backend must remain running if water leakage should automatically issue Kaizen work orders.

Deploy with the existing rebuild command: `docker compose up -d --build --force-recreate`. Verify a standard guest report appears in the Executive inbox, issue a test water leakage report and confirm its Kaizen order in CMMS, then edit and preview a form. Run backend tests with `python -m unittest -v test_server.py test_reporting.ReportingTests` (CMMS calls in reporting tests are mocked).

## Daily Safety Patrol Checklist

Completed patrols now support **two-way follow-up** between the submitter and SHE Executives/Admins. From a daily report, choose **Reply / Add action photos** to see original evidence, a dated conversation, and a reply composer. Written replies and photos are optional individually, but each update needs a message or a photo. Attach up to 10 action photos per reply; they appear with that update, separately from the original patrol photos. Upload progress and retry preserve successfully uploaded files and avoid reposting the reply when only a photo fails. The full original checklist opens on demand below the findings.

Follow-up status is **Open**, **Action taken · awaiting review**, or **Resolved**. Submitters can share actions and reopen their own patrols; only Executives and Admins can verify and resolve them. Existing access rules apply to conversations and photos. New replies refresh every 5 seconds without replacing the reply composer, so typing and selected photos survive incoming updates. Daily report cards show status and update count. Replies need a connection; they are not queued offline.

Patrol inspection and multiple-choice answers use visible tap buttons on both phones and PCs. OK, NOT OK, and N/A have distinct selected states. Optional questions include **Clear answer**, and every item remark and the overall patrol remarks remain optional.

Every checklist item now has an optional **Remarks for this item** box, including inspection, written-answer, multiple-choice, and photo questions in default and custom checklists. Item remarks support up to 2,000 characters, are restored with the device's draft, and appear beside their item in the submitted report. Overall patrol remarks are still available. Older reports remain readable with no item remarks.

Executives and Admins can also edit the existing **Daily Safety Patrol Checklist**. Open the patrol form, select the checklist, click **Edit checklist**, then use **Choose an item to edit** to jump to a specific inspection item. Change its wording, answer type, choices, or required setting, or add, remove, and reorder items, then save. The existing 23 items are available automatically, and edits persist across restarts. Regular users can fill the default checklist but cannot edit it. Submitted reports retain their original checklist wording.

The patrol page now includes a **Checklist** selector and **Create checklist** builder. Any signed-in user can create a shared checklist with a title, description, and up to 100 questions. Questions support OK / NOT OK / N/A, written answers, multiple choice, and photo uploads, with required settings and question reordering. Users edit their own checklists; Executives and Admins can edit all checklists. Each submission stores its checklist definition so later changes preserve the original report. Conflicting edits and submissions using an outdated checklist revision are rejected with a reload message.

**Patrol History** opens to **Day**, with a date picker and Week / Month options. Daily report cards show the inspector, findings count, remarks, and attachment thumbnails on the history page. JPEG, PNG, GIF, and WebP photos open full size in a new tab; HEIC and other files remain downloadable. Required photo questions must be uploaded before a custom patrol appears in completed reports. If an upload fails, the saved patrol detail allows the missing question photos to be added and the submission finished.

Open reports, patrol details, checklist selectors, and dashboard counts refresh from the shared server every **5 seconds** while the page is visible, and reconnect when the device comes online or the page becomes visible. All devices must use the same deployed SHE Digital URL. Existing report permissions still apply: Users see their own reports; Executives and Admins see all reports. Unsubmitted form drafts remain on the current device. Deploy the updated application with `docker compose up -d --build --force-recreate` to make these changes available on the live server.

Open **Safety → Daily Safety Patrol Checklist** to submit an inspection. The form includes the inspector (Sara, Aman, or another name), all 23 items from the supplied checklist with OK / NOT OK / N/A choices, a required 1–3 star overall rating, remarks, and up to 10 attachments of 1 GB each. Answers and remarks are saved as a local draft on the current device while the form is open; attachments must be selected again after a reload. Submission requires a connection.

The **Safety → Patrol History** page lists completed reports for a selected day, week, or month. Search inspectors/checklists, filter follow-up status, or show only patrols with findings. Users can review their own patrols; Executives/Admins can review all patrols and open the separate **Patrol Dashboard** for statistics. Submitted patrols and attachment files remain in the existing persistent storage. All patrol endpoints require a signed-in session; writes also require a CSRF token.

On phones and in the installed PWA, a SHE-green bottom bar provides quick links to Home, Patrol, History, and Orders. **More** opens the full sidebar with Safety, Health, Environmental, My Account, and User Management for admins. The bar stays out of the way of the patrol form's submit controls and respects phone safe areas.

## CMMS SHE work orders

SHE Digital now has a **SHE Work Orders** page. It reads live CMMS orders whose responsible department is `SHE`, supports issuing an order with an issue photo, shows status, maintenance notes and evidence, allows SHE follow-up notes and photos, and lets users close or return a resolved job. CMMS remains the authoritative work-order database. SHE Digital checks its own login and CSRF token before forwarding each action. A dedicated CMMS requester account represents the SHE department; SHE Digital records the individual Safety user's display name in the reported-by field and follow-up/verification notes. CMMS activity actor IDs therefore identify the integration account, while the text records the Safety user.

1. Deploy the accompanying CMMS changes in the `cmms` checkout. They notify SHE requester accounts about newly issued SHE orders and allow department requesters to add notes and evidence to their department's jobs.
2. In CMMS **Users → People**, create a dedicated active user with role **Requester**, department exactly **SHE**, and plant access for the plant(s) SHE Digital should show. Use a strong unique password. Configure CMMS Web Push VAPID keys if phone notifications are required.
3. In the SHE Digital deployment directory, copy `.env.example` to `.env` and set `CMMS_URL`, `CMMS_USERNAME`, and `CMMS_PASSWORD`. `CMMS_URL` must be reachable by the SHE Digital container. When both apps run on the same Docker host and CMMS publishes port 3300, `http://host.docker.internal:3300` works with the supplied Compose file. Keep `.env` private; it is ignored by Git.
4. Rebuild and restart both applications. Sign in to SHE Digital and open **SHE Work Orders**. Select a plant, issue a test order, attach a photo, and confirm the order appears in CMMS. After maintenance resolves it, review its summary and completion photo, then close or return it from SHE Digital.

SHE Digital refreshes the work-order list every 30 seconds while open and shows an in-app alert for newly seen orders. On the work-order page, choose **Enable alerts** to register that device for Web Push through CMMS. Push requires the CMMS VAPID configuration and HTTPS for phone access. On iPhone and iPad, install SHE Digital to the Home Screen first. The PWA has 192 px and 512 px install icons, a maskable icon, and an Apple touch icon. The Account page includes installation guidance. Use HTTPS on phones for PWA installation, authentication, and notifications. The shell can load from cache offline, but sign-in, patrol submissions, and work-order actions need a connection.

The app includes a login page and account management. Admins can create users, edit names and roles, activate or deactivate accounts, and reset passwords. Available roles are Administrator, Executive, User, and Safety Committee. Safety Committee has regular User permissions (including own patrols); only administrators can assign or manage this role. Its phone navigation is Home, Red Tag, Air Leak, and More. Home contains quick actions, and More contains the remaining tools. Dashboards are available to Administrator and Executive roles. Old feature-access selections are ignored. Existing databases migrate automatically on server startup, preserving accounts, sessions, and patrols. Password fields have a Show/Hide control for text being entered; stored passwords cannot be displayed because only hashes are kept. Every user can change their own password. Account data and sessions are stored in a persistent SQLite database inside a Docker named volume. The app uses Python's standard library and needs no package installation during the image build.

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

The command prompts for an admin username, display name, and password of at least 12 characters. The password is entered interactively and is not stored in a command, environment file, or Git. Run this only once. Later accounts are created in **User Management** after an Admin or Executive signs in (Executives create regular user accounts only).

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

## Air Leak reporting

The dedicated signed-in Air Leak form collects plant, section/location, equipment, leak details, optional immediate action and at least one required photo. Submitting saves a report and automatically creates a **maintenance** work order in the configured CMMS, with the equipment, location and report reference. Photos remain available in the SHE reporting inbox. The reporter can open the linked work order and view recent Air Leak receipts.

The existing CMMS Requester/SHE integration must be configured for the selected plant. If CMMS is unavailable, the report stays saved and shows that work-order follow-up is required. Repeating the same submission returns its existing receipt. If a response is uncertain, SHE must verify CMMS and link the existing maintenance order before retrying; this avoids duplicate orders.

Printed Red Tags include an offline-generated QR code and a clickable link to the exact finding. Set `SHE_PUBLIC_URL` in `.env` to the phone-accessible app address (default: `https://she.sugidigital.org`). The code opens `/#/red-tag/<record ID>` and preserves that destination through sign-in; existing viewing and action permissions still apply. Administrator and Executive accounts can use **Overview → Dashboards**, and the app opens dashboards by default for those roles when no page is specified.

## Report to SHE QR and alerts

Open **Environment → Report to SHE QR** to preview or download the public reporting QR. The same QR appears on the Environment landing page. It uses `SHE_PUBLIC_URL` and opens `/report`; all Report to SHE categories require at least one JPG, PNG or WebP picture (up to three, 2 MB each).

Administrators and Executives receive website pop-ups and an unread Reports indicator while signed in, checked every 20 seconds. Unread counts persist per account until **Mark notifications as read** is used in Environment, the QR page or Inbox. Phone notifications are opt-in on each device through **Enable phone notifications**. They open the submitted report in the authenticated SHE inbox. On iPhone/iPad, install the site on the Home Screen and enable alerts from that installed app. HTTPS and browser notification permission are required.

Rebuild the Docker image to install `requirements.txt` and include the alert files, or run `python -m pip install -r requirements.txt` for a local Python deployment. Web Push signing keys and device subscriptions persist in the database volume. Optionally set `SHE_PUSH_SUBJECT` to a contact such as `mailto:she@example.com`; it defaults to the public site URL. Phone deliveries are best effort; failed deliveries never prevent a report being saved, and expired subscriptions are removed. Website alerts remain available if the push dependency is missing. SHE report subscriptions use `/reporting-push/`, separately from CMMS work-order subscriptions.
