import { ProxyAgent } from 'undici';
import { randomUUID } from 'node:crypto';
import type { LlmNetworkStatus } from '@shared/karton-contracts/ui';

export const DEFAULT_CHAT_PROXY_URL = 'http://127.0.0.1:7897';
export const DEFAULT_CLASH_API_URL = 'http://127.0.0.1:9097';
export const DEFAULT_CLASH_API_SECRET = '88521617';
export const DEFAULT_CLASH_PROXY_GROUP = 'GLOBAL';
export const CLASH_UNAVAILABLE_MESSAGE = '当前订阅无可用节点，请更换订阅重试';
export const LLM_ACCOUNT_FORBIDDEN_MARKER = '[stagewise:llm-account-forbidden]';
export const LLM_ACCOUNT_FORBIDDEN_NODE_THRESHOLD = 10;
const SPOOFED_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

type LlmNetworkSettings = {
  proxyUrl?: string;
  useProxyPool?: boolean;
  loadProxyPool?: () => Promise<string | undefined>;
  clashApiUrl?: string;
  clashApiSecret?: string;
  clashProxyGroup?: string;
  clashAutoSwitchOnForbidden?: boolean;
  forceClashSwitchOnForbidden?: () => boolean;
  onAccountSuccess?: () => void;
  onStatus?: (status: LlmNetworkStatus | null) => void;
  onLog?: (message: string) => void;
};

type RequestInitWithDispatcher = RequestInit & {
  dispatcher?: ProxyAgent;
};

type ClashProxyDetails = {
  all?: unknown;
  now?: unknown;
  type?: unknown;
  delay?: unknown;
  history?: unknown;
};

type ClashNodeCandidate = {
  name: string;
  delayMs?: number;
};

type ClashProxySelection = {
  groupName: string;
  nodeCandidates: ClashNodeCandidate[];
};

type ClashSwitchResult = {
  ok: boolean;
  status: number;
  statusText: string;
};

type ClashRetryOutcome =
  | { kind: 'success' }
  | { kind: 'account-forbidden' }
  | { kind: 'unavailable' }
  | { kind: 'no-candidates' };

type ClashRetryResult = {
  response: Response;
  outcome: ClashRetryOutcome;
};

type LlmFailureKind = 'none' | 'forbidden' | 'account-required';

type LlmSend = () => Promise<Response>;

const proxyAgents = new Map<string, ProxyAgent>();
let clashSwitchInFlight: Promise<ClashRetryOutcome> | null = null;

function describeRequestTarget(input: RequestInfo | URL): string {
  try {
    const url =
      typeof input === 'string'
        ? new URL(input)
        : input instanceof URL
          ? input
          : new URL(input.url);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return '[unknown-url]';
  }
}

function getRequestMethod(init: RequestInit | undefined): string {
  return init?.method?.toUpperCase() ?? 'GET';
}

function normalizeUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  return trimmed.includes('://') ? trimmed : `http://${trimmed}`;
}

function getProxyAgent(proxyUrl: string): ProxyAgent {
  let agent = proxyAgents.get(proxyUrl);
  if (!agent) {
    agent = new ProxyAgent(proxyUrl);
    proxyAgents.set(proxyUrl, agent);
  }
  return agent;
}

function parseLlmProxyPool(proxyPool?: string): string[] {
  const raw = String(proxyPool ?? '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === 'string') return normalizeUrl(item);
          if (!item || typeof item !== 'object') return '';
          const record = item as Record<string, unknown>;
          const isActive = record.isActive ?? record.is_active ?? true;
          if (!isActive) return '';
          return normalizeUrl(String(record.url ?? ''));
        })
        .filter(Boolean);
    }
  } catch {}

  return raw
    .split(/[\r\n,]+/)
    .map((item) => normalizeUrl(item))
    .filter(Boolean);
}

