import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLASH_UNAVAILABLE_MESSAGE,
  LLM_ACCOUNT_FORBIDDEN_MARKER,
  LLM_ACCOUNT_FORBIDDEN_NODE_THRESHOLD,
  createLlmFetch,
  selectProxyPoolProxy,
} from './llm-network';

describe('createLlmFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('switches Clash nodes and retries forbidden LLM requests', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: any) => {
      const url = String(input);
      if (url.endsWith('/proxies') && init?.method === 'GET') {
        return Response.json({
          proxies: {
            GLOBAL: {
              type: 'Selector',
              now: 'node-a',
              all: ['node-a', 'node-b', 'node-c'],
            },
          },
        });
      }
      if (url.endsWith('/proxies/GLOBAL') && init?.method === 'PUT') {
        return new Response(null, { status: 204 });
      }
      if (fetchMock.mock.calls.length < 5) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const llmFetch = createLlmFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      clashApiUrl: 'http://127.0.0.1:9090',
      clashApiSecret: 'secret',
      clashProxyGroup: 'GLOBAL',
    });

    const response = await llmFetch('https://llm.stagewise.io/chat', {
      method: 'POST',
      body: '{}',
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:9090/proxies/GLOBAL',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'node-b' }),
      }),
    );
  });

  it('masks client identity headers on LLM requests', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const llmFetch = createLlmFetch({
      proxyUrl: 'http://127.0.0.1:7897',
    });

    await llmFetch('https://llm.stagewise.io/chat', {
      method: 'POST',
      headers: {
        'User-Agent': 'ai-sdk/provider-utils test node',
        'X-Stagewise-Client': 'electron/1.14.0',
      },
      body: '{}',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      RequestInfo | URL,
      RequestInit?,
    ];
    const headers = new Headers(init?.headers);
    expect(headers.get('X-Stagewise-Client')).toBeNull();
    expect(headers.get('User-Agent')).toContain('Chrome/126.0.0.0');
    expect(headers.get('Sec-CH-UA-Platform')).toBe('"Windows"');
  });

  it('loads proxy pool when LLM proxy-pool mode is enabled', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('ok', { status: 200 });
    });
    const loadProxyPool = vi.fn(async () =>
      JSON.stringify([{ url: 'http://proxy-a:7890', isActive: true }]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const llmFetch = createLlmFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      useProxyPool: true,
      loadProxyPool,
    });

    await llmFetch('https://llm.stagewise.io/chat', {
      method: 'POST',
      body: '{}',
    });

    expect(loadProxyPool).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a clear error after all Clash nodes stay forbidden', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: any) => {
      const url = String(input);
      if (url.endsWith('/proxies') && init?.method === 'GET') {
        return Response.json({
          proxies: {
            GLOBAL: {
              type: 'Selector',
              now: 'node-a',
              all: ['node-a', 'node-b'],
            },
          },
        });
      }
      if (url.endsWith('/proxies/GLOBAL') && init?.method === 'PUT') {
        return new Response(null, { status: 204 });
      }
      return new Response('Forbidden', { status: 403 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const llmFetch = createLlmFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      clashApiUrl: 'http://127.0.0.1:9090',
      clashProxyGroup: 'GLOBAL',
    });

    const response = await llmFetch('https://llm.stagewise.io/chat', {
      method: 'POST',
      body: '{}',
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.message).toBe(CLASH_UNAVAILABLE_MESSAGE);
  });

  it('marks account-forbidden after more than ten switched nodes stay forbidden', async () => {
    const nodes = Array.from({ length: 20 }, (_, index) => `node-${index}`);
    let clashSwitches = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: any) => {
      const url = String(input);
      if (url.endsWith('/proxies') && init?.method === 'GET') {
        return Response.json({
          proxies: {
            GLOBAL: {
              type: 'Selector',
              now: nodes[0],
              all: nodes,
            },
          },
        });
      }
      if (url.endsWith('/proxies/GLOBAL') && init?.method === 'PUT') {
        clashSwitches += 1;
        return new Response(null, { status: 204 });
      }
      return new Response('Forbidden', { status: 403 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const llmFetch = createLlmFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      clashApiUrl: 'http://127.0.0.1:9090',
      clashProxyGroup: 'GLOBAL',
    });

    const response = await llmFetch('https://llm.stagewise.io/chat', {
      method: 'POST',
      body: '{}',
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('LLM_ACCOUNT_FORBIDDEN');
    expect(body.error.message).toContain(LLM_ACCOUNT_FORBIDDEN_MARKER);
    expect(clashSwitches).toBe(LLM_ACCOUNT_FORBIDDEN_NODE_THRESHOLD + 1);
  });

  it('marks account-forbidden for stagewise subscription required responses', async () => {
    const fetchMock = vi.fn(async () => {
      return Response.json(
        {
          error: {
            message:
              'Stagewise subscription required - upgrade your plan, configure your own API keys, or connect a coding plan to continue.',
          },
        },
        { status: 402 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const llmFetch = createLlmFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      clashApiUrl: 'http://127.0.0.1:9090',
      clashProxyGroup: 'GLOBAL',
    });

    const response = await llmFetch('https://llm.stagewise.io/chat', {
      method: 'POST',
      body: '{}',
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('LLM_ACCOUNT_FORBIDDEN');
    expect(body.error.message).toContain(LLM_ACCOUNT_FORBIDDEN_MARKER);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('marks account-forbidden for missing or invalid session responses', async () => {
    const fetchMock = vi.fn(async () => {
      return Response.json(
        {
          error: {
            message: 'Missing or invalid session',
          },
        },
        { status: 401 },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const llmFetch = createLlmFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      clashApiUrl: 'http://127.0.0.1:9090',
      clashProxyGroup: 'GLOBAL',
    });

    const response = await llmFetch('https://llm.stagewise.io/chat', {
      method: 'POST',
      body: '{}',
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('LLM_ACCOUNT_FORBIDDEN');
    expect(body.error.message).toContain(LLM_ACCOUNT_FORBIDDEN_MARKER);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses Clash defaults when saved settings are empty', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: any) => {
      const url = String(input);
      if (
        url === 'http://127.0.0.1:9097/proxies' &&
        init?.method === 'GET'
      ) {
        const headers = new Headers(init.headers);
        expect(headers.get('Authorization')).toBe('Bearer 88521617');
        return Response.json({
          proxies: {
            GLOBAL: {
              type: 'Selector',
              now: 'node-a',
              all: ['node-a', 'node-b'],
            },
          },
        });
      }
      if (
        url === 'http://127.0.0.1:9097/proxies/GLOBAL' &&
        init?.method === 'PUT'
      ) {
        const headers = new Headers(init.headers);
        expect(headers.get('Authorization')).toBe('Bearer 88521617');
        return new Response(null, { status: 204 });
      }
      if (fetchMock.mock.calls.length < 4) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const llmFetch = createLlmFetch({
      proxyUrl: '',
      clashApiUrl: '',
      clashApiSecret: '',
      clashProxyGroup: '',
    });

    const response = await llmFetch('https://llm.stagewise.io/chat', {
      method: 'POST',
      body: '{}',
    });

    expect(response.status).toBe(200);
  });

  it('reports Clash switching status and clears it after retry', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: any) => {
      const url = String(input);
      if (url.endsWith('/proxies') && init?.method === 'GET') {
        return Response.json({
          proxies: {
            GLOBAL: {
              type: 'Selector',
              now: 'node-a',
              all: ['node-a', 'node-b'],
            },
            'node-b': {
              delay: 88,
            },
          },
        });
      }
      if (url.endsWith('/proxies/GLOBAL') && init?.method === 'PUT') {
        return new Response(null, { status: 204 });
      }
      if (fetchMock.mock.calls.length < 4) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response('ok', { status: 200 });
    });
    const statuses: Array<string | null> = [];
    const logs: string[] = [];
    vi.stubGlobal('fetch', fetchMock);

    const llmFetch = createLlmFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      clashApiUrl: 'http://127.0.0.1:9090',
      clashProxyGroup: 'GLOBAL',
      onStatus: (status) => statuses.push(status?.phase ?? null),
      onLog: (message) => logs.push(message),
    });

    const response = await llmFetch('https://llm.stagewise.io/chat', {
      method: 'POST',
      body: '{}',
    });

    expect(response.status).toBe(200);
    expect(statuses).toEqual([
      'reading-clash-nodes',
      'switching-clash-node',
      'retrying-request',
      null,
    ]);
    expect(logs).toContain(
      '[llm-network] Clash group=GLOBAL candidates=node-b(ping=88ms)',
    );
    expect(logs).toContain(
      '[llm-network] Switching Clash node 1/1: group=GLOBAL node=node-b ping=88ms',
    );
    expect(logs).toContain(
      '[llm-network] Clash switch result: group=GLOBAL node=node-b ping=88ms status=204 statusText= ok=true',
    );
    expect(logs).toContain(
      '[llm-network] Retry result after Clash switch: group=GLOBAL node=node-b ping=88ms status=200 statusText= ok=true failure=none',
    );
  });

  it('serializes concurrent Clash switching tasks', async () => {
    let releaseProxies: (() => void) | undefined;
    const proxiesGate = new Promise<void>((resolve) => {
      releaseProxies = resolve;
    });
    let clashProxyReads = 0;
    let clashSwitches = 0;
    let llmCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: any) => {
      const url = String(input);
      if (url.endsWith('/proxies') && init?.method === 'GET') {
        clashProxyReads += 1;
        await proxiesGate;
        return Response.json({
          proxies: {
            GLOBAL: {
              type: 'Selector',
              now: 'node-a',
              all: ['node-a', 'node-b'],
            },
          },
        });
      }
      if (url.endsWith('/proxies/GLOBAL') && init?.method === 'PUT') {
        clashSwitches += 1;
        return new Response(null, { status: 204 });
      }
      llmCalls += 1;
      if (llmCalls <= 2) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response(`ok-${llmCalls}`, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const llmFetch = createLlmFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      clashApiUrl: 'http://127.0.0.1:9090',
      clashProxyGroup: 'GLOBAL',
    });

    const first = llmFetch('https://llm.stagewise.io/chat', {
      method: 'POST',
      body: '{}',
    });
    const second = llmFetch('https://llm.stagewise.io/chat', {
      method: 'POST',
      body: '{}',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseProxies?.();

    const responses = await Promise.all([first, second]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(
      await Promise.all(responses.map((response) => response.text())),
    ).toEqual(['ok-3', 'ok-4']);
    expect(clashProxyReads).toBe(1);
    expect(clashSwitches).toBe(1);
  });

  it('logs the latest Clash history delay when current delay is missing', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: any) => {
      const url = String(input);
      if (url.endsWith('/proxies') && init?.method === 'GET') {
        return Response.json({
          proxies: {
            GLOBAL: {
              type: 'Selector',
              now: 'node-a',
              all: ['node-a', 'node-b'],
            },
            'node-b': {
              history: [{ delay: 120 }, { delay: 76 }],
            },
          },
        });
      }
      if (url.endsWith('/proxies/GLOBAL') && init?.method === 'PUT') {
        return new Response(null, { status: 204 });
      }
      if (fetchMock.mock.calls.length < 4) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response('ok', { status: 200 });
    });
    const logs: string[] = [];
    vi.stubGlobal('fetch', fetchMock);

    const llmFetch = createLlmFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      clashApiUrl: 'http://127.0.0.1:9090',
      clashProxyGroup: 'GLOBAL',
      onLog: (message) => logs.push(message),
    });

    const response = await llmFetch('https://llm.stagewise.io/chat', {
      method: 'POST',
      body: '{}',
    });

    expect(response.status).toBe(200);
    expect(logs).toContain(
      '[llm-network] Clash group=GLOBAL candidates=node-b(ping=76ms)',
    );
  });

  it('auto-detects a selector group when no group is configured', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: any) => {
      const url = String(input);
      if (url.endsWith('/proxies') && init?.method === 'GET') {
        return Response.json({
          proxies: {
            '节点选择': {
              type: 'Selector',
              now: 'node-a',
              all: ['node-a', 'node-b'],
            },
          },
        });
      }
      if (
        url.endsWith('/proxies/%E8%8A%82%E7%82%B9%E9%80%89%E6%8B%A9') &&
        init?.method === 'PUT'
      ) {
        return new Response(null, { status: 204 });
      }
      if (fetchMock.mock.calls.length < 4) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response('ok', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const llmFetch = createLlmFetch({
      proxyUrl: 'http://127.0.0.1:7897',
      clashApiUrl: 'http://127.0.0.1:9090',
    });

    const response = await llmFetch('https://llm.stagewise.io/chat', {
      method: 'POST',
      body: '{}',
    });

    expect(response.status).toBe(200);
  });
});

describe('selectProxyPoolProxy', () => {
  it('uses enabled proxy-pool entries and ignores disabled entries', () => {
    const proxy = selectProxyPoolProxy(
      JSON.stringify([
        { url: 'http://disabled:7890', isActive: false },
        { url: 'http://enabled:7890', isActive: true },
      ]),
    );

    expect(proxy).toBe('http://enabled:7890');
  });
});
