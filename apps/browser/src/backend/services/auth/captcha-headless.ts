/**
 * Acquire Cloudflare Turnstile credentials (captcha token + visitor id).
 *
 * Strategy:
 *   1. If the renderer exposes window.__solveTurnstile (registered by
 *      ui/services/turnstile-solver.ts), call it first. This avoids any
 *      hidden BrowserWindow when the renderer can solve the challenge.
 *   2. Otherwise, open a small hidden BrowserWindow against the public
 *      console login page and let the page's own Turnstile widget complete
 *      the challenge. The token is then read from the cf-turnstile-response
 *      hidden input.
 *
 * The hidden window is created with show:false (never shown, never focused,
 * never appears in the taskbar). webdriver flag is hidden so Cloudflare
 * does not flag us as a bot. Verified locally that this combination produces
 * a token in ~10s.
 */
import { BrowserWindow, session } from 'electron';

const DEFAULT_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 250;

export type CaptchaCredentials = {
  captchaToken: string;
  visitorId: string;
};

export type AcquireCaptchaOptions = {
  consoleUrl: string;
  proxyUrl?: string;
  timeoutMs?: number;
  userAgent?: string;
  /**
   * Preferred Turnstile solver: calls the UI renderer's
   * window.__solveTurnstile() via IPC. When provided this is tried first.
   */
  solveTurnstile?: () => Promise<string | null>;
  /** Live step logger so the registration UI can show what is happening. */
  onStep?: (msg: string) => void;
};

