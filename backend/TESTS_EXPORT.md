Export tests and e2e notes

This file describes how to run automated checks for the tasks export flow and suggestions for a Puppeteer/Selenium e2e test.

1) Quick axios-based script (already added)

- Script: `backend/scripts/e2e_export_tasks_test.js`
- Purpose: Logs in, checks `/api/users/export/quota?module=tasks`, requests `/api/tasks/export` (with password), saves the downloaded file, then re-checks quota.

How to run:

```powershell
# from repo root
$env:API_BASE='http://localhost:5000/api'
$env:E2E_USER='admin'
$env:E2E_PASS='password'
node backend/scripts/e2e_export_tasks_test.js
```

2) Puppeteer / Selenium recommendation (manual)

- Start frontend (so UI flows can be exercised) and backend (API). Use Puppeteer to open the dashboard page, authenticate via UI, open the report export dropdown, select a format, fill the password modal, confirm export, and verify a file was downloaded to a temporary directory.
- Important checks:
  - Verify the `Content-Disposition` filename matches the expected pattern: `xanuicam_dashboard_DDMMYYYYhhmmss.ext`.
  - For Excel: open the generated file and confirm the sheet name equals `xanuicam_dashboard_DDMMYYYY` (date-only) and columns headers exist.
  - Verify server-side quota table (`tasks_export_actions`) has a new row for the actor.

A basic Puppeteer outline (not included fully here):
- Launch Chromium with `--disable-dev-shm-usage --no-sandbox --enable-features=NetworkService` (CI friendly).
- Set `page._client().send('Browser.setDownloadBehavior', {behavior: 'allow', downloadPath: tmpDir})` to capture downloads.
- Automate UI steps to trigger export and wait for file to appear in `tmpDir`.

3) Server-side assertions

- The backend now records export actions into `tasks_export_actions` (table created automatically if missing).
- Use a small DB query to confirm `SELECT COUNT(*) FROM tasks_export_actions WHERE actor_id = <id> AND created_at >= date_trunc('day', now());` to assert the per-day restriction.

4) Notes

- The backend export endpoint accepts optional `filename` and `sheet_name` hints in the POST body; the server will use them when setting the `Content-Disposition` header and sheet name (xlsx).
- The front-end already sends `filename` and `sheet_name` when initiating dashboard exports to produce filenames like `xanuicam_dashboard_DDMMYYYYhhmmss.xlsx`.

If you want, I can add a full Puppeteer test file that exercises the real UI and downloads the file automatically.
