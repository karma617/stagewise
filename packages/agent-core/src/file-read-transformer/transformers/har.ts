/**
 * HAR transformer.
 *
 * HAR files can contain large request/response bodies. By default we inject a
 * compact network index into model context and keep the raw file available for
 * targeted reads/searches.
 */

import type { FileTransformer, FileTransformResult } from '../types';
import { baseMetadata } from '../format-utils';
import { textTransformer } from './text';

interface HarFile {
  log?: {
    version?: string;
    creator?: { name?: string; version?: string };
    entries?: HarEntry[];
  };
}

interface HarEntry {
  startedDateTime?: string;
  time?: number;
  serverIPAddress?: string;
  request?: {
    method?: string;
    url?: string;
    headers?: Array<{ name?: string; value?: string }>;
    postData?: {
      mimeType?: string;
      text?: string;
      params?: Array<{ name?: string; value?: string }>;
    };
  };
  response?: {
    status?: number;
    statusText?: string;
    headers?: Array<{ name?: string; value?: string }>;
    content?: { mimeType?: string; size?: number; text?: string };
    bodySize?: number;
    _error?: string;
  };
  _error?: string;
}

const TOP_HOSTS = 20;
const TOP_FAILED = 20;
const TOP_SLOW = 10;
const TOP_GRAPHQL = 20;

export const harTransformer: FileTransformer = async (
  buf,
  mountedPath,
  stats,
  ctx,
  originalFileName,
): Promise<FileTransformResult> => {
  if (
    ctx.readParams.startLine !== undefined ||
    ctx.readParams.endLine !== undefined
  ) {
    return textTransformer(buf, mountedPath, stats, ctx, originalFileName);
  }

  const raw = buf.toString('utf-8');
  let har: HarFile;
  try {
    har = JSON.parse(raw) as HarFile;
  } catch {
    return textTransformer(buf, mountedPath, stats, ctx, originalFileName);
  }

  const entries = Array.isArray(har.log?.entries) ? har.log.entries : [];
  const metadata = {
    ...baseMetadata(stats.size, stats.mtime),
    format: 'har',
    entries: String(entries.length),
    summary: 'true',
  };

  const summary = buildHarSummary(mountedPath, har, entries);
  const cappedSummary =
    summary.length <= ctx.maxReadChars
      ? summary
      : `${summary.slice(0, Math.max(0, ctx.maxReadChars - 80))}\n… (HAR summary truncated to per-read budget)`;

  return {
    metadata,
    parts: [{ type: 'text', text: cappedSummary }],
    effectiveReadParams: { preview: true },
  };
};

function buildHarSummary(
  mountedPath: string,
  har: HarFile,
  entries: readonly HarEntry[],
): string {
  const hosts = new Map<string, number>();
  const methods = new Map<string, number>();
  const statuses = new Map<string, number>();
  const contentTypes = new Map<string, number>();
  const failed: HarEntry[] = [];
  const graphql = new Map<string, number>();

  for (const entry of entries) {
    const request = entry.request;
    const response = entry.response;
    const method = request?.method ?? 'UNKNOWN';
    const status = response?.status ?? 0;
    increment(methods, method);
    increment(statuses, String(status));

    const host = hostFromUrl(request?.url);
    if (host) increment(hosts, host);

    const mimeType = response?.content?.mimeType;
    if (mimeType) increment(contentTypes, mimeType.split(';')[0] ?? mimeType);

    if (status >= 400 || entry._error || response?._error) {
      failed.push(entry);
    }

    const operation = extractGraphqlOperation(entry);
    if (operation) increment(graphql, operation);
  }

  const slowest = [...entries]
    .sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
    .slice(0, TOP_SLOW);

  return [
    `HAR summary for ${mountedPath}`,
    '',
    `Entries: ${entries.length}`,
    creatorLine(har),
    timeRangeLine(entries),
    '',
    'Hosts:',
    formatCounts(hosts, TOP_HOSTS),
    '',
    'Methods:',
    formatCounts(methods),
    '',
    'Statuses:',
    formatCounts(statuses),
    '',
    'Response content types:',
    formatCounts(contentTypes),
    '',
    'Failed requests:',
    failed.length > 0
      ? failed
          .slice(0, TOP_FAILED)
          .map((entry) => `- ${entryLine(entry)}`)
          .join('\n')
      : '- none',
    failed.length > TOP_FAILED
      ? `- … ${failed.length - TOP_FAILED} more failed requests`
      : '',
    '',
    'Slowest requests:',
    slowest.length > 0
      ? slowest.map((entry) => `- ${entryLine(entry)}`).join('\n')
      : '- none',
    '',
    'GraphQL operations:',
    graphql.size > 0 ? formatCounts(graphql, TOP_GRAPHQL) : '- none detected',
    '',
    'This is an index, not the full HAR. Request/response bodies are intentionally omitted. For exact payloads, search this path for a URL, status, or operation name, or read a narrow raw line range with start_line/end_line.',
  ]
    .filter((section) => section !== '')
    .join('\n');
}