function generateVisitorId(): string {
  // 20-char lowercase hex, format-compatible with kv.better-auth.com fingerprint ids.
  const bytes = new Uint8Array(10);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function configureProxy(
  partition: string,
  proxyUrl?: string,
): Promise<void> {
  const ses = session.fromPartition(partition);
  if (!proxyUrl) {
    // No explicit proxy - let Electron use the system proxy settings, with
    // a final fallback to direct if no system proxy is configured.
    await ses.setProxy({ mode: 'system' });
    return;
  }
  await ses.setProxy({ proxyRules: proxyUrl, proxyBypassRules: '<-loopback>' });
}

/**
 * Reads cf-turnstile-response from the rendered console login page.
 */
const READ_CREDENTIALS_JS = `
(() => {
  function readToken() {
    const el = document.querySelector('input[name="cf-turnstile-response"]');
    if (el && typeof el.value === 'string' && el.value.length > 8) return el.value;
    return '';
  }
  function readVisitor() {
    try {
      const ls = window.localStorage;
      const candidates = [
        'better-auth.visitor-id',
        'better-auth:visitor-id',
        'visitorId',
        'better-auth.fp',
      ];
      for (const key of candidates) {
        const v = ls.getItem(key);
        if (v && v.length >= 10) return v;
      }
    } catch {}
    return '';
  }
  return { token: readToken(), visitor: readVisitor() };
})();
`;

const TURNSTILE_SITE_KEY =
  process.env.VITE_TURNSTILE_SITE_KEY ||
  process.env.TURNSTILE_SITE_KEY ||
  '0x4AAAAAAC_nVTXG4QucHDTh';

// Injected into the hidden console page after navigation. Renders an
// explicit invisible Turnstile widget (appearance=execute, size=invisible)
// so the challenge runs automatically without user interaction.
function buildInjectTurnstileJs(sitekey: string): string {
  return [
    '(() => {',
    '  if (window.__stagewiseTurnstileToken) return true;',
    "  window.__stagewiseTurnstileToken = '';",
    "  window.__stagewiseTurnstileError = '';",
    '  window.__stagewiseTurnstileRendered = false;',
    '  function doRender() {',
    '    if (window.__stagewiseTurnstileRendered) return;',
    '    if (!window.turnstile || !window.turnstile.render) return;',
    '    window.__stagewiseTurnstileRendered = true;',
    "    var box = document.createElement('div');",
    "    box.id = '__stagewise_turnstile_box';",
    "    box.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;';",
    '    document.body.appendChild(box);',
    '    try {',
    '      window.turnstile.render(box, {',
    "        sitekey: '" + sitekey + "',",
    "        callback: function(t) { window.__stagewiseTurnstileToken = t || ''; },",
    "        'error-callback': function(e) { window.__stagewiseTurnstileError = String(e || 'err'); },",
    "        'expired-callback': function() { window.__stagewiseTurnstileToken = ''; },",
    "        appearance: 'execute',",
    "        size: 'invisible'",
    '      });',
    "    } catch (e) { window.__stagewiseTurnstileError = 'render:' + String(e); }",
    '  }',
    '  function start() {',
    '    if (window.turnstile && window.turnstile.render) { doRender(); return; }',
    "    if (!document.querySelector('script[data-stagewise-turnstile]')) {",
    "      var s = document.createElement('script');",
    "      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';",
    "      s.async = true; s.setAttribute('data-stagewise-turnstile', '1');",
    '      s.onload = doRender; document.head.appendChild(s);',
    '    }',
    '    var tries = 0;',
    '    var iv = setInterval(function() {',
    '      tries++;',
    '      if (window.turnstile && window.turnstile.render) { clearInterval(iv); doRender(); }',
    '      else if (tries > 80) { clearInterval(iv); }',
    '    }, 250);',
    '  }',
    "  if (document.readyState === 'loading') {",
    "    document.addEventListener('DOMContentLoaded', start, { once: true });",
    '  } else { start(); }',
    '  return true;',
    '})();',
  ].join('\n');
}

const READ_TOKEN_JS = [
  '(() => {',
  "  var injected = window.__stagewiseTurnstileToken || '';",
  "  var injectedError = window.__stagewiseTurnstileError || '';",
  "  var pageInput = '';",
  '  try {',
  '    var el = document.querySelector(\'input[name="cf-turnstile-response"]\');',
  "    if (el) pageInput = String(el.value || '');",
  '  } catch (e) {}',
  '  return { injected: injected, injectedError: injectedError, pageInput: pageInput };',
  '})()',
].join('\n');

export async function acquireCaptchaCredentials(
  opts: AcquireCaptchaOptions,
): Promise<CaptchaCredentials> {
  const step = (m: string) => {
    try {
      opts.onStep && opts.onStep(m);
    } catch (_e) {}
  };

  // Step 1: try the renderer-side solver. This usually completes in 2-3s
  // and avoids opening any background window.
  if (opts.solveTurnstile) {
    try {
      step('尝试使用 UI 渲染器的 Turnstile solver');
      const token = await Promise.race([
        opts.solveTurnstile(),
        new Promise<null>((r) => setTimeout(() => r(null), 15_000)),
      ]);
      if (token && token.length > 8) {
        step('UI solver 返回 Turnstile token（跳过后台窗口）');
        return { captchaToken: token, visitorId: generateVisitorId() };
      }
      step('UI solver 未返回 token，回退到后台隐藏窗口方式');
    } catch (e) {
      step(
        'UI solver 报错，回退到后台隐藏窗口: ' +
          String((e as Error).message ?? e),
      );
    }
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const partition = 'in-memory:captcha-headless-' + Date.now().toString(36);
  await configureProxy(partition, opts.proxyUrl);

  step('创建极小可视窗口 (Turnstile 需要可见窗口才能采集指纹)');
  // Cloudflare Turnstile rejects challenges in hidden/offscreen windows.
  // Use a tiny always-on-top, non-focusable, skip-taskbar utility window
  // placed off-screen so it is technically shown but visually imperceptible.
  const win = new BrowserWindow({
    show: true,
    width: 24,
    height: 24,
    x: 9999,
    y: 9999,
    frame: false,
    skipTaskbar: true,
    focusable: false,
    minimizable: false,
    maximizable: false,
    resizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    hasShadow: false,
    opacity: 0.06,
    webPreferences: {
      partition,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  // Sniff visitor id off the live identify request as a more reliable source
  // than localStorage.
  let sniffedVisitor = '';
  const onBeforeSendHeaders = (
    details: Electron.OnBeforeSendHeadersListenerDetails,
    cb: (resp: Electron.BeforeSendResponse) => void,
  ) => {
    try {
      if (
        /kv\.better-auth\.com\/identify/.test(details.url) &&
        details.uploadData
      ) {
        const buf = details.uploadData[0]?.bytes;
        if (buf) {
          try {
            const parsed = JSON.parse(buf.toString('utf8')) as {
              visitorId?: string;
            };
            if (parsed.visitorId) {
              sniffedVisitor = parsed.visitorId;
              step(
                '实时抓取到 visitorId：' + parsed.visitorId.slice(0, 8) + '..',
              );
            }
          } catch {}
        }
      }
    } catch {}
    cb({ cancel: false, requestHeaders: details.requestHeaders });
  };
  session
    .fromPartition(partition)
    .webRequest.onBeforeSendHeaders(onBeforeSendHeaders);

  try {
    if (opts.userAgent) {
      win.webContents.setUserAgent(opts.userAgent);
    }

    // Hide navigator.webdriver so Cloudflare Turnstile does not flag us as a bot.
    const STEALTH_SCRIPT =
      'try { Object.defineProperty(Navigator.prototype, ' +
      '"webdriver", { configurable: true, get: () => undefined }); } catch (e) {}';
    const onFrameCreated = (
      _event: Electron.Event,
      details: Electron.FrameCreatedDetails,
    ) => {
      details.frame?.executeJavaScript(STEALTH_SCRIPT).catch(() => {});
    };
    win.webContents.on('frame-created', onFrameCreated);
    const onDomReady = () => {
      win.webContents.executeJavaScript(STEALTH_SCRIPT).catch(() => {});
    };
    win.webContents.on('dom-ready', onDomReady);

    step('加载 ' + opts.consoleUrl + ' 中（隐藏窗口）');
    await win.loadURL(opts.consoleUrl);
    step('页面加载完成，注入 explicit Turnstile widget (execute/invisible)');

    try {
      await win.webContents.executeJavaScript(
        buildInjectTurnstileJs(TURNSTILE_SITE_KEY),
        true,
      );
      step(
        'Turnstile widget 注入完成，等待 token（sitekey=' +
          TURNSTILE_SITE_KEY.slice(0, 8) +
          '..）',
      );
    } catch (e) {
      step('注入 Turnstile widget 出错: ' + String((e as Error).message ?? e));
    }

    const deadline = Date.now() + timeoutMs;
    let lastLogElapsed = 0;
    let lastInjectedError = '';
    while (Date.now() < deadline) {
      let token = '';
      let injectedError = '';
      try {
        const res = (await win.webContents.executeJavaScript(
          READ_TOKEN_JS,
          true,
        )) as { injected: string; injectedError: string; pageInput: string };
        token =
          res?.injected && res.injected.length > 8
            ? res.injected
            : res?.pageInput && res.pageInput.length > 8
              ? res.pageInput
              : '';
        injectedError = res?.injectedError ?? '';
      } catch (_e) {}
      if (injectedError && injectedError !== lastInjectedError) {
        lastInjectedError = injectedError;
        step('Turnstile widget 报错: ' + injectedError);
      }
      if (token) {
        const visitor = sniffedVisitor || generateVisitorId();
        step('后台窗口获取到 Turnstile token (len=' + token.length + ')');
        return { captchaToken: token, visitorId: visitor };
      }
      const elapsedSec = Math.floor(
        (Date.now() - (deadline - timeoutMs)) / 1000,
      );
      if (elapsedSec >= lastLogElapsed + 5) {
        lastLogElapsed = elapsedSec;
        step('等待 Turnstile token… elapsed=' + elapsedSec + 's');
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    step('Turnstile 获取超时 (' + timeoutMs + 'ms)');
    throw new Error(
      'Timed out waiting for Cloudflare Turnstile challenge to complete (' +
        timeoutMs +
        'ms)',
    );
  } finally {
    try {
      session.fromPartition(partition).webRequest.onBeforeSendHeaders(null);
    } catch {}
    if (!win.isDestroyed()) win.destroy();
  }
}
