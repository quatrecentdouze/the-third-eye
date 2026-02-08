@echo off
setlocal enabledelayedexpansion
title the-third-eye Build
echo.
echo  ========================================
echo   the-third-eye - Build
echo  ========================================
echo.

set "MISSING=0"
set "CMAKE_CMD="
set "GCC_CMD="

where cmake >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%i in ('where cmake') do if not defined CMAKE_CMD set "CMAKE_CMD=%%i"
) else (
    for %%P in (
        "C:\Program Files\CMake\bin\cmake.exe"
        "C:\Program Files (x86)\CMake\bin\cmake.exe"
    ) do if exist %%P if not defined CMAKE_CMD set "CMAKE_CMD=%%~P"

    if not defined CMAKE_CMD (
        for /f "delims=" %%D in ('dir /b "C:\Program Files\JetBrains" 2^>nul') do (
            if exist "C:\Program Files\JetBrains\%%D\bin\cmake\win\x64\bin\cmake.exe" (
                if not defined CMAKE_CMD set "CMAKE_CMD=C:\Program Files\JetBrains\%%D\bin\cmake\win\x64\bin\cmake.exe"
            )
        )
    )
)

if not defined CMAKE_CMD (
    echo  [MISSING] CMake not found.
    echo            Install: https://cmake.org/download/
    echo            Or:      winget install Kitware.CMake
    echo.
    set "MISSING=1"
) else (
    echo  [OK] CMake: !CMAKE_CMD!
)

where gcc >nul 2>&1
if %errorlevel% equ 0 (
    for /f "delims=" %%i in ('where gcc') do if not defined GCC_CMD set "GCC_CMD=%%i"
) else (
    for %%P in (
        "C:\mingw64\bin\gcc.exe"
        "C:\mingw\bin\gcc.exe"
        "C:\msys64\mingw64\bin\gcc.exe"
        "C:\msys64\ucrt64\bin\gcc.exe"
    ) do if exist %%P if not defined GCC_CMD set "GCC_CMD=%%~P"

    if not defined GCC_CMD for /f "delims=" %%D in ('dir /b /s "C:\Program Files\JetBrains\gcc.exe" 2^>nul') do (
        if not defined GCC_CMD set "GCC_CMD=%%D"
    )
)

if not defined GCC_CMD (
    where cl >nul 2>&1
    if !errorlevel! equ 0 (
        echo  [OK] Compiler: MSVC ^(cl.exe^)
    ) else (
        echo  [MISSING] C++ compiler not found ^(GCC/MinGW or MSVC^).
        echo            Install MinGW-w64: https://www.mingw-w64.org/
        echo            Or:                winget install MSYS2.MSYS2
        echo.
        set "MISSING=1"
    )
) else (
    for %%F in ("!GCC_CMD!") do set "MINGW_BIN=%%~dpF"
    set "PATH=!MINGW_BIN!;!PATH!"
    echo  [OK] GCC:   !GCC_CMD!
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [MISSING] Node.js not found.
    echo            Install: https://nodejs.org/
    echo            Or:      winget install OpenJS.NodeJS.LTS
    echo.
    set "MISSING=1"
) else (
    echo  [OK] Node.js found
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [MISSING] npm not found ^(comes with Node.js^).
    echo            Install Node.js: https://nodejs.org/
    echo.
    set "MISSING=1"
) else (
    echo  [OK] npm found
)

echo.

if %MISSING% equ 1 (
    echo  [ERROR] Missing dependencies. Install them and re-run build.bat.
    echo.
    pause
    exit /b 1
)

if defined CMAKE_CMD (
    for %%F in ("!CMAKE_CMD!") do set "CMAKE_BIN=%%~dpF"
    set "PATH=!CMAKE_BIN!;!PATH!"
)

echo  [1/2] Building the agent...
echo.

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

cmake -B "%PROJECT_DIR%\build" -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release -S "%PROJECT_DIR%"
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] CMake configuration failed.
    pause
    exit /b 1
)

cmake --build "%PROJECT_DIR%\build"
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Agent build failed.
    pause
    exit /b 1
)

echo.
echo  [OK] Agent built: build\the_third_eye.exe
echo.

echo  [2/2] Building the UI...
echo.

pushd "%PROJECT_DIR%\ui"

call npm install
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] npm install failed.
    popd
    pause
    exit /b 1
)

call npx vite build
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] UI build failed.
    popd
    pause
    exit /b 1
)

popd

echo.
echo  [OK] UI built.
echo.

echo  [3/3] Packaging portable .exe...
echo.

pushd "%PROJECT_DIR%\ui"

call npx electron-builder --win nsis
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] electron-builder failed.
    popd
    pause
    exit /b 1
)

popd

echo.
echo  ========================================
echo   Build complete!
echo  ========================================
echo.
echo  Portable .exe: ui\dist-electron\
echo  To develop:    start.bat
echo.
pause