export function selectProxyPoolProxy(proxyPool?: string): string | undefined {
  const proxies = parseLlmProxyPool(proxyPool);
  if (proxies.length === 0) return undefined;
  return proxies[Math.floor(Math.random() * proxies.length)];
}

async function resolveLlmProxyUrl(
  settings: LlmNetworkSettings,
): Promise<string> {
  if (settings.useProxyPool && settings.loadProxyPool) {
    const proxyPool = await settings.loadProxyPool().catch(() => undefined);
    const poolProxy = selectProxyPoolProxy(proxyPool);
    if (poolProxy) return poolProxy;
  }

  return normalizeUrl(settings.proxyUrl) || DEFAULT_CHAT_PROXY_URL;
}

function withExtraHeaders(
  init: RequestInit | undefined,
  extraHeaders: Record<string, string> | undefined,
): RequestInit {
  if (!extraHeaders || Object.keys(extraHeaders).length === 0) {
    return init ?? {};
  }

  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }
  return { ...init, headers };
}

function maskClientIdentity(init: RequestInit): RequestInit {
  const headers = new Headers(init.headers);
  headers.delete('X-Stagewise-Client');
  headers.delete('x-stagewise-client');
  headers.set('User-Agent', SPOOFED_USER_AGENT);
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set(
    'Sec-CH-UA',
    '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
  );
  headers.set('Sec-CH-UA-Mobile', '?0');
  headers.set('Sec-CH-UA-Platform', '"Windows"');
  return { ...init, headers };
}

function isAccountRequiredBody(body: string): boolean {
  return (
    /stagewise subscription required/i.test(body) ||
    /subscription required/i.test(body) ||
    /missing or invalid session/i.test(body) ||
    /invalid session/i.test(body) ||
    /upgrade your plan/i.test(body) ||
    /configure your own api keys/i.test(body) ||
    /connect a coding plan/i.test(body)
  );
}

async function getLlmFailureKind(response: Response): Promise<LlmFailureKind> {
  if (response.ok) return 'none';

  let body = '';
  try {
    body = await response.clone().text();
  } catch {
    body = '';
  }

  if (isAccountRequiredBody(body)) return 'account-required';
  if (response.status === 403) return 'forbidden';
  if (/\bforbidden\b/i.test(body)) return 'forbidden';
  return 'none';
}

