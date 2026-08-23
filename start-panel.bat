@echo off
echo ========================================================
echo   ProxPanel v3 - Local Launch
echo ========================================================
echo Starting PostgreSQL, Redis, Backend (3001) and Frontend (5173)...
echo.
wsl -u root -d Debian bash /mnt/f/proxy-panel-v3/start-local.sh
pause
