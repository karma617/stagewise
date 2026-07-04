import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { MessagePortProxy } from '@stagewise/karton/client';
import type { KartonMessage } from '@stagewise/karton/shared';

type StartupProfilerConfig = {
  enabled: true;
  startedAt: number;
  durationMs: number;
  flushIntervalMs: number;
};

type StartupProfilerEvent = Record<string, unknown> & {
  type: string;
  at: number;
  uptimeMs: number;
};

const RENDERER_LONG_TASK_THRESHOLD_MS = 50;
const RENDERER_FREEZE_THRESHOLD_MS = 1_000;
const RENDERER_BATCH_SIZE = 100;

function createStartupProfilerEvent(
  type: string,
  data: Record<string, unknown> = {},
): StartupProfilerEvent {
  return {
    type,
    at: Date.now(),
    uptimeMs: Math.round(performance.now()),
    ...data,
  };
}

function startRendererStartupProfiler() {
  void ipcRenderer
    .invoke('startup-profiler:get-config')
    .then((config: StartupProfilerConfig | null) => {
      if (!config?.enabled) return;

      const events: StartupProfilerEvent[] = [];
      const summary = {
        longTaskCount: 0,
        worstLongTaskMs: 0,
        rafGapCount: 0,
        worstRafGapMs: 0,
      };
      let flushTimer: NodeJS.Timeout | null = null;
      let stopTimer: NodeJS.Timeout | null = null;
      let rafId: number | null = null;
      let longTaskObserver: PerformanceObserver | null = null;
      let stopped = false;

      const flush = () => {
        if (events.length === 0) return;
        ipcRenderer.send('startup-profiler:renderer-events', {
          events: events.splice(0),
        });
      };

      const queue = (event: StartupProfilerEvent) => {
        events.push(event);
        if (events.length >= RENDERER_BATCH_SIZE) flush();
      };

      const stop = (reason: string) => {
        if (stopped) return;
        stopped = true;
        if (flushTimer) clearInterval(flushTimer);
        if (stopTimer) clearTimeout(stopTimer);
        if (rafId !== null) cancelAnimationFrame(rafId);
        longTaskObserver?.disconnect();
        queue(
          createStartupProfilerEvent('renderer-summary', {
            reason,
            ...summary,
          }),
        );
        flush();
      };

      queue(
        createStartupProfilerEvent('renderer-profiler-started', {
          durationMs: config.durationMs,
        }),
      );

      const navEntry = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (navEntry) {
        queue(
          createStartupProfilerEvent('navigation-timing', {
            domContentLoadedMs: Math.round(navEntry.domContentLoadedEventEnd),
            loadMs: Math.round(navEntry.loadEventEnd),
            responseEndMs: Math.round(navEntry.responseEnd),
          }),
        );
      }

      window.addEventListener(
        'DOMContentLoaded',
        () => queue(createStartupProfilerEvent('dom-content-loaded')),
        { once: true },
      );
      window.addEventListener(
        'load',
        () => queue(createStartupProfilerEvent('window-load')),
        { once: true },
      );
      document.addEventListener('visibilitychange', () => {
        queue(
          createStartupProfilerEvent('visibility-change', {
            visibilityState: document.visibilityState,
          }),
        );
      });

      try {
        longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration < RENDERER_LONG_TASK_THRESHOLD_MS) continue;

            const durationMs = Math.round(entry.duration);
            summary.longTaskCount += 1;
            summary.worstLongTaskMs = Math.max(
              summary.worstLongTaskMs,
              durationMs,
            );
            queue(
              createStartupProfilerEvent('long-task', {
                durationMs,
                startTimeMs: Math.round(entry.startTime),
                name: entry.name,
              }),
            );
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        queue(
          createStartupProfilerEvent('long-task-observer-failed', {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }

      let lastFrameAt = performance.now();
      const recordFrame = (frameAt: number) => {
        const gapMs = Math.round(frameAt - lastFrameAt);
        lastFrameAt = frameAt;

        if (gapMs >= RENDERER_LONG_TASK_THRESHOLD_MS) {
          summary.rafGapCount += 1;
          summary.worstRafGapMs = Math.max(summary.worstRafGapMs, gapMs);
          queue(
            createStartupProfilerEvent('raf-gap', {
              gapMs,
              severity:
                gapMs >= RENDERER_FREEZE_THRESHOLD_MS ? 'freeze' : 'jank',
            }),
          );
        }

        rafId = requestAnimationFrame(recordFrame);
      };
      rafId = requestAnimationFrame(recordFrame);

      flushTimer = setInterval(flush, config.flushIntervalMs);
      stopTimer = setTimeout(() => stop('timeout'), config.durationMs);
      window.addEventListener('beforeunload', () => stop('beforeunload'), {
        once: true,
      });
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('No handler registered')) {
        console.warn('[startup-profiler] Renderer profiler failed', error);
      }
    });
}

startRendererStartupProfiler();

/**
 * Reconnection configuration
 */
const RECONNECT_CONFIG = {
  MAX_ATTEMPTS: 10,
  BASE_DELAY: 1000, // 1 second
  MAX_DELAY: 30000, // 30 seconds
};

/**
 * Reconnection state
 */
let reconnectAttempts = 0;
let _reconnectTimer: NodeJS.Timeout | null = null;
let isReconnecting = false;

/**
 * Current message handler - stored so we can re-apply it on reconnection
 */
let currentMessageHandler: ((message: KartonMessage) => void) | null = null;

/**
 * Current port reference - will be updated on reconnection
 */
let currentPort: MessagePort;

/**
 * Dispatch reconnection events to renderer
 */
function dispatchReconnectEvent(
  type: 'reconnecting' | 'reconnected' | 'failed',
  attempt?: number,
) {
  window.dispatchEvent(
    new CustomEvent('karton-reconnect', {
      detail: { type, attempt },
    }),
  );
}

/**
 * Setup port listeners for connection monitoring
 * Note: MessagePort in renderer doesn't have 'onclose' - only 'onmessageerror'
 */
function setupPortListeners(port: MessagePort) {
  // Handle message errors (connection issues)
  port.onmessageerror = (error) => {
    console.error('[Karton] MessagePort error:', error);
    attemptReconnect();
  };

  // Re-apply message handler if it exists
  if (currentMessageHandler) {
    port.onmessage = (event) => {
      currentMessageHandler!(event.data as KartonMessage);
    };
  }
}

/**
 * Attempt to reconnect with exponential backoff
 */
function attemptReconnect() {
  // Prevent multiple simultaneous reconnection attempts
  if (isReconnecting) {
    return;
  }

  if (reconnectAttempts >= RECONNECT_CONFIG.MAX_ATTEMPTS) {
    console.error('[Karton] Max reconnection attempts reached');
    dispatchReconnectEvent('failed', reconnectAttempts);
    return;
  }

  isReconnecting = true;
  reconnectAttempts++;

  // Calculate delay with exponential backoff
  const delay = Math.min(
    RECONNECT_CONFIG.BASE_DELAY * Math.pow(2, reconnectAttempts - 1),
    RECONNECT_CONFIG.MAX_DELAY,
  );

  console.log(
    `[Karton] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${RECONNECT_CONFIG.MAX_ATTEMPTS})`,
  );
  dispatchReconnectEvent('reconnecting', reconnectAttempts);

  _reconnectTimer = setTimeout(() => {
    _reconnectTimer = null;
    performReconnect();
  }, delay);
}

/**
 * Perform the actual reconnection
 */
function performReconnect() {
  try {
    // Create new MessageChannel
    const newChannel = new MessageChannel();

    // Send port2 to main process
    ipcRenderer.postMessage('karton-connect', 'ui-main', [newChannel.port2]);

    // Update current port reference
    currentPort = newChannel.port1;

    // Setup listeners on new port (this will also re-apply the message handler)
    setupPortListeners(currentPort);

    console.log('[Karton] Reconnection successful');
    dispatchReconnectEvent('reconnected');

    // Reset reconnection state
    reconnectAttempts = 0;
    isReconnecting = false;
  } catch (error) {
    console.error('[Karton] Reconnection failed:', error);
    isReconnecting = false;

    // Try again
    attemptReconnect();
  }
}

/**
 * Initialize the first connection
 */
const msgChannel = new MessageChannel();
currentPort = msgChannel.port1;

// Request the port from main process
ipcRenderer.postMessage('karton-connect', 'ui-main', [msgChannel.port2]);

/**
 * MessagePort proxy that works with reconnection
 * The port will automatically start when onmessage is set
 */
const messagePortProxy: MessagePortProxy = {
  setOnMessage: (handler: (message: KartonMessage) => void) => {
    // Store the handler so we can re-apply it on reconnection
    currentMessageHandler = handler;

    // Apply message handler to current port
    currentPort.onmessage = (event) => {
      handler(event.data as KartonMessage);
    };

    // Setup error handler for detecting connection issues
    currentPort.onmessageerror = (error) => {
      console.error('[Karton] MessagePort error:', error);
      attemptReconnect();
    };
  },
  postMessage: (message: KartonMessage) => {
    try {
      currentPort.postMessage(message);
    } catch (error) {
      console.error('[Karton] Failed to post message:', error);
      // Trigger reconnection if post fails
      attemptReconnect();
    }
  },
};

// Listen for IPC messages from main process and forward as DOM events
ipcRenderer.on('stagewise-tab-focused', (_event, tabId) => {
  window.dispatchEvent(
    new CustomEvent('stagewise-tab-focused', { detail: tabId }),
  );
});

/**
 * Theme colors payload for syncing CSS-derived colors to main process
 */
interface ThemeColorPayload {
  background: string;
  titleBarOverlay: {
    color: string;
    symbolColor: string;
  };
}

/**
 * Thin bridge API exposed to renderer.
 * The transport layer handles all the complexity.
 */
contextBridge.exposeInMainWorld('electron', {
  karton: {
    portProxy: messagePortProxy,
  },
  /**
   * Sync theme colors from CSS to main process for window background updates.
   * Used during dev mode HMR to keep window background in sync with CSS palette changes.
   */
  syncThemeColors: (colors: { isDark: boolean; theme: ThemeColorPayload }) => {
    ipcRenderer.send('sync-theme-colors', colors);
  },
  /**
   * Get the absolute filesystem path for a File object from drag-and-drop or file input.
   * Returns an empty string for clipboard-pasted or programmatically constructed Files.
   */
  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },
});
