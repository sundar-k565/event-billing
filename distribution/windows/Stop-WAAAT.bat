@echo off
setlocal
cd /d "%~dp0"
docker.exe compose -f compose.yaml stop
if errorlevel 1 (
  echo Could not stop WAAAT POS. Check Docker Desktop is running.
  pause
) else (
  echo WAAAT POS is stopped. Your saved bills are still on this laptop.
  pause
)
