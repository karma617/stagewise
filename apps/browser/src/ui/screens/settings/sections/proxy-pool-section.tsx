import { Button } from '@stagewise/stage-ui/components/button';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import { Switch } from '@stagewise/stage-ui/components/switch';
import { useKartonProcedure, useKartonState } from '@ui/hooks/use-karton';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@ui/hooks/use-i18n';
import {
  normalizeAutoRegisterConfig,
  type AutoRegisterConfig,
} from './auto-register-config';
import type { Patch } from 'immer';

type ProxyEntry = {
  id: string;
  url: string;
  region: string;
  successCount: number;
  failCount: number;
  isActive: boolean;
  lastChecked?: string;
};

function createId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizeProxyUrl(value: string): string {
  const proxy = value.trim();
  if (!proxy) return '';
  return proxy.includes('://') ? proxy : `http://${proxy}`;
}

function splitProxyLines(value: string): string[] {
  return value
    .split(/[\r\n,]+/)
    .map((item) => normalizeProxyUrl(item))
    .filter(Boolean);
}

function toProxyEntry(value: unknown, fallbackRegion = ''): ProxyEntry | null {
  if (typeof value === 'string') {
    const url = normalizeProxyUrl(value);
    if (!url) return null;
    return {
      id: createId(),
      url,
      region: fallbackRegion,
      successCount: 0,
      failCount: 0,
      isActive: true,
    };
  }

  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const url = normalizeProxyUrl(String(record.url ?? ''));
  if (!url) return null;
  return {
    id: String(record.id ?? createId()),
    url,
    region: String(record.region ?? fallbackRegion),
    successCount: Number(record.successCount ?? record.success_count ?? 0),
    failCount: Number(record.failCount ?? record.fail_count ?? 0),
    isActive: !!(record.isActive ?? record.is_active ?? true),
    lastChecked:
      typeof record.lastChecked === 'string'
        ? record.lastChecked
        : typeof record.last_checked === 'string'
          ? record.last_checked
          : undefined,
  };
}

function parseStoredProxyPool(value: string | null): ProxyEntry[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => toProxyEntry(item))
        .filter((item): item is ProxyEntry => Boolean(item));
    }
  } catch {}
  return splitProxyLines(value)
    .map((url) => toProxyEntry(url))
    .filter((item): item is ProxyEntry => Boolean(item));
}

