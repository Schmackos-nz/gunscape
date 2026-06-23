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

echo.
echo   Starting Gunscape server...
echo   Play at http://localhost:8787/  (server: ws://localhost:8787)
echo   Press Ctrl+C to stop.
echo.
node server.js

REM keep the window open if the server exits/crashes
echo.
echo   Server stopped.
pause
endlocal
