@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "b2b-hub\data\hub.db" ( echo Brak bazy - czy Hub byl juz uruchamiany? & pause & exit /b 1 )
if not exist "kopie" mkdir kopie
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set TS=%%i
copy "b2b-hub\data\hub.db" "kopie\hub-%TS%.db" >nul
echo Zapisano kopie: kopie\hub-%TS%.db
pause
