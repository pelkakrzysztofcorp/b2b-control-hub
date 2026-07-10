@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo === B2B Control Hub (prawdziwy backend + baza SQLite) ===
echo Otwieram przegladarke za 2 sekundy...
start "" /min cmd /c "timeout /t 2 >nul & start http://localhost:5180"
node b2b-hub\server.mjs
pause
