import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import nodeFs from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { FileReadCacheService } from '../services/file-read-cache';
import {
  fileReadTransformer,
  textBlobTransformer,
  type FileReadTransformerOptions,
} from './index';
import type { HostPaths } from '../host';

const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  log: () => {},
  verboseMode: false,
} as any;

const testRoot = path.join(os.tmpdir(), 'frt-diagnostic-tests');

interface TestContext {
  cache: FileReadCacheService;
  workDir: string;
  mountPrefix: string;
  mountPaths: Map<string, string>;
  agentId: string;
  host: HostPaths;
}

async function setup(): Promise<TestContext> {
  const id = randomUUID().slice(0, 8);
  const workDir = path.join(testRoot, id);
  await nodeFs.mkdir(workDir, { recursive: true });

  const mountPrefix = `w${id.slice(0, 3)}`;
  const cache = await FileReadCacheService.createWithUrl(
    `file:${path.join(testRoot, `${id}.sqlite`)}`,
    noopLogger,
  );

  return {
    cache,
    workDir,
    mountPrefix,
    mountPaths: new Map([[mountPrefix, workDir]]),
    agentId: `agent-${id}`,
    host: {
      agentAttachmentPath: (_agentId: string, attachmentId: string) =>
        path.join(testRoot, `${id}-att`, attachmentId),
    } as unknown as HostPaths,
  };
}

async function teardown(ctx: TestContext): Promise<void> {
  await ctx.cache.teardown();
}

function sha256(content: string | Buffer): string {
  return createHash('sha256')
    .update(typeof content === 'string' ? Buffer.from(content) : content)
    .digest('hex');
}

function makeBlobReader(
  mountPaths: Map<string, string>,
): (agentId: string, mountedPath: string) => Promise<Buffer> {
  return async (_agentId: string, mountedPath: string) => {
    const slashIdx = mountedPath.indexOf('/');
    if (slashIdx <= 0) throw new Error(`Invalid path: ${mountedPath}`);
    const prefix = mountedPath.slice(0, slashIdx);
    const relative = mountedPath.slice(slashIdx + 1);
    const root = mountPaths.get(prefix);
    if (!root) throw new Error(`Unknown mount: ${prefix}`);
    return nodeFs.readFile(path.join(root, relative));
  };
}

function makeOpts(
  ctx: TestContext,
  mountedPath: string,
  expectedHash: string,
  overrides: Partial<FileReadTransformerOptions> = {},
): FileReadTransformerOptions {
  return {
    mountedPath,
    expectedHash,
    blobReader: makeBlobReader(ctx.mountPaths),
    cache: ctx.cache,
    logger: noopLogger,
    host: ctx.host,
    agentId: ctx.agentId,
    mountPaths: ctx.mountPaths,
    ...overrides,
  };
}

function allText(parts: any[]): string {
  return parts
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('');
}

describe('fileReadTransformer – diagnostic attachment summaries', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await setup();
  });

  afterEach(async () => {
    await teardown(ctx);
  });

  it('summarizes HAR files without injecting request or response bodies', async () => {
    const har = {
      log: {
        version: '1.2',
        creator: { name: 'Chrome', version: '126' },
        entries: [
          entry('GET', 'https://api.example.test/ok', 200, 42),
          entry('POST', 'https://api.example.test/forbidden', 403, 51),
          entry('GET', 'https://cdn.example.test/app.js', 500, 3200),
          {
            ...entry('POST', 'https://api.example.test/graphql', 200, 80),
            request: {
              method: 'POST',
              url: 'https://api.example.test/graphql',
              postData: {
                mimeType: 'application/json',
                text: JSON.stringify({
                  operationName: 'GetDashboard',
                  variables: {
                    secret: 'REQUEST_BODY_SHOULD_NOT_APPEAR',
                  },
                }),
              },
            },
            response: {
              status: 200,
              statusText: 'OK',
              content: {
                mimeType: 'application/json',
                text: 'RESPONSE_BODY_SHOULD_NOT_APPEAR',
              },
            },
          },
        ],
      },
    };
    const content = JSON.stringify(har);
    await nodeFs.writeFile(path.join(ctx.workDir, 'capture.har'), content);

    const result = await fileReadTransformer(
      makeOpts(ctx, `${ctx.mountPrefix}/capture.har`, sha256(content)),
    );
    const text = allText(result.parts);

    expect(text).toContain('HAR summary');
    expect(text).toContain('entries:4');
    expect(text).toContain('api.example.test: 3');
    expect(text).toContain('403');
    expect(text).toContain('500');
    expect(text).toContain('GetDashboard');
    expect(text).not.toContain('REQUEST_BODY_SHOULD_NOT_APPEAR');
    expect(text).not.toContain('RESPONSE_BODY_SHOULD_NOT_APPEAR');
    expect(result.effectiveReadParams).toEqual({ preview: true });
  });

  it('summarizes large log files instead of injecting the full middle body', async () => {
    const lines = Array.from({ length: 1200 }, (_, i) => {
      const n = i + 1;
      if (n === 601) return 'SECRET_MIDDLE_LINE_SHOULD_NOT_APPEAR';
      if (n % 100 === 0) {
        return `2026-07-19T10:00:00Z ERROR retry failed request id=${n}`;
      }
      return `2026-07-19T10:00:00Z INFO normal event id=${n}`;
    });
    const content = lines.join('\n');
    await nodeFs.writeFile(path.join(ctx.workDir, 'app.log'), content);

    const result = await fileReadTransformer(
      makeOpts(ctx, `${ctx.mountPrefix}/app.log`, sha256(content)),
    );
    const text = allText(result.parts);

    expect(text).toContain('Large log summary');
    expect(text).toContain('lines:1200');
    expect(text).toContain('error/fatal/exception/traceback: 12');
    expect(text).toContain('1|2026-07-19T10:00:00Z INFO normal event id=1');
    expect(text).toContain(
      '1200|2026-07-19T10:00:00Z ERROR retry failed request id=1200',
    );
    expect(text).not.toContain('SECRET_MIDDLE_LINE_SHOULD_NOT_APPEAR');
    expect(result.effectiveReadParams).toEqual({ preview: true });
  });

  it('summarizes large text clips through the browser blob transformer', async () => {
    const content = Array.from(
      { length: 1200 },
      (_, i) => `line ${i + 1}`,
    ).join('\n');
    await nodeFs.writeFile(path.join(ctx.workDir, 'clip'), content);

    const result = await fileReadTransformer(
      makeOpts(ctx, `${ctx.mountPrefix}/clip`, sha256(content), {
        originalFileName: 'pasted.textclip',
        extraTransformers: { '.textclip': textBlobTransformer },
      }),
    );
    const text = allText(result.parts);

    expect(text).toContain('Large text summary');
    expect(text).toContain('type:text-clip-summary');
    expect(text).toContain('lines:1200');
    expect(text).not.toContain('600|line 600');
  });
});

function entry(
  method: string,
  url: string,
  status: number,
  time: number,
): Record<string, unknown> {
  return {
    startedDateTime: '2026-07-19T10:00:00.000Z',
    time,
    request: { method, url },
    response: {
      status,
      statusText: status >= 400 ? 'ERR' : 'OK',
      content: { mimeType: 'application/json' },
    },
  };
}