function creatorLine(har: HarFile): string {
  const creator = har.log?.creator;
  if (!creator?.name) return 'Creator: not specified';
  return `Creator: ${creator.name}${creator.version ? ` ${creator.version}` : ''}`;
}

function timeRangeLine(entries: readonly HarEntry[]): string {
  const times = entries
    .map((entry) => entry.startedDateTime)
    .filter((value): value is string => Boolean(value))
    .sort();
  if (times.length === 0) return 'Time range: not specified';
  return `Time range: ${times[0]} → ${times[times.length - 1]}`;
}

function entryLine(entry: HarEntry): string {
  const request = entry.request;
  const response = entry.response;
  const status = response?.status ?? 0;
  const statusText = response?.statusText ? ` ${response.statusText}` : '';
  const time = entry.time !== undefined ? `${Math.round(entry.time)}ms` : '?ms';
  const method = request?.method ?? 'UNKNOWN';
  const url = shortUrl(request?.url);
  const operation = extractGraphqlOperation(entry);
  const error = entry._error ?? response?._error;
  const suffixes = [
    operation ? `op=${operation}` : undefined,
    error ? `error=${truncate(error, 80)}` : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  return `${method} ${status}${statusText} ${time} ${url}${suffixes ? ` ${suffixes}` : ''}`;
}

function extractGraphqlOperation(entry: HarEntry): string | undefined {
  const postData = entry.request?.postData;
  if (!postData) return undefined;

  for (const param of postData.params ?? []) {
    if (param.name === 'operationName' && param.value) {
      return truncate(param.value, 80);
    }
  }

  const text = postData.text?.slice(0, 100_000);
  if (!text) return undefined;

  try {
    const parsed = JSON.parse(text) as unknown;
    const operation = operationFromJson(parsed);
    if (operation) return operation;
  } catch {
    // Fall through to regex extraction below.
  }

  const operationName = text.match(/"operationName"\s*:\s*"([^"]+)"/)?.[1];
  if (operationName) return truncate(operationName, 80);

  const queryName = text.match(
    /\b(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/,
  )?.[1];
  return queryName ? truncate(queryName, 80) : undefined;
}

function operationFromJson(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const operation = operationFromJson(item);
      if (operation) return operation;
    }
    return undefined;
  }

  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.operationName === 'string' && record.operationName) {
    return truncate(record.operationName, 80);
  }
  if (typeof record.query === 'string') {
    const queryName = record.query.match(
      /\b(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/,
    )?.[1];
    if (queryName) return truncate(queryName, 80);
  }
  return undefined;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function formatCounts(map: Map<string, number>, limit = 50): string {
  if (map.size === 0) return '- none';
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => `- ${key}: ${count}`)
    .join('\n');
}

function hostFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function shortUrl(url?: string): string {
  if (!url) return '<missing-url>';
  try {
    const parsed = new URL(url);
    const query = parsed.search ? '?…' : '';
    return truncate(`${parsed.host}${parsed.pathname}${query}`, 180);
  } catch {
    return truncate(url, 180);
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}
