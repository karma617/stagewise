/**
 * Unified captcha (Cloudflare Turnstile) provider layer.
 *
 * Four providers are supported, selectable by the user in the auto-register
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
 *
 *   3. playwright-stealth
 *      Launches a real headless Chrome via Playwright with stealth patches to
 *      solve Turnstile. Requires the playwright package to be installed.
 */
import {
  buildRegistrationProxyCandidates,
  fetchWithRegistrationFallback,
  describeProxyCandidate,
  logRegistrationStep,
} from './registration-network';

export type CaptchaProviderId =
  | 'console-handoff'
  | '2captcha'
  | 'capsolver'
  | 'yescaptcha'
  | 'playwright-stealth';

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
 * yescaptcha, playwright-stealth).
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
    case 'playwright-stealth':
      return solveWithPlaywrightFallback(
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

// ---------------------------------------------------------------------------
// Playwright stealth: launches a real headless Chrome with stealth patches.
// Dynamically imports playwright so the app does not hard-depend on it.
// ---------------------------------------------------------------------------
function isPlaywrightNetworkError(error: Error): boolean {
  return /ERR_PROXY_CONNECTION_FAILED|ERR_TUNNEL_CONNECTION_FAILED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|net::|Page\.goto|Turnstile API script failed to load|Timeout/i.test(
    error.message,
  );
}

async function autoInstallPlaywright(step: (m: string) => void): Promise<void> {
  const { spawn } = await import('node:child_process');
  const nodeFs = await import('node:fs');
  const nodePath = await import('node:path');
  const nodeOs = await import('node:os');

  const isWindows = process.platform === 'win32';

  // Pick a persistent writable install directory
  const installDir = nodePath.join(
    process.env.APPDATA || process.env.HOME || nodeOs.tmpdir(),
    isWindows ? 'stagewise\\captcha-deps' : '.stagewise/captcha-deps',
  );
  nodeFs.mkdirSync(installDir, { recursive: true });

  // Ensure package.json exists
  const pkgJsonPath = nodePath.join(installDir, 'package.json');
  if (!nodeFs.existsSync(pkgJsonPath)) {
    nodeFs.writeFileSync(
      pkgJsonPath,
      JSON.stringify({
        name: 'stagewise-captcha-deps',
        version: '1.0.0',
        private: true,
      }),
    );
  }
  step('\u5b89\u88c5\u76ee\u5f55: ' + installDir);

  // Helper: run a command with live stdout/stderr forwarded to step()
  function runCmd(
    cmd: string,
    args: string[],
    label: string,
    timeoutMs: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      step('[' + label + '] \u5f00\u59cb: ' + cmd + ' ' + args.join(' '));
      const child = spawn(cmd, args, {
        cwd: installDir,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: isWindows,
      });
      let lastLine = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(
          new Error('[' + label + '] \u8d85\u65f6 (' + timeoutMs / 1000 + 's)'),
        );
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          lastLine = line.trim();
          // Forward meaningful lines to UI
          if (
            line.includes('added') ||
            line.includes('removed') ||
            line.includes('npm') ||
            line.includes('Downloading') ||
            line.includes('install') ||
            line.includes('%') ||
            line.includes('playwright') ||
            line.includes('chromium')
          ) {
            step('[' + label + '] ' + line.trim().slice(0, 120));
          }
        }
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          lastLine = line.trim();
          if (
            line.includes('Downloading') ||
            line.includes('install') ||
            line.includes('%') ||
            line.includes('chromium') ||
            line.includes('playwright')
          ) {
            step('[' + label + '] ' + line.trim().slice(0, 120));
          }
        }
      });
      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        if (code === 0) {
          step('[' + label + '] \u5b8c\u6210');
          resolve();
        } else {
          reject(
            new Error(
              '[' +
                label +
                '] \u5931\u8d25 (\u9000\u51fa\u7801=' +
                code +
                '): ' +
                lastLine.slice(0, 200),
            ),
          );
        }
      });
      child.on('error', (err: Error) => {
        clearTimeout(timer);
        reject(
          new Error('[' + label + '] \u542f\u52a8\u5931\u8d25: ' + err.message),
        );
      });
    });
  }

  // Step 1: Find npm + node. User says they have node installed on system.
  // On Windows, npm is npm.cmd and must be run with shell:true
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';
  const nodeCmd = isWindows ? 'node.exe' : 'node';

  // Step 2: Install playwright package
  step(
    '\u6b63\u5728\u5b89\u88c5 playwright \u5305 (npm install playwright)...',
  );
  await runCmd(npmCmd, ['install', 'playwright'], 'npm install', 180_000);

  // Step 3: Install chromium browser binary
  step('\u6b63\u5728\u4e0b\u8f7d chromium \u6d4f\u89c8\u5668...');
  // Use npx playwright install chromium (find local playwright)
  const pwCliPath = nodePath.join(
    installDir,
    'node_modules',
    'playwright',
    'cli.js',
  );
  if (nodeFs.existsSync(pwCliPath)) {
    await runCmd(
      nodeCmd,
      [pwCliPath, 'install', 'chromium'],
      'playwright install',
      300_000,
    );
  } else {
    // Fallback: npx
    const npxCmd = isWindows ? 'npx.cmd' : 'npx';
    await runCmd(
      npxCmd,
      ['playwright', 'install', 'chromium'],
      'npx playwright install',
      300_000,
    );
  }
}

