PM2 cron and Windows Task Scheduler instructions for pruning old sessions

PM2 (recommended CLI):

Run once to start a cron-managed job that executes `scripts/prune_sessions.js` every day at 03:00 server time:

```powershell
cd E:\ubndxanuicam_internet\backend
pm2 start scripts/prune_sessions.js --name prune-sessions --cron "0 3 * * *"
```

This tells PM2 to run the script and schedule a restart at 03:00 each day. If you prefer to use the ecosystem file, ensure the `prune-sessions` entry exists in `ecosystem.config.js` and then run:

```powershell
pm2 start ecosystem.config.js --only prune-sessions
```

Windows Task Scheduler (alternate):

1. Open Task Scheduler > Create Basic Task...
2. Name: "Prune UBND sessions"
3. Trigger: Daily at 03:00
4. Action: Start a program
   - Program/script: C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe
   - Add arguments (replace paths as needed):
     -ExecutionPolicy Bypass -NoProfile -Command "cd 'E:\\ubndxanuicam_internet\\backend'; node scripts/prune_sessions.js"
5. Finish and ensure "Run whether user is logged on or not" is selected and highest privileges if needed.

Notes:
- The worker `backend/src/workers/sessionPruner.js` also runs in-process when the main `server.js` starts (it prunes once immediately and then schedules daily runs). Use that if you want pruning tied to the backend process instead of an external scheduler.
- When using the PM2 CLI `--cron` option, ensure your PM2 version supports `--cron` and that system timezone is correct.
