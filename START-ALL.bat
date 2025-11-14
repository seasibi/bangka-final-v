@echo off
cls
echo ============================================================
echo       BANGKA MONITORING SYSTEM - STARTUP SCRIPT
echo ============================================================
echo.
echo This will start:
echo   1. Redis Server
echo   2. Django Backend (with Daphne - WebSocket support)
echo   3. React Frontend (Vite dev server)
echo.
echo ============================================================
echo.

REM Check if Redis is already running
tasklist /FI "IMAGENAME eq redis-server.exe" 2>NUL | find /I /N "redis-server.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [OK] Redis is already running
) else (
    echo [STARTING] Redis Server...
    start "Redis Server - KEEP OPEN" "%USERPROFILE%\redis\redis-server.exe" "%USERPROFILE%\redis\redis.windows.conf"
    timeout /t 2 /nobreak >nul
    echo [OK] Redis Server started
)
echo.

REM Start Django Backend with Daphne
echo [STARTING] Django Backend (with WebSocket support)...
cd /d "%~dp0backend"
start "Django Backend - Daphne" cmd /k "echo Django Backend Server && echo ==================== && echo Running on http://127.0.0.1:8000 && echo WebSocket: ws://127.0.0.1:8000/ws/gps/ && echo. && python -m daphne -b 0.0.0.0 -p 8000 backend.asgi:application"
timeout /t 3 /nobreak >nul
echo [OK] Django Backend started
echo.

REM Start React Frontend
echo [STARTING] React Frontend...
cd /d "%~dp0frontend"
start "React Frontend - Vite" cmd /k "echo React Frontend && echo ============ && echo Running on http://localhost:5173 && echo. && npm run dev"
timeout /t 2 /nobreak >nul
echo [OK] React Frontend started
echo.

echo ============================================================
echo                    ALL SERVICES STARTED!
echo ============================================================
echo.
echo Services running:
echo   - Redis Server      : Running in separate window
echo   - Django Backend    : http://127.0.0.1:8000
echo   - React Frontend    : http://localhost:5173
echo.
echo Your browser should automatically open to:
echo   http://localhost:5173
echo.
echo To stop all services:
echo   - Close each window individually, OR
echo   - Press Ctrl+C in each window
echo.
echo ============================================================
echo.

REM Wait a moment then open browser
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo Browser should now open to the app!
echo.
echo Press any key to close this window...
pause >nul
