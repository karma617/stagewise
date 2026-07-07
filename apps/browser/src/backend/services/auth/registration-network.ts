import { ProxyAgent } from 'undici';
import { session } from 'electron';

// Target URL used when probing system proxy settings.
const SYSTEM_PROXY_PROBE_TARGET = 'https://api.stagewise.io';

/**
 * Resolve effective proxy URL with three-tier fallback:
 * 1. Random proxy from the configured pool
 * 2. System proxy (Electron session resolver)
 * 3. Direct connection (undefined)
 */
export async function resolveEffectiveProxyUrl(
  proxyPool?: string,
): Promise<string | undefined> {
  const poolProxy = pickRandomProxy(proxyPool);
  if (poolProxy) return poolProxy;

  return resolveSystemProxyUrl();
}

export async function resolveSystemProxyUrl(
  targetUrl = SYSTEM_PROXY_PROBE_TARGET,
): Promise<string | undefined> {
  try {
    const result = await session.defaultSession.resolveProxy(targetUrl);
    if (!result || result === 'DIRECT') return undefined;
    const first = result.split(';')[0]!.trim();
    const match = /^(PROXY|SOCKS5|SOCKS4|HTTPS)\s+(.+)$/i.exec(first);
    if (!match) return undefined;
    const scheme = /^SOCKS/i.test(match[1]!) ? 'socks5' : 'http';
    return scheme + '://' + match[2]!.trim();
  } catch {
    return undefined;
  }
}

export type RegistrationFingerprint = {
  userAgent: string;
  acceptLanguage: string;
  secChUa: string;
  secChUaPlatform: string;
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
] as const;

const ACCEPT_LANGUAGES = [
  'zh-CN,zh;q=0.9,en;q=0.8',
  'zh-CN,zh;q=0.9',
  'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
] as const;

const PLATFORMS = ['"Windows"'] as const;

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function normalizeProxyUrl(value: string): string {
  const proxy = value.trim();
  if (!proxy) return '';
  return proxy.includes('://') ? proxy : `http://${proxy}`;
}

export function createRegistrationFingerprint(): RegistrationFingerprint {
  const chromeMajor = String(148 + Math.floor(Math.random() * 3));
  return {
    userAgent: randomItem(USER_AGENTS),
    acceptLanguage: randomItem(ACCEPT_LANGUAGES),
    secChUa: `"Chromium";v="${chromeMajor}", "Google Chrome";v="${chromeMajor}", "Not_A Brand";v="99"`,
    secChUaPlatform: randomItem(PLATFORMS),
  };
}

export function parseProxyPool(proxyPool?: string): string[] {
  const raw = String(proxyPool ?? '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === 'string') return normalizeProxyUrl(item);
          if (!item || typeof item !== 'object') return '';
          const record = item as Record<string, unknown>;
          const isActive = record.isActive ?? record.is_active ?? true;
          if (!isActive) return '';
          return normalizeProxyUrl(String(record.url ?? ''));
        })
        .filter(Boolean);
    }
  } catch {}

  return raw
    .split(/[\r\n,]+/)
    .map((item) => normalizeProxyUrl(item))
    .filter(Boolean);
}

export function pickRandomProxy(proxyPool?: string): string | undefined {
  const proxies = parseProxyPool(proxyPool);
  return proxies.length > 0 ? randomItem(proxies) : undefined;
}

// Debug logger hook for registration network calls. AuthService wires this
// to its winston logger in dev mode so the terminal shows the full
// request/response trace and you can see exactly which step stalls or fails.
// Additionally appends to a log file so it can be tailed even when Electron
// stdout is not visible (electron-forge, packaged builds, etc).
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const REG_NET_LOG_FILE = join(tmpdir(), 'stagewise', 'registration-debug.log');

let registrationNetDebug: ((msg: string) => void) | null = null;

export function setRegistrationNetworkDebugger(
  fn: ((msg: string) => void) | null,
): void {
  registrationNetDebug = fn;
}

function traceNetwork(msg: string): void {
  if (registrationNetDebug) registrationNetDebug(msg);
  try {
    const line = new Date().toISOString() + ' ' + msg + '\n';
    appendFileSync(REG_NET_LOG_FILE, line);
  } catch {
    // best-effort file logging
  }
}

