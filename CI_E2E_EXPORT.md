CI E2E Dashboard Export (Puppeteer)

This document explains how the GitHub Actions workflow runs the Dashboard export e2e test, and how to run it locally.

Workflow file
- `.github/workflows/e2e-export.yml`

Secrets recommended (add to GitHub repository settings -> Secrets):
- `E2E_USER` - account with `view_reports` permission (default: `admin`)
- `E2E_PASS` - password for that account (default: `password`)

What the workflow does
1. Checkout code
2. Setup Node.js
3. Install root, backend and frontend dependencies
4. Build the frontend (`npm run build --prefix frontend`)
5. Start backend (`npm run start --prefix backend`) and serve the frontend build (`npx serve -s frontend/build -l 3000`)
6. Wait for backend (`http://localhost:5000/api`) and frontend (`http://localhost:3000`) to be reachable
7. Run the Puppeteer test: `backend/scripts/e2e_puppeteer_export_dashboard.js`
8. Upload logs as artifacts on completion/failure

Local run (mirror CI)

PowerShell example (Windows):

```powershell
# from repo root
npm ci
npm ci --prefix backend
npm ci --prefix frontend
npm run build --prefix frontend
# start backend in background
start /b cmd /c "npm run start --prefix backend > backend.log 2>&1"
# serve frontend build (requires npx serve available)
start /b cmd /c "npx serve -s frontend/build -l 3000 > frontend.log 2>&1"
# then run the Puppeteer script
node backend/scripts/e2e_puppeteer_export_dashboard.js
```

Notes and troubleshooting
- The Puppeteer script expects the Dashboard UI selectors to match the current app (input ids `#identifier`, `#password`, and visible buttons with text 'Xuất báo cáo' / 'Xuất Excel' / 'Xác nhận & Xuất'). If UI changes, update the script accordingly.
- The script downloads the exported file to a temporary folder and validates the XLSX using `exceljs` (sheet name contains `xanuicam_dashboard_DDMMYYYY` and header row contains `Tiêu đề` and `Người thực hiện`).
- Make sure the E2E account has permission `view_reports` and that the backend can connect to the database during CI.

If you want, I can add a GitHub Actions badge or add this doc into the project's main README.
