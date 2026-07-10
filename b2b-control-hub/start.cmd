@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules" ( echo Najpierw uruchom instalacja.cmd & pause & exit /b 1 )
start "" /min cmd /c "timeout /t 2 >nul & start http://localhost:5180"
node b2b-hub\server.mjs
pause
