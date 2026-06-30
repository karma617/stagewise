/**
 * SQLite-based persistent storage for account pool and auto-register config.
 */
import { createClient, type Client } from '@libsql/client';
import path from 'node:path';
import { app } from 'electron';

let _client: Client | null = null;

function getClient(): Client {
  if (_client) return _client;
  const dbPath = path.join(
    app.getPath('userData'),
    'stagewise',
    'account-data.sqlite',
  );
  _client = createClient({ url: 'file:' + dbPath });
  return _client;
}

const INIT_SQL = [
  "CREATE TABLE IF NOT EXISTS account_pool (email TEXT PRIMARY KEY, token TEXT, status TEXT NOT NULL DEFAULT 'normal', added_at TEXT NOT NULL, last_checked_at TEXT, throttled_since TEXT, throttled_resets_at TEXT, usage_json TEXT, usage_checked_at TEXT)",
  "CREATE TABLE IF NOT EXISTS auto_register_config (id INTEGER PRIMARY KEY DEFAULT 1, config_json TEXT NOT NULL DEFAULT '{}')",
  "CREATE TABLE IF NOT EXISTS captcha_api_keys (provider TEXT PRIMARY KEY, api_key TEXT NOT NULL DEFAULT '')",
];

let _initialized = false;

async function ensureInit(): Promise<void> {
  if (_initialized) return;
  const client = getClient();
  for (const sql of INIT_SQL) {
    await client.execute(sql);
  }
  // Soft migration: add usage columns to existing account_pool tables.
  // Wrapped in try/catch because SQLite ADD COLUMN throws if the column already exists.
  for (const col of ['usage_json TEXT', 'usage_checked_at TEXT']) {
    try {
      await client.execute('ALTER TABLE account_pool ADD COLUMN ' + col);
    } catch {
      // column already present
    }
  }
  _initialized = true;
}

// Account pool

export interface PoolAccountRow {
  email: string;
  token: string | null;
  status: string;
  added_at: string;
  last_checked_at: string | null;
  throttled_since: string | null;
  throttled_resets_at: string | null;
  usage_json: string | null;
  usage_checked_at: string | null;
}

export async function dbLoadPool(): Promise<PoolAccountRow[]> {
  await ensureInit();
  const result = await getClient().execute(
    'SELECT * FROM account_pool ORDER BY added_at ASC',
  );
  return result.rows as unknown as PoolAccountRow[];
}

export async function dbUpsertAccount(row: PoolAccountRow): Promise<void> {
  await ensureInit();
  const sql =
    'INSERT INTO account_pool (email, token, status, added_at, last_checked_at, throttled_since, throttled_resets_at, usage_json, usage_checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET token = excluded.token, status = excluded.status, last_checked_at = excluded.last_checked_at, throttled_since = excluded.throttled_since, throttled_resets_at = excluded.throttled_resets_at, usage_json = COALESCE(excluded.usage_json, account_pool.usage_json), usage_checked_at = COALESCE(excluded.usage_checked_at, account_pool.usage_checked_at)';
  await getClient().execute({
    sql,
    args: [
      row.email,
      row.token,
      row.status,
      row.added_at,
      row.last_checked_at,
      row.throttled_since,
      row.throttled_resets_at,
      row.usage_json,
      row.usage_checked_at,
    ],
  });
}

export async function dbRemoveAccount(email: string): Promise<void> {
  await ensureInit();
  await getClient().execute({
    sql: 'DELETE FROM account_pool WHERE email = ?',
    args: [email],
  });
}

export async function dbRemoveAccounts(emails: string[]): Promise<void> {
  await ensureInit();
  if (emails.length === 0) return;
  const client = getClient();
  for (let i = 0; i < emails.length; i += 200) {
    const chunk = emails.slice(i, i + 200);
    await client.execute({
      sql:
        'DELETE FROM account_pool WHERE email IN (' +
        chunk.map(() => '?').join(',') +
        ')',
      args: chunk,
    });
  }
}

export async function dbUpdateAccountStatus(
  email: string,
  status: string,
  throttledSince?: string,
  throttledResetsAt?: string,
): Promise<void> {
  await ensureInit();
  const sql =
    "UPDATE account_pool SET status = ?, throttled_since = ?, throttled_resets_at = ?, last_checked_at = datetime('now') WHERE email = ?";
  await getClient().execute({
    sql,
    args: [status, throttledSince ?? null, throttledResetsAt ?? null, email],
  });
}

export async function dbUpdateAccountUsage(
  email: string,
  usageJson: string | null,
  checkedAt: string,
): Promise<void> {
  await ensureInit();
  const sql =
    'UPDATE account_pool SET usage_json = ?, usage_checked_at = ? WHERE email = ?';
  await getClient().execute({ sql, args: [usageJson, checkedAt, email] });
}

// Config

export async function dbLoadConfig(): Promise<Record<string, unknown> | null> {
  await ensureInit();
  const result = await getClient().execute(
    'SELECT config_json FROM auto_register_config WHERE id = 1',
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as { config_json?: string };
  try {
    return JSON.parse(row.config_json ?? '{}');
  } catch {
    return null;
  }
}

export async function dbSaveConfig(
  config: Record<string, unknown>,
): Promise<void> {
  await ensureInit();
  const json = JSON.stringify(config);
  const sql =
    'INSERT INTO auto_register_config (id, config_json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET config_json = excluded.config_json';
  await getClient().execute({ sql, args: [json] });
}

// Captcha API keys (per-provider)

export async function dbLoadCaptchaKeys(): Promise<Record<string, string>> {
  await ensureInit();
  const result = await getClient().execute(
    'SELECT provider, api_key FROM captcha_api_keys',
  );
  const map: Record<string, string> = {};
  for (const row of result.rows) {
    const r = row as unknown as { provider: string; api_key: string };
    map[r.provider] = r.api_key;
  }
  return map;
}

export async function dbSaveCaptchaKey(
  provider: string,
  apiKey: string,
): Promise<void> {
  await ensureInit();
  const sql =
    'INSERT INTO captcha_api_keys (provider, api_key) VALUES (?, ?) ON CONFLICT(provider) DO UPDATE SET api_key = excluded.api_key';
  await getClient().execute({ sql, args: [provider, apiKey] });
}
