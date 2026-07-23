@echo off
setlocal enableextensions
chcp 65001 >nul

rem ============================================================
rem  PickStar Studio apps/browser FAST package one-click script
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

echo [build-fast] closing running PickStar/Stagewise app processes
pwsh -NoProfile -ExecutionPolicy Bypass -Command "$names = @('pickstar-studio', 'stagewise', 'stagewise-dev'); $procs = @(Get-Process | Where-Object { $names -contains $_.ProcessName }); foreach ($proc in $procs) { Write-Host \"[build-fast] closing process: $($proc.ProcessName) pid=$($proc.Id)\"; if ($proc.MainWindowHandle -ne 0) { [void]$proc.CloseMainWindow() } }; if ($procs.Count -gt 0) { Start-Sleep -Seconds 2 }; foreach ($proc in $procs) { $alive = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue; if ($alive) { Write-Host \"[build-fast] force stopping process: $($proc.ProcessName) pid=$($proc.Id)\"; Stop-Process -Id $proc.Id -Force -ErrorAction Stop } }; exit 0"
if errorlevel 1 (
  set _CODE=%ERRORLEVEL%
  goto :AFTER_PACKAGE
)

echo [build-fast] cleaning stale package outputs
pwsh -NoProfile -ExecutionPolicy Bypass -Command "$root = (Get-Location).Path; $targets = @('apps\browser\out\dev\pickstar-studio-win32-x64', 'apps\browser\out\dev\pickstar-studio-win32-x64.zip', 'apps\browser\out\release\pickstar-studio-win32-x64', 'apps\browser\out\release\pickstar-studio-win32-x64.zip', 'apps\browser\out\dev\stagewise-dev-win32-x64', 'apps\browser\out\dev\stagewise-dev-win32-x64.zip', 'apps\browser\out\release\stagewise-win32-x64', 'apps\browser\out\release\stagewise-win32-x64.zip', 'apps\browser\out\release\make'); foreach ($rel in $targets) { $target = Join-Path $root $rel; if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop; Write-Host \"[build-fast] removed stale output: $target\" } }"
if errorlevel 1 (
  set _CODE=%ERRORLEVEL%
  goto :AFTER_PACKAGE
)

echo [build-fast] building workspace packages used by the app
call pnpm --filter @stagewise/agent-core build
if errorlevel 1 (
  set _CODE=%ERRORLEVEL%
  goto :AFTER_PACKAGE
)

echo [build-fast] verifying agent-core dist contains latest context preflight code
pwsh -NoProfile -ExecutionPolicy Bypass -Command "$dist = Join-Path (Get-Location).Path 'packages\agent-core\dist\agents\index.js'; if (!(Test-Path -LiteralPath $dist)) { throw \"agent-core dist missing: $dist\" }; if (!(Select-String -LiteralPath $dist -Pattern 'final-request-preflight' -Quiet)) { throw \"agent-core dist does not contain final-request-preflight; build is stale\" }"
if errorlevel 1 (
  set _CODE=%ERRORLEVEL%
  goto :AFTER_PACKAGE
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
echo [build-fast] clearing Vite cache to avoid stale workspace package bundles
pwsh -NoProfile -ExecutionPolicy Bypass -Command "$root = (Resolve-Path -LiteralPath (Get-Location).Path).Path; $dirs = @('node_modules\.vite', 'src\ui\node_modules\.vite', 'src\pages\node_modules\.vite'); foreach ($rel in $dirs) { $target = Join-Path $root $rel; if (Test-Path -LiteralPath $target) { $resolved = (Resolve-Path -LiteralPath $target).Path; if (!$resolved.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { throw \"Refusing to delete outside browser root: $resolved\" }; Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction Stop; Write-Host \"[build-fast] removed Vite cache: $resolved\" } }"
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
  pwsh -NoProfile -ExecutionPolicy Bypass -Command "$root = (Get-Location).Path; $srcDir = Join-Path $root 'apps\browser\assets\camoufox'; $out = Join-Path $root 'apps\browser\out'; if (!(Test-Path -LiteralPath $srcDir)) { throw \"Camoufox asset directory missing: $srcDir\" }; Get-ChildItem -LiteralPath $out -Directory -Recurse -Filter resources | Where-Object { $_.Parent.Name -like 'pickstar-studio-*' } | ForEach-Object { $destDir = Join-Path $_.FullName 'camoufox'; New-Item -ItemType Directory -Force -Path $destDir | Out-Null; Copy-Item -Path (Join-Path $srcDir '*') -Destination $destDir -Recurse -Force -ErrorAction Stop; Write-Host \"[build-fast] copied Camoufox assets to $destDir\" }"
  if errorlevel 1 (
    set _CODE=%ERRORLEVEL%
  )
)

if %_CODE% EQU 0 (
  echo [build-fast] creating zip package
  pwsh -NoProfile -ExecutionPolicy Bypass -Command "$root = (Get-Location).Path; $out = Join-Path $root 'apps\browser\out'; if (!(Test-Path -LiteralPath $out)) { throw \"Output directory missing: $out\" }; $packageDirs = @(Get-ChildItem -LiteralPath $out -Directory -Recurse | Where-Object { $_.Name -like 'pickstar-studio-*' -and (Test-Path -LiteralPath (Join-Path $_.FullName 'resources')) -and ((Get-ChildItem -LiteralPath $_.FullName -File -Filter '*.exe' | Select-Object -First 1) -ne $null) }); if ($packageDirs.Count -eq 0) { throw \"No PickStar Studio packaged app directories found under $out\" }; foreach ($dir in $packageDirs) { $zipPath = Join-Path $dir.Parent.FullName ($dir.Name + '.zip'); if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }; Compress-Archive -LiteralPath $dir.FullName -DestinationPath $zipPath -CompressionLevel Optimal -Force; Write-Host \"[build-fast] created zip package: $zipPath\" }"
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
