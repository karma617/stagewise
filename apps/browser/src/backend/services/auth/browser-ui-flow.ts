/**
 * Full-UI browser registration flow for stagewise.
 *
 * Background
 * ----------
 * The existing auto-register pipeline drives the better-auth HTTP endpoints
 * directly:
 *   1. Solve Turnstile -> x-captcha-response
 *   2. POST /v1/auth/email-otp/send-verification-otp
 *   3. Poll mailbox -> OTP
 *   4. POST /v1/auth/sign-in/email-otp -> bearer token (set-auth-token header)
 *
 * This works but Cloudflare risk-scoring sometimes rejects the API path even
 * with a fresh Turnstile token, because the request profile differs from a
 * real browser session. The "browser-ui-flow" mode side-steps the issue by
 * driving the real console.stagewise.io sign-in page inside a normal
 * user-visible Electron BrowserWindow with an isolated in-memory session:
 *
 *   1. Load https://console.stagewise.io/login
 *   2. Auto-fill the email input and submit
 *   3. Wait for the page to send send-verification-otp itself
 *   4. (Caller polls the mailbox pool for the OTP)
 *   5. Auto-fill the OTP and submit
 *   6. Sniff set-auth-token off the /v1/auth/sign-in/email-otp response
 *
 * The window is created with show:true and normal dimensions to satisfy
 * Cloudflare Turnstile and to allow manual user interaction if the challenge
 * requires it.
 *
 * NOTE: This file deliberately does NOT couple to AuthService internals.
 * Callers feed in the email (claimed from MailboxPool) and supply an async
 * waitForOtp() lambda that resolves with the OTP string once mailbox
 * polling finds it. This keeps auth/index.ts orchestration intact.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, screen, session } from 'electron';
import camoufoxUiFlowScript from './camoufox-ui-flow.py?raw';

export type BrowserUiFlowOptions = {
  email: string;
  waitForOtp: () => Promise<string>;
  proxyUrl?: string;
  proxyCandidates?: Array<string | undefined>;
  userAgent?: string;
  acceptLanguage?: string;
  onStep?: (msg: string) => void;
  visible?: boolean;
  timeoutMs?: number;
  consoleUrl?: string;
  shouldAbort?: () => boolean;
};

export type BrowserUiFlowResult = {
  bearerToken: string;
  email: string;
};

type BrowserUiFlowPageSummary = {
  url?: string;
  title?: string;
  readyState?: string;
  bodyText?: string;
  inputs?: Array<Record<string, unknown>>;
  buttons?: Array<Record<string, unknown>>;
};

type FillEmailResult = {
  ok: boolean;
  reason?: string;
  summary?: BrowserUiFlowPageSummary;
};

type OtpFormWaitResult = {
  ok: boolean;
  reason?: string;
};

type CamoufoxMessage = {
  event?: string;
  message?: string;
  token?: string;
};

function proxyLabel(proxyUrl?: string): string {
  return proxyUrl?.trim() ? proxyUrl : 'direct';
}

function uniqueProxyCandidates(
  candidates: Array<string | undefined>,
): Array<string | undefined> {
  const result: Array<string | undefined> = [];
  for (const candidate of candidates) {
    const normalized = candidate?.trim() || undefined;
    if (result.some((item) => (item?.trim() || undefined) === normalized)) {
      continue;
    }
    result.push(normalized);
  }
  return result;
}

function isCamoufoxNetworkError(error: Error): boolean {
  return /NS_ERROR_NET_INTERRUPT|NS_ERROR_PROXY_CONNECTION_REFUSED|NS_ERROR_CONNECTION_REFUSED|NS_ERROR_NET_TIMEOUT|ERR_PROXY_CONNECTION_FAILED|ERR_TUNNEL_CONNECTION_FAILED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_CONNECTION_TIMED_OUT|Page\.goto|net::/i.test(
    error.message,
  );
}

type PythonCommand = {
  command: string;
  prefixArgs: string[];
  label: string;
};

const DEFAULT_CONSOLE_URL = 'https://console.stagewise.io';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_ACCEPT_LANGUAGE = 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7';
const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 820;
const AUTH_EMAIL_OTP_RE =
  /\/v1\/auth\/(?:email-otp\/send-verification-otp|sign-in\/email-otp)(\?|$)/;

const BLOCKED_DEVICE_PERMISSIONS = new Set([
  'bluetooth',
  'bluetooth-pairing',
  'hid',
  'serial',
  'usb',
]);

function buildLoginUrl(consoleUrl: string): string {
  const url = new URL(consoleUrl);
  return url.toString();
}

function getWebContentPreloadPath(): string {
  return path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'web-content-preload/index.js',
  );
}

function getCamoufoxScriptPath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates: string[] = [
    path.join(moduleDir, 'camoufox-ui-flow.py'),
    ...(process.resourcesPath
      ? [path.join(process.resourcesPath, 'camoufox-ui-flow.py')]
      : []),
    path.join(
      process.cwd(),
      'src',
      'backend',
      'services',
      'auth',
      'camoufox-ui-flow.py',
    ),
    path.join(
      process.cwd(),
      'apps',
      'browser',
      'src',
      'backend',
      'services',
      'auth',
      'camoufox-ui-flow.py',
    ),
  ];

  const appPath = app.getAppPath();
  candidates.push(
    path.join(
      appPath,
      'src',
      'backend',
      'services',
      'auth',
      'camoufox-ui-flow.py',
    ),
    path.join(
      appPath,
      'apps',
      'browser',
      'src',
      'backend',
      'services',
      'auth',
      'camoufox-ui-flow.py',
    ),
  );

  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    candidates.push(
      path.join(
        dir,
        'src',
        'backend',
        'services',
        'auth',
        'camoufox-ui-flow.py',
      ),
      path.join(
        dir,
        'apps',
        'browser',
        'src',
        'backend',
        'services',
        'auth',
        'camoufox-ui-flow.py',
      ),
    );
    const parent = path.dirname(dir);
    if (parent === dir) break;
  }

  const found = candidates.find((candidate) => existsSync(candidate));
  if (found) return found;

  const hash = createHash('sha256')
    .update(camoufoxUiFlowScript)
    .digest('hex')
    .slice(0, 12);
  const scriptDir = path.join(app.getPath('temp'), 'stagewise-camoufox');
  const scriptPath = path.join(scriptDir, `camoufox-ui-flow-${hash}.py`);
  mkdirSync(scriptDir, { recursive: true });
  writeFileSync(scriptPath, camoufoxUiFlowScript, 'utf8');
  return scriptPath;
}

function getCamoufoxResourceDir(): string {
  const appPath = app.getAppPath();
  const candidates = [
    ...(process.resourcesPath
      ? [path.join(process.resourcesPath, 'camoufox')]
      : []),
    path.join(appPath, 'assets', 'camoufox'),
    path.join(appPath, 'apps', 'browser', 'assets', 'camoufox'),
    path.join(process.cwd(), 'assets', 'camoufox'),
    path.join(process.cwd(), 'apps', 'browser', 'assets', 'camoufox'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
}

function normalizeUserAgent(userAgent: string): string {
  return userAgent.replace(/\sElectron\/[\d.]+/g, '');
}

function canRunPythonCommand(candidate: PythonCommand): boolean {
  const result = spawnSync(
    candidate.command,
    [...candidate.prefixArgs, '--version'],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  return !result.error && result.status === 0;
}

function resolvePythonCommand(): PythonCommand {
  const configured = process.env.STAGEWISE_CAMOUFOX_PYTHON?.trim();
  const candidates: PythonCommand[] = [];
  if (configured) {
    candidates.push({
      command: configured,
      prefixArgs: [],
      label: configured,
    });
  }
  candidates.push(
    { command: 'python', prefixArgs: [], label: 'python' },
    { command: 'python3', prefixArgs: [], label: 'python3' },
  );
  if (process.platform === 'win32') {
    candidates.push({ command: 'py', prefixArgs: ['-3'], label: 'py -3' });
  }

  const found = candidates.find(canRunPythonCommand);
  if (found) return found;

  throw new Error(
    '[camoufox] Python executable not found. Install Python 3.10+ and make ' +
      'python/python3/py available on PATH, or set STAGEWISE_CAMOUFOX_PYTHON ' +
      'to the full python.exe path.',
  );
}

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string {
  const found = Object.keys(headers).find(
    (key) => key.toLowerCase() === name.toLowerCase(),
  );
  if (!found) return '';
  const value = headers[found];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function isBlockedDevicePermission(permission: string): boolean {
  return BLOCKED_DEVICE_PERMISSIONS.has(permission);
}

function configureIncognitoSession(
  ses: Electron.Session,
  step: (msg: string) => void,
  acceptLanguage: string,
): void {
  ses.setPermissionCheckHandler((_webContents, permission) => {
    return !isBlockedDevicePermission(permission);
  });

  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(!isBlockedDevicePermission(permission));
  });

  ses.setDevicePermissionHandler(() => false);

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        'Accept-Language': acceptLanguage,
      },
    });
  });

  ses.on('select-hid-device', (event, _details, callback) => {
    event.preventDefault();
    step('[ui-flow] blocked HID device selection prompt');
    callback('');
  });

  ses.on('select-serial-port', (event, _portList, _webContents, callback) => {
    event.preventDefault();
    step('[ui-flow] blocked serial port selection prompt');
    callback('');
  });

  ses.on('select-usb-device', (event, _details, callback) => {
    event.preventDefault();
    step('[ui-flow] blocked USB device selection prompt');
    callback('');
  });
}

function getRealisticWindowBounds(): { width: number; height: number } {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return {
    height: Math.max(700, Math.min(DEFAULT_WINDOW_HEIGHT, height - 80)),
    width: Math.max(960, Math.min(DEFAULT_WINDOW_WIDTH, width - 80)),
  };
}

/** JS injected to fill the email input and click the submit button. */
function buildFillEmailJs(email: string): string {
  return [
    '(async () => {',
    '  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));',
    '  const pageSummary = () => ({',
    '    url: location.href,',
    '    title: document.title,',
    '    readyState: document.readyState,',
    '    bodyText: (document.body?.innerText || "").replace(/\\s+/g, " ").slice(0, 500),',
    '    inputs: Array.from(document.querySelectorAll("input")).slice(0, 20).map((el) => ({',
    '      type: el.getAttribute("type") || "",',
    '      name: el.getAttribute("name") || "",',
    '      id: el.id || "",',
    '      autocomplete: el.getAttribute("autocomplete") || "",',
    '      placeholder: el.getAttribute("placeholder") || "",',
    '      ariaLabel: el.getAttribute("aria-label") || "",',
    '      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),',
    '    })),',
    '    buttons: Array.from(document.querySelectorAll("button, [role=button], a")).slice(0, 30).map((el) => ({',
    '      tag: el.tagName,',
    '      type: el.getAttribute("type") || "",',
    '      role: el.getAttribute("role") || "",',
    '      text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80),',
    '      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),',
    '    })),',
    '  });',
    '  function setValue(el, value) {',
    '    const proto = Object.getPrototypeOf(el);',
    '    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;',
    '    if (setter) setter.call(el, value);',
    '    else el.value = value;',
    '    el.dispatchEvent(new Event("input", { bubbles: true }));',
    '    el.dispatchEvent(new Event("change", { bubbles: true }));',
    '  }',
    '  function getText(el) {',
    '    return [',
    '      el.getAttribute("aria-label"),',
    '      el.getAttribute("title"),',
    '      el.textContent,',
    '      el.value,',
    '    ]',
    '      .filter(Boolean)',
    '      .join(" ")',
    '      .replace(/\\s+/g, " ")',
    '      .trim();',
    '  }',
    '  function isVisible(el) {',
    '    const rect = el.getBoundingClientRect();',
    '    return (',
    '      rect.width > 0 &&',
    '      rect.height > 0 &&',
    '      rect.bottom > 0 &&',
    '      rect.right > 0 &&',
    '      rect.top < (window.innerHeight || document.documentElement.clientHeight) &&',
    '      rect.left < (window.innerWidth || document.documentElement.clientWidth)',
    '    );',
    '  }',
    '  function isDisabledLike(el) {',
    '    return Boolean(',
    '      el.disabled ||',
    '        el.hasAttribute("disabled") ||',
    '        el.getAttribute("aria-disabled") === "true" ||',
    '        el.getAttribute("data-disabled") === "true"',
    '    );',
    '  }',
    '  function isPrimarySubmitButton(btn) {',
    '    const text = getText(btn).toLowerCase();',
    '    if (!text) return btn.getAttribute("type") === "submit";',
    '    if (/(google|github|microsoft|apple|discord|facebook|x\\b|with\\s+google|continue\\s+with)/i.test(text)) {',
    '      return false;',
    '    }',
    '    if (/(sign in|log in|login|continue|next|submit|send|下一步|继续|登录|提交|发送)/i.test(text)) {',
    '      return true;',
    '    }',
    '    return btn.getAttribute("type") === "submit";',
    '  }',
    '  function findSubmitCandidates(scope) {',
    '    return Array.from(',
    '      scope.querySelectorAll(\'button[type="submit"], button, [role="button"]\')',
    '    )',
    '      .filter(isVisible)',
    '      .filter((btn) => !btn.matches(\'[aria-hidden="true"]\'));',
    '  }',
    '  function pickSubmitButton(input) {',
    '    const form = input.form || input.closest("form") || null;',
    '    const scopes = form ? [form, document] : [document];',
    '    for (const scope of scopes) {',
    '      const candidates = findSubmitCandidates(scope);',
    '      const primary = candidates.find((btn) => isPrimarySubmitButton(btn));',
    '      if (primary) return primary;',
    '      const submitType = candidates.find((btn) => btn.getAttribute("type") === "submit");',
    '      if (submitType) return submitType;',
    '    }',
    '    return null;',
    '  }',
    '  function findEmailInput() {',
    '    const inputs = Array.from(document.querySelectorAll("input"));',
    '    const preferred = inputs.find((el) => {',
    '      const text = [',
    '        el.getAttribute("type"),',
    '        el.getAttribute("name"),',
    '        el.getAttribute("id"),',
    '        el.getAttribute("autocomplete"),',
    '        el.getAttribute("placeholder"),',
    '        el.getAttribute("aria-label"),',
    '      ].join(" ").toLowerCase();',
    '      return text.includes("email") || text.includes("mail");',
    '    });',
    '    if (preferred) return preferred;',
    '    return (',
    '      document.querySelector(\'input[type="email"]\') ||',
    '      document.querySelector(\'input[name="email"]\') ||',
    '      document.querySelector(\'input[autocomplete="email"]\') ||',
    '      document.querySelector(\'input[placeholder*="mail" i]\')',
    '    );',
    '  }',
    '  const input = findEmailInput();',
    '  if (!input) return { ok: false, reason: "no-email-input", summary: pageSummary() };',
    '  setValue(input, ' + JSON.stringify(email) + ');',
    '  const deadline = Date.now() + 15000;',
    '  let btn = null;',
    '  while (Date.now() < deadline) {',
    '    btn = pickSubmitButton(input);',
    '    if (btn && !isDisabledLike(btn)) break;',
    '    await sleep(250);',
    '  }',
    '  if (!btn) return { ok: false, reason: "no-submit-button", summary: pageSummary() };',
    '  if (isDisabledLike(btn)) {',
    '    return { ok: false, reason: "submit-still-disabled", summary: pageSummary() };',
    '  }',
    '  btn.scrollIntoView({ block: "center", inline: "nearest" });',
    '  await sleep(100);',
    '  btn.click();',
    '  return { ok: true, summary: pageSummary() };',
    '})()',
  ].join('\n');
}

