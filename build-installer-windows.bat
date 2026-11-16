@echo off
REM MAYAACC 2.0 — one-click Windows INSTALLER build (run on a Windows PC)
REM Produces a proper installer: dist\MAYAACC-Setup-2.0.0.exe
REM Installing it puts MAYAACC in Start Menu + Desktop + Programs list,
REM and it can be pinned to the taskbar. No more opening from the setup file.
cd /d %~dp0
echo ============================================================
echo  MAYAACC 2.0 - building the Windows installer (NSIS)
echo ============================================================
call npm install
if errorlevel 1 goto :fail
call npm test
if errorlevel 1 goto :fail
call npm run dist:installer
if errorlevel 1 goto :fail
echo.
echo ============================================================
echo  DONE. Installer is here:
echo  dist\MAYAACC-Setup-2.0.0.exe
echo.
echo  Double-click it to install. Tick "Create Desktop Shortcut"
echo  in the wizard, then Finish. MAYAACC will be in Start Menu,
echo  on the Desktop, in Programs, and can be pinned to taskbar.
echo ============================================================
pause
exit /b 0
:fail
echo.
echo BUILD FAILED. Check the error above and try again.
pause
exit /b 1
