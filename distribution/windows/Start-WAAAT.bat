@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-WAAAT.ps1"
if errorlevel 1 (
  echo.
  echo WAAAT POS did not start. Read the message above, then press any key.
  pause >nul
)
