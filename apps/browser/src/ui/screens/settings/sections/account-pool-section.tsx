import { Button } from '@stagewise/stage-ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@stagewise/stage-ui/components/dialog';
import { Input } from '@stagewise/stage-ui/components/input';
import { useKartonProcedure, useKartonState } from '@ui/hooks/use-karton';
import {
  memo,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  startTransition,
  type ChangeEvent,
} from 'react';
import { Virtuoso } from 'react-virtuoso';
import {
  DownloadIcon,
  RefreshCwIcon,
  UploadIcon,
  ZapIcon,
  XIcon,
} from 'lucide-react';
import { useTurnstile } from '@ui/hooks/use-turnstile';
import { useI18n } from '@ui/hooks/use-i18n';
import { cn } from '@ui/utils';
import type { Patch } from 'immer';
import type { CurrentUsageResponse } from '@shared/karton-contracts/pages-api/types';
import {
  cancelAccountPoolBatchTask,
  dismissAccountPoolBatchTask,
  failAccountPoolBatchTask,
  startAccountPoolBatchTask,
  useAccountPoolBatchTask,
} from './account-pool-batch-task-store';
import {
  isAutoRegisterConfigReady,
  normalizeAutoRegisterConfig,
} from './auto-register-config';

type PoolEntry = {
  email: string;
  token?: string;
  status: 'normal' | 'throttled' | 'banned' | 'observing';
  addedAt: string;
  lastCheckedAt?: string;
  throttledSince?: string;
  throttledResetsAt?: string;
  usage?: CurrentUsageResponse;
  usageCheckedAt?: string;
};