export function ProxyPoolSection() {
  const { t } = useI18n();
  const llmUseProxyPool = useKartonState(
    (s) => s.preferences.agent.llmUseProxyPool,
  );
  const [proxies, setProxies] = useState<ProxyEntry[]>([]);
  const [newProxy, setNewProxy] = useState('');
  const [region, setRegion] = useState('');
  const [notice, setNotice] = useState('');
  const [testing, setTesting] = useState(false);
  const testProxyPoolProc = useKartonProcedure(
    (p) => p.userAccount.testProxyPool,
  );
  const saveAutoRegisterConfig = useKartonProcedure(
    (p) => p.userAccount.saveAutoRegisterConfig,
  );
  const loadAutoRegisterConfig = useKartonProcedure(
    (p) => p.userAccount.loadAutoRegisterConfig,
  );
  const updatePreferences = useKartonProcedure((p) => p.preferences.update);
  const saveConfigRef = useRef(saveAutoRegisterConfig);
  saveConfigRef.current = saveAutoRegisterConfig;
  const loadConfigRef = useRef(loadAutoRegisterConfig);
  loadConfigRef.current = loadAutoRegisterConfig;

  useEffect(() => {
    void loadConfigRef.current().then((config) => {
      const normalized = normalizeAutoRegisterConfig(config);
      setProxies(parseStoredProxyPool(normalized.proxyPool));
    });
  }, []);

  const totalSuccess = proxies.reduce(
    (sum, item) => sum + Number(item.successCount || 0),
    0,
  );
  const totalFail = proxies.reduce(
    (sum, item) => sum + Number(item.failCount || 0),
    0,
  );
  const activeCount = proxies.filter((item) => item.isActive).length;

  const setLlmUseProxyPool = (checked: boolean) => {
    const patches: Patch[] = [
      {
        op: 'replace',
        path: ['agent', 'llmUseProxyPool'],
        value: checked,
      },
    ];
    void updatePreferences(patches);
  };

  const showNotice = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 2000);
  };

  const persist = async (entries: ProxyEntry[], message: string) => {
    setProxies(entries);
    try {
      const config = normalizeAutoRegisterConfig(await loadConfigRef.current());
      const nextConfig: AutoRegisterConfig = {
        ...config,
        proxyPool: JSON.stringify(entries),
      };
      await saveConfigRef.current(
        nextConfig as unknown as Record<string, unknown>,
      );
      showNotice(message);
    } catch {
      showNotice(t('settings.proxyPool.notice.saveFailed'));
    }
  };

  const addProxies = () => {
    const urls = splitProxyLines(newProxy);
    if (urls.length === 0) return;

    const existingUrls = new Set(proxies.map((item) => item.url));
    const additions = urls
      .filter((url) => !existingUrls.has(url))
      .map((url) => ({
        id: createId(),
        url,
        region: region.trim(),
        successCount: 0,
        failCount: 0,
        isActive: true,
      }));

    if (additions.length === 0) {
      showNotice(t('settings.proxyPool.notice.duplicated'));
      return;
    }

    void persist(
      [...proxies, ...additions],
      t('settings.proxyPool.notice.added'),
    );
    setNewProxy('');
  };

  const toggleProxy = (id: string) => {
    void persist(
      proxies.map((item) =>
        item.id === id ? { ...item, isActive: !item.isActive } : item,
      ),
      t('settings.proxyPool.notice.updated'),
    );
  };

  const deleteProxy = (id: string) => {
    void persist(
      proxies.filter((item) => item.id !== id),
      t('settings.proxyPool.notice.deleted'),
    );
  };

  const runProxyTest = async () => {
    if (testing) return;
    if (proxies.length === 0) {
      showNotice(t('settings.proxyPool.notice.empty'));
      return;
    }
    setTesting(true);
    try {
      const targets = proxies.map((item) => item.url);
      const resp = await testProxyPoolProc(targets);
      const byUrl = new Map(
        resp.results.map((item) => [item.url, item] as const),
      );
      const now = new Date().toISOString();
      let okCount = 0;
      let failCount = 0;
      const next = proxies.map((item) => {
        const probe = byUrl.get(item.url);
        if (!probe) return item;
        if (probe.ok) okCount += 1;
        else failCount += 1;
        return {
          ...item,
          successCount: probe.ok
            ? Number(item.successCount || 0) + 1
            : Number(item.successCount || 0),
          failCount: probe.ok
            ? Number(item.failCount || 0)
            : Number(item.failCount || 0) + 1,
          lastChecked: now,
        };
      });
      await persist(
        next,
        t('settings.proxyPool.notice.testSummary')
          .replace('{ok}', String(okCount))
          .replace('{fail}', String(failCount)),
      );
    } catch (err) {
      showNotice(
        t('settings.proxyPool.notice.testFailed').replace(
          '{err}',
          err instanceof Error ? err.message : String(err),
        ),
      );
    } finally {
      setTesting(false);
    }
  };

  const metricCards = [
    { label: t('settings.proxyPool.metric.total'), value: proxies.length },
    { label: t('settings.proxyPool.metric.active'), value: activeCount },
    { label: t('settings.proxyPool.metric.success'), value: totalSuccess },
    { label: t('settings.proxyPool.metric.fail'), value: totalFail },
  ];

  return (
    <div className="h-full w-full">
      <OverlayScrollbar className="h-full" contentClassName="px-6 pt-24 pb-24">
        <div className="mx-auto flex w-full max-w-5xl shrink-0 flex-col gap-8">
          <div>
            <h1 className="font-semibold text-foreground text-xl">
              {t('settings.proxyPool.title')}
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              {t('settings.proxyPool.description')}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {metricCards.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-border bg-surface-1 px-4 py-3"
              >
                <div className="text-muted-foreground text-xs">
                  {item.label}
                </div>
                <div className="mt-1 font-semibold text-foreground text-xl">
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-1 p-4">
            <label className="min-w-0 flex-1" htmlFor="llm-use-proxy-pool">
              <h2 className="font-medium text-foreground text-sm">
                {t('settings.proxyPool.llmSwitch.title')}
              </h2>
              <p className="mt-1 text-muted-foreground text-xs">
                {t('settings.proxyPool.llmSwitch.description')}
              </p>
            </label>
            <Switch
              id="llm-use-proxy-pool"
              checked={llmUseProxyPool}
              onCheckedChange={setLlmUseProxyPool}
              size="xs"
              className="mt-1 shrink-0"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4">
              <div>
                <h2 className="font-medium text-foreground text-sm">
                  {t('settings.proxyPool.add.title')}
                </h2>
                <p className="mt-1 text-muted-foreground text-xs">
                  {t('settings.proxyPool.add.description')}
                </p>
              </div>
              <textarea
                className="min-h-40 resize-none rounded border border-border bg-background px-3 py-2 font-mono text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary-solid"
                placeholder={
                  'http://127.0.0.1:7890\nhttp://user:pass@host:port'
                }
                value={newProxy}
                onChange={(event) => setNewProxy(event.target.value)}
              />
              <input
                className="h-8 rounded border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary-solid"
                placeholder={t('settings.proxyPool.add.regionPlaceholder')}
                value={region}
                onChange={(event) => setRegion(event.target.value)}
              />
              <Button variant="primary" size="sm" onClick={addProxies}>
                {t('settings.proxyPool.add.submit')}
              </Button>
              {notice && (
                <div className="text-green-600 text-xs dark:text-green-400">
                  {notice}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-surface-1">
              <div className="flex items-center justify-between border-border border-b px-4 py-3">
                <span className="font-medium text-foreground text-sm">
                  {t('settings.proxyPool.list.title')}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={testing || proxies.length === 0}
                  onClick={runProxyTest}
                >
                  {testing
                    ? t('settings.proxyPool.list.testing')
                    : t('settings.proxyPool.list.test')}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-border border-b text-muted-foreground">
                      <th className="px-6 py-3 text-left">
                        {t('settings.proxyPool.table.url')}
                      </th>
                      <th className="px-6 py-3 text-left">
                        {t('settings.proxyPool.table.region')}
                      </th>
                      <th className="px-6 py-3 text-left">
                        {t('settings.proxyPool.table.successFail')}
                      </th>
                      <th className="px-6 py-3 text-left">
                        {t('settings.proxyPool.table.status')}
                      </th>
                      <th className="px-6 py-3 text-left">
                        {t('settings.proxyPool.table.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {proxies.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          {t('settings.proxyPool.notice.empty')}
                        </td>
                      </tr>
                    )}
                    {proxies.map((item) => (
                      <tr
                        key={item.id}
                        className="border-border/60 border-b last:border-b-0"
                      >
                        <td className="w-[480px] max-w-[600px] break-all px-6 py-3 font-mono text-foreground text-xs">
                          {item.url}
                        </td>
                        <td className="w-[100px] px-6 py-3 text-muted-foreground">
                          {item.region || '-'}
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-green-600 dark:text-green-400">
                            {item.successCount}
                          </span>
                          <span className="text-muted-foreground"> / </span>
                          <span className="text-red-600 dark:text-red-400">
                            {item.failCount}
                          </span>
                        </td>
                        <td className="w-[80px] px-6 py-3">
                          <span
                            className={
                              item.isActive
                                ? 'rounded-full bg-green-500/10 px-2 py-1 text-green-600 text-xs dark:text-green-400'
                                : 'rounded-full bg-red-500/10 px-2 py-1 text-red-600 text-xs dark:text-red-400'
                            }
                          >
                            {item.isActive
                              ? t('settings.proxyPool.status.enabled')
                              : t('settings.proxyPool.status.disabled')}
                          </span>
                        </td>
                        <td className="w-[140px] px-6 py-3">
                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleProxy(item.id)}
                            >
                              {item.isActive
                                ? t('settings.proxyPool.action.disable')
                                : t('settings.proxyPool.action.enable')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteProxy(item.id)}
                            >
                              {t('settings.proxyPool.action.delete')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </OverlayScrollbar>
    </div>
  );
}
