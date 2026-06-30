@echo off
setlocal enabledelayedexpansion

echo.
echo  ============================================
echo   Metrology Management System - Setup
echo  ============================================
echo.

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found
    echo  Please install Node.js and check "Add to PATH"
    echo  Then restart your computer and try again
    pause
    exit /b 1
)
echo  [OK] Node.js found
node --version
echo.

set "PRJ=%~dp0"

echo  Project: %PRJ%
echo.
echo  [1/3] Installing server dependencies...

cd /d "%PRJ%server"
call npm install
if %errorlevel% neq 0 (
    echo  [ERROR] Server install failed
    pause
    exit /b 1
)
echo  [OK] Server install done
echo.

echo  [2/3] Installing client dependencies...

cd /d "%PRJ%client"
call npm install
if %errorlevel% neq 0 (
    echo  [ERROR] Client install failed
    pause
    exit /b 1
)
echo  [OK] Client install done
echo.

echo  [3/3] Building frontend...

call npx vite build
if %errorlevel% neq 0 (
    echo  [ERROR] Build failed
    pause
    exit /b 1
)
echo  [OK] Build done
echo.

echo  ============================================
echo   Setup complete!
echo.
echo   Double-click start.bat to launch
echo   Default login: admin / admin123
echo  ============================================
pause
