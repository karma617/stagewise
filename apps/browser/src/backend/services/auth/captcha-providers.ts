/**
 * Unified captcha (Cloudflare Turnstile) provider layer.
 *
 * Three providers are supported, selectable by the user in the auto-register
 * settings panel:
 *
 *   1. console-handoff (default)
 *      Opens the system browser to console.stagewise.io/login where Turnstile
 *      runs on a valid registered origin. The user completes email OTP in the
 *      real browser; the session is handed back via the stagewise:// callback.
 *      This does NOT produce a captcha token for the silent API flow - it is
 *      a full interactive sign-in handoff. Used when no silent provider is
 *      configured.
 *
 *   2. 2captcha / capsolver / yescaptcha
 *      Third-party captcha-solving services. Submit the Turnstile sitekey +
 *      page URL, poll for the solution token. Fully automatic once an API key
 *      is configured.
 */
import {
  fetchWithRegistrationFallback,
  logRegistrationStep,
} from './registration-network';

export type CaptchaProviderId =
  | 'console-handoff'
  | '2captcha'
  | 'capsolver'
  | 'yescaptcha';

export interface CaptchaProviderConfig {
  /** Which provider to use. */
  provider: CaptchaProviderId;
  /** API key for 2captcha / capsolver / yescaptcha. */
  apiKey?: string;
  /** Cloudflare Turnstile sitekey (defaults to the stagewise console key). */
  siteKey?: string;
  /** Page URL the Turnstile widget is embedded on. */
  pageUrl?: string;
  /** Proxy URL to route solver requests through (optional). */
  proxyUrl?: string;
  /** Max time to wait for a solution, in milliseconds. */
  timeoutMs?: number;
  /** Live step logger. */
  onStep?: (msg: string) => void;
}

export const DEFAULT_TURNSTILE_SITEKEY =
  process.env.VITE_TURNSTILE_SITE_KEY ||
  process.env.TURNSTILE_SITE_KEY ||
  '0x4AAAAAAC_nVTXG4QucHDTh';
export const DEFAULT_TURNSTILE_PAGE_URL = 'https://console.stagewise.io';

const DEFAULT_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 5_000;

