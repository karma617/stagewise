@echo off
setlocal enableextensions
chcp 65001 >nul

rem ============================================================
rem  stagewise apps/browser FAST package one-click script
rem  Double-click to run. Output dir: apps\browser\out
rem ============================================================

rem cd to the directory where this .bat lives (the repo root: stagewise/)
cd /d "%~dp0"

echo [build-fast] repo root: %CD%
echo [build-fast] starting at %DATE% %TIME%
set _START_TIME=%TIME%
set _CODE=0

rem make sure pnpm is on PATH
where pnpm >nul 2>nul
if errorlevel 1 (
  echo [build-fast] ERROR: pnpm not found on PATH. Install pnpm first.
  goto :END
)

rem run the fast package script inside apps/browser
pushd apps\browser
echo [build-fast] preparing Camoufox bundled assets
call pnpm exec tsx scripts/prepare-camoufox-assets.ts
if errorlevel 1 (
  set _CODE=%ERRORLEVEL%
  popd
  goto :AFTER_PACKAGE
)
echo [build-fast] running: pnpm package:fast
call pnpm package:fast
set _CODE=%ERRORLEVEL%
popd
if %_CODE% EQU 0 (
  echo [build-fast] copying Camoufox assets into packaged resources
  pwsh -NoProfile -ExecutionPolicy Bypass -Command "$root = (Get-Location).Path; $srcDir = Join-Path $root 'apps\browser\assets\camoufox'; $out = Join-Path $root 'apps\browser\out'; if (!(Test-Path -LiteralPath $srcDir)) { throw \"Camoufox asset directory missing: $srcDir\" }; Get-ChildItem -LiteralPath $out -Directory -Recurse -Filter resources | ForEach-Object { $destDir = Join-Path $_.FullName 'camoufox'; New-Item -ItemType Directory -Force -Path $destDir | Out-Null; Copy-Item -Path (Join-Path $srcDir '*') -Destination $destDir -Recurse -Force -ErrorAction Stop; Write-Host \"[build-fast] copied Camoufox assets to $destDir\" }"
  if errorlevel 1 (
    set _CODE=%ERRORLEVEL%
  )
)

if %_CODE% EQU 0 (
  echo [build-fast] creating zip package
  pwsh -NoProfile -ExecutionPolicy Bypass -Command "$root = (Get-Location).Path; $out = Join-Path $root 'apps\browser\out'; if (!(Test-Path -LiteralPath $out)) { throw \"Output directory missing: $out\" }; $packageDirs = @(Get-ChildItem -LiteralPath $out -Directory -Recurse | Where-Object { (Test-Path -LiteralPath (Join-Path $_.FullName 'resources')) -and ((Get-ChildItem -LiteralPath $_.FullName -File -Filter '*.exe' | Select-Object -First 1) -ne $null) }); if ($packageDirs.Count -eq 0) { throw \"No packaged app directories found under $out\" }; foreach ($dir in $packageDirs) { $zipPath = Join-Path $dir.Parent.FullName ($dir.Name + '.zip'); if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }; Compress-Archive -LiteralPath $dir.FullName -DestinationPath $zipPath -CompressionLevel Optimal -Force; Write-Host \"[build-fast] created zip package: $zipPath\" }"
  if errorlevel 1 (
    set _CODE=%ERRORLEVEL%
  )
)

:AFTER_PACKAGE
echo.
echo [build-fast] finished at %DATE% %TIME%
echo [build-fast] start %_START_TIME%  end %TIME%
if %_CODE% NEQ 0 (
  echo [build-fast] FAILED with exit code %_CODE%
) else (
  echo [build-fast] SUCCESS. Artifact directory:
  echo   %CD%\apps\browser\out
  echo [build-fast] Zip packages are next to packaged app directories.
)

:END
echo.
echo Press any key to close...
pause >nul
endlocal
