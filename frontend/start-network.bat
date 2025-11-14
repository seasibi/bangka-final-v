@echo off
echo Starting frontend server with network access...
echo Your computer IP: 192.168.100.118
echo Frontend will be accessible at: http://192.168.100.118:5173
echo.
npm run dev -- --host 0.0.0.0