function formatProviderError(
  errorCode: string | undefined,
  errorDescription: string | undefined,
): string {
  const code = errorCode || 'unknown';
  return errorDescription ? `${code}: ${errorDescription}` : code;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Solve a Turnstile challenge and return the token, using the configured
 * provider. Throws on failure or timeout.
 *
 * For 'console-handoff', callers should NOT call this - they should use
 * signInEmail() instead, which is a full interactive browser handoff.
 * This function is only for the silent providers (2captcha, capsolver,
 * yescaptcha).
 */
export async function solveTurnstileToken(
  cfg: CaptchaProviderConfig,
): Promise<string> {
  const step = (m: string) => {
    logRegistrationStep('[captcha:' + cfg.provider + '] ' + m);
    try {
      cfg.onStep && cfg.onStep(m);
    } catch (_e) {}
  };

  const siteKey = cfg.siteKey || DEFAULT_TURNSTILE_SITEKEY;
  const pageUrl = cfg.pageUrl || DEFAULT_TURNSTILE_PAGE_URL;
  const timeoutMs = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  step(
    '\u5f00\u59cb\u89e3\u51b3 Turnstile (provider=' +
      cfg.provider +
      ', sitekey=' +
      siteKey.slice(0, 10) +
      '..)',
  );

  switch (cfg.provider) {
    case '2captcha':
      return solveWith2captcha(
        cfg.apiKey || '',
        siteKey,
        pageUrl,
        cfg.proxyUrl,
        timeoutMs,
        step,
      );
    case 'capsolver':
      return solveWithCapsolver(
        cfg.apiKey || '',
        siteKey,
        pageUrl,
        cfg.proxyUrl,
        timeoutMs,
        step,
      );
    case 'yescaptcha':
      return solveWithYescaptcha(
        cfg.apiKey || '',
        siteKey,
        pageUrl,
        cfg.proxyUrl,
        timeoutMs,
        step,
      );
    case 'console-handoff':
    default:
      throw new Error(
        'console-handoff provider does not produce a silent captcha token; use signInEmail instead',
      );
  }
}

// ---------------------------------------------------------------------------
// 2captcha: https://2captcha.com/api-docs/cloudflare-turnstile
// ---------------------------------------------------------------------------
async function solveWith2captcha(
  apiKey: string,
  siteKey: string,
  pageUrl: string,
  proxyUrl: string | undefined,
  timeoutMs: number,
  step: (m: string) => void,
): Promise<string> {
  if (!apiKey) throw new Error('2captcha API key not configured');

  step('\u63d0\u4ea4 Turnstile \u4efb\u52a1\u5230 2captcha...');
  const submitBody: Record<string, string> = {
    key: apiKey,
    method: 'turnstile',
    sitekey: siteKey,
    pageurl: pageUrl,
    json: '1',
  };
  if (proxyUrl) {
    submitBody.proxy = proxyUrl;
    submitBody.proxytype = 'HTTP';
  }

  const submitResp = await fetchWithRegistrationFallback(
    'https://2captcha.com/in.php',
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(submitBody).toString(),
    },
    proxyUrl,
  );
  const submitData = (await submitResp.json()) as {
    status: number;
    request: string;
  };
  if (submitData.status !== 1) {
    throw new Error('2captcha submit failed: ' + submitData.request);
  }
  const taskId = submitData.request;
  step(
    '2captcha \u4efb\u52a1\u5df2\u63d0\u4ea4 (id=' +
      taskId +
      ')\uff0c\u8f6e\u8be2\u7ed3\u679c...',
  );

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const pollResp = await fetchWithRegistrationFallback(
      'https://2captcha.com/res.php?key=' +
        apiKey +
        '&action=get&id=' +
        taskId +
        '&json=1',
      { method: 'GET' },
      proxyUrl,
    );
    const pollData = (await pollResp.json()) as {
      status: number;
      request: string;
    };
    if (pollData.status === 1) {
      step('2captcha \u8fd4\u56de token (len=' + pollData.request.length + ')');
      return pollData.request;
    }
    if (pollData.request !== 'CAPCHA_NOT_READY') {
      throw new Error('2captcha poll error: ' + pollData.request);
    }
    step(
      '2captcha \u89e3\u51b3\u4e2d... (' +
        Math.floor((Date.now() - (deadline - timeoutMs)) / 1000) +
        's)',
    );
  }
  throw new Error('2captcha timed out after ' + timeoutMs / 1000 + 's');
}

// ---------------------------------------------------------------------------
// CapSolver: https://docs.capsolver.com/guide/captcha/CloudflareTurnstile.html
// ---------------------------------------------------------------------------
async function solveWithCapsolver(
  apiKey: string,
  siteKey: string,
  pageUrl: string,
  proxyUrl: string | undefined,
  timeoutMs: number,
  step: (m: string) => void,
): Promise<string> {
  if (!apiKey) throw new Error('CapSolver API key not configured');

  step('\u63d0\u4ea4 Turnstile \u4efb\u52a1\u5230 CapSolver...');
  const task = {
    type: 'AntiTurnstileTaskProxyLess',
    websiteURL: pageUrl,
    websiteKey: siteKey,
  };

  const submitResp = await fetchWithRegistrationFallback(
    'https://api.capsolver.com/createTask',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientKey: apiKey, task }),
    },
    proxyUrl,
  );
  const submitData = (await submitResp.json()) as {
    errorId?: number;
    errorCode?: string;
    taskId?: string;
  };
  if (submitData.errorId && submitData.errorId !== 0) {
    throw new Error(
      'CapSolver submit failed: ' + (submitData.errorCode || 'unknown'),
    );
  }
  const taskId = submitData.taskId;
  if (!taskId) {
    throw new Error('CapSolver did not return a taskId');
  }
  step(
    'CapSolver \u4efb\u52a1\u5df2\u63d0\u4ea4 (id=' +
      taskId +
      ')\uff0c\u8f6e\u8be2\u7ed3\u679c...',
  );

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const pollResp = await fetchWithRegistrationFallback(
      'https://api.capsolver.com/getTaskResult',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientKey: apiKey, taskId }),
      },
      proxyUrl,
    );
    const pollData = (await pollResp.json()) as {
      errorId?: number;
      errorCode?: string;
      status?: string;
      solution?: { token?: string };
    };
    if (pollData.errorId && pollData.errorId !== 0) {
      throw new Error('CapSolver error: ' + (pollData.errorCode || 'unknown'));
    }
    if (pollData.status === 'ready' && pollData.solution?.token) {
      step(
        'CapSolver \u8fd4\u56de token (len=' +
          pollData.solution.token.length +
          ')',
      );
      return pollData.solution.token;
    }
    step(
      'CapSolver \u89e3\u51b3\u4e2d... (' +
        Math.floor((Date.now() - (deadline - timeoutMs)) / 1000) +
        's)',
    );
  }
  throw new Error('CapSolver timed out after ' + timeoutMs / 1000 + 's');
}

