# Run instructions for Computer Configs development

This project contains frontend and backend services. Use the following steps to run and test the `/computer-configs` page locally.

1) Start backend (API):

```powershell
cd backend
npm run dev
```

Backend listens by default on `http://localhost:5000`.

2) Start frontend (UI):

```powershell
cd frontend
npm start
```

If port 3000 is busy the frontend dev server will suggest another port (e.g., 3001). Note that the e2e script expects the frontend at `http://localhost:3001` by default; override via `URL` env var.

3) Run unit tests for frontend helpers:

```bash
cd frontend
npm test -- --watchAll=false
```

4) Run Puppeteer e2e smoke test (requires Chrome/Chromium or Puppeteer's bundled Chromium):

```bash
cd frontend
npm run e2e
# or override target URL
URL=http://localhost:3001/computer-configs npm run e2e
```

Artifacts: The e2e script saves screenshots `e2e_computer_configs_list.png` or `e2e_computer_configs_modal.png` in the `frontend` folder.

If you want me to run these in the current environment, say so and I'll attempt them; note I previously encountered terminal instability when starting detached processes here.
