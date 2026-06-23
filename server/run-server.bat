@echo off
REM ============================================================
REM  Gunscape Classic - run the dedicated server locally
REM  Double-click this file (or run it from a terminal).
REM ============================================================
setlocal
cd /d "%~dp0"

REM --- check Node is installed ---
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js was not found on your PATH.
  echo   Install it from https://nodejs.org/ then run this again.
  echo.
  pause
  exit /b 1
)

REM --- install dependencies on first run ---
if not exist "node_modules" (
  echo Installing dependencies ^(first run^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo   npm install failed - see the error above.
    pause
    exit /b 1
  )
)

REM --- work out the port + this machine's LAN IP for the share links ---
if "%PORT%"=="" set PORT=8787
set LANIP=
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object { $_.IPAddress -notlike '169.*' -and $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } ^| Select-Object -First 1 -ExpandProperty IPAddress)" 2^>nul') do set LANIP=%%i
if "%LANIP%"=="" set LANIP=localhost

echo.
echo   ============================================================
echo    Gunscape server starting on port %PORT%
echo   ============================================================
echo.
echo    Share these links so friends connect straight to YOU:
echo.
echo    Web (Cloudflare):
echo      https://gunscape.salostuce.workers.dev/?host=%LANIP%^&port=%PORT%
echo.
echo    Direct (served by this server, best for LAN):
echo      http://%LANIP%:%PORT%/?host=%LANIP%^&port=%PORT%
echo.
echo    On this PC:  http://localhost:%PORT%/
echo.
echo    Note: the web link needs this server reachable from the
echo    internet (port-forward %PORT% or use a tunnel). On the same
echo    network, use the Direct link.
echo.
echo    Press Ctrl+C to stop.
echo   ============================================================
echo.
node server.js

REM keep the window open if the server exits/crashes
echo.
echo   Server stopped.
pause
endlocal