/** JS injected to fill the OTP input(s) and click submit. */
function buildFillOtpJs(otp: string): string {
  return [
    '(() => {',
    '  function setValue(el, value) {',
    '    const proto = Object.getPrototypeOf(el);',
    '    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;',
    '    if (setter) setter.call(el, value);',
    '    else el.value = value;',
    '    el.dispatchEvent(new Event("input", { bubbles: true }));',
    '    el.dispatchEvent(new Event("change", { bubbles: true }));',
    '  }',
    '  function findOtpInputs() {',
    '    const single =',
    '      document.querySelector(\'input[autocomplete="one-time-code"]\') ||',
    '      document.querySelector(\'input[name="otp"]\') ||',
    '      document.querySelector(\'input[name="code"]\') ||',
    '      document.querySelector(\'input[placeholder*="code" i]\') ||',
    '      document.querySelector(\'input[placeholder*="otp" i]\');',
    '    if (single) return { kind: "single", el: single };',
    '    const digits = Array.from(',
    '      document.querySelectorAll(\'input[inputmode="numeric"], input[maxlength="1"]\')',
    '    );',
    '    if (digits.length >= 6) return { kind: "digits", els: digits.slice(0, 6) };',
    '    return null;',
    '  }',
    '  function findSubmit() {',
    '    const cands = Array.from(',
    '      document.querySelectorAll(\'button[type="submit"], button\')',
    '    );',
    '    return cands.find((b) => {',
    '      const txt = (b.textContent || "").toLowerCase();',
    '      return /verify|continue|sign in|next|submit|confirm/.test(txt);',
    '    }) || document.querySelector(\'button[type="submit"]\');',
    '  }',
    '  const target = findOtpInputs();',
    '  if (!target) return { ok: false, reason: "no-otp-input" };',
    '  if (target.kind === "single") {',
    '    setValue(target.el, ' + JSON.stringify(otp) + ');',
    '  } else {',
    '    const digits = ' + JSON.stringify(otp) + '.split("");',
    '    target.els.forEach((el, i) => setValue(el, digits[i] || ""));',
    '  }',
    '  const btn = findSubmit();',
    '  if (btn) btn.click();',
    '  return { ok: true };',
    '})();',
  ].join('\n');
}

