@echo off
setlocal
cd /d "%~dp0"
where npm.cmd >nul 2>nul
if errorlevel 1 (
  for /d %%D in ("%LOCALAPPDATA%\Programs\inventico-node\node-*-win-x64") do set "PATH=%%~D;%PATH%"
)
powershell -NoProfile -Command "try { $response = Invoke-WebRequest 'http://localhost:5173' -UseBasicParsing -TimeoutSec 2; if($response.Content -match 'Inventico Calc'){exit 0};exit 1 } catch {exit 1}" >nul 2>nul
if not errorlevel 1 (
  start "" "http://localhost:5173"
  exit /b 0
)
if not exist "node_modules\vite" call npm.cmd install
call npm.cmd run dev
pause