async function tryImportPlaywright(): Promise<{
  chromium: {
    launch(
      options?: Record<string, unknown>,
    ): Promise<import('playwright').Browser>;
  };
} | null> {
  // 1. Try default import (works if playwright is in app node_modules)
  try {
    const pw = await import('playwright');
    if (pw.chromium)
      return pw as unknown as {
        chromium: {
          launch(
            options?: Record<string, unknown>,
          ): Promise<import('playwright').Browser>;
        };
      };
  } catch {}

  // 2. Try from known install directories
  const nodeFs = await import('node:fs');
  const nodeModule = await import('node:module');
  const nodeOs = await import('node:os');
  const nodePath = await import('node:path');
  const nodeUrl = await import('node:url');

  const candidateDirs = [
    process.env.APPDATA
      ? nodePath.join(process.env.APPDATA, 'stagewise', 'captcha-deps')
      : null,
    process.env.HOME
      ? nodePath.join(process.env.HOME, '.stagewise', 'captcha-deps')
      : null,
    nodePath.join(nodeOs.tmpdir(), 'stagewise', 'captcha-deps'),
    nodePath.join(nodeOs.tmpdir(), 'stagewise-captcha-deps'),
  ].filter(Boolean) as string[];

  for (const dir of candidateDirs) {
    const nodeModulesDir = nodePath.join(dir, 'node_modules');
    const packageJsonPath = nodePath.join(dir, 'package.json');
    if (nodeFs.existsSync(packageJsonPath)) {
      try {
        const requireFromInstallDir = nodeModule.createRequire(packageJsonPath);
        const pw = requireFromInstallDir('playwright') as unknown as {
          chromium?: {
            launch(
              options?: Record<string, unknown>,
            ): Promise<import('playwright').Browser>;
          };
        };
        if (pw.chromium)
          return pw as {
            chromium: {
              launch(
                options?: Record<string, unknown>,
              ): Promise<import('playwright').Browser>;
            };
          };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logRegistrationStep(
          '[captcha:playwright-stealth] require from ' +
            nodeModulesDir +
            ' failed: ' +
            message,
        );
      }
    }
    const pwPath = nodePath.join(dir, 'node_modules', 'playwright');
    if (nodeFs.existsSync(nodePath.join(pwPath, 'index.mjs'))) {
      try {
        const pwUrl = nodeUrl.pathToFileURL(
          nodePath.join(pwPath, 'index.mjs'),
        ).href;
        const pw = await import(/* @vite-ignore */ pwUrl);
        if (pw.chromium)
          return pw as unknown as {
            chromium: {
              launch(
                options?: Record<string, unknown>,
              ): Promise<import('playwright').Browser>;
            };
          };
      } catch {}
    }
    if (nodeFs.existsSync(nodePath.join(pwPath, 'index.js'))) {
      try {
        // Also add to NODE_PATH for sub-dependencies
        process.env.NODE_PATH =
          nodePath.join(dir, 'node_modules') +
          (process.env.NODE_PATH ? ';' + process.env.NODE_PATH : '');
        const pwUrl = nodeUrl.pathToFileURL(
          nodePath.join(pwPath, 'index.js'),
        ).href;
        const pw = await import(/* @vite-ignore */ pwUrl);
        if (pw.chromium)
          return pw as unknown as {
            chromium: {
              launch(
                options?: Record<string, unknown>,
              ): Promise<import('playwright').Browser>;
            };
          };
      } catch {}
    }
  }
  return null;
}

async function solveWithPlaywrightFallback(
  siteKey: string,
  pageUrl: string,
  proxyUrl: string | undefined,
  timeoutMs: number,
  step: (m: string) => void,
): Promise<string> {
  const candidates = await buildRegistrationProxyCandidates(proxyUrl, pageUrl);
  let lastNetworkError: Error | null = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (i > 0) {
      step('Playwright 切换网络链路: ' + describeProxyCandidate(candidate));
    }
    try {
      return await solveWithPlaywright(
        siteKey,
        pageUrl,
        candidate,
        timeoutMs,
        step,
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const canRetry =
        i < candidates.length - 1 && isPlaywrightNetworkError(error);
      if (!canRetry) throw error;
      lastNetworkError = error;
      step(
        'Playwright 网络链路失败，尝试下一链路: ' + error.message,
      );
    }
  }
  throw lastNetworkError ?? new Error('Playwright network fallback failed');
}

