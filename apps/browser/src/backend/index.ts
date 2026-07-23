import unhandled from 'electron-unhandled';
unhandled();

import { app, protocol } from 'electron';
import started from 'electron-squirrel-startup';
import path from 'node:path';
import { installStartupOpenUrlListener } from './startup-url-events';

// CRITICAL: `main` is imported dynamically (below in the 'ready' handler)
// instead of statically. On Windows machines without the VC++ redistributable
// installed system-wide, static imports eagerly load native .node addons
// (@libsql, sharp, etc.) whose transitive vcruntime140.dll dependency cannot be
// resolved when the process is launched by Squirrel's Update.exe (different
// working directory). Keeping the import dynamic ensures Squirrel install/
// uninstall/update events are handled cleanly without touching native code.

const isSmokeTest = process.argv.includes('--smoke-test');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const appBaseName = __APP_BASE_NAME__;
const appName = __APP_NAME__;

// Set the app name for macOS menu bar
app.setName(appName);
if (process.platform === 'win32') {
  app.setAppUserModelId(__APP_BUNDLE_ID__);
}
app.applicationMenu = null;
installStartupOpenUrlListener();

// Set the right path structure for the app
// We keep userData where it is, but we will put session data into a sub-folder called "session"
app.setPath('userData', path.join(app.getPath('appData'), appBaseName));
app.setPath('sessionData', path.join(app.getPath('userData'), 'session'));

// Register custom protocols as privileged (must happen before app.ready)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'stagewise',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      codeCache: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  {
    scheme: 'attachment',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  {
    scheme: 'workspace',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  {
    scheme: 'plans',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  // Don't load native modules during Squirrel install/uninstall events.
  // The process is about to quit — loading them would crash on Windows
  // machines without system-wide VC++ redistributable.
  if (started) return;

  const startupProfiler =
    process.env.STAGEWISE_STARTUP_PROFILING === '1'
      ? await import('./utils/startup-profiler').then((module) =>
          module.startStartupProfiler(),
        )
      : null;
  startupProfiler?.mark('app-ready');

  if (isSmokeTest) {
    // Validate the full import tree is intact, then exit.
    await import('./main');
    console.log('[smoke-test] App ready — all modules loaded successfully.');
    await startupProfiler?.stop('smoke-test');
    app.exit(0);
    return;
  }

  startupProfiler?.mark('main-import-start');
  const { main } = await import('./main');
  startupProfiler?.mark('main-import-end');
  main({ launchOptions: { verbose: true } });
  startupProfiler?.mark('main-called');
});

// Keep the process alive after the main window is hidden so users can reopen
// it from the tray. Real shutdown is driven by app.quit()/app.exit() paths such
// as the tray Exit action or updater quit flow.
app.on('window-all-closed', () => {});

app.on('activate', () => {});