function buildReadOtpSubmitErrorJs(): string {
  return [
    '(() => {',
    '  const text = (document.body?.innerText || "").replace(/\\s+/g, " ").trim();',
    '  const tooMany = /too many attempts|try again later/i.test(text);',
    '  const verifyError = /error verifying code|invalid code|invalid otp|expired code|verification failed/i.test(text);',
    '  if (!tooMany && !verifyError) return { found: false, message: "" };',
    '  const snippets = [];',
    '  for (const pattern of [',
    '    /Error verifying code\\. Please try again\\./i,',
    '    /Too many attempts\\. Please try again later\\./i,',
    '    /Invalid code[^.]*\\./i,',
    '    /Verification failed[^.]*\\./i,',
    '  ]) {',
    '    const match = text.match(pattern);',
    '    if (match?.[0] && !snippets.includes(match[0])) snippets.push(match[0]);',
    '  }',
    '  return {',
    '    found: true,',
    '    rateLimited: tooMany,',
    '    message: snippets.join(" ") || text.slice(0, 240),',
    '  };',
    '})();',
  ].join('\n');
}

async function configureProxy(
  partition: string,
  proxyUrl?: string,
): Promise<void> {
  const ses = session.fromPartition(partition);
  if (!proxyUrl) {
    await ses.setProxy({ mode: 'system' });
    return;
  }
  await ses.setProxy({ proxyRules: proxyUrl, proxyBypassRules: '<-loopback>' });
}
export async function runBrowserUiFlow(
  opts: BrowserUiFlowOptions,
): Promise<BrowserUiFlowResult> {
  const step = (msg: string) => opts.onStep?.(msg);
  const checkAbort = () => {
    if (opts.shouldAbort?.()) {
      throw new Error('Registration was cancelled by user.');
    }
  };
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const consoleUrl = opts.consoleUrl ?? DEFAULT_CONSOLE_URL;
  const acceptLanguage = opts.acceptLanguage ?? DEFAULT_ACCEPT_LANGUAGE;
  const partition = 'in-memory:browser-ui-flow-' + Date.now().toString(36);
  await configureProxy(partition, opts.proxyUrl);
  const flowSession = session.fromPartition(partition);
  configureIncognitoSession(flowSession, step, acceptLanguage);

  const hiddenRequested = opts.visible === false;
  const bounds = getRealisticWindowBounds();
  step(
    '[ui-flow] create visible incognito Electron window' +
      (hiddenRequested ? ' (ignored visible=false)' : ''),
  );
  const win = new BrowserWindow({
    show: true,
    width: bounds.width,
    height: bounds.height,
    center: true,
    frame: true,
    title: 'stagewise auto-register',
    skipTaskbar: false,
    focusable: true,
    minimizable: true,
    maximizable: true,
    resizable: true,
    fullscreenable: false,
    alwaysOnTop: false,
    hasShadow: true,
    opacity: 1,
    webPreferences: {
      preload: getWebContentPreloadPath(),
      nodeIntegrationInSubFrames: true,
      partition,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.show();
  win.focus();
  win.webContents.focus();

  // Capture set-auth-token off the sign-in response.
  let capturedToken = '';
  const onHeadersReceived = (
    details: Electron.OnHeadersReceivedListenerDetails,
    cb: (resp: Electron.HeadersReceivedResponse) => void,
  ) => {
    try {
      if (/\/v1\/auth\/sign-in\/email-otp(\?|$)/.test(details.url)) {
        const headers = details.responseHeaders ?? {};
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase() === 'set-auth-token') {
            const raw = headers[key];
            const value = Array.isArray(raw) ? raw[0] : raw;
            if (value && typeof value === 'string') {
              capturedToken = value;
              step(
                '[ui-flow] \u6293\u5230 set-auth-token (len=' +
                  value.length +
                  ')',
              );
            }
          }
        }
      }
    } catch {
      // best-effort sniff
    }
    cb({ cancel: false, responseHeaders: details.responseHeaders });
  };
  session
    .fromPartition(partition)
    .webRequest.onHeadersReceived(onHeadersReceived);

  const browserUserAgent = normalizeUserAgent(win.webContents.getUserAgent());
  win.webContents.setUserAgent(browserUserAgent);
  step('[ui-flow] using native Chromium user agent');
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2 || /error|fail|captcha|turnstile|otp/i.test(message)) {
      step('[ui-flow:console] ' + message.slice(0, 300));
    }
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    step(
      '[ui-flow] renderer gone: reason=' +
        details.reason +
        ', exitCode=' +
        details.exitCode,
    );
  });
  win.webContents.on('unresponsive', () => {
    step('[ui-flow] renderer became unresponsive');
  });
  flowSession.webRequest.onSendHeaders((details) => {
    if (!AUTH_EMAIL_OTP_RE.test(details.url)) return;
    const captcha = getHeader(details.requestHeaders, 'x-captcha-response');
    const visitor = getHeader(details.requestHeaders, 'x-visitor-id');
    const endpoint = details.url.includes('/sign-in/email-otp')
      ? 'sign-in/email-otp'
      : 'send-verification-otp';
    step(
      '[ui-flow:auth-request] ' +
        endpoint +
        ' captchaLen=' +
        captcha.length +
        ' captchaPrefix=' +
        captcha.slice(0, 16) +
        ' visitor=' +
        visitor.slice(0, 12),
    );
  });
  flowSession.webRequest.onCompleted((details) => {
    if (!AUTH_EMAIL_OTP_RE.test(details.url)) return;
    const endpoint = details.url.includes('/sign-in/email-otp')
      ? 'sign-in/email-otp'
      : 'send-verification-otp';
    step(
      '[ui-flow:auth-response] ' + endpoint + ' status=' + details.statusCode,
    );
  });
  flowSession.webRequest.onErrorOccurred((details) => {
    if (!AUTH_EMAIL_OTP_RE.test(details.url)) return;
    const endpoint = details.url.includes('/sign-in/email-otp')
      ? 'sign-in/email-otp'
      : 'send-verification-otp';
    step('[ui-flow:auth-error] ' + endpoint + ' error=' + details.error);
  });

  const deadline = Date.now() + timeoutMs;
  const remaining = () => Math.max(0, deadline - Date.now());
  const sleep = async (ms: number) => {
    const end = Date.now() + ms;
    while (Date.now() < end && remaining() > 0) {
      checkAbort();
      await new Promise<void>((r) =>
        setTimeout(r, Math.min(250, end - Date.now(), remaining())),
      );
    }
    checkAbort();
  };

  try {
    checkAbort();
    const signInUrl = buildLoginUrl(consoleUrl);
    step('[ui-flow] \u52a0\u8f7d ' + signInUrl);
    await win.loadURL(signInUrl);
    checkAbort();
    await sleep(1500);

    step(
      '[ui-flow] \u7b49\u5f85\u90ae\u7bb1\u8f93\u5165\u6846\u5e76\u63d0\u4ea4',
    );
    const fillEmailRes = await waitAndFillEmail(
      win,
      opts.email,
      remaining,
      step,
      checkAbort,
    );
    if (!fillEmailRes?.ok) {
      throw new Error(
        '[ui-flow] failed to fill email input: ' +
          (fillEmailRes?.reason ?? 'unknown') +
          (fillEmailRes?.summary
            ? ' | page=' + summarizePage(fillEmailRes.summary)
            : ''),
      );
    }

    step(
      '[ui-flow] \u7b49\u5f85\u9875\u9762\u53d1\u9001 send-verification-otp \u5e76\u51fa\u73b0 OTP \u8f93\u5165\u6846',
    );
    // Page sends send-verification-otp via its own Turnstile widget. We
    // don't need to drive it manually. Wait for the OTP form to appear by
    // polling for a plausible OTP input element.
    const otpFormReady = await waitForOtpForm(win, remaining, step, checkAbort);
    if (!otpFormReady.ok) {
      throw new Error(
        '[ui-flow] timed out waiting for OTP input form' +
          (otpFormReady.reason ? ': ' + otpFormReady.reason : ''),
      );
    }

    step(
      '[ui-flow] \u8c03\u7528 mailbox waitForOtp \u62c9\u53d6\u9a8c\u8bc1\u7801',
    );
    checkAbort();
    const otp = await opts.waitForOtp();
    checkAbort();
    step(
      '[ui-flow] \u62ff\u5230 OTP=' +
        otp.slice(0, 2) +
        '****\uff0c\u586b\u5165\u9875\u9762\u5e76\u63d0\u4ea4',
    );
    let fillOtpRes: { ok: boolean; reason?: string };
    try {
      fillOtpRes = (await win.webContents.executeJavaScript(
        buildFillOtpJs(otp),
        true,
      )) as { ok: boolean; reason?: string };
    } catch (err) {
      throw new Error(
        '[ui-flow] OTP script failed: ' +
          (err instanceof Error ? err.message : String(err)),
      );
    }
    if (!fillOtpRes?.ok) {
      throw new Error(
        '[ui-flow] failed to fill OTP input: ' +
          (fillOtpRes?.reason ?? 'unknown'),
      );
    }

    step('[ui-flow] \u7b49\u5f85 set-auth-token \u54cd\u5e94\u5934');
    let lastOtpErrorCheck = 0;
    while (remaining() > 0) {
      checkAbort();
      if (capturedToken) break;
      const now = Date.now();
      if (now - lastOtpErrorCheck >= 1000) {
        lastOtpErrorCheck = now;
        try {
          const pageError = (await win.webContents.executeJavaScript(
            buildReadOtpSubmitErrorJs(),
            true,
          )) as { found?: boolean; rateLimited?: boolean; message?: string };
          if (pageError?.found) {
            const message =
              pageError.message || 'unknown OTP verification error';
            throw new Error(
              pageError.rateLimited
                ? '[ui-flow] OTP verification rate-limited: ' + message
                : '[ui-flow] OTP verification failed: ' + message,
            );
          }
        } catch (err) {
          if (
            err instanceof Error &&
            err.message.startsWith('[ui-flow] OTP verification')
          ) {
            throw err;
          }
          step(
            '[ui-flow] OTP error detection failed: ' +
              (err instanceof Error ? err.message : String(err)),
          );
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!capturedToken) {
      throw new Error('[ui-flow] timed out waiting for set-auth-token');
    }
    return { bearerToken: capturedToken, email: opts.email };
  } finally {
    try {
      session.fromPartition(partition).webRequest.onHeadersReceived(null);
      flowSession.webRequest.onSendHeaders(null);
      flowSession.webRequest.onCompleted(null);
      flowSession.webRequest.onErrorOccurred(null);
    } catch {
      // ignore teardown error
    }
    if (!win.isDestroyed()) win.destroy();
  }
}

export async function runCamoufoxUiFlow(
  opts: BrowserUiFlowOptions,
): Promise<BrowserUiFlowResult> {
  const step = (msg: string) => opts.onStep?.(msg);
  const proxyCandidates = uniqueProxyCandidates(
    opts.proxyCandidates?.length
      ? opts.proxyCandidates
      : [opts.proxyUrl || undefined],
  );
  let lastNetworkError: Error | null = null;
  for (let i = 0; i < proxyCandidates.length; i += 1) {
    const proxyUrl = proxyCandidates[i];
    if (i > 0) {
      step(
        '[camoufox] retrying browser flow via ' + proxyLabel(proxyUrl),
      );
    }
    try {
      return await runCamoufoxUiFlowOnce(opts, proxyUrl);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const canRetry =
        i < proxyCandidates.length - 1 && isCamoufoxNetworkError(error);
      if (!canRetry) {
        throw error;
      }
      lastNetworkError = error;
      step(
        '[camoufox] browser network failed via ' +
          proxyLabel(proxyUrl) +
          '; retry next network: ' +
          error.message,
      );
    }
  }
  throw lastNetworkError ?? new Error('[camoufox] no network candidate worked');
}

async function runCamoufoxUiFlowOnce(
  opts: BrowserUiFlowOptions,
  proxyUrl: string | undefined,
): Promise<BrowserUiFlowResult> {
  const step = (msg: string) => opts.onStep?.(msg);
  const scriptPath = getCamoufoxScriptPath();
  const consoleUrl = buildLoginUrl(opts.consoleUrl ?? DEFAULT_CONSOLE_URL);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const python = resolvePythonCommand();
  const args = [
    ...python.prefixArgs,
    scriptPath,
    '--email',
    opts.email,
    '--console-url',
    consoleUrl,
    '--timeout-ms',
    String(timeoutMs),
    '--accept-language',
    opts.acceptLanguage ?? DEFAULT_ACCEPT_LANGUAGE,
  ];
  if (proxyUrl) {
    args.push('--proxy-url', proxyUrl);
  }
  const childEnv = { ...process.env };
  childEnv.STAGEWISE_CAMOUFOX_RESOURCE_DIR = getCamoufoxResourceDir();
  if (proxyUrl) {
    childEnv.HTTP_PROXY = proxyUrl;
    childEnv.HTTPS_PROXY = proxyUrl;
    childEnv.http_proxy = proxyUrl;
    childEnv.https_proxy = proxyUrl;
  }

  step('[camoufox] starting external browser flow');
  step('[camoufox] using Python runtime: ' + python.label);
  step('[camoufox] network route: ' + proxyLabel(proxyUrl));

  return new Promise<BrowserUiFlowResult>((resolve, reject) => {
    const child = spawn(python.command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: false,
      env: childEnv,
    });

    let settled = false;
    let otpRequested = false;
    let timeout: NodeJS.Timeout | undefined;
    let abortCheck: NodeJS.Timeout | undefined;
    let stdout: ReturnType<typeof readline.createInterface> | undefined;
    let stderr: ReturnType<typeof readline.createInterface> | undefined;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      if (abortCheck) clearInterval(abortCheck);
      stdout?.close();
      stderr?.close();
      if (!child.killed) {
        child.kill();
      }
    };

    const settleReject = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const settleResolve = (result: BrowserUiFlowResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    timeout = setTimeout(() => {
      settleReject(
        new Error('[camoufox] timed out after ' + timeoutMs / 1000 + 's'),
      );
    }, timeoutMs + 90_000);

    abortCheck = setInterval(() => {
      if (!opts.shouldAbort?.()) return;
      settleReject(new Error('Registration was cancelled by user.'));
    }, 500);

    child.on('error', (err) => {
      settleReject(new Error('[camoufox] failed to start: ' + err.message));
    });

    child.on('close', (code) => {
      if (settled) return;
      settleReject(new Error('[camoufox] exited before completion: ' + code));
    });

    stdout = readline.createInterface({ input: child.stdout });
    stderr = readline.createInterface({ input: child.stderr });

    stderr.on('line', (line) => {
      if (!line.trim()) return;
      step('[camoufox:stderr] ' + line.slice(0, 300));
    });

    stdout.on('line', (line) => {
      if (!line.trim()) return;
      let msg: CamoufoxMessage;
      try {
        msg = JSON.parse(line) as CamoufoxMessage;
      } catch {
        step('[camoufox:stdout] ' + line.slice(0, 300));
        return;
      }

      if (msg.event === 'step') {
        step('[camoufox] ' + (msg.message ?? ''));
        return;
      }

      if (msg.event === 'otp-ready') {
        if (otpRequested) return;
        otpRequested = true;
        step('[camoufox] OTP request accepted; polling mailbox');
        void opts
          .waitForOtp()
          .then((otp) => {
            if (settled || child.stdin.destroyed) return;
            child.stdin.write(JSON.stringify({ otp }) + '\n');
          })
          .catch((err) => {
            settleReject(
              new Error(
                '[camoufox] mailbox OTP failed: ' +
                  (err instanceof Error ? err.message : String(err)),
              ),
            );
          });
        return;
      }

      if (msg.event === 'result') {
        const token = msg.token ?? '';
        if (!token) {
          settleReject(new Error('[camoufox] empty token returned'));
          return;
        }
        step('[camoufox] captured token (len=' + token.length + ')');
        settleResolve({ bearerToken: token, email: opts.email });
        return;
      }

      if (msg.event === 'error') {
        settleReject(new Error('[camoufox] ' + (msg.message ?? 'unknown')));
      }
    });
  });
}

