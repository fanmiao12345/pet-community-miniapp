@echo off
chcp 65001 >nul
setlocal
set ROOT=%~dp0
set FILE=%ROOT%miniprogram\pages\auth\login\index.wxml

echo Checking project root: %ROOT%
if not exist "%ROOT%project.config.json" (
  echo [FAIL] project.config.json is missing.
  pause
  exit /b 1
)
if not exist "%FILE%" (
  echo [FAIL] miniprogram\pages\auth\login\index.wxml is missing.
  pause
  exit /b 2
)
for %%F in ("%FILE%") do echo [OK] Login WXML exists: %%~fF ^(%%~zF bytes^)
echo [OK] Project structure is complete. Import this exact folder in WeChat DevTools.
pause
