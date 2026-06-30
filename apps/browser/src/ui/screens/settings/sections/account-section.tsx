import { Button } from '@stagewise/stage-ui/components/button';
import { useKartonState, useKartonProcedure } from '@ui/hooks/use-karton';
import { useState, useRef, useEffect } from 'react';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import { cn } from '@ui/utils';
import type { SettingsRoute } from '@shared/settings-route';
import type { CurrentUsageResponse } from '@shared/karton-contracts/pages-api/types';
import { useTurnstile } from '@ui/hooks/use-turnstile';
import { useI18n } from '@ui/hooks/use-i18n';
import {
  isAutoRegisterConfigReady,
  normalizeAutoRegisterConfig,
} from './auto-register-config';

const CONSOLE_URL =
  import.meta.env.VITE_STAGEWISE_CONSOLE_URL || 'https://console.stagewise.io';

export function AccountSection() {
  const { t } = useI18n();
  const userAccount = useKartonState((s) => s.userAccount);
  const logout = useKartonProcedure((p) => p.userAccount.logout);
  const openSettings = useKartonProcedure((p) => p.appScreen.openSettings);

  return (
    <div className="h-full w-full">
      {/* Content */}
      <OverlayScrollbar
        className="h-full"
        contentClassName={cn(
          'px-6 pt-24 pb-24',
          userAccount?.status !== 'authenticated' &&
            userAccount?.status !== 'server_unreachable' &&
            'flex min-h-full items-center',
        )}
      >
        {userAccount?.status === 'authenticated' ||
        userAccount?.status === 'server_unreachable' ? (
          <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-8">
            {/* Header */}
            <div>
              <h1 className="font-semibold text-foreground text-xl">
                {t('settings.account.title')}
              </h1>
            </div>
            <AuthenticatedView
              email={userAccount.user?.email}
              subscription={userAccount.subscription}
              machineId={userAccount.machineId}
              onLogout={() => void logout()}
            />
          </div>
        ) : (
          <RegisterAndLoginView openSettings={openSettings} />
        )}
      </OverlayScrollbar>
    </div>
  );
}