function summarizePage(summary: BrowserUiFlowPageSummary): string {
  const inputs = (summary.inputs ?? [])
    .map((input) => {
      const parts = [
        'type=' + String(input.type ?? ''),
        'name=' + String(input.name ?? ''),
        'id=' + String(input.id ?? ''),
        'autocomplete=' + String(input.autocomplete ?? ''),
        'placeholder=' + String(input.placeholder ?? ''),
        'aria=' + String(input.ariaLabel ?? ''),
        'visible=' + String(input.visible ?? ''),
      ];
      return '{' + parts.join(',') + '}';
    })
    .join(';');
  const buttons = (summary.buttons ?? [])
    .map((button) => {
      return (
        '{text=' +
        String(button.text ?? '') +
        ',type=' +
        String(button.type ?? '') +
        ',role=' +
        String(button.role ?? '') +
        ',visible=' +
        String(button.visible ?? '') +
        '}'
      );
    })
    .join(';');
  return (
    'url=' +
    (summary.url ?? '') +
    ', title=' +
    (summary.title ?? '') +
    ', ready=' +
    (summary.readyState ?? '') +
    ', inputs=[' +
    inputs.slice(0, 900) +
    '], buttons=[' +
    buttons.slice(0, 900) +
    '], body="' +
    String(summary.bodyText ?? '').slice(0, 300) +
    '"'
  );
}

