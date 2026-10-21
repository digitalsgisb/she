# Red Tag / Safety genba

Open **Safety → Red Tag · Safety genba** to record the Tuesday committee inspection. Inspections can also be saved on other dates. Each finding has a date, section, machine/equipment, hazard, before picture, type of stop, rank, recommendation, PIC, status, and the signed-in issuer. Stop types and ranks use your existing classifications as text. IDs use RTyyMM-001 and increment per month within SHE Digital. This is a separate sequence from the old AppSheet sheet.

## Set up committee and PIC accounts

1. In **User Management**, create each account. Keep PICs as the **User** role.
2. Give committee members the **Safety Committee** role. Workspace tools are shared by all accounts; no feature checkboxes are needed.
3. In **Red Tag → Manage sections & PICs**, link each section/PIC name to the corresponding login account. Unlinked PIC names can still be recorded, but no account receives that finding until linked.
4. Share the same deployed SHE Digital URL with each PIC. They can install it to their phone's Home Screen using the existing installation instructions. PICs open **My Red Tag Actions** from Home or More.

The initial section/PIC list contains all 17 pairs supplied, across 10 sections. Executives and Admins can add, rename, or remove section and PIC names. Editing names preserves the original text on historical findings. Changing the account for an unchanged section/PIC pair reassigns unresolved findings for that pair. Removing or renaming a pair leaves existing assigned findings with their current owner; create the desired current mapping before recording new findings. Closed/resolved findings retain their assignee.

## Simple phone workflow for PICs

Safety Committee members get an action-focused Home and Red Tag screen with local status filters. New findings follow three steps: **Where**, **What happened**, and **Next action**. Back navigation retains answers and the selected photo; required fields are checked before moving forward. Committee screens hide printing, spreadsheet export, and print confirmation controls.

PICs see their pending assigned findings across dates, with an optional **Show completed** switch. The inbox refreshes every 15 seconds while visible. Open a finding, read the hazard/recommendation and before picture, describe what was fixed, then use **Take a photo** or **Choose from gallery**. Send it with **Send to SHE for verification**. **Save progress for later** keeps the finding in progress without requiring an after photo. Completed submissions require an after photo. The original and after images remain separate in the action history.

Phone JPEG, PNG and WebP originals up to 30 MB are resized to at most 1,600 pixels on the longest side and compressed as needed before sending. Stored pictures are limited to 2 MB. Unsupported photo formats need conversion or a fresh JPEG camera photo. Notes and optimized after photos are saved as a draft on the current device when local storage is available; successful sending clears the draft. Drafts are separated by account and finding. A failed send retains the composer and photo so the PIC can retry. Submissions require an internet connection; this is not an offline upload queue. The inbox updates inside the app; no email or operating-system push notifications are sent.

The workflow is **Open → In progress → Action taken · awaiting review → Resolved / Closed**. Only Executives/Admins can verify and resolve/close. Regular users can update their own or assigned findings. My Red Tag Actions lists assigned findings. All accounts can read genba findings and create new ones; only Executives/Admins can change section/PIC settings or verify completed actions. All writes require an authenticated session and CSRF token, with revision checks for conflicting updates.

## Print and Google Sheets export

Select a date, then **Print findings / Save PDF**. The physical form includes all finding fields, before photo, and action/verification signature spaces. Use the browser's Print command (Ctrl+P on a PC). Long descriptions wrap and continue instead of being truncated. Confirm printing from the finding detail only after printing succeeds.

**Export for Google Sheets** downloads that date's findings as CSV, with column names matching the existing red-tag terminology. In Google Sheets, use **File → Import → Upload → Insert new sheet(s)**. Keep the native export in a separate tab; the old Apps Script has positional photo columns, and its print routine expects Drive picture paths. Photos remain authenticated inside SHE Digital and are not copied to Drive or included as public image URLs in the CSV. The original Apps Script remains unchanged. CSV imports do not sync later status or photo changes; export again when needed. Native printing includes the photos directly.

## Roles and existing installations

All accounts share workspace features; per-account feature selections are no longer used. Roles still control privileged actions. Only Executives can open dashboards. Executives can manage regular User accounts, and Admins manage all accounts, including Safety Committee. Safety Committee phone navigation is Home, Red Tag, Air Leak and More.

Database migration runs automatically on application startup. Findings, photo evidence, PIC assignments, and action history live in the existing SQLite database volume. Back up the database before upgrading. Deploy with the normal rebuild command:

```sh
docker compose up -d --build --force-recreate
```

Validate the deployment by linking a test PIC account, submitting a finding, uploading an after photo from that phone, and verifying it from an Executive account. Existing Google Sheet/AppSheet findings are not imported automatically.

Backend checks: `python -m unittest -v test_server test_reporting.ReportingTests test_redtag.GenbaTests`. The new genba tests use an in-memory HTTP transport to test authenticated routes without external network access. The browser QA script covers desktop/mobile form submission, restricted PIC navigation, camera/gallery controls, image optimization, and a failed-send retry.

Browser checks: install Playwright for development, then run `node test_genba_ui.cjs`. Optional `SHE_QA_BROWSER` selects an installed Chrome/Chromium executable; `SHE_QA_PYTHON` selects Python and `SHE_QA_PLAYWRIGHT` selects the Playwright package. Screenshots are written to the ignored `.qa-temp` directory. Production runs without these development dependencies. The PIC inbox shows the latest 500 assigned findings.

## Executive statistics

The main Dashboard has concise Red Tag and Environmental totals. Detailed statistics have their own routes under the automatically expanding Dashboards menu: Patrol Dashboard, Red Tag Dashboard, and Environmental Dashboard. The main dashboard has summaries for all three. Forms and action pages remain separate. Statistical endpoints are restricted to Executives/Admins with access to the relevant module. Regular committee users and PICs do not receive these chart datasets. Charts use the month, year, or all-date selection; statuses are current statuses of findings recorded during that period, not counts of closure events during the period. The backlog always covers all dates. All-date activity charts show the 12 months ending at the selected trend month. No data produces an empty chart and no invented completion percentage.

Run statistics checks with `python -m unittest test_statistics.StatisticsTests` and `node test_statistics_ui.cjs` (using the same optional Playwright/browser/Python variables as genba UI tests). Browser fixtures are synthetic test data and are not inserted into the production database.