async function solveWithPlaywright(
  siteKey: string,
  pageUrl: string,
  proxyUrl: string | undefined,
  timeoutMs: number,
  step: (m: string) => void,
): Promise<string> {
  step('\u5c1d\u8bd5\u52a8\u6001\u5bfc\u5165 playwright...');
  let chromium: {
    launch(
      options?: Record<string, unknown>,
    ): Promise<import('playwright').Browser>;
  };
  const pwModule = await tryImportPlaywright();
  if (pwModule) {
    chromium = pwModule.chromium;
  } else {
    step(
      'playwright \u672a\u5b89\u88c5\uff0c\u6b63\u5728\u81ea\u52a8\u5b89\u88c5...',
    );
    await autoInstallPlaywright(step);
    // Retry import after install
    const pwModule2 = await tryImportPlaywright();
    if (!pwModule2) {
      throw new Error(
        'playwright installation completed but module could not be loaded',
      );
    }
    chromium = pwModule2.chromium;
    step('playwright \u5b89\u88c5\u5b8c\u6210');
  }

  const launchOptions: Record<string, unknown> = {
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  };
  if (proxyUrl) {
    launchOptions.proxy = { server: proxyUrl };
  }

  step('\u542f\u52a8 stealth Chromium...');
  const browser = await chromium.launch(launchOptions);
  try {
    const page = await browser.newPage();

    // Hide webdriver flag
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    step('\u52a0\u8f7d ' + pageUrl + ' \u5e76\u6ce8\u5165 Turnstile widget...');
    await page.goto(pageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    // Inject an explicit invisible Turnstile widget that auto-executes.
    await page.evaluate(
      async ({ sk, apiTimeoutMs }: { sk: string; apiTimeoutMs: number }) => {
        type TurnstileWindow = Window & {
          turnstile?: {
            render: (el: HTMLElement, opts: Record<string, unknown>) => void;
          };
          __pwError?: string;
          __pwRendered?: boolean;
          __pwToken?: string;
        };

        const w = window as TurnstileWindow;
        w.__pwToken = '';
        w.__pwError = '';

        const waitForTurnstile = async () => {
          if (w.turnstile?.render) return;

          await new Promise<void>((resolve, reject) => {
            let settled = false;
            const startedAt = Date.now();
            const cleanup = () => {
              settled = true;
              window.clearInterval(intervalId);
            };
            const finish = () => {
              if (settled) return;
              cleanup();
              resolve();
            };
            const fail = (message: string) => {
              if (settled) return;
              cleanup();
              w.__pwError = message;
              reject(new Error(message));
            };
            const checkReady = () => {
              if (w.turnstile?.render) {
                finish();
                return;
              }
              if (Date.now() - startedAt > apiTimeoutMs) {
                fail('Turnstile API did not become ready');
              }
            };
            const intervalId = window.setInterval(checkReady, 250);

            if (!document.querySelector('script[data-stagewise-turnstile]')) {
              const script = document.createElement('script');
              script.async = true;
              script.src =
                'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
              script.setAttribute('data-stagewise-turnstile', '1');
              script.onload = checkReady;
              script.onerror = () => {
                fail('Turnstile API script failed to load');
              };
              (document.head || document.documentElement).appendChild(script);
            }

            checkReady();
          });
        };

        await waitForTurnstile();
        if (w.__pwRendered) return;

        w.__pwRendered = true;
        const box = document.createElement('div');
        box.style.cssText =
          'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;';
        document.body.appendChild(box);

        try {
          w.turnstile?.render(box, {
            sitekey: sk,
            callback: (t: string) => {
              w.__pwToken = t || '';
            },
            'error-callback': (e: unknown) => {
              w.__pwError = String(e || 'err');
            },
            'expired-callback': () => {
              w.__pwToken = '';
            },
            appearance: 'execute',
            size: 'invisible',
          });
        } catch (e) {
          w.__pwError = 'render:' + String(e);
          throw e;
        }
      },
      {
        apiTimeoutMs: Math.min(30_000, Math.max(5_000, timeoutMs / 4)),
        sk: siteKey,
      },
    );

    const deadline = Date.now() + timeoutMs;
    step('\u7b49\u5f85 token...');
    while (Date.now() < deadline) {
      const token = await page.evaluate(
        () =>
          ((window as unknown as Record<string, unknown>)
            .__pwToken as string) || '',
      );
      if (token && token.length > 8) {
        step('Playwright \u83b7\u53d6\u5230 token (len=' + token.length + ')');
        return token;
      }
      const tokenError = await page.evaluate(
        () =>
          ((window as unknown as Record<string, unknown>)
            .__pwError as string) || '',
      );
      if (tokenError) {
        throw new Error('Playwright Turnstile error: ' + tokenError);
      }
      await sleep(1000);
    }
    throw new Error(
      'Playwright Turnstile timed out after ' + timeoutMs / 1000 + 's',
    );
  } finally {
    await browser.close().catch(() => {});
  }
}
