/**
 * Diagnostic text transformer.
 *
 * Large logs are usually evidence blobs, not source files. Injecting the full
 * body into every model request makes history compression churn and can still
 * leave the final prompt too large. This transformer keeps the blob searchable
 * by path while putting only a compact index/summary into model context by
 * default.
 */

import nodePath from 'node:path';
import type { FileTransformer, FileTransformResult } from '../types';
import {
  baseMetadata,
  inferLanguage,
  isBinaryBuffer,
  prefixLineNumbers,
} from '../format-utils';
import { textTransformer } from './text';

const LARGE_TEXT_SUMMARY_MIN_BYTES = 64 * 1024;
const LARGE_TEXT_SUMMARY_MIN_LINES = 1000;
const SAMPLE_LINE_COUNT = 12;
const TOP_REPEATED_COUNT = 8;

export function shouldSummarizeLargeText(
  sizeBytes: number,
  totalLines: number,
  readParams: { startLine?: number; endLine?: number; preview?: boolean },
): boolean {
  if (readParams.startLine !== undefined || readParams.endLine !== undefined) {
    return false;
  }
  if (readParams.preview) return true;
  return (
    sizeBytes >= LARGE_TEXT_SUMMARY_MIN_BYTES ||
    totalLines >= LARGE_TEXT_SUMMARY_MIN_LINES
  );
}

export function summarizeLargeTextContent(
  text: string,
  mountedPath: string,
  stats: { size: number; mtime: Date; isDirectory: boolean },
  maxReadChars: number,
  metadata: Record<string, string>,
  label = 'large-text',
): FileTransformResult {
  const allLines = text.split('\n');
  const totalLines = allLines.length;
  const summary = buildSummary(text, allLines, mountedPath, label);
  const cappedSummary =
    summary.length <= maxReadChars
      ? summary
      : `${summary.slice(0, Math.max(0, maxReadChars - 80))}\n… (summary truncated to per-read budget)`;

  return {
    metadata: {
      ...metadata,
      ...baseMetadata(stats.size, stats.mtime),
      type: label,
      summary: 'true',
      lines: String(totalLines),
      chars: String(text.length),
    },
    parts: [{ type: 'text', text: cappedSummary }],
    effectiveReadParams: { preview: true },
  };
}

export const diagnosticTextTransformer: FileTransformer = async (
  buf,
  mountedPath,
  stats,
  ctx,
  originalFileName,
): Promise<FileTransformResult> => {
  if (isBinaryBuffer(buf)) {
    return textTransformer(buf, mountedPath, stats, ctx, originalFileName);
  }

  const text = buf.toString('utf-8');
  const allLines = text.split('\n');
  const metadata = baseMetadata(stats.size, stats.mtime);
  const nameForExt = originalFileName ?? mountedPath;
  const ext = nodePath.extname(nameForExt).toLowerCase();
  const language = inferLanguage(ext);
  if (language) metadata.language = language;

  if (
    !shouldSummarizeLargeText(stats.size, allLines.length, ctx.readParams)
  ) {
    return textTransformer(buf, mountedPath, stats, ctx, originalFileName);
  }

  return summarizeLargeTextContent(
    text,
    mountedPath,
    stats,
    ctx.maxReadChars,
    metadata,
    ext === '.log' ? 'log-summary' : 'large-text-summary',
  );
};

function buildSummary(
  text: string,
  allLines: readonly string[],
  mountedPath: string,
  label: string,
): string {
  const totalLines = allLines.length;
  const levelCounts = countLevels(allLines);
  const repeated = topRepeatedMessages(allLines);
  const { firstTimestamp, lastTimestamp } = findTimestampRange(allLines);
  const firstLines = allLines.slice(0, Math.min(SAMPLE_LINE_COUNT, totalLines));
  const lastStart = Math.max(firstLines.length, totalLines - SAMPLE_LINE_COUNT);
  const lastLines = allLines.slice(lastStart);
  const title =
    label === 'log-summary'
      ? 'Large log summary'
      : 'Large text summary';

  const sections = [
    `${title} for ${mountedPath}`,
    '',
    `Total: ${totalLines} lines, ${text.length} chars.`,
    timestampLine(firstTimestamp, lastTimestamp),
    '',
    'Level counts:',
    `- error/fatal/exception/traceback: ${levelCounts.error}`,
    `- warn/warning: ${levelCounts.warn}`,
    `- info: ${levelCounts.info}`,
    `- debug/trace: ${levelCounts.debug}`,
    '',
    'Top repeated normalized lines:',
    repeated.length > 0
      ? repeated.map((item) => `- ${item.count}× ${item.text}`).join('\n')
      : '- none detected',
    '',
    `First ${firstLines.length} lines:`,
    prefixLineNumbers(firstLines.join('\n'), 1),
    '',
    `Last ${lastLines.length} lines:`,
    prefixLineNumbers(lastLines.join('\n'), lastStart + 1),
    '',
    'This is an index, not the full file. For exact evidence, search this path or read a narrow line range with start_line/end_line.',
  ];

  return sections.filter((section) => section !== undefined).join('\n');
}

function countLevels(lines: readonly string[]): {
  error: number;
  warn: number;
  info: number;
  debug: number;
} {
  const counts = { error: 0, warn: 0, info: 0, debug: 0 };
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      /\b(error|fatal|exception|traceback|stack trace)\b/.test(lower)
    ) {
      counts.error++;
    } else if (/\b(warn|warning)\b/.test(lower)) {
      counts.warn++;
    } else if (/\binfo\b/.test(lower)) {
      counts.info++;
    } else if (/\b(debug|trace)\b/.test(lower)) {
      counts.debug++;
    }
  }
  return counts;
}

function topRepeatedMessages(
  lines: readonly string[],
): Array<{ text: string; count: number }> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const normalized = normalizeLine(line);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_REPEATED_COUNT)
    .map(([text, count]) => ({ text, count }));
}

function normalizeLine(line: string): string {
  return line
    .replace(/\d{4}-\d{2}-\d{2}[T ][0-9:.+-Z]+/g, '<timestamp>')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<hex>')
    .replace(/\b\d+(?:\.\d+)?(?:ms|s|m)?\b/g, '<num>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function findTimestampRange(lines: readonly string[]): {
  firstTimestamp?: string;
  lastTimestamp?: string;
} {
  const timestampPattern =
    /\b\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-Z]+)?\b|\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/;
  let firstTimestamp: string | undefined;
  let lastTimestamp: string | undefined;

  for (const line of lines) {
    const match = line.match(timestampPattern)?.[0];
    if (!match) continue;
    firstTimestamp ??= match;
    lastTimestamp = match;
  }

  return { firstTimestamp, lastTimestamp };
}

function timestampLine(
  firstTimestamp?: string,
  lastTimestamp?: string,
): string {
  if (!firstTimestamp && !lastTimestamp) return 'Time range: not detected.';
  if (firstTimestamp === lastTimestamp) {
    return `Time range: ${firstTimestamp}.`;
  }
  return `Time range: ${firstTimestamp ?? '?'} → ${lastTimestamp ?? '?'}.`;
}