function unavailableResponse(accountForbidden = false): Response {
  const message = accountForbidden
    ? `${CLASH_UNAVAILABLE_MESSAGE} ${LLM_ACCOUNT_FORBIDDEN_MARKER}`
    : CLASH_UNAVAILABLE_MESSAGE;
  return new Response(
    JSON.stringify({
      error: {
        message,
        code: accountForbidden ? 'LLM_ACCOUNT_FORBIDDEN' : undefined,
      },
    }),
    {
      status: 403,
      statusText: 'Forbidden',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}

function clashHeaders(secret: string): HeadersInit {
  return secret
    ? {
        Authorization: `Bearer ${secret}`,
      }
    : {};
}

async function clashFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    return await globalThis.fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function selectClashProxyGroup(
  proxies: Record<string, ClashProxyDetails>,
  configuredGroup: string,
): ClashProxySelection | null {
  const entries = Object.entries(proxies).filter(([, proxy]) => {
    if (!Array.isArray(proxy.all) || proxy.all.length === 0) return false;
    const type = typeof proxy.type === 'string' ? proxy.type : '';
    return !type || type === 'Selector';
  });

  const selected =
    entries.find(([name]) => name === configuredGroup) ??
    entries.find(([name]) => name === 'GLOBAL') ??
    entries[0];
  if (!selected) return null;

  const [groupName, details] = selected;
  const now = typeof details.now === 'string' ? details.now : '';
  const nodeCandidates = (details.all as unknown[])
    .filter(
      (name): name is string =>
        typeof name === 'string' &&
        name.length > 0 &&
        name !== now &&
        name !== 'DIRECT' &&
        name !== 'REJECT',
    )
    .map((name) => ({
      name,
      delayMs: readClashDelayMs(proxies[name]),
    }));

  // Randomize order so retries do not always start from the first node in
  // the pool (Fisher-Yates shuffle).
  for (let i = nodeCandidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [nodeCandidates[i], nodeCandidates[j]] = [
      nodeCandidates[j]!,
      nodeCandidates[i]!,
    ];
  }

  return { groupName, nodeCandidates };
}

function readClashDelayMs(
  details: ClashProxyDetails | undefined,
): number | undefined {
  if (!details) return undefined;
  if (typeof details.delay === 'number' && Number.isFinite(details.delay)) {
    return details.delay;
  }
  if (!Array.isArray(details.history)) return undefined;
  for (let i = details.history.length - 1; i >= 0; i -= 1) {
    const item = details.history[i] as { delay?: unknown } | undefined;
    if (typeof item?.delay === 'number' && Number.isFinite(item.delay)) {
      return item.delay;
    }
  }
  return undefined;
}

function formatClashDelay(delayMs: number | undefined): string {
  return delayMs === undefined ? 'unknown' : `${delayMs}ms`;
}

function formatClashCandidates(candidates: ClashNodeCandidate[]): string {
  return candidates
    .map(
      (candidate) =>
        `${candidate.name}(ping=${formatClashDelay(candidate.delayMs)})`,
    )
    .join(', ');
}

async function readClashNodeCandidates(
  settings: LlmNetworkSettings,
): Promise<ClashProxySelection | null> {
  const apiUrl = (
    normalizeUrl(settings.clashApiUrl) || DEFAULT_CLASH_API_URL
  ).replace(/\/+$/, '');
  if (!apiUrl) return null;

  const response = await clashFetch(`${apiUrl}/proxies`, {
    method: 'GET',
    headers: clashHeaders(
      settings.clashApiSecret?.trim() || DEFAULT_CLASH_API_SECRET,
    ),
  });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    proxies?: Record<string, ClashProxyDetails>;
  };
  if (!data.proxies) return null;
  return selectClashProxyGroup(
    data.proxies,
    settings.clashProxyGroup?.trim() || DEFAULT_CLASH_PROXY_GROUP,
  );
}

async function switchClashNode(
  settings: LlmNetworkSettings,
  groupName: string,
  nodeName: string,
): Promise<ClashSwitchResult> {
  const apiUrl = (
    normalizeUrl(settings.clashApiUrl) || DEFAULT_CLASH_API_URL
  ).replace(/\/+$/, '');
  if (!apiUrl || !groupName) {
    return { ok: false, status: 0, statusText: 'missing api url or group' };
  }

  const response = await clashFetch(
    `${apiUrl}/proxies/${encodeURIComponent(groupName)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...clashHeaders(
          settings.clashApiSecret?.trim() || DEFAULT_CLASH_API_SECRET,
        ),
      },
      body: JSON.stringify({ name: nodeName }),
    },
  );
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  };
}

export function createLlmFetch(
  settings: LlmNetworkSettings,
  extraHeaders?: Record<string, string>,
): typeof globalThis.fetch {
  return async (input, init) => {
    const proxyUrl = await resolveLlmProxyUrl(settings);
    const dispatcher = getProxyAgent(proxyUrl);
    const requestInit = maskClientIdentity(
      withExtraHeaders(
        {
          ...init,
          dispatcher,
        } as RequestInitWithDispatcher,
        extraHeaders,
      ),
    ) as RequestInitWithDispatcher;

    let requestAttempt = 0;
    const requestTarget = describeRequestTarget(input);
    const requestMethod = getRequestMethod(requestInit);
    const send = async () => {
      requestAttempt += 1;
      const requestId = randomUUID();
      const startedAt = Date.now();
      settings.onLog?.(
        `[llm-network] request start id=${requestId} attempt=${requestAttempt} method=${requestMethod} url=${requestTarget} proxy=${proxyUrl || 'direct'}`,
      );
      try {
        const response = await globalThis.fetch(input, requestInit);
        settings.onLog?.(
          `[llm-network] request response id=${requestId} attempt=${requestAttempt} status=${response.status} statusText=${response.statusText} ok=${response.ok} elapsedMs=${Date.now() - startedAt}`,
        );
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        settings.onLog?.(
          `[llm-network] request error id=${requestId} attempt=${requestAttempt} elapsedMs=${Date.now() - startedAt} error=${message}`,
        );
        throw error;
      }
    };
    const firstResponse = await send();
    const firstFailure = await getLlmFailureKind(firstResponse);
    if (firstFailure === 'none') {
      settings.onAccountSuccess?.();
      return firstResponse;
    }
    if (firstFailure === 'account-required') {
      settings.onLog?.(
        `[llm-network] Initial LLM request requires account switching: status=${firstResponse.status} statusText=${firstResponse.statusText} proxy=${proxyUrl}`,
      );
      return unavailableResponse(true);
    }
    settings.onLog?.(
      `[llm-network] Initial LLM request forbidden: status=${firstResponse.status} statusText=${firstResponse.statusText} proxy=${proxyUrl}`,
    );

    const forceSwitch = settings.forceClashSwitchOnForbidden?.() ?? false;
    if (settings.clashAutoSwitchOnForbidden === false && !forceSwitch) {
      settings.onLog?.(
        '[llm-network] Clash auto-switch disabled; marking account-forbidden for pool switching',
      );
      return unavailableResponse(true);
    }
    if (forceSwitch) {
      settings.onLog?.(
        '[llm-network] Current account is from observing pool; forcing Clash node switch',
      );
    }
    return retryWithSerializedClashSwitch(settings, send, firstResponse);
  };
}

async function retryWithSerializedClashSwitch(
  settings: LlmNetworkSettings,
  send: LlmSend,
  firstResponse: Response,
): Promise<Response> {
  if (clashSwitchInFlight) {
    settings.onLog?.('[llm-network] Waiting for active Clash node switch task');
    const outcome = await clashSwitchInFlight;
    settings.onLog?.(
      `[llm-network] Active Clash node switch task completed: outcome=${outcome.kind}`,
    );
    if (outcome.kind === 'account-forbidden') {
      return unavailableResponse(true);
    }
    if (outcome.kind === 'unavailable') {
      return unavailableResponse(false);
    }
    if (outcome.kind === 'no-candidates') {
      return firstResponse;
    }

    const retryResponse = await send();
    const retryFailure = await getLlmFailureKind(retryResponse);
    settings.onLog?.(
      `[llm-network] Retry result after shared Clash switch: status=${retryResponse.status} statusText=${retryResponse.statusText} ok=${retryResponse.ok} failure=${retryFailure}`,
    );
    if (retryFailure === 'account-required') return unavailableResponse(true);
    if (retryFailure === 'forbidden') return unavailableResponse(false);
    settings.onAccountSuccess?.();
    return retryResponse;
  }

  const task = runClashSwitchRetry(settings, send, firstResponse);
  const outcomeTask: Promise<ClashRetryOutcome> = task
    .then((result) => result.outcome)
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      settings.onLog?.(
        `[llm-network] Active Clash node switch task failed: ${message}`,
      );
      return { kind: 'unavailable' } satisfies ClashRetryOutcome;
    });
  clashSwitchInFlight = outcomeTask;
  void outcomeTask.finally(() => {
    if (clashSwitchInFlight === outcomeTask) {
      clashSwitchInFlight = null;
    }
  });

  const result = await task;
  return result.response;
}

async function runClashSwitchRetry(
  settings: LlmNetworkSettings,
  send: LlmSend,
  firstResponse: Response,
): Promise<ClashRetryResult> {
  try {
    settings.onStatus?.({
      phase: 'reading-clash-nodes',
      updatedAt: Date.now(),
    });
    settings.onLog?.('[llm-network] Reading Clash node candidates');
    const selection = await readClashNodeCandidates(settings).catch(() => null);
    if (!selection || selection.nodeCandidates.length === 0) {
      settings.onLog?.('[llm-network] No switchable Clash node candidates');
      return { response: firstResponse, outcome: { kind: 'no-candidates' } };
    }
    settings.onLog?.(
      `[llm-network] Clash group=${selection.groupName} candidates=${formatClashCandidates(selection.nodeCandidates)}`,
    );
    let switchedRetryCount = 0;
    let forbiddenRetryCount = 0;

    for (let i = 0; i < selection.nodeCandidates.length; i += 1) {
      const candidate = selection.nodeCandidates[i]!;
      const nodeName = candidate.name;
      const attempt = i + 1;
      const total = selection.nodeCandidates.length;
      settings.onStatus?.({
        phase: 'switching-clash-node',
        groupName: selection.groupName,
        nodeName,
        attempt,
        total,
        updatedAt: Date.now(),
      });
      settings.onLog?.(
        `[llm-network] Switching Clash node ${attempt}/${total}: group=${selection.groupName} node=${nodeName} ping=${formatClashDelay(candidate.delayMs)}`,
      );
      const switched = await switchClashNode(
        settings,
        selection.groupName,
        nodeName,
      ).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        settings.onLog?.(
          `[llm-network] Clash switch request failed: group=${selection.groupName} node=${nodeName} error=${message}`,
        );
        return { ok: false, status: 0, statusText: message };
      });
      settings.onLog?.(
        `[llm-network] Clash switch result: group=${selection.groupName} node=${nodeName} ping=${formatClashDelay(candidate.delayMs)} status=${switched.status} statusText=${switched.statusText} ok=${switched.ok}`,
      );
      if (!switched.ok) continue;

      settings.onStatus?.({
        phase: 'retrying-request',
        groupName: selection.groupName,
        nodeName,
        attempt,
        total,
        updatedAt: Date.now(),
      });
      const retryResponse = await send();
      const retryFailure = await getLlmFailureKind(retryResponse);
      switchedRetryCount += 1;
      const retryForbidden = retryFailure === 'forbidden';
      if (retryForbidden) forbiddenRetryCount += 1;
      settings.onLog?.(
        `[llm-network] Retry result after Clash switch: group=${selection.groupName} node=${nodeName} ping=${formatClashDelay(candidate.delayMs)} status=${retryResponse.status} statusText=${retryResponse.statusText} ok=${retryResponse.ok} failure=${retryFailure}`,
      );
      if (retryFailure === 'account-required') {
        settings.onLog?.(
          '[llm-network] Retry requires account switching; stopping node switching',
        );
        return {
          response: unavailableResponse(true),
          outcome: { kind: 'account-forbidden' },
        };
      }
      if (retryFailure === 'none') {
        settings.onAccountSuccess?.();
        return { response: retryResponse, outcome: { kind: 'success' } };
      }
      const accountForbidden =
        forbiddenRetryCount > LLM_ACCOUNT_FORBIDDEN_NODE_THRESHOLD &&
        forbiddenRetryCount === switchedRetryCount;
      if (accountForbidden) {
        settings.onLog?.(
          `[llm-network] ${forbiddenRetryCount} switched Clash node retries stayed forbidden; stopping node switching and marking current account for observation`,
        );
        return {
          response: unavailableResponse(true),
          outcome: { kind: 'account-forbidden' },
        };
      }
    }

    settings.onLog?.('[llm-network] All Clash node retry attempts failed');
    return {
      response: unavailableResponse(false),
      outcome: { kind: 'unavailable' },
    };
  } finally {
    settings.onStatus?.(null);
  }
}
