@echo off
REM Start CRA dev server in background and redirect logs to frontend\frontend_start.log
cd /d %~dp0\..\frontend
if not exist package.json (
  echo frontend package.json not found in %CD%
  exit /b 1
)
start /B cmd /C "npm start > frontend_start.log 2>&1"
echo Started frontend in background; logs -> %CD%\frontend_start.log
