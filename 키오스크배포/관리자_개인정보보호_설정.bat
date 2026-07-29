@echo off
rem =========================================================
rem  Gunpo Minwon Form Helper - Kiosk Privacy Lockdown (launcher)
rem
rem  Blocks "Save as PDF" so that citizens' personal data
rem  cannot be left on this PC as a file.
rem  Printing to the real printer keeps working.
rem
rem  Usage:
rem    관리자_개인정보보호_설정.bat                    apply    (run as administrator)
rem    관리자_개인정보보호_설정.bat /only "PRINTER"     apply + keep only that printer
rem    관리자_개인정보보호_설정.bat /status            show current state (no change)
rem    관리자_개인정보보호_설정.bat /undo              revert   (run as administrator)
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
