/**
 * Account pool management for auto-switching on quota limit.
 * Persists accounts in SQLite (account-data.sqlite) with automatic
 * one-time migration from the legacy JSON file.
 */

import { z } from 'zod';
import { readPersistedData } from '../../utils/persisted-data';
import type { CurrentUsageResponse } from '../../../shared/karton-contracts/pages-api/types';
import {
  dbLoadPool,
  dbUpdateAccountUsage,
  dbUpsertAccount,
  dbRemoveAccount,
  dbRemoveAccounts,
  dbUpdateAccountStatus,
  type PoolAccountRow,
} from './account-data-sqlite';

export type AccountStatus = 'normal' | 'throttled' | 'banned';

export const accountEntrySchema = z.object({
  email: z.string(),
  token: z.string().optional(),
  status: z.enum(['normal', 'throttled', 'banned']).default('normal'),
  addedAt: z.string().default(() => new Date().toISOString()),
  lastCheckedAt: z.string().optional(),
  throttledSince: z.string().optional(),
  throttledResetsAt: z.string().optional(),
  usage: z.custom<CurrentUsageResponse>(() => true).optional(),
  usageCheckedAt: z.string().optional(),
});

export type AccountEntry = z.infer<typeof accountEntrySchema>;
export type UsageLimitWindow = 'monthly' | 'weekly' | 'daily';

export type AccountPoolExport = {
  version: 1;
  exportedAt: string;
  accounts: Array<{
    email: string;
    token: string;
    status: AccountStatus;
    addedAt: string;
  }>;
};

export type AccountPoolImportResult = {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  accounts: AccountEntry[];
};

export type FindAvailableAccountOptions = {
  currentEmail?: string;
  usageCheckedAfter?: string;
  excludedEmails?: Iterable<string>;
};

const poolSchema = z.array(accountEntrySchema).nullable();
const POOL_KEY = 'account-pool' as const;

const importAccountSchema = z.object({
  email: z.string().trim().email(),
  token: z.string().trim().min(1),
  status: z.enum(['normal', 'throttled', 'banned']).optional(),
  addedAt: z.string().optional(),
});

const importPayloadSchema = z.union([
  z.array(importAccountSchema),
  z.object({
    accounts: z.array(importAccountSchema),
  }),
]);

let _migrated = false;

function parseTimestamp(value?: string): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeIsoTimestamp(value?: string): string | undefined {
  const timestamp = parseTimestamp(value);
  return timestamp === null ? undefined : new Date(timestamp).toISOString();
}

/** Convert a SQLite row to AccountEntry */
function rowToEntry(row: PoolAccountRow): AccountEntry {
  let usage: CurrentUsageResponse | undefined;
  if (row.usage_json) {
    try {
      usage = JSON.parse(row.usage_json) as CurrentUsageResponse;
    } catch {
      usage = undefined;
    }
  }
  return {
    email: row.email,
    token: row.token ?? undefined,
    status: row.status as AccountStatus,
    addedAt: row.added_at,
    lastCheckedAt: row.last_checked_at ?? undefined,
    throttledSince: row.throttled_since ?? undefined,
    throttledResetsAt: row.throttled_resets_at ?? undefined,
    usage,
    usageCheckedAt: row.usage_checked_at ?? undefined,
  };
}

/** Convert AccountEntry to SQLite row args */
function entryToRow(entry: AccountEntry): PoolAccountRow {
  return {
    email: entry.email,
    token: entry.token ?? null,
    status: entry.status,
    added_at: entry.addedAt,
    last_checked_at: entry.lastCheckedAt ?? null,
    throttled_since: entry.throttledSince ?? null,
    throttled_resets_at: entry.throttledResetsAt ?? null,
    usage_json: entry.usage ? JSON.stringify(entry.usage) : null,
    usage_checked_at: entry.usageCheckedAt ?? null,
  };
}

/** One-time migration from JSON to SQLite */
async function migrateFromJson(): Promise<void> {
  if (_migrated) return;
  _migrated = true;
  try {
    const data = await readPersistedData(POOL_KEY, poolSchema, null);
    if (data && data.length > 0) {
      for (const entry of data) {
        await dbUpsertAccount(entryToRow(entry));
      }
    }
  } catch {
    // Ignore migration errors
  }
}

export async function loadPool(): Promise<AccountEntry[]> {
  await migrateFromJson();
  const rows = await dbLoadPool();
  return rows.map(rowToEntry);
}

/** Add or update an account in the pool */
export async function upsertAccount(entry: AccountEntry): Promise<void> {
  await dbUpsertAccount(entryToRow(entry));
}

export async function exportAccountPool(): Promise<AccountPoolExport> {
  const pool = await loadPool();
  const accounts: AccountPoolExport['accounts'] = [];
  for (const entry of pool) {
    if (!entry.token) continue;
    accounts.push({
      email: normalizeEmail(entry.email),
      token: entry.token,
      status: entry.status,
      addedAt: entry.addedAt,
    });
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts,
  };
}

