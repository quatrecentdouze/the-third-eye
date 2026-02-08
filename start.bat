@echo off
title the-third-eye Launcher
echo.
echo  [the-third-eye] Starting agent + UI...
echo.

taskkill /F /IM the_third_eye.exe >nul 2>&1

start "" /B "%~dp0build\the_third_eye.exe" --port 9100 --interval 2 --log-level info
echo  [OK] Agent started on http://127.0.0.1:9100

timeout /t 2 /nobreak >nul

echo  [OK] Launching UI...
start "" "%~dp0ui\node_modules\electron\dist\electron.exe" "%~dp0ui"

echo  [OK] All running. Close this window to stop the agent.
echo.

pause >nul
taskkill /F /IM the_third_eye.exe >nul 2>&1
