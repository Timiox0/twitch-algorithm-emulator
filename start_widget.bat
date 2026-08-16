@echo off
title Twitch Ranking Algorithm OBS HUD
echo ============================================================
echo 🚀 Starting Twitch Ranking HUD Server...
echo ============================================================

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Freeing port 3000 from previous instance (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

node server.js
pause
