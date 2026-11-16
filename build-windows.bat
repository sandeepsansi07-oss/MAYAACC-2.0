@echo off
REM MAYAACC 2.0 — one-click Windows build (run on a Windows PC)
REM Builds the proper installer: dist\MAYAACC-Setup-2.0.0.exe
REM (Use npm run dist:portable if you only want the portable EXE.)
cd /d %~dp0
call npm install
call npm test
call npm run dist:installer
echo.
echo Done. Installer is in dist\MAYAACC-Setup-2.0.0.exe
echo Double-click it to install MAYAACC properly (Start Menu + Desktop shortcut).
pause
