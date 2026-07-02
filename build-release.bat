@echo off
setlocal enableextensions
chcp 65001 >nul

rem ============================================================
rem  stagewise apps/browser RELEASE make one-click script
rem  Double-click to run. Output dir: apps\browser\out\release
rem ============================================================

rem cd to the directory where this .bat lives (the repo root: stagewise/)
cd /d "%~dp0"

echo [build-release] repo root: %CD%
echo [build-release] starting at %DATE% %TIME%
set _START_TIME=%TIME%
set _CODE=0

rem make sure pnpm is on PATH
where pnpm >nul 2>nul
if errorlevel 1 (
  echo [build-release] ERROR: pnpm not found on PATH. Install pnpm first.
  set _CODE=1
  goto :AFTER_MAKE
)

rem Create a local production env file when it is missing.
if not exist ".env.prod" (
  if exist ".env" (
    echo [build-release] .env.prod not found. Creating it from .env.
    copy /Y ".env" ".env.prod" >nul
  ) else (
    if exist ".env.example" (
      echo [build-release] .env.prod not found. Creating it from .env.example.
      copy /Y ".env.example" ".env.prod" >nul
    ) else (
      echo [build-release] ERROR: .env.prod, .env, and .env.example are all missing.
      set _CODE=1
      goto :AFTER_MAKE
    )
  )
  if errorlevel 1 (
    set _CODE=%ERRORLEVEL%
    goto :AFTER_MAKE
  )
)

rem avoid Forge failing to remove an output directory that is still running
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process stagewise -ErrorAction SilentlyContinue | Stop-Process -Force"

pushd apps\browser
echo [build-release] preparing Camoufox bundled assets
call pnpm exec tsx scripts/prepare-camoufox-assets.ts
if errorlevel 1 (
  set _CODE=%ERRORLEVEL%
  popd
  goto :AFTER_MAKE
)

echo [build-release] running: RELEASE_CHANNEL=release pnpm make
set "RELEASE_CHANNEL=release"
call pnpm make
set _CODE=%ERRORLEVEL%
set "RELEASE_CHANNEL="
popd

if %_CODE% EQU 0 (
  echo [build-release] copying Camoufox assets into packaged resources
  pwsh -NoProfile -ExecutionPolicy Bypass -Command "$root = (Get-Location).Path; $srcDir = Join-Path $root 'apps\browser\assets\camoufox'; $out = Join-Path $root 'apps\browser\out\release'; if (!(Test-Path -LiteralPath $srcDir)) { throw \"Camoufox asset directory missing: $srcDir\" }; if (!(Test-Path -LiteralPath $out)) { throw \"Release output directory missing: $out\" }; Get-ChildItem -LiteralPath $out -Directory -Recurse -Filter resources | ForEach-Object { $destDir = Join-Path $_.FullName 'camoufox'; New-Item -ItemType Directory -Force -Path $destDir | Out-Null; Copy-Item -Path (Join-Path $srcDir '*') -Destination $destDir -Recurse -Force -ErrorAction Stop; Write-Host \"[build-release] copied Camoufox assets to $destDir\" }"
  if errorlevel 1 (
    set _CODE=%ERRORLEVEL%
  )
)

:AFTER_MAKE
echo.
echo [build-release] finished at %DATE% %TIME%
echo [build-release] start %_START_TIME%  end %TIME%
if %_CODE% NEQ 0 (
  echo [build-release] FAILED with exit code %_CODE%
) else (
  echo [build-release] SUCCESS. Artifact directory:
  echo   %CD%\apps\browser\out\release
  echo [build-release] Forge make artifacts are under apps\browser\out\release\make.
)

echo.
echo Press any key to close...
pause >nul
endlocal & exit /b %_CODE%