export async function importAccountPool(
  rawJson: string,
): Promise<AccountPoolImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Invalid account pool import JSON');
  }

  const payload = importPayloadSchema.parse(parsed);
  const rawAccounts = Array.isArray(payload) ? payload : payload.accounts;
  const existing = new Map(
    (await loadPool()).map((entry) => [normalizeEmail(entry.email), entry]),
  );
  const deduped = new Map<
    string,
    z.infer<typeof importAccountSchema> & { email: string }
  >();
  let skipped = 0;

  for (const raw of rawAccounts) {
    const email = normalizeEmail(raw.email);
    if (!email || !raw.token) {
      skipped += 1;
      continue;
    }
    if (deduped.has(email)) {
      skipped += 1;
    }
    deduped.set(email, { ...raw, email });
  }

  let imported = 0;
  let updated = 0;
  for (const [email, raw] of deduped) {
    const previous = existing.get(email);
    if (previous) {
      updated += 1;
    } else {
      imported += 1;
    }
    await upsertAccount({
      email,
      token: raw.token,
      status: raw.status ?? 'normal',
      addedAt: previous?.addedAt ?? raw.addedAt ?? new Date().toISOString(),
      lastCheckedAt: undefined,
      throttledSince: undefined,
      throttledResetsAt: undefined,
      usage: undefined,
      usageCheckedAt: undefined,
    });
  }

  return {
    total: rawAccounts.length,
    imported,
    updated,
    skipped,
    accounts: await loadPool(),
  };
}

/** Bulk save all pool entries (replaces entire pool) */
export async function savePool(entries: AccountEntry[]): Promise<void> {
  for (const entry of entries) {
    await dbUpsertAccount(entryToRow(entry));
  }
}

/** Mark account as throttled */
export async function markAccountThrottled(
  email: string,
  resetsAt?: string,
): Promise<void> {
  await dbUpdateAccountStatus(
    email,
    'throttled',
    new Date().toISOString(),
    normalizeIsoTimestamp(resetsAt),
  );
}

/** Mark account as banned */
export async function markAccountBanned(email: string): Promise<void> {
  await dbUpdateAccountStatus(email, 'banned');
}

/** Mark account as normal */
export async function markAccountNormal(email: string): Promise<void> {
  await dbUpdateAccountStatus(email, 'normal');
}

export function getUsageLimitWindow(
  usage?: CurrentUsageResponse | null,
): UsageLimitWindow | null {
  if (!usage) return null;
  const byType = new Map(usage.windows.map((w) => [w.type, w]));
  for (const type of ['monthly', 'weekly', 'daily'] as const) {
    const win = byType.get(type);
    if (!win) continue;
    if (win.exceeded || win.usedPercent >= 100) {
      return type;
    }
  }
  return null;
}

function getUsageLimitResetsAt(
  usage: CurrentUsageResponse,
  window: UsageLimitWindow,
): string | undefined {
  return usage.windows.find((w) => w.type === window)?.resetsAt;
}

/** Update an account's usage snapshot and sync normal/throttled status. */
export async function updateAccountUsage(
  email: string,
  usage: CurrentUsageResponse | null,
): Promise<void> {
  await dbUpdateAccountUsage(
    email,
    usage ? JSON.stringify(usage) : null,
    new Date().toISOString(),
  );
  const limitWindow = getUsageLimitWindow(usage);
  if (usage && limitWindow) {
    await markAccountThrottled(
      email,
      getUsageLimitResetsAt(usage, limitWindow),
    );
  } else if (usage) {
    await markAccountNormal(email);
  }
}

/** Remove account from pool */
export async function removeAccount(email: string): Promise<void> {
  await dbRemoveAccount(email);
}

export async function removeInvalidAccounts(): Promise<number> {
  const pool = await loadPool();
  const emails = pool
    .filter((entry) => entry.status === 'banned' || !entry.token)
    .map((entry) => entry.email);
  await dbRemoveAccounts(emails);
  return emails.length;
}

function normalizeEmail(email?: string): string {
  return (email ?? '').trim().toLowerCase();
}

function wasUsageCheckedAfter(
  entry: AccountEntry,
  checkedAfter?: string,
): boolean {
  if (!checkedAfter) return true;
  if (!entry.usageCheckedAt) return false;
  return (
    new Date(entry.usageCheckedAt).getTime() >= new Date(checkedAfter).getTime()
  );
}

/** Find first available account (normal status, reset if throttle window expired) */
export async function findAvailableAccount(
  currentEmailOrOptions?: string | FindAvailableAccountOptions,
): Promise<AccountEntry | null> {
  const options =
    typeof currentEmailOrOptions === 'string'
      ? { currentEmail: currentEmailOrOptions }
      : (currentEmailOrOptions ?? {});
  const currentEmail = normalizeEmail(options.currentEmail);
  const excludedEmails = new Set(
    Array.from(options.excludedEmails ?? [], normalizeEmail),
  );
  const pool = await loadPool();
  const now = Date.now();

  for (const entry of pool) {
    const email = normalizeEmail(entry.email);
    if (email === currentEmail) continue;
    if (excludedEmails.has(email)) continue;
    if (!entry.token) {
      await markAccountBanned(entry.email);
      continue;
    }
    if (entry.status === 'banned') continue;
    if (!wasUsageCheckedAfter(entry, options.usageCheckedAfter)) continue;
    if (getUsageLimitWindow(entry.usage)) {
      const limitWindow = getUsageLimitWindow(entry.usage);
      if (limitWindow) {
        await markAccountThrottled(
          entry.email,
          getUsageLimitResetsAt(entry.usage!, limitWindow),
        );
      }
      continue;
    }
    if (entry.status === 'throttled') {
      if (entry.throttledResetsAt) {
        const resetsAt = parseTimestamp(entry.throttledResetsAt);
        if (resetsAt === null || now >= resetsAt) {
          await markAccountNormal(entry.email);
          entry.status = 'normal';
          entry.throttledSince = undefined;
          entry.throttledResetsAt = undefined;
        } else {
          continue;
        }
      } else {
        continue;
      }
    }
    return entry;
  }

  return null;
}
