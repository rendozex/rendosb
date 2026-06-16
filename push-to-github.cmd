@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0push-to-github.ps1" %*
if errorlevel 1 (
  echo.
  echo Push failed. See errors above.
  pause
  exit /b 1
)
pause