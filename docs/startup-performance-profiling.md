# Startup Performance Profiling

Use this only when diagnosing startup UI freezes. It is off by default and
adds tracing overhead while enabled.

## Enable

PowerShell:

```powershell
$env:STAGEWISE_STARTUP_PROFILING = '1'
$env:STAGEWISE_STARTUP_PROFILING_MS = '120000'
pnpm -F stagewise start:fast
```

Packaged dev build:

```powershell
$env:STAGEWISE_STARTUP_PROFILING = '1'
$env:STAGEWISE_STARTUP_PROFILING_MS = '120000'
& D:\work\ai\stagewise\apps\browser\out\dev\stagewise-dev-win32-x64\stagewise-dev.exe
```

Do not start the packaged app by double-clicking when collecting a profile.
The environment variables above only apply to child processes launched from the
same PowerShell session.

`STAGEWISE_STARTUP_PROFILING_MS` is optional. The default capture window is
120 seconds.

## Output

The profiler writes one folder under the app logs directory:

```text
%APPDATA%\stagewise-dev\stagewise\user-data\logs\startup-profile-*
```

For other release channels, replace `stagewise-dev` with the channel-specific
app data name.

Generated files:

- `trace.json`: Chromium/Electron trace. Import it in Chrome DevTools
  Performance or `chrome://tracing`.
- `renderer-events.jsonl`: renderer long tasks, frame gaps, navigation timing,
  and visibility/load marks.
- `main-events.jsonl`: main-process startup marks and event-loop lag.
- `summary.json`: capture window, file paths, and trace start/stop status.

## Read The Result

Start with `renderer-events.jsonl`:

- `long-task` means the renderer main thread was blocked for at least 50 ms.
- `raf-gap` with `severity: "freeze"` means no animation frame landed for at
  least 1 second.
- `navigation-timing`, `dom-content-loaded`, and `window-load` show whether the
  freeze happens before or after the UI has loaded.

Then check `main-events.jsonl`:

- `main-event-loop-lag` means the Electron main process was blocked for at
  least 100 ms.
- `main-import-start`, `main-import-end`, and `main-called` show whether the
  delay is before or after service bootstrap starts.

Finally open `trace.json` to find the exact JavaScript task, layout, paint, or
IPC burst that overlaps with the freeze window.
