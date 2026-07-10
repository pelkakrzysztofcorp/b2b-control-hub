@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Instalacja B2B Control Hub ===
where node >nul 2>nul
if errorlevel 1 ( echo Brak Node.js. Zainstaluj wersje LTS z nodejs.org i uruchom ponownie. & pause & exit /b 1 )
echo Instaluje biblioteki (Anthropic SDK, mammoth)...
call npm install
if not exist "config.json" ( copy "config.example.json" "config.json" >nul & echo Utworzono config.json - otworz go i wpisz klucz API oraz nazwe firmy. )
echo.
echo Gotowe. Teraz uruchom: start.cmd
pause