function StatusBadge({ status }: { status: PoolEntry['status'] }) {
  const { t } = useI18n();
  if (status === 'normal') {
    return (
      <span className="inline-flex items-center rounded-md bg-success-background px-2 py-0.5 font-medium text-success-foreground text-xs ring-1 ring-success-solid/20">
        <span className="mr-1.5 size-1.5 shrink-0 rounded-full bg-success-solid" />
        {t('settings.accountPool.status.normal')}
      </span>
    );
  }
  if (status === 'throttled') {
    return (
      <span className="inline-flex items-center rounded-md bg-warning-background px-2 py-0.5 font-medium text-warning-foreground text-xs ring-1 ring-warning-solid/20">
        <span className="mr-1.5 size-1.5 shrink-0 rounded-full bg-warning-solid" />
        {t('settings.accountPool.status.throttled')}
      </span>
    );
  }
  if (status === 'observing') {
    return (
      <span className="inline-flex items-center rounded-md bg-warning-background px-2 py-0.5 font-medium text-warning-foreground text-xs ring-1 ring-warning-solid/20">
        <span className="mr-1.5 size-1.5 shrink-0 rounded-full bg-warning-solid" />
        {t('settings.accountPool.status.observing')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-error-background px-2 py-0.5 font-medium text-error-foreground text-xs ring-1 ring-error-solid/20">
      <span className="mr-1.5 size-1.5 shrink-0 rounded-full bg-error-solid" />
      {t('settings.accountPool.status.banned')}
    </span>
  );
}

function getLimitWindow(usage?: CurrentUsageResponse) {
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

function getAccountPoolOverview(pool: PoolEntry[]) {
  const overview = {
    total: pool.length,
    available: 0,
    dailyLimited: 0,
    weeklyLimited: 0,
    monthlyLimited: 0,
    observing: 0,
    banned: 0,
  };

  for (const entry of pool) {
    if (entry.status === 'banned') {
      overview.banned += 1;
      continue;
    }
    if (entry.status === 'observing') {
      overview.observing += 1;
      continue;
    }

    const limitWindow = getLimitWindow(entry.usage);
    if (limitWindow === 'monthly') {
      overview.monthlyLimited += 1;
      continue;
    }
    if (limitWindow === 'weekly') {
      overview.weeklyLimited += 1;
      continue;
    }
    if (limitWindow === 'daily' || entry.status === 'throttled') {
      overview.dailyLimited += 1;
      continue;
    }

    overview.available += 1;
  }

  return overview;
}

function EffectiveStatusBadge({ entry }: { entry: PoolEntry }) {
  const { t } = useI18n();
  const limitWindow = getLimitWindow(entry.usage);
  if (entry.status === 'banned') return <StatusBadge status="banned" />;
  if (entry.status === 'observing') return <StatusBadge status="observing" />;
  if (entry.status === 'throttled' || limitWindow) {
    const label =
      limitWindow === 'monthly'
        ? t('settings.accountPool.status.monthlyLimit')
        : limitWindow === 'weekly'
          ? t('settings.accountPool.status.weeklyLimit')
          : limitWindow === 'daily'
            ? t('settings.accountPool.status.dailyLimit')
            : t('settings.accountPool.status.throttled');
    return (
      <span className="inline-flex items-center rounded-md bg-warning-background px-2 py-0.5 font-medium text-warning-foreground text-xs ring-1 ring-warning-solid/20">
        <span className="mr-1.5 size-1.5 shrink-0 rounded-full bg-warning-solid" />
        {label}
      </span>
    );
  }
  return <StatusBadge status="normal" />;
}

function formatWindowLabel(type: string, t: (k: string) => string): string {
  if (type === 'daily') return t('settings.accountPool.window.daily');
  if (type === 'weekly') return t('settings.accountPool.window.weekly');
  if (type === 'monthly') return t('settings.accountPool.window.monthly');
  return type;
}

function formatPlanLabel(plan: string): string {
  return plan.toUpperCase();
}

function parseDateTime(value?: string): Date | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function formatResetsAt(iso: string): string {
  return parseDateTime(iso)?.toLocaleString() ?? iso;
}

function getEffectiveThrottledResetsAt(entry: PoolEntry): string | undefined {
  const limitWindow = getLimitWindow(entry.usage);
  const usageResetsAt = limitWindow
    ? entry.usage?.windows.find((window) => window.type === limitWindow)
        ?.resetsAt
    : undefined;

  if (parseDateTime(usageResetsAt)) return usageResetsAt;
  if (parseDateTime(entry.throttledResetsAt)) return entry.throttledResetsAt;
  return undefined;
}

function getLogLineClassName(line: string): string {
  const normalized = line.toLowerCase();
  const lineWithoutZeroFailures = line
    .replace(/失败\s*0\s*个/g, '')
    .replace(/failed\s*0\b/gi, '');
  const normalizedWithoutZeroFailures = lineWithoutZeroFailures.toLowerCase();

  if (
    /error|failed|exception|timed out|not found/.test(
      normalizedWithoutZeroFailures,
    ) ||
    /失败|异常|错误/.test(lineWithoutZeroFailures)
  ) {
    return 'text-error-foreground';
  }

  if (
    /warning|warn|stderr/.test(normalized) ||
    /警告|跳过|取消|限流/.test(line)
  ) {
    return 'text-warning-foreground';
  }

  if (
    /success|succeeded|completed|captured (session )?token/.test(normalized) ||
    /成功|完成|已入账号池|✓/.test(line)
  ) {
    return 'text-success-foreground';
  }

  return 'text-foreground';
}

function UsageDisplay({
  usage,
  checkedAt,
}: {
  usage?: CurrentUsageResponse;
  checkedAt?: string;
}) {
  const { t } = useI18n();
  if (!usage) {
    return (
      <p className="text-muted-foreground text-xs italic">
        {t('settings.accountPool.usage.empty')}
      </p>
    );
  }
  const planClass =
    usage.plan === 'free'
      ? 'bg-surface-2 text-muted-foreground ring-1 ring-border-subtle'
      : usage.plan === 'pro'
        ? 'bg-info-background text-info-foreground ring-1 ring-info-solid/20'
        : 'bg-primary-solid/10 text-primary-foreground ring-1 ring-primary-solid/20';
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 font-semibold tracking-wide',
            planClass,
          )}
        >
          {formatPlanLabel(usage.plan)}
        </span>
        {usage.prepaidBalance > 0 && (
          <span className="inline-flex items-center rounded-md bg-success-background px-2 py-0.5 text-success-foreground ring-1 ring-success-solid/20">
            {t('settings.accountPool.usage.prepaid')}
            {(usage.prepaidBalance / 10000).toFixed(2)}
          </span>
        )}
        {checkedAt && (
          <span className="text-muted-foreground">
            {t('settings.accountPool.usage.refreshedAt')}
            {new Date(checkedAt).toLocaleString()}
          </span>
        )}
      </div>
      {usage.windows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {usage.windows.map((w) => {
            const pct = Math.max(0, Math.min(100, w.usedPercent));
            const bar = w.exceeded
              ? 'bg-error-solid'
              : pct >= 80
                ? 'bg-warning-solid'
                : 'bg-success-solid';
            return (
              <div key={w.type} className="flex items-center gap-2 text-xs">
                <span className="w-14 shrink-0 font-medium text-muted-foreground">
                  {formatWindowLabel(w.type, t)}
                </span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-2 ring-1 ring-border-subtle">
                  <div
                    className={cn('h-full rounded-full', bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'w-10 shrink-0 text-right font-medium tabular-nums',
                    w.exceeded
                      ? 'text-error-foreground'
                      : pct >= 80
                        ? 'text-warning-foreground'
                        : 'text-muted-foreground',
                  )}
                >
                  {pct.toFixed(0)}
                  {'%'}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {t('settings.accountPool.usage.resetsAt')}
                  {formatResetsAt(w.resetsAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type PoolHealthTaskStatus = {
  taskId: string;
  status: 'running' | 'completed' | 'error';
  total: number;
  done: number;
  failed: number;
  skipped: number;
  activeEmails: string[];
  logs: string[];
  logsByEmail: Record<string, string[]>;
  accounts: PoolEntry[];
  error?: string;
};

type AccountPoolTransferResult =
  | {
      kind: 'export';
      count: number;
      error?: string;
    }
  | {
      kind: 'import';
      imported: number;
      updated: number;
      skipped: number;
      error?: string;
    };

const EMPTY_REFRESH_LOGS: string[] = [];
const ACCOUNT_POOL_USAGE_SYNC_DELAYS_MS = [1500, 4000, 8000];

type AccountPoolListItem =
  | { kind: 'header' }
  | { kind: 'account'; entry: PoolEntry }
  | { kind: 'footer' };

const AccountPoolRow = memo(function AccountPoolRow({
  entry,
  currentEmailLower,
  actionEmail,
  refreshingEmail,
  refreshLogs,
  isHealthChecking,
  onRefresh,
  onSwitch,
  onRemove,
  onClearRefreshLogs,
}: {
  entry: PoolEntry;
  currentEmailLower?: string;
  actionEmail: string | null;
  refreshingEmail: string | null;
  refreshLogs: string[];
  isHealthChecking: boolean;
  onRefresh: (email: string) => void;
  onSwitch: (email: string) => void;
  onRemove: (email: string) => void;
  onClearRefreshLogs: (email: string) => void;
}) {
  const { t } = useI18n();
  const isCurrent = entry.email?.trim().toLowerCase() === currentEmailLower;
  const isActing = actionEmail === entry.email;
  const isLimited =
    entry.status === 'throttled' ||
    entry.status === 'observing' ||
    !!getLimitWindow(entry.usage);
  const throttledResetsAt = getEffectiveThrottledResetsAt(entry);

  return (
    <div className="pb-2.5">
      <div
        className={cn(
          'flex flex-col gap-2 rounded-xl bg-background px-4 py-3.5 ring-1 ring-border-subtle hover:ring-border dark:bg-surface-1',
          isCurrent &&
            'bg-primary-solid/5 ring-2 ring-primary-solid dark:bg-primary-solid/10',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'break-all font-medium text-sm',
                isCurrent ? 'text-primary-foreground' : 'text-foreground',
              )}
            >
              {entry.email}
            </span>
            {isCurrent && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary-solid px-2 py-0.5 font-medium text-solid-foreground text-xs">
                <span className="size-1.5 shrink-0 rounded-full bg-solid-foreground" />
                {t('settings.accountPool.current')}
              </span>
            )}
            <EffectiveStatusBadge entry={entry} />
            {isHealthChecking && (
              <span className="inline-flex shrink-0 items-center rounded-md bg-info-background px-2 py-0.5 font-medium text-info-foreground text-xs ring-1 ring-info-solid/20">
                <span className="mr-1.5 size-1.5 shrink-0 animate-pulse-full rounded-full bg-info-solid" />
                {t('settings.accountPool.healthTask.rowChecking')}
              </span>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button
              variant="ghost"
              size="xs"
              disabled={refreshingEmail === entry.email}
              onClick={() => onRefresh(entry.email)}
            >
              {refreshingEmail === entry.email
                ? t('settings.accountPool.refreshing')
                : t('settings.accountPool.refresh')}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={isCurrent || !entry.token || isActing || isLimited}
              onClick={() => onSwitch(entry.email)}
            >
              {isActing
                ? t('settings.accountPool.switching')
                : t('settings.accountPool.switch')}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={isActing}
              onClick={() => onRemove(entry.email)}
            >
              {t('settings.accountPool.remove')}
            </Button>
          </div>
        </div>
        {entry.status === 'throttled' && throttledResetsAt && (
          <p className="text-muted-foreground text-xs">
            {t('settings.accountPool.throttledResetsAt')}
            {formatResetsAt(throttledResetsAt)}
          </p>
        )}
        <UsageDisplay usage={entry.usage} checkedAt={entry.usageCheckedAt} />
        {entry.lastCheckedAt && (
          <p className="text-muted-foreground text-xs">
            {t('settings.accountPool.lastCheckedAt')}
            {new Date(entry.lastCheckedAt).toLocaleString()}
          </p>
        )}
        {refreshLogs.length > 0 && (
          <div className="mt-1 flex flex-col gap-2 rounded-md bg-surface-2 p-2 ring-1 ring-border-subtle">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground text-xs">
                {t('settings.accountPool.refreshLog.title')}
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onClearRefreshLogs(entry.email)}
              >
                {t('settings.accountPool.batchTask.close')}
              </Button>
            </div>
            <div className="max-h-32 overflow-auto font-mono text-xs">
              {refreshLogs.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    'whitespace-pre-wrap break-words',
                    getLogLineClassName(line),
                  )}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export function AccountPoolSection() {
  const { t } = useI18n();
  const currentEmail = useKartonState((s) => s.userAccount?.user?.email);
  const autoSwitchMaxAttempts = useKartonState(
    (s) => s.preferences.agent.accountPoolAutoSwitchMaxAttempts,
  );
  // Email comparison is case-insensitive — the server may return a
  // differently-cased email than what is stored in the pool.
  const currentEmailLower = currentEmail?.trim().toLowerCase();
  const getAccountPool = useKartonProcedure(
    (p) => p.userAccount.getAccountPool,
  );
  const exportAccountPool = useKartonProcedure(
    (p) => p.userAccount.exportAccountPool,
  );
  const importAccountPool = useKartonProcedure(
    (p) => p.userAccount.importAccountPool,
  );
  const removeFromPool = useKartonProcedure(
    (p) => p.userAccount.removeFromPool,
  );
  const switchToAccount = useKartonProcedure(
    (p) => p.userAccount.switchToAccount,
  );
  const autoRegisterBatch = useKartonProcedure(
    (p) => p.userAccount.autoRegisterBatch,
  );
  const loadAutoRegisterConfig = useKartonProcedure(
    (p) => p.userAccount.loadAutoRegisterConfig,
  );
  const startPoolHealthCheck = useKartonProcedure(
    (p) => p.userAccount.startPoolHealthCheck,
  );
  const getPoolHealthCheckStatus = useKartonProcedure(
    (p) => p.userAccount.getPoolHealthCheckStatus,
  );
  const refreshPoolUsage = useKartonProcedure(
    (p) => p.userAccount.refreshPoolUsage,
  );
  const refreshPoolAccountUsage = useKartonProcedure(
    (p) => p.userAccount.refreshPoolAccountUsage,
  );
  const cleanupInvalidPoolAccounts = useKartonProcedure(
    (p) => p.userAccount.cleanupInvalidPoolAccounts,
  );
  const getBatchTaskStatus = useKartonProcedure(
    (p) => p.userAccount.getBatchTaskStatus,
  );
  const cancelBatchTask = useKartonProcedure(
    (p) => p.userAccount.cancelBatchTask,
  );
  const updatePreferences = useKartonProcedure((p) => p.preferences.update);

  const getRef = useRef(getAccountPool);
  getRef.current = getAccountPool;
  const exportRef = useRef(exportAccountPool);
  exportRef.current = exportAccountPool;
  const importRef = useRef(importAccountPool);
  importRef.current = importAccountPool;
  const removeRef = useRef(removeFromPool);
  removeRef.current = removeFromPool;
  const switchRef = useRef(switchToAccount);
  switchRef.current = switchToAccount;
  const batchRef = useRef(autoRegisterBatch);
  batchRef.current = autoRegisterBatch;
  const loadAutoRegisterConfigRef = useRef(loadAutoRegisterConfig);
  loadAutoRegisterConfigRef.current = loadAutoRegisterConfig;
  const startHealthRef = useRef(startPoolHealthCheck);
  startHealthRef.current = startPoolHealthCheck;
  const healthStatusRef = useRef(getPoolHealthCheckStatus);
  healthStatusRef.current = getPoolHealthCheckStatus;
  const refreshUsageRef = useRef(refreshPoolUsage);
  refreshUsageRef.current = refreshPoolUsage;
  const refreshAccountUsageRef = useRef(refreshPoolAccountUsage);
  refreshAccountUsageRef.current = refreshPoolAccountUsage;
  const cleanupInvalidRef = useRef(cleanupInvalidPoolAccounts);
  cleanupInvalidRef.current = cleanupInvalidPoolAccounts;

  const updateAutoSwitchMaxAttempts = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    const nextValue = Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
    const patches: Patch[] = [
      {
        op: 'replace',
        path: ['agent', 'accountPoolAutoSwitchMaxAttempts'],
        value: nextValue,
      },
    ];
    void updatePreferences(patches);
  };

  const {
    containerRef: turnstileRef,
    token: turnstileToken,
    enabled: turnstileEnabled,
    solveToken: solveTurnstileToken,
    isSolverMode: turnstileSolverMode,
    reset: resetTurnstile,
  } = useTurnstile();

  const [pool, setPool] = useState<PoolEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);
  const [actionEmail, setActionEmail] = useState<string | null>(null);
  const [refreshingEmail, setRefreshingEmail] = useState<string | null>(null);
  const [refreshLogsByEmail, setRefreshLogsByEmail] = useState<
    Record<string, string[]>
  >({});
  const [transferring, setTransferring] = useState<'import' | 'export' | null>(
    null,
  );
  const [transferResult, setTransferResult] =
    useState<AccountPoolTransferResult | null>(null);
  const [switchResult, setSwitchResult] = useState<{
    email?: string;
    error?: string;
    removed?: number;
  } | null>(null);

  // Batch task UI state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTotal, setTaskTotal] = useState(1);
  const [taskInterval, setTaskInterval] = useState(2000);
  const [starting, setStarting] = useState(false);
  const task = useAccountPoolBatchTask();
  const [healthTask, setHealthTask] = useState<PoolHealthTaskStatus | null>(
    null,
  );
  const healthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const healthLogsContainerRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const usageSyncTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const applyPoolEntries = useCallback((entries: PoolEntry[]) => {
    startTransition(() => {
      setPool(entries);
    });
  }, []);

  const clearUsageSyncTimeouts = useCallback(() => {
    for (const timeout of usageSyncTimeoutsRef.current) {
      clearTimeout(timeout);
    }
    usageSyncTimeoutsRef.current = [];
  }, []);

  const scheduleUsageSync = useCallback(() => {
    clearUsageSyncTimeouts();
    usageSyncTimeoutsRef.current = ACCOUNT_POOL_USAGE_SYNC_DELAYS_MS.map(
      (delayMs) =>
        setTimeout(() => {
          void getRef
            .current()
            .then((entries) => applyPoolEntries(entries as PoolEntry[]));
        }, delayMs),
    );
  }, [applyPoolEntries, clearUsageSyncTimeouts]);

  useEffect(() => {
    const el = logsContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [task?.logs.length]);

  useEffect(() => {
    const el = healthLogsContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [healthTask?.logs.length]);

  const refresh = useCallback(() => {
    setLoading(true);
    void getRef
      .current()
      .then((entries) => applyPoolEntries(entries as PoolEntry[]))
      .finally(() => setLoading(false));
  }, [applyPoolEntries]);

  const lastSyncedBatchProgressRef = useRef('');

  // Refresh the pool whenever a batch task adds accounts, and once more when
  // it stops so failures/cancellations still leave the list current.
  useEffect(() => {
    if (!task) return;
    const syncKey = `${task.taskId}:${task.done}:${task.status}`;
    if (syncKey === lastSyncedBatchProgressRef.current) return;
    if (task.done > 0 || task.status !== 'running') {
      lastSyncedBatchProgressRef.current = syncKey;
      void refresh();
    }
  }, [task?.taskId, task?.done, task?.status, refresh]);

  const didInitRef = useRef(false);
  if (!didInitRef.current) {
    didInitRef.current = true;
    setLoading(true);
    void getRef
      .current()
      .then((entries) => applyPoolEntries(entries as PoolEntry[]))
      .finally(() => setLoading(false));
  }

  // Best-effort: refresh usage info once when the section mounts so the rows
  // show up-to-date plan/window data without forcing a full health check.
  useEffect(() => {
    let cancelled = false;
    void refreshUsageRef
      .current()
      .then((entries) => {
        if (!cancelled) {
          applyPoolEntries(entries as PoolEntry[]);
          scheduleUsageSync();
        }
      })
      .catch(() => {
        // ignore: network/auth blip should not break the page
      });
    return () => {
      cancelled = true;
    };
  }, [applyPoolEntries, scheduleUsageSync]);

  // Cleanup health-check polling on unmount. Batch registration polling is
  // global and must survive leaving this settings page.
  useEffect(() => {
    return () => {
      if (healthPollRef.current) clearInterval(healthPollRef.current);
      clearUsageSyncTimeouts();
    };
  }, [clearUsageSyncTimeouts]);

  const handleCheckHealth = () => {
    if (healthTask?.status === 'running') return;
    setSwitchResult(null);
    setHealthTask({
      taskId: '',
      status: 'running',
      total: pool.length,
      done: 0,
      failed: 0,
      skipped: 0,
      activeEmails: [],
      logs: [t('settings.accountPool.healthTask.starting')],
      logsByEmail: {},
      accounts: pool,
    });
    void startHealthRef
      .current()
      .then(({ taskId }) => {
        if (healthPollRef.current) clearInterval(healthPollRef.current);
        healthPollRef.current = setInterval(async () => {
          try {
            const status = (await healthStatusRef.current(
              taskId,
            )) as PoolHealthTaskStatus;
            setHealthTask(status);
            setPool(status.accounts);
            if (Object.keys(status.logsByEmail).length > 0) {
              setRefreshLogsByEmail((prev) => ({
                ...prev,
                ...status.logsByEmail,
              }));
            }
            if (status.status !== 'running') {
              if (healthPollRef.current) {
                clearInterval(healthPollRef.current);
                healthPollRef.current = null;
              }
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setHealthTask((prev) => ({
              taskId,
              status: 'error',
              total: prev?.total ?? 0,
              done: prev?.done ?? 0,
              failed: prev?.failed ?? 0,
              skipped: prev?.skipped ?? 0,
              activeEmails: [],
              logs: [
                ...(prev?.logs ?? []),
                t('settings.accountPool.healthTask.pollFailed') + message,
              ],
              logsByEmail: prev?.logsByEmail ?? {},
              accounts: prev?.accounts ?? pool,
              error: message,
            }));
            if (healthPollRef.current) {
              clearInterval(healthPollRef.current);
              healthPollRef.current = null;
            }
          }
        }, 1000);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        setHealthTask({
          taskId: '',
          status: 'error',
          total: pool.length,
          done: 0,
          failed: 0,
          skipped: 0,
          activeEmails: [],
          logs: [t('settings.accountPool.healthTask.startFailed') + message],
          logsByEmail: {},
          accounts: pool,
          error: message,
        });
      });
  };

  const handleRefreshOne = useCallback(
    (email: string) => {
      setRefreshingEmail(email);
      setSwitchResult(null);
      setRefreshLogsByEmail((prev) => ({
        ...prev,
        [email]: [t('settings.accountPool.refreshLog.starting')],
      }));
      void refreshAccountUsageRef
        .current(email)
        .then((result) => {
          setPool(result.accounts as PoolEntry[]);
          setRefreshLogsByEmail((prev) => ({
            ...prev,
            [email]: result.logs,
          }));
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          setRefreshLogsByEmail((prev) => ({
            ...prev,
            [email]: [
              t('settings.accountPool.refreshLog.failed').replace(
                '{message}',
                message,
              ),
            ],
          }));
        })
        .finally(() => setRefreshingEmail(null));
    },
    [t],
  );

  const handleCleanupInvalid = () => {
    if (cleaning) return;
    setCleanupConfirmOpen(false);
    setCleaning(true);
    setSwitchResult(null);
    void cleanupInvalidRef
      .current()
      .then((result) => {
        setPool(result.accounts as PoolEntry[]);
        setSwitchResult({ removed: result.removed });
      })
      .finally(() => setCleaning(false));
  };

  const handleExport = () => {
    if (transferring === 'export') return;
    setTransferring('export');
    setSwitchResult(null);
    setTransferResult(null);
    void exportRef
      .current()
      .then((payload) => {
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download =
          'stagewise-account-pool-' +
          new Date().toISOString().replace(/[:.]/g, '-') +
          '.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setTransferResult({
          kind: 'export',
          count: payload.accounts.length,
        });
      })
      .catch((err) => {
        setTransferResult({
          kind: 'export',
          count: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => setTransferring(null));
  };

  const handleImportClick = () => {
    if (transferring === 'import') return;
    importInputRef.current?.click();
  };

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setTransferring('import');
    setSwitchResult(null);
    setTransferResult(null);
    void file
      .text()
      .then((text) => importRef.current(text))
      .then((result) => {
        setPool(result.accounts as PoolEntry[]);
        setTransferResult({
          kind: 'import',
          imported: result.imported,
          updated: result.updated,
          skipped: result.skipped,
        });
      })
      .catch((err) => {
        setTransferResult({
          kind: 'import',
          imported: 0,
          updated: 0,
          skipped: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => setTransferring(null));
  };

  const handleRemove = useCallback((email: string) => {
    setActionEmail(email);
    void removeRef
      .current(email)
      .then(() => setPool((prev) => prev.filter((e) => e.email !== email)))
      .finally(() => setActionEmail(null));
  }, []);

  const handleSwitch = useCallback((email: string) => {
    setActionEmail(email);
    setSwitchResult(null);
    void switchRef
      .current(email)
      .then((r) => {
        setSwitchResult(r as { email?: string; error?: string });
        if (!r.error) {
          void getRef
            .current()
            .then((entries) => setPool(entries as PoolEntry[]));
        }
      })
      .finally(() => setActionEmail(null));
  }, []);

  const clearRefreshLogs = useCallback((email: string) => {
    setRefreshLogsByEmail((prev) => {
      const next = { ...prev };
      delete next[email];
      return next;
    });
  }, []);

  async function getCaptchaToken(): Promise<string | undefined> {
    if (!turnstileEnabled) return undefined;
    if (turnstileSolverMode) return (await solveTurnstileToken()) ?? undefined;
    return turnstileToken ?? undefined;
  }

  const startTask = async () => {
    setStarting(true);
    try {
      const cfg = normalizeAutoRegisterConfig(
        await loadAutoRegisterConfigRef.current(),
      );
      if (!isAutoRegisterConfigReady(cfg)) {
        failAccountPoolBatchTask(t('settings.accountPool.error.configMissing'));
        return;
      }
      const captchaProvider = cfg.captchaProvider || 'browser-ui-flow';
      // 前端可选性预取 token：拿不到也不阻断，
      // 后端会根据 cfg.captchaProvider 自行获取 / 交给系统浏览器。
      let captchaToken: string | undefined;
      try {
        if (captchaProvider !== 'browser-ui-flow') {
          captchaToken = await getCaptchaToken();
        }
      } catch {
        captchaToken = undefined;
      }
      // 进入启动流程后立即关闭弹窗，任务面板会接管展示。
      setShowTaskModal(false);
      await startAccountPoolBatchTask(
        {
          cfg: { ...cfg, captchaProvider },
          total: taskTotal,
          intervalMs: taskInterval,
          captchaToken,
        },
        {
          autoRegisterBatch: batchRef.current,
          getBatchTaskStatus,
          cancelBatchTask,
        },
      );
      resetTurnstile();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failAccountPoolBatchTask(
        t('settings.accountPool.error.startFailed') + msg,
      );
    } finally {
      setStarting(false);
    }
  };

  const cancelTask = async () => {
    await cancelAccountPoolBatchTask();
  };

  const [copiedLogs, setCopiedLogs] = useState(false);
  const copyLogs = async () => {
    if (!task?.logs?.length) return;
    const text = task.logs.join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: try the legacy execCommand path inside a temporary textarea.
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        // best-effort
      }
    }
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 1500);
  };

  const dismissTask = () => {
    dismissAccountPoolBatchTask();
  };

  const overview = useMemo(() => getAccountPoolOverview(pool), [pool]);
  const healthCheckingEmailSet = useMemo(() => {
    if (healthTask?.status !== 'running') return null;
    return new Set(healthTask.activeEmails);
  }, [healthTask?.status, healthTask?.activeEmails]);
  const accountPoolListItems = useMemo<AccountPoolListItem[]>(
    () => [
      { kind: 'header' },
      ...pool.map((entry) => ({ kind: 'account' as const, entry })),
      { kind: 'footer' },
    ],
    [pool],
  );

  return (
    <div className="h-full w-full">
      <Virtuoso
        className="virtuoso-contain h-full"
        data={accountPoolListItems}
        computeItemKey={(_, item) =>
          item.kind === 'account' ? item.entry.email : item.kind
        }
        increaseViewportBy={{ top: 250, bottom: 350 }}
        itemContent={(_, item) => {
          if (item.kind === 'header') {
            return (
              <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-8 px-6 pt-24 pb-8">
                <div className="min-w-0">
                  <h1 className="font-semibold text-foreground text-xl">
                    {t('settings.accountPool.title')}
                  </h1>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {t('settings.accountPool.description')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl bg-background p-3 shadow-elevation-1 ring-1 ring-border-subtle sm:grid-cols-3 lg:grid-cols-7 dark:bg-surface-1">
                  {[
                    {
                      label: t('settings.accountPool.overview.total'),
                      value: overview.total,
                      className: 'text-foreground',
                    },
                    {
                      label: t('settings.accountPool.overview.available'),
                      value: overview.available,
                      className: 'text-success-foreground',
                    },
                    {
                      label: t('settings.accountPool.overview.dailyLimit'),
                      value: overview.dailyLimited,
                      className: 'text-warning-foreground',
                    },
                    {
                      label: t('settings.accountPool.overview.weeklyLimit'),
                      value: overview.weeklyLimited,
                      className: 'text-warning-foreground',
                    },
                    {
                      label: t('settings.accountPool.overview.monthlyLimit'),
                      value: overview.monthlyLimited,
                      className: 'text-warning-foreground',
                    },
                    {
                      label: t('settings.accountPool.overview.observing'),
                      value: overview.observing,
                      className: 'text-warning-foreground',
                    },
                    {
                      label: t('settings.accountPool.overview.banned'),
                      value: overview.banned,
                      className: 'text-error-foreground',
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg bg-surface-1 px-3 py-2 ring-1 ring-border-subtle dark:bg-surface-2"
                    >
                      <div className="text-muted-foreground text-xs">
                        {item.label}
                      </div>
                      <div
                        className={cn(
                          'mt-1 font-semibold text-xl tabular-nums',
                          item.className,
                        )}
                      >
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 rounded-xl bg-background p-3 shadow-elevation-1 ring-1 ring-border-subtle sm:flex-row sm:items-center sm:justify-between dark:bg-surface-1">
                  <div className="min-w-0">
                    <label
                      htmlFor="account-pool-auto-switch-max-attempts"
                      className="font-medium text-foreground text-sm"
                    >
                      {t('settings.accountPool.autoSwitchRetry.title')}
                    </label>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {t('settings.accountPool.autoSwitchRetry.description')}
                    </p>
                  </div>
                  <Input
                    id="account-pool-auto-switch-max-attempts"
                    type="number"
                    min={1}
                    size="sm"
                    className="w-28 shrink-0"
                    value={String(autoSwitchMaxAttempts)}
                    onValueChange={updateAutoSwitchMaxAttempts}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-background p-3 shadow-elevation-1 ring-1 ring-border-subtle dark:bg-surface-1">
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0 whitespace-nowrap"
                    disabled={transferring === 'import'}
                    onClick={handleImportClick}
                  >
                    <DownloadIcon className="size-3.5" />
                    {transferring === 'import'
                      ? t('settings.accountPool.importing')
                      : t('settings.accountPool.import')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0 whitespace-nowrap"
                    disabled={pool.length === 0 || transferring === 'export'}
                    onClick={handleExport}
                  >
                    <UploadIcon className="size-3.5" />
                    {transferring === 'export'
                      ? t('settings.accountPool.exporting')
                      : t('settings.accountPool.export')}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0 whitespace-nowrap"
                    disabled={
                      starting || (task !== null && task.status === 'running')
                    }
                    onClick={() => setShowTaskModal(true)}
                  >
                    <ZapIcon className="size-3.5" />
                    {task !== null && task.status === 'running'
                      ? t('settings.accountPool.startAutoRunning')
                      : t('settings.accountPool.startAuto')}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="shrink-0 whitespace-nowrap"
                    disabled={
                      healthTask?.status === 'running' || pool.length === 0
                    }
                    onClick={handleCheckHealth}
                  >
                    {healthTask?.status === 'running'
                      ? t('settings.accountPool.checking')
                      : t('settings.accountPool.healthCheck')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0 whitespace-nowrap"
                    disabled={cleaning || pool.length === 0}
                    onClick={() => setCleanupConfirmOpen(true)}
                  >
                    {cleaning
                      ? t('settings.accountPool.cleaning')
                      : t('settings.accountPool.cleanup')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 whitespace-nowrap"
                    disabled={loading}
                    onClick={refresh}
                  >
                    <RefreshCwIcon className="size-3.5" />
                    {loading
                      ? t('settings.accountPool.refreshing')
                      : t('settings.accountPool.refresh')}
                  </Button>
                </div>

                {switchResult?.error && (
                  <p className="text-error-foreground text-xs">
                    {t('settings.accountPool.switchFailed')}
                    {switchResult.error}
                  </p>
                )}
                {switchResult?.email && !switchResult.error && (
                  <p className="text-success-foreground text-xs">
                    {t('settings.accountPool.switchedTo')}
                    {switchResult.email}
                  </p>
                )}
                {switchResult?.removed !== undefined && !switchResult.error && (
                  <p className="text-success-foreground text-xs">
                    {t('settings.accountPool.cleanupResult').replace(
                      '{count}',
                      String(switchResult.removed),
                    )}
                  </p>
                )}
                {transferResult?.error && (
                  <p className="text-error-foreground text-xs">
                    {t('settings.accountPool.transferFailed')}
                    {transferResult.error}
                  </p>
                )}
                {transferResult?.kind === 'export' && !transferResult.error && (
                  <p className="text-success-foreground text-xs">
                    {t('settings.accountPool.exportSuccess').replace(
                      '{count}',
                      String(transferResult.count),
                    )}
                  </p>
                )}
                {transferResult?.kind === 'import' && !transferResult.error && (
                  <p className="text-success-foreground text-xs">
                    {t('settings.accountPool.importSuccess')
                      .replace('{imported}', String(transferResult.imported))
                      .replace('{updated}', String(transferResult.updated))
                      .replace('{skipped}', String(transferResult.skipped))}
                  </p>
                )}

                {healthTask && (
                  <div className="flex flex-col gap-3 rounded-xl bg-background p-4 shadow-elevation-1 ring-1 ring-border-subtle dark:bg-surface-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-medium text-foreground text-sm">
                        {t('settings.accountPool.healthTask.title')}
                      </h3>
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 font-medium text-xs ring-1',
                            healthTask.status === 'running' &&
                              'bg-info-background text-info-foreground ring-info-solid/20',
                            healthTask.status === 'completed' &&
                              'bg-success-background text-success-foreground ring-success-solid/20',
                            healthTask.status === 'error' &&
                              'bg-error-background text-error-foreground ring-error-solid/20',
                          )}
                        >
                          {healthTask.status === 'running' && (
                            <span className="mr-1.5 size-1.5 shrink-0 animate-pulse-full rounded-full bg-info-solid" />
                          )}
                          {healthTask.status === 'running'
                            ? t('settings.accountPool.healthTask.running')
                            : healthTask.status === 'completed'
                              ? t('settings.accountPool.healthTask.completed')
                              : t('settings.accountPool.healthTask.error')}
                        </span>
                        {healthTask.status !== 'running' && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setHealthTask(null)}
                          >
                            {t('settings.accountPool.batchTask.close')}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-muted-foreground text-xs">
                      <span>
                        {t('settings.accountPool.healthTask.progress')}:{' '}
                        <span className="font-medium text-foreground tabular-nums">
                          {healthTask.done}
                        </span>
                        {' / '}
                        <span className="tabular-nums">{healthTask.total}</span>
                      </span>
                      {healthTask.failed > 0 && (
                        <span className="text-error-foreground">
                          {t('settings.accountPool.healthTask.failed')}:{' '}
                          <span className="font-medium tabular-nums">
                            {healthTask.failed}
                          </span>
                        </span>
                      )}
                      {healthTask.skipped > 0 && (
                        <span className="text-warning-foreground">
                          {t('settings.accountPool.healthTask.skipped')}:{' '}
                          <span className="font-medium tabular-nums">
                            {healthTask.skipped}
                          </span>
                        </span>
                      )}
                    </div>
                    {healthTask.activeEmails.length > 0 && (
                      <p className="break-all text-muted-foreground text-xs">
                        {t('settings.accountPool.healthTask.active')}
                        {healthTask.activeEmails.join(', ')}
                      </p>
                    )}
                    <div
                      ref={healthLogsContainerRef}
                      className="max-h-36 overflow-auto rounded-md bg-surface-2 p-2 font-mono text-xs ring-1 ring-border-subtle"
                    >
                      {healthTask.logs.map((line, i) => (
                        <div
                          key={i}
                          className={cn(
                            'whitespace-pre-wrap break-words',
                            getLogLineClassName(line),
                          )}
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {task && (
                  <div className="flex flex-col gap-3 rounded-xl bg-background p-4 shadow-elevation-1 ring-1 ring-border-subtle dark:bg-surface-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-foreground text-sm">
                        {t('settings.accountPool.batchTask.title')}
                      </h3>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => void copyLogs()}
                        >
                          {copiedLogs
                            ? t('settings.accountPool.batchTask.copied')
                            : t('settings.accountPool.batchTask.copy')}
                        </Button>
                        {task.status === 'running' ? (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => void cancelTask()}
                          >
                            {t('settings.accountPool.batchTask.cancel')}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={dismissTask}
                          >
                            {t('settings.accountPool.batchTask.close')}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground text-xs">
                      <span>
                        {t('settings.accountPool.batchTask.progress')}:{' '}
                        <span className="font-medium text-foreground tabular-nums">
                          {task.done}
                        </span>
                        {' / '}
                        <span className="tabular-nums">{task.total}</span>
                      </span>
                      <span>
                        {t('settings.accountPool.batchTask.success')}:{' '}
                        <span className="font-medium text-success-foreground tabular-nums">
                          {task.done}
                        </span>
                      </span>
                      {task.failed > 0 && (
                        <span className="text-error-foreground">
                          {t('settings.accountPool.batchTask.failed')}:{' '}
                          <span className="font-medium tabular-nums">
                            {task.failed}
                          </span>
                        </span>
                      )}
                      <span
                        className={cn(
                          'font-medium',
                          task.status === 'running' && 'text-info-foreground',
                          task.status === 'completed' &&
                            'text-success-foreground',
                          task.status === 'error' && 'text-error-foreground',
                          task.status === 'cancelled' &&
                            'text-warning-foreground',
                        )}
                      >
                        {task.status === 'running' && (
                          <span className="mr-1.5 inline-block size-1.5 animate-pulse-full rounded-full bg-info-solid align-middle" />
                        )}
                        {task.status === 'running'
                          ? t('settings.accountPool.batchTask.statusRunning')
                          : task.status === 'completed'
                            ? t(
                                'settings.accountPool.batchTask.statusCompleted',
                              )
                            : task.status === 'cancelled'
                              ? t(
                                  'settings.accountPool.batchTask.statusCancelled',
                                )
                              : t('settings.accountPool.batchTask.statusError')}
                      </span>
                    </div>
                    <div
                      ref={logsContainerRef}
                      className="max-h-48 overflow-auto rounded-md bg-surface-2 p-2 font-mono text-xs ring-1 ring-border-subtle"
                    >
                      {task.logs.map((line, i) => (
                        <div
                          key={i}
                          className={cn(
                            'whitespace-pre-wrap break-words',
                            getLogLineClassName(line),
                          )}
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {loading && (
                  <p className="rounded-xl bg-background px-4 py-3 text-muted-foreground text-sm shadow-elevation-1 ring-1 ring-border-subtle dark:bg-surface-1">
                    {t('settings.accountPool.loading')}
                  </p>
                )}

                {pool.length === 0 && !loading && (
                  <p className="text-muted-foreground text-sm">
                    {t('settings.accountPool.empty')}
                  </p>
                )}
              </div>
            );
          }
          if (item.kind === 'footer') return <div className="h-24" />;
          const { entry } = item;
          return (
            <div className="mx-auto w-full max-w-3xl px-6">
              <AccountPoolRow
                entry={entry}
                currentEmailLower={currentEmailLower}
                actionEmail={actionEmail}
                refreshingEmail={refreshingEmail}
                refreshLogs={
                  refreshLogsByEmail[entry.email] ?? EMPTY_REFRESH_LOGS
                }
                isHealthChecking={
                  healthCheckingEmailSet?.has(entry.email) ?? false
                }
                onRefresh={handleRefreshOne}
                onSwitch={handleSwitch}
                onRemove={handleRemove}
                onClearRefreshLogs={clearRefreshLogs}
              />
            </div>
          );
        }}
      />

      <Dialog open={cleanupConfirmOpen} onOpenChange={setCleanupConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogClose />
          <DialogHeader>
            <DialogTitle>
              {t('settings.accountPool.cleanupConfirm.title')}
            </DialogTitle>
            <DialogDescription>
              {t('settings.accountPool.cleanupConfirm.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={cleaning}
              onClick={() => setCleanupConfirmOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={cleaning}
              onClick={handleCleanupInvalid}
            >
              {t('settings.accountPool.cleanupConfirm.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showTaskModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"
          onClick={() => setShowTaskModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-elevation-2 dark:bg-surface-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-foreground text-lg">
                {t('settings.accountPool.startAuto')}
              </h2>
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <p className="mb-4 text-muted-foreground text-sm">
              {t('settings.accountPool.modal.description')}
            </p>
            <div ref={turnstileRef} className="mb-4 empty:hidden" />
            <div className="mb-4 flex flex-col gap-3">
              <div className="grid grid-cols-[120px_1fr] items-center gap-x-3">
                <span className="text-muted-foreground text-sm">
                  {t('settings.accountPool.modal.count')}
                </span>
                <input
                  type="number"
                  min={1}
                  className="h-8 rounded-md border border-border bg-background px-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary-solid dark:bg-surface-2"
                  value={taskTotal}
                  onChange={(e) =>
                    setTaskTotal(Math.max(1, Number(e.target.value)))
                  }
                />
              </div>
              <div className="grid grid-cols-[120px_1fr] items-center gap-x-3">
                <span className="text-muted-foreground text-sm">
                  {t('settings.accountPool.modal.interval')}
                </span>
                <input
                  type="number"
                  min={0}
                  className="h-8 rounded-md border border-border bg-background px-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary-solid dark:bg-surface-2"
                  value={taskInterval}
                  onChange={(e) =>
                    setTaskInterval(Math.max(0, Number(e.target.value)))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTaskModal(false)}
              >
                {t('settings.accountPool.batchTask.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={starting}
                onClick={() => void startTask()}
              >
                {starting
                  ? t('settings.accountPool.modal.starting')
                  : t('settings.accountPool.modal.start')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
