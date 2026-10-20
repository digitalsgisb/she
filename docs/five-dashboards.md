# Safety department dashboard update

The dashboard landing page has five primary dashboards, grouped as requested:

| Area | Dashboard | Source in the app |
| --- | --- | --- |
| Safety | Monthly accident statistic | Executive monthly register: ten sections, off-job count and man-hours |
| Safety | SSFM (Redtag) Gemba summary | Existing Red Tag findings, status, rank, STOP classification, sections and PIC workload |
| Safety | Hiyari Hatto Summary | Hiyari Hatto reports with their event date and saved SHE review |
| Environment | No. of compound | Executive monthly compound register |
| Environment | No. of environmental findings | Executive monthly register for Spillage, Aedes Larvae, Stagnant Water and Others |

Safety Patrol remains available as an additional operational dashboard. Health and the existing reporting inbox remain available. Hiyari Hatto now has a form link in Safety.

## Monthly registers

Choose a year, select a month in the chart or register, enter counts and save. Enter `0` for a confirmed zero, leave a value blank when it has not been reported, or use `NA` when not applicable. Partial totals are marked. Empty months are never converted into confirmed zeroes. CSV export preserves blanks and NA.

The accident register follows the ten section rows in the supplied AR26 sheet. Off-job accidents are separate from on-job totals. IFR uses on-job accident count multiplied by 1,000,000 and divided by man-hours. It is unavailable when counts are incomplete or man-hours are missing/zero. The year headline IFR uses matching counts and hours only when every recorded month is complete and has positive hours; it never averages monthly IFRs.

Every save retains the actor, time and a complete prior revision in the history. Conflicting edits return a reload message. Accident access follows Safety patrol permission; the other new dashboards follow Reporting permission. Statistical pages and monthly writes require Executive/Admin access, with CSRF protection on writes.

Environmental inspection totals are entered explicitly, following the supplied workbook categories. They are separate from employee/guest environmental reports in the SHE inbox; public reports are not silently treated as inspection findings or compounds.

## FR-SH-12 Hiyari Hatto

The default form follows FR-SH-12 Rev 1 (06.02.2018):

- Part A captures employee number, shift, department, section, date, location, category, operation, experience, problem, hazard/consequence, proposed corrective action and STOP 6. Existing shared fields capture name, contact, factory and up to three photos; photographs can include sketches, with optional sketch descriptions.
- Executives/Admins complete Part B in the report detail: Head of Section name/employee number, rank, verified STOP classification, action, PIC and target date.
- Part C records the team member, Head of Section and SHE officer names. Rank A closure also requires a manager name. These are recorded review names; each save separately records the authenticated SHE editor and time.
- Incomplete reviews can be saved as Open/In progress. Resolution/closure requires the review fields. The ordinary follow-up endpoint cannot bypass that check. Original submissions keep their form snapshots.

The summary groups by category, rank, STOP, section and PIC. Select a group or month to open matching reports. Older reports without classification stay visible as Unclassified/Unspecified. Progress uses the current status of reports attributed to each event month; it is not a historical month-end status snapshot. Resolved and Closed both count as completed.

Open the original blank PDF from the summary or report detail. The completed report has a print action showing the original submission, saved review names, action details and evidence. Printing uses a readable app layout; it does not stamp data onto the master-copy PDF. The browser can save the print view as PDF.

The upgrade changes only the untouched legacy default form. If the default was edited or deleted, it preserves that choice and adds the supplied template once. It never rewrites old reports.

## Source data and deployment

The five supplied workbooks were used as requirements references. Historical workbook rows are not imported into operational records. The source contains broken formulas, older-year sheets and dates inconsistent with their tab labels; those require review before a historical migration. Existing app records remain available in their summaries. Monthly registers start unreported until SHE enters checked figures.

Deploy from the existing project with `docker compose up -d --build --force-recreate`. Back up the SQLite database before deployment as usual. New tables and the template migration are initialized automatically. No new Python packages are needed in production. Browser assets and the service-worker cache are versioned for this change.

Backend validation: `python -m unittest -q test_monitoring.MonitoringTests test_reporting.ReportingTests test_statistics test_redtag.GenbaTests`.

The `test_monitoring_ui.cjs` browser check expects an isolated server at `SHE_QA_URL` (default `http://127.0.0.1:3611`) with a disposable `qa-admin` / `QaPassword123!` account and an empty database. Never create that account on a live deployment. Supply Playwright and optional `SHE_QA_BROWSER` through the QA runtime. It exercises all five dashboard pages, monthly save/history/export, public form submission, rank A closure, print layout and phone overflow.