// Register and login view: runs the silent auto-registration flow and
// shows live step logs. On success the backend persists credentials and
// refreshes the session, so the account view flips to AuthenticatedView.
function RegisterAndLoginView({
  openSettings,
}: {
  openSettings: (route?: SettingsRoute) => Promise<void> | void;
}) {
  const { t } = useI18n();
  const autoRegister = useKartonProcedure((p) => p.userAccount.autoRegister);
  const autoRegisterRef = useRef(autoRegister);
  autoRegisterRef.current = autoRegister;
  const loadAutoRegisterConfig = useKartonProcedure(
    (p) => p.userAccount.loadAutoRegisterConfig,
  );
  const loadAutoRegisterConfigRef = useRef(loadAutoRegisterConfig);
  loadAutoRegisterConfigRef.current = loadAutoRegisterConfig;
  const signInEmail = useKartonProcedure((p) => p.userAccount.signInEmail);
  const signInEmailRef = useRef(signInEmail);
  signInEmailRef.current = signInEmail;
  const cancelSignInEmail = useKartonProcedure(
    (p) => p.userAccount.cancelSignInEmail,
  );
  const cancelSignInEmailRef = useRef(cancelSignInEmail);
  cancelSignInEmailRef.current = cancelSignInEmail;
  const backendSteps = useKartonState(
    (s) => s.userAccount.registrationSteps ?? [],
  );
  const backendRunning = useKartonState(
    (s) => s.userAccount.registrationRunning ?? false,
  );

  const {
    containerRef: turnstileRef,
    token: turnstileToken,
    enabled: turnstileEnabled,
    solveToken: solveTurnstileToken,
    isSolverMode: turnstileSolverMode,
    reset: resetTurnstile,
  } = useTurnstile();

  const [logs, setLogs] = useState<string[]>([]);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<null | 'ok' | 'fail'>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, backendSteps]);

  function appendLog(line: string) {
    setLogs((prev) => [...prev, line]);
  }

  async function copyRegistrationLogs() {
    const backendLogLines = backendSteps.map((step) => {
      const time = new Date(step.ts).toLocaleTimeString('en-GB', {
        hour12: false,
      });
      return `[${time}] ${step.msg}`;
    });
    const text = [...logs, ...backendLogLines].join('\n');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        // best-effort fallback
      }
    }
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 1500);
  }

  async function getCaptchaToken(): Promise<string | undefined> {
    if (!turnstileEnabled) return undefined;
    if (turnstileSolverMode) return (await solveTurnstileToken()) ?? undefined;
    return turnstileToken ?? undefined;
  }

  async function handleRegister() {
    setRunning(true);
    setDone(null);
    setLogs([]);
    try {
      appendLog(t('settings.account.log.preparing'));
      const cfg = normalizeAutoRegisterConfig(
        await loadAutoRegisterConfigRef.current(),
      );
      if (!isAutoRegisterConfigReady(cfg)) {
        appendLog(t('settings.account.log.configMissing'));
        setDone('fail');
        return;
      }

      // Branch on captcha provider
      const captchaProvider = cfg.captchaProvider || 'browser-ui-flow';
      if (captchaProvider === 'console-handoff') {
        appendLog(t('settings.account.log.consoleHandoff'));
        const r = await signInEmailRef.current.withTimeout(10 * 60 * 1000)();
        if (r?.error) {
          appendLog(
            t('settings.account.log.signInFailed').replace(
              '{error}',
              String(r.error),
            ),
          );
          setDone('fail');
        } else {
          appendLog(t('settings.account.log.signInSuccess'));
          setDone('ok');
        }
        return;
      }

      appendLog(
        t('settings.account.log.useProvider').replace(
          '{provider}',
          captchaProvider,
        ),
      );
      let captchaToken: string | undefined;
      if (captchaProvider !== 'browser-ui-flow') {
        captchaToken = await getCaptchaToken();
      }
      if (turnstileEnabled && !captchaToken) {
        appendLog(t('settings.account.log.captchaPending'));
      } else if (captchaToken) {
        appendLog(t('settings.account.log.captchaReady'));
      }

      appendLog(t('settings.account.log.registerStart'));
      if (!autoRegisterRef.current) {
        appendLog(t('settings.account.log.autoRegisterNotReady'));
        setDone('fail');
        return;
      }
      const result = await autoRegisterRef.current.withTimeout(10 * 60 * 1000)(
        cfg,
        captchaToken,
      );

      if (result?.error) {
        appendLog(
          t('settings.account.log.registerFailed').replace(
            '{error}',
            String(result?.error ?? ''),
          ),
        );
        setDone('fail');
      } else {
        appendLog(
          t('settings.account.log.registerSuccess').replace(
            '{email}',
            String(result?.email ?? ''),
          ),
        );
        appendLog(t('settings.account.log.autoSignedIn'));
        setDone('ok');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      appendLog(
        t('settings.account.log.registerError').replace('{message}', msg),
      );
      setDone('fail');
    } finally {
      resetTurnstile();
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl shrink-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-foreground text-xl">
          {t('settings.account.register.title')}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t('settings.account.register.description')}
        </p>
      </div>

      <div ref={turnstileRef} className="empty:hidden" />

      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          size="sm"
          disabled={running}
          onClick={() => void handleRegister()}
        >
          {running
            ? t('settings.account.register.running')
            : t('settings.account.register.button')}
        </Button>
        {running && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void cancelSignInEmailRef.current().then(() => {
                setRunning(false);
                appendLog(t('settings.account.log.cancelled'));
                setDone('fail');
                resetTurnstile();
              });
            }}
          >
            {t('settings.account.register.cancel')}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void openSettings({ section: 'auto-register' })}
        >
          {t('settings.account.register.openAutoRegister')}
        </Button>
      </div>

      {(logs.length > 0 || backendSteps.length > 0 || backendRunning) && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-foreground text-sm">
              {t('settings.account.register.logsTitle')}
            </h3>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => void copyRegistrationLogs()}
            >
              {copiedLogs
                ? t('settings.account.register.copiedLogs')
                : t('settings.account.register.copyLogs')}
            </Button>
          </div>
          <div className="max-h-96 overflow-auto rounded-lg border border-border bg-surface-1 p-3 font-mono text-xs">
            {logs.map((line, i) => (
              <div
                key={`ui-${i}`}
                className={cn(
                  'whitespace-pre-wrap break-words text-muted-foreground',
                )}
              >
                {line}
              </div>
            ))}
            {backendSteps.map((step, i) => {
              const isLast = i === backendSteps.length - 1 && !backendRunning;
              const failed = done === 'fail' && isLast;
              const ok = done === 'ok' && isLast;
              const time = new Date(step.ts).toLocaleTimeString('en-GB', {
                hour12: false,
              });
              return (
                <div
                  key={`bk-${i}-${step.ts}`}
                  className={cn(
                    'whitespace-pre-wrap break-words',
                    failed
                      ? 'text-red-600 dark:text-red-400'
                      : ok
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-foreground/80',
                  )}
                >
                  <span className="text-muted-foreground/60">[{time}]</span>{' '}
                  {step.msg}
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

function AuthenticatedView({
  email,
  subscription,
  machineId,
  onLogout,
}: {
  email?: string;
  subscription?: {
    active: boolean;
    plan?: string;
    expiresAt?: string;
  };
  machineId?: string;
  onLogout: () => void;
}) {
  const { t } = useI18n();
  const openExternalUrl = useKartonProcedure((p) => p.openExternalUrl);

  return (
    <>
      {/* User info */}
      <div className="flex flex-col gap-2">
        <h2 className="font-medium text-foreground text-lg">
          {email ?? t('settings.account.authenticated.unknownUser')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t('settings.account.authenticated.signedIn')}
        </p>
      </div>

      <hr className="border-border-subtle" />

      {/* Account details */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-y-3">
          <div className="grid grid-cols-[140px_1fr] gap-x-4">
            <span className="font-medium text-muted-foreground text-sm">
              {t('settings.account.authenticated.email')}
            </span>
            <span className="break-all text-foreground text-sm">{email}</span>
          </div>

          {subscription && (
            <>
              <div className="grid grid-cols-[140px_1fr] gap-x-4">
                <span className="font-medium text-muted-foreground text-sm">
                  {t('settings.account.authenticated.plan')}
                </span>
                <span className="text-foreground text-sm capitalize">
                  {subscription.plan ??
                    t('settings.account.authenticated.free')}
                </span>
              </div>
              {subscription.expiresAt && (
                <div className="grid grid-cols-[140px_1fr] gap-x-4">
                  <span className="font-medium text-muted-foreground text-sm">
                    {t('settings.account.authenticated.expires')}
                  </span>
                  <span className="text-foreground text-sm">
                    {new Date(subscription.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </>
          )}

          {machineId && (
            <div className="grid grid-cols-[140px_1fr] gap-x-4">
              <span className="font-medium text-muted-foreground text-sm">
                {t('settings.account.authenticated.machineId')}
              </span>
              <span className="break-all font-mono text-foreground text-sm">
                {machineId}
              </span>
            </div>
          )}
        </div>
      </div>

      <hr className="border-border-subtle" />

      <UsageSection />

      <hr className="border-border-subtle" />

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onLogout}>
          {t('settings.account.authenticated.signOut')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void openExternalUrl(CONSOLE_URL)}
        >
          {t('settings.account.authenticated.openConsole')}
        </Button>
      </div>
    </>
  );
}

function getWindowLabel(type: string, t: (k: string) => string): string {
  if (type === 'daily') return t('settings.account.usage.window.daily');
  if (type === 'weekly') return t('settings.account.usage.window.weekly');
  if (type === 'monthly') return t('settings.account.usage.window.monthly');
  return type;
}

function formatCredits(raw: number): string {
  const dollars = raw / 10_000;
  return `$${dollars.toFixed(2)}`;
}

function formatResetTime(iso: string, t: (k: string) => string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return t('settings.account.usage.reset.now');
  const diffH = Math.floor(diffMs / 3_600_000);
  if (diffH < 24)
    return t('settings.account.usage.reset.hours').replace(
      '{h}',
      String(diffH),
    );
  const diffD = Math.floor(diffH / 24);
  return t('settings.account.usage.reset.days').replace('{d}', String(diffD));
}

function UsageSection() {
  const { t } = useI18n();
  const getUsageCurrent = useKartonProcedure(
    (p) => p.userAccount.getUsageCurrent,
  );

  // Guard: if RPC is not ready, skip usage fetch
  if (!getUsageCurrent) {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="font-medium text-foreground">
          {t('settings.account.usage.title')}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t('settings.account.usage.unavailable')}
        </p>
      </div>
    );
  }

  // Guard: if RPC is not ready, skip usage fetch
  if (!getUsageCurrent) {
    return (
      <div className="flex flex-col gap-4">
        <h3 className="font-medium text-foreground">
          {t('settings.account.usage.title')}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t('settings.account.usage.unavailable')}
        </p>
      </div>
    );
  }
  const getUsageCurrentRef = useRef(getUsageCurrent);
  getUsageCurrentRef.current = getUsageCurrent;
  const [usage, setUsage] = useState<CurrentUsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getUsageCurrentRef
      .current()
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : t('settings.account.usage.loadFailed');
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-medium text-foreground">
        {t('settings.account.usage.title')}
      </h3>

      {loading && (
        <p className="text-muted-foreground text-sm">
          {t('settings.account.usage.loading')}
        </p>
      )}

      {error && <p className="text-error-foreground text-sm">{error}</p>}

      {usage && (
        <div className="flex flex-col gap-5">
          {/* Credits */}
          <div className="grid grid-cols-[140px_1fr] gap-x-4">
            <span className="font-medium text-muted-foreground text-sm">
              {t('settings.account.usage.credits')}
            </span>
            <span className="text-foreground text-sm">
              {t('settings.account.usage.remaining').replace(
                '{amount}',
                formatCredits(usage.prepaidBalance),
              )}
            </span>
          </div>

          {/* Rate-limit windows */}
          <div className="flex flex-col gap-3">
            {usage.windows.map((w) => {
              const remaining = Math.max(0, 100 - w.usedPercent);
              const barColor =
                w.usedPercent >= 100
                  ? 'bg-error-solid'
                  : w.usedPercent > 80
                    ? 'bg-warning-solid'
                    : 'bg-primary-solid';
              return (
                <div key={w.type} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground text-sm">
                      {getWindowLabel(w.type, t)}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {t('settings.account.usage.percentLeft')
                        .replace('{pct}', remaining.toFixed(0))
                        .replace('{when}', formatResetTime(w.resetsAt, t))}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-1">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${w.usedPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
