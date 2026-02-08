@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════╗
echo  ║   The Third Eye — Release Script     ║
echo  ╚══════════════════════════════════════╝
echo.

:: ─── Check tools ───
where gh >nul 2>&1 || (echo  [ERROR] gh CLI not found. & pause & exit /b 1)
where git >nul 2>&1 || (echo  [ERROR] git not found. & pause & exit /b 1)
where node >nul 2>&1 || (echo  [ERROR] node not found. & pause & exit /b 1)

:: ─── Read current version ───
for /f "tokens=2 delims=:, " %%a in ('findstr /c:"\"version\"" ui\package.json') do set "CURRENT=%%~a"
echo  Current version: %CURRENT%

:: ─── Ask for new version ───
set /p "VERSION=  New version (e.g. 1.2.0): "
if "%VERSION%"=="" (echo  [ERROR] No version provided. & pause & exit /b 1)

echo.
set /p "NOTES=  Release notes: "
if "%NOTES%"=="" set "NOTES=v%VERSION%"

echo.
echo  ─────────────────────────────────────
echo   %CURRENT% → %VERSION%
echo   Notes: %NOTES%
echo  ─────────────────────────────────────
echo.
set /p "CONFIRM=  Proceed? (y/n): "
if /i not "%CONFIRM%"=="y" (echo  Aborted. & pause & exit /b 0)

echo.
echo  [1/6] Bumping version to %VERSION%...

:: ─── Bump versions ───
node scripts\bump.js %VERSION%

if %errorlevel% neq 0 (echo  [ERROR] Version bump failed. & pause & exit /b 1)
echo  [OK] Version bumped.
echo.

:: ─── Find CMake and GCC ───
set "CLION_BASE=C:\Program Files\JetBrains"
for /f "delims=" %%d in ('dir /b /ad /o-n "%CLION_BASE%\CLion*" 2^>nul') do (
    set "CLION_DIR=%CLION_BASE%\%%d"
    goto :found_clion
)
echo  [ERROR] CLion not found.
pause
exit /b 1

:found_clion
set "CMAKE_DIR=!CLION_DIR!\bin\cmake\win\x64\bin"
set "MINGW_DIR=!CLION_DIR!\bin\mingw\bin"
set "PATH=!CMAKE_DIR!;!MINGW_DIR!;%PATH%"

echo  [2/6] Building C++ agent...
taskkill /f /im the_third_eye.exe >nul 2>&1
cmake -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release >nul 2>&1
cmake --build build 2>&1
if %errorlevel% neq 0 (echo  [ERROR] Agent build failed. & pause & exit /b 1)
echo  [OK] Agent built.
echo.

echo  [3/6] Building UI...
pushd ui
call npx vite build >nul 2>&1
echo  [OK] UI built.
echo.

echo  [4/6] Packaging installer...
call npx electron-builder --win nsis >nul 2>&1
if %errorlevel% neq 0 (echo  [ERROR] electron-builder failed. & popd & pause & exit /b 1)
popd
echo  [OK] Installer packaged.
echo.

echo  [5/6] Pushing to GitHub...
git add -A >nul 2>&1
git commit -m "v%VERSION%: %NOTES%" >nul 2>&1
git push origin main >nul 2>&1
if %errorlevel% neq 0 (echo  [ERROR] Git push failed. & pause & exit /b 1)
echo  [OK] Code pushed.
echo.

echo  [6/6] Creating GitHub release v%VERSION%...
gh release create "v%VERSION%" --title "v%VERSION%" --notes "%NOTES%" "ui\dist-electron\the-third-eye-Setup-%VERSION%.exe" "ui\dist-electron\the-third-eye-Setup-%VERSION%.exe.blockmap" "ui\dist-electron\latest.yml"
if %errorlevel% neq 0 (echo  [ERROR] Release creation failed. & pause & exit /b 1)

echo.
echo  ════════════════════════════════════════
echo   v%VERSION% released!
echo  ════════════════════════════════════════
echo.
pause
