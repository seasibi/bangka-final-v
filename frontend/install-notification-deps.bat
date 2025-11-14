@echo off
echo Installing notification system dependencies...
cd /d "C:\Users\rhyi\OneDrive\Desktop\bangka-git-v-43\frontend"

echo.
echo Installing react-hot-toast for toast notifications...
npm install react-hot-toast

echo.
echo Installing date-fns for date formatting...
npm install date-fns

echo.
echo ===================================
echo Installation complete!
echo ===================================
echo.
echo Please add a notification sound file named "notification-sound.mp3" 
echo to the public directory for sound alerts.
echo.
pause