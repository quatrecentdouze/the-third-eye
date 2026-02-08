@echo off
title the-third-eye Launcher
echo.
echo  [the-third-eye] Starting agent + UI...
echo.

:: Kill any existing instances
taskkill /F /IM the_third_eye.exe >nul 2>&1

:: Start the agent in background
start "" /B "%~dp0build\the_third_eye.exe" --port 9100 --interval 2 --log-level info
echo  [OK] Agent started on http://127.0.0.1:9100

:: Wait a moment for the agent to bind the port
timeout /t 2 /nobreak >nul

:: Launch Electron UI (uses production build from dist/)
echo  [OK] Launching UI...
start "" "%~dp0ui\node_modules\electron\dist\electron.exe" "%~dp0ui"

echo  [OK] All running. Close this window to stop the agent.
echo.

:: Keep this window open — closing it kills the agent
pause >nul
taskkill /F /IM the_third_eye.exe >nul 2>&1
