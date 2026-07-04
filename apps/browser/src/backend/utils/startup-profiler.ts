import { app, contentTracing, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import { createWriteStream, type WriteStream } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { getLogsDir } from './paths';

type JsonRecord = Record<string, unknown>;

type StartupProfilerConfig = {
  enabled: true;
  directory: string;
  startedAt: number;
  durationMs: number;
  flushIntervalMs: number;
};

type StartupProfiler = {
  enabled: boolean;
  directory: string | null;
  mark: (name: string, data?: JsonRecord) => void;
  stop: (reason: string) => Promise<void>;
};

const DEFAULT_DURATION_MS = 120_000;
const FLUSH_INTERVAL_MS = 5_000;
const EVENT_LOOP_SAMPLE_MS = 1_000;
const EVENT_LOOP_LAG_THRESHOLD_MS = 100;
const TRACE_CATEGORIES = [
  'blink',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'electron',
  'latencyInfo',
  'loading',
  'renderer.scheduler',
  'toplevel',
  'v8',
];

const disabledStartupProfiler: StartupProfiler = {
  enabled: false,
  directory: null,
  mark: () => {},
  stop: async () => {},
};

function parseDurationMs(): number {
  const raw = process.env.STAGEWISE_STARTUP_PROFILING_MS;
  if (!raw) return DEFAULT_DURATION_MS;

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 10_000) return DEFAULT_DURATION_MS;

  return value;
}

function createProfileDirectoryName(now: Date): string {
  return `startup-profile-${now
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', '')}`;
}

function writeJsonLine(stream: WriteStream, record: JsonRecord): void {
  stream.write(`${JSON.stringify(record)}\n`);
}

function closeStream(stream: WriteStream): Promise<void> {
  return new Promise((resolve) => {
    stream.end(resolve);
  });
}

function normalizeRendererEvents(payload: unknown): JsonRecord[] {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as { events?: unknown }).events)
  ) {
    return [];
  }

  return (payload as { events: unknown[] }).events.filter(
    (event): event is JsonRecord =>
      event !== null && typeof event === 'object' && !Array.isArray(event),
  );
}

export async function startStartupProfiler(): Promise<StartupProfiler> {
  if (process.env.STAGEWISE_STARTUP_PROFILING !== '1') {
    return disabledStartupProfiler;
  }

  const startedAt = Date.now();
  const durationMs = parseDurationMs();
  const directory = path.join(
    getLogsDir(),
    createProfileDirectoryName(new Date()),
  );
  await fs.mkdir(directory, { recursive: true });

  const mainEvents = createWriteStream(
    path.join(directory, 'main-events.jsonl'),
  );
  const rendererEvents = createWriteStream(
    path.join(directory, 'renderer-events.jsonl'),
  );
  const summaryPath = path.join(directory, 'summary.json');
  const tracePath = path.join(directory, 'trace.json');
  const summary: JsonRecord = {
    enabledAt: new Date(startedAt).toISOString(),
    durationMs,
    directory,
    tracePath,
    rendererEventsPath: path.join(directory, 'renderer-events.jsonl'),
    mainEventsPath: path.join(directory, 'main-events.jsonl'),
  };

  let stopped = false;
  let traceStarted = false;
  let stopTimer: NodeJS.Timeout | null = null;
  let eventLoopTimer: NodeJS.Timeout | null = null;
  let expectedTick = performance.now() + EVENT_LOOP_SAMPLE_MS;

  const mark = (name: string, data: JsonRecord = {}) => {
    writeJsonLine(mainEvents, {
      type: 'mark',
      name,
      at: Date.now(),
      uptimeMs: Math.round(performance.now()),
      ...data,
    });
  };

  const config: StartupProfilerConfig = {
    enabled: true,
    directory,
    startedAt,
    durationMs,
    flushIntervalMs: FLUSH_INTERVAL_MS,
  };

  const stop = async (reason: string) => {
    if (stopped) return;
    stopped = true;

    if (stopTimer) clearTimeout(stopTimer);
    if (eventLoopTimer) clearInterval(eventLoopTimer);
    ipcMain.removeHandler('startup-profiler:get-config');
    ipcMain.removeAllListeners('startup-profiler:renderer-events');

    mark('stop', { reason });
    summary.stoppedAt = new Date().toISOString();
    summary.stopReason = reason;

    if (traceStarted) {
      try {
        summary.traceResultPath = await contentTracing.stopRecording(tracePath);
      } catch (error) {
        summary.traceError =
          error instanceof Error ? error.message : String(error);
      }
    }

    await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    await Promise.all([closeStream(mainEvents), closeStream(rendererEvents)]);
    console.log(`[startup-profiler] Wrote startup profile to ${directory}`);
  };

  ipcMain.handle('startup-profiler:get-config', () => config);
  ipcMain.on('startup-profiler:renderer-events', (_event, payload) => {
    const receivedAt = Date.now();
    for (const event of normalizeRendererEvents(payload)) {
      writeJsonLine(rendererEvents, { receivedAt, ...event });
    }
  });

  try {
    await contentTracing.startRecording({
      included_categories: TRACE_CATEGORIES,
    });
    traceStarted = true;
    mark('content-tracing-started');
  } catch (error) {
    summary.traceStartError =
      error instanceof Error ? error.message : String(error);
    mark('content-tracing-start-failed', {
      error: summary.traceStartError,
    });
  }

  eventLoopTimer = setInterval(() => {
    const now = performance.now();
    const lagMs = now - expectedTick;
    expectedTick = now + EVENT_LOOP_SAMPLE_MS;
    if (lagMs >= EVENT_LOOP_LAG_THRESHOLD_MS) {
      mark('main-event-loop-lag', {
        lagMs: Math.round(lagMs),
      });
    }
  }, EVENT_LOOP_SAMPLE_MS);

  stopTimer = setTimeout(() => {
    void stop('timeout');
  }, durationMs);

  process.once('beforeExit', () => {
    void stop('beforeExit');
  });
  app.once('before-quit', () => {
    void stop('before-quit');
  });

  mark('started');
  return {
    enabled: true,
    directory,
    mark,
    stop,
  };
}
