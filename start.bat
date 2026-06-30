@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0server"

if not exist "node_modules" (
    echo [ERROR] Please run setup.bat first
    pause
    exit /b 1
)

if not exist "..\client\dist\index.html" (
    echo [ERROR] Frontend not built, please run setup.bat first
    pause
    exit /b 1
)

:: Get local IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" 2^>nul') do (
    set "IP=%%a"
    set "IP=!IP: =!"
    goto :ip_done
)
:ip_done

cls
echo.
echo  ============================================
echo   Metrology Management System
echo  ============================================
echo.
echo   This PC:    http://localhost:3000
if defined IP echo   LAN access: http://!IP!:3000
echo.
echo   Login:      admin / admin123
echo   Stop:       Ctrl+C
echo  ============================================
echo.

start http://localhost:3000

node app.js
pause