async function waitAndFillEmail(
  win: BrowserWindow,
  email: string,
  remaining: () => number,
  step: (msg: string) => void,
  checkAbort: () => void,
): Promise<FillEmailResult> {
  let last: FillEmailResult | null = null;
  let lastLog = 0;
  while (remaining() > 0) {
    checkAbort();
    try {
      last = (await win.webContents.executeJavaScript(
        buildFillEmailJs(email),
        true,
      )) as FillEmailResult;
    } catch (err) {
      return {
        ok: false,
        reason:
          'email-script-exception: ' +
          (err instanceof Error ? err.message : String(err)),
      };
    }
    if (last?.ok) {
      step(
        '[ui-flow] \u90ae\u7bb1\u5df2\u586b\u5165\uff0c\u5df2\u7b49\u5230\u63d0\u4ea4\u6309\u94ae\u53ef\u7528\u5e76\u70b9\u51fb',
      );
      return last;
    }
    const now = Date.now();
    if (now - lastLog >= 5000) {
      lastLog = now;
      step(
        '[ui-flow] \u4ecd\u672a\u627e\u5230\u90ae\u7bb1\u8f93\u5165\u6846: ' +
          (last?.reason ?? 'unknown') +
          (last?.summary ? ' | ' + summarizePage(last.summary) : ''),
      );
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  checkAbort();
  return last ?? { ok: false, reason: 'timed-out-before-first-probe' };
}

async function waitForOtpForm(
  win: BrowserWindow,
  remaining: () => number,
  step: (msg: string) => void,
  checkAbort: () => void,
): Promise<OtpFormWaitResult> {
  const probeJs =
    '(() => {' +
    '  const hasOtp = !!(document.querySelector(\'input[autocomplete="one-time-code"]\') ||' +
    '    document.querySelector(\'input[name="otp"]\') ||' +
    '    document.querySelector(\'input[name="code"]\') ||' +
    '    document.querySelector(\'input[placeholder*="code" i]\') ||' +
    '    document.querySelector(\'input[placeholder*="otp" i]\') ||' +
    '    document.querySelectorAll(\'input[inputmode="numeric"]\').length >= 6 ||' +
    '    document.querySelectorAll(\'input[maxlength="1"]\').length >= 6);' +
    '  const bodyText = (document.body?.innerText || "").replace(/\\s+/g, " ").slice(0, 1200);' +
    '  const authErrorMatch = bodyText.match(/(Missing CAPTCHA response|Security verification failed|Error sending code\\. Please try again\\.)/i);' +
    '  const captchaInput = document.querySelector(\'input[name="cf-turnstile-response"]\');' +
    '  const captchaValue = captchaInput && typeof captchaInput.value === "string" ? captchaInput.value : "";' +
    '  return { hasOtp, authError: authErrorMatch ? authErrorMatch[1] : "", captchaLen: captchaValue.length, hasBridge: !!window.__stagewise_captcha?.requestTurnstileToken, url: location.href };' +
    '})();';
  let lastLog = 0;
  while (remaining() > 0) {
    checkAbort();
    try {
      const probe = (await win.webContents.executeJavaScript(
        probeJs,
        true,
      )) as {
        hasOtp?: boolean;
        authError?: string;
        captchaLen?: number;
        hasBridge?: boolean;
        url?: string;
      };
      if (probe?.hasOtp) return { ok: true };
      if (probe?.authError) {
        return {
          ok: false,
          reason:
            'page-auth-error=' +
            probe.authError +
            ', captchaLen=' +
            String(probe.captchaLen ?? 0) +
            ', bridge=' +
            String(probe.hasBridge ?? false) +
            ', url=' +
            String(probe.url ?? ''),
        };
      }
    } catch {
      // ignore probe error
    }
    const elapsed = Math.floor(Date.now() / 1000);
    if (elapsed - lastLog >= 5) {
      lastLog = elapsed;
      step('[ui-flow] \u7b49\u5f85 OTP \u8868\u5355\u51fa\u73b0\u4e2d\u2026');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  checkAbort();
  return { ok: false };
}
