@echo off
REM Start backend in background and redirect logs to backend\backend_start.log
cd /d %~dp0\..\backend
if not exist server.js (
  echo server.js not found in %CD%
  exit /b 1
)
start /B cmd /C "node server.js > backend_start.log 2>&1"
echo Started backend in background; logs -> %CD%\backend_start.log
