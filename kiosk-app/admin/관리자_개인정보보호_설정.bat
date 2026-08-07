@echo off
rem =========================================================
rem  Gunpo Minwon Form Helper - Kiosk Admin Setup (launcher)
rem
rem  1) Pins the real printer the app is allowed to print to
rem  2) Removes virtual printers that save prints as files
rem  3) Sets the administrator exit PIN
rem
rem  Usage:
rem    관리자_개인정보보호_설정.bat /only "PRINTER"     pin printer + clean up (as administrator)
rem    관리자_개인정보보호_설정.bat /pin               set exit PIN        (as administrator)
rem    관리자_개인정보보호_설정.bat /status            show current state  (no change)
rem    관리자_개인정보보호_설정.bat /preview           dry run             (no change)
rem    관리자_개인정보보호_설정.bat /undo              revert              (as administrator)
rem
rem  All logic and Korean messages live in kiosk-privacy.ps1
rem  (kept out of this .bat because cmd.exe mis-parses batch
rem   files that mix chcp 65001 with multi-byte text).
rem =========================================================
setlocal

set "PS1=%~dp0kiosk-privacy.ps1"
if not exist "%PS1%" (
  echo.
  echo  [!] kiosk-privacy.ps1 not found next to this file.
  echo      Keep both files in the same folder.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %1 %2
if errorlevel 1 echo.

echo.
pause
endlocal