export function logRegistrationStep(msg: string): void {
  traceNetwork(msg);
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export async function fetchWithRegistrationNetwork(
  input: RequestInfo | URL,
  init: RequestInit = {},
  proxyUrl?: string,
): Promise<Response> {
  const url = requestUrl(input);
  const method = (init.method as string) || 'GET';
  const proxyTag = proxyUrl ? '(proxy)' : '(direct)';
  traceNetwork(`--> ${method} ${url} ${proxyTag}`);

  let response: Response;
  try {
    if (!proxyUrl) {
      response = await fetch(input, init);
    } else {
      const dispatcher = new ProxyAgent(proxyUrl);
      response = await fetch(input, {
        ...init,
        dispatcher,
      } as RequestInit & { dispatcher: ProxyAgent });
    }
  } catch (err) {
    traceNetwork(
      '<-- ' +
        method +
        ' ' +
        url +
        ' NETWORK ERROR: ' +
        (err instanceof Error ? err.message : String(err)),
    );
    throw err;
  }

  traceNetwork(
    '<-- ' +
      method +
      ' ' +
      url +
      ' ' +
      response.status +
      ' ' +
      response.statusText,
  );
  return response;
}

function proxyLabel(proxyUrl?: string): string {
  return proxyUrl ? proxyUrl : 'direct';
}

function pushUniqueProxyCandidate(
  candidates: Array<string | undefined>,
  proxyUrl?: string,
): void {
  const normalized = proxyUrl?.trim() || undefined;
  if (candidates.some((item) => (item?.trim() || undefined) === normalized)) {
    return;
  }
  candidates.push(normalized);
}

export async function buildRegistrationProxyCandidates(
  primaryProxyUrl?: string,
  targetUrl = SYSTEM_PROXY_PROBE_TARGET,
): Promise<Array<string | undefined>> {
  const candidates: Array<string | undefined> = [];
  if (primaryProxyUrl?.trim()) {
    pushUniqueProxyCandidate(candidates, primaryProxyUrl);
  }
  pushUniqueProxyCandidate(candidates, await resolveSystemProxyUrl(targetUrl));
  pushUniqueProxyCandidate(candidates, undefined);
  return candidates;
}

export function describeProxyCandidate(proxyUrl?: string): string {
  return proxyLabel(proxyUrl);
}

function isTransientProxyStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * Network-error fallback for mailbox-service requests:
 * configured proxy -> system proxy -> direct.
 *
 * HTTP responses are returned as-is so callers can still distinguish API
 * contract errors such as 404 from transport failures.
 */
export async function fetchWithRegistrationFallback(
  input: RequestInfo | URL,
  init: RequestInit = {},
  primaryProxyUrl?: string,
): Promise<Response> {
  const url = requestUrl(input);
  const method = (init.method as string) || 'GET';
  const candidates = await buildRegistrationProxyCandidates(
    primaryProxyUrl,
    url,
  );

  let lastError: unknown = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const proxyUrl = candidates[i];
    try {
      const response = await fetchWithRegistrationNetwork(
        input,
        init,
        proxyUrl,
      );
      const nextProxy = candidates[i + 1];
      if (i < candidates.length - 1 && isTransientProxyStatus(response.status)) {
        traceNetwork(
          `[fallback] ${method} ${url} via ${proxyLabel(
            proxyUrl,
          )} returned ${response.status}; retry via ${proxyLabel(nextProxy)}`,
        );
        continue;
      }
      return response;
    } catch (err) {
      lastError = err;
      const nextProxy = candidates[i + 1];
      if (i < candidates.length - 1) {
        traceNetwork(
          `[fallback] ${method} ${url} via ${proxyLabel(
            proxyUrl,
          )} failed; retry via ${proxyLabel(nextProxy)}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export type ProxyProbeResult = {
  url: string;
  ok: boolean;
  latencyMs?: number;
  ip?: string;
  error?: string;
};

const PROXY_PROBE_URL = 'https://api.ipify.org?format=json';
const PROXY_PROBE_TIMEOUT_MS = 8000;

async function probeSingleProxy(url: string): Promise<ProxyProbeResult> {
  const normalized = normalizeProxyUrl(url);
  if (!normalized) {
    return { url, ok: false, error: 'invalid proxy url' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_PROBE_TIMEOUT_MS);
  const start = Date.now();
  try {
    const resp = await fetchWithRegistrationNetwork(
      PROXY_PROBE_URL,
      { method: 'GET', signal: controller.signal },
      normalized,
    );
    if (!resp.ok) {
      return {
        url: normalized,
        ok: false,
        latencyMs: Date.now() - start,
        error: 'HTTP ' + resp.status,
      };
    }
    let ip: string | undefined;
    try {
      const data = (await resp.json()) as { ip?: string };
      if (typeof data.ip === 'string') ip = data.ip;
    } catch {}
    return {
      url: normalized,
      ok: true,
      latencyMs: Date.now() - start,
      ip,
    };
  } catch (err) {
    return {
      url: normalized,
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function testProxyPool(
  urls: string[],
): Promise<{ results: ProxyProbeResult[] }> {
  const list = Array.isArray(urls) ? urls : [];
  const results = await Promise.all(list.map((url) => probeSingleProxy(url)));
  return { results };
}