// ---------------------------------------------------------------------------
// YesCaptcha: https://yescaptcha.com/en/help/cloudflare/turnstile
// ---------------------------------------------------------------------------
async function solveWithYescaptcha(
  apiKey: string,
  siteKey: string,
  pageUrl: string,
  proxyUrl: string | undefined,
  timeoutMs: number,
  step: (m: string) => void,
): Promise<string> {
  if (!apiKey) throw new Error('YesCaptcha API key not configured');

  step('\u63d0\u4ea4 Turnstile \u4efb\u52a1\u5230 YesCaptcha...');
  const task = {
    type: 'TurnstileTaskProxylessM1',
    websiteURL: pageUrl,
    websiteKey: siteKey,
  };

  const submitResp = await fetchWithRegistrationFallback(
    'https://api.yescaptcha.com/createTask',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientKey: apiKey, task }),
    },
    proxyUrl,
  );
  const submitData = (await submitResp.json()) as {
    errorId?: number;
    errorCode?: string;
    errorDescription?: string;
    taskId?: string;
  };
  if (submitData.errorId && submitData.errorId !== 0) {
    throw new Error(
      'YesCaptcha submit failed: ' +
        formatProviderError(submitData.errorCode, submitData.errorDescription),
    );
  }
  const taskId = submitData.taskId;
  if (!taskId) {
    throw new Error('YesCaptcha did not return a taskId');
  }
  step(
    'YesCaptcha \u4efb\u52a1\u5df2\u63d0\u4ea4 (id=' +
      taskId +
      ')\uff0c\u8f6e\u8be2\u7ed3\u679c...',
  );

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const pollResp = await fetchWithRegistrationFallback(
      'https://api.yescaptcha.com/getTaskResult',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientKey: apiKey, taskId }),
      },
      proxyUrl,
    );
    const pollData = (await pollResp.json()) as {
      errorId?: number;
      errorCode?: string;
      errorDescription?: string;
      status?: string;
      solution?: { token?: string };
    };
    if (pollData.errorId && pollData.errorId !== 0) {
      throw new Error(
        'YesCaptcha error: ' +
          formatProviderError(pollData.errorCode, pollData.errorDescription),
      );
    }
    if (pollData.status === 'ready' && pollData.solution?.token) {
      step(
        'YesCaptcha \u8fd4\u56de token (len=' +
          pollData.solution.token.length +
          ')',
      );
      return pollData.solution.token;
    }
    step(
      'YesCaptcha \u89e3\u51b3\u4e2d... (' +
        Math.floor((Date.now() - (deadline - timeoutMs)) / 1000) +
        's)',
    );
  }
  throw new Error('YesCaptcha timed out after ' + timeoutMs / 1000 + 's');
}
