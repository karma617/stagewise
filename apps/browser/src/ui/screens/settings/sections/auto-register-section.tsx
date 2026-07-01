import { Button } from '@stagewise/stage-ui/components/button';
import { useKartonProcedure } from '@ui/hooks/use-karton';
import { useState, useRef, useEffect } from 'react';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import { useTurnstile } from '@ui/hooks/use-turnstile';
import { useI18n } from '@ui/hooks/use-i18n';
import {
  DEFAULT_AUTO_REGISTER_CONFIG,
  normalizeAutoRegisterConfig,
  type CaptchaProvider,
  type AutoRegisterConfig,
  type MailboxService,
} from './auto-register-config';

export function AutoRegisterSection() {
  const { t } = useI18n();
  const testMailboxConnection = useKartonProcedure(
    (p) => p.userAccount.testMailboxConnection,
  );
  const { containerRef: turnstileRef } = useTurnstile();

  const testRef = useRef(testMailboxConnection);
  testRef.current = testMailboxConnection;
  const saveAutoRegisterConfig = useKartonProcedure(
    (p) => p.userAccount.saveAutoRegisterConfig,
  );
  const loadAutoRegisterConfig = useKartonProcedure(
    (p) => p.userAccount.loadAutoRegisterConfig,
  );
  const saveConfigRef = useRef(saveAutoRegisterConfig);
  saveConfigRef.current = saveAutoRegisterConfig;
  const loadConfigRef = useRef(loadAutoRegisterConfig);
  loadConfigRef.current = loadAutoRegisterConfig;

  const [cfg, setCfg] = useState(DEFAULT_AUTO_REGISTER_CONFIG);

  // Load user-managed config from SQLite; source defaults remain non-sensitive.
  useEffect(() => {
    void loadConfigRef.current().then((dbConfig) => {
      if (dbConfig) {
        setCfg(normalizeAutoRegisterConfig(dbConfig));
      }
    });
  }, []);

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);
  const saveNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    accountCount?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (saveNoticeTimerRef.current) {
        clearTimeout(saveNoticeTimerRef.current);
      }
    };
  }, []);

  async function handleSaveConfig() {
    setSaving(true);
    setSaveResult(null);
    if (saveNoticeTimerRef.current) {
      clearTimeout(saveNoticeTimerRef.current);
      saveNoticeTimerRef.current = null;
    }
    try {
      await saveConfigRef.current(cfg as unknown as Record<string, unknown>);
      setSaveResult({ ok: true });
      saveNoticeTimerRef.current = setTimeout(() => {
        setSaveResult(null);
        saveNoticeTimerRef.current = null;
      }, 3000);
    } catch (err) {
      setSaveResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, key: keyof typeof cfg, type = 'text') {
    return (
      <div className="grid grid-cols-[160px_1fr] items-center gap-x-3">
        <span className="text-muted-foreground text-sm">{label}</span>
        <input
          type={type}
          className="h-7 rounded border border-border bg-surface-1 px-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary-solid"
          value={String(cfg[key])}
          onChange={(e) => {
            const val =
              type === 'number' ? Number(e.target.value) : e.target.value;
            setCfg((prev: typeof cfg) => ({ ...prev, [key]: val }));
          }}
        />
      </div>
    );
  }

  function serviceField(
    label: string,
    serviceKey: keyof AutoRegisterConfig['mailServices'],
    fieldKey: string,
    type = 'text',
  ) {
    const serviceCfg = cfg.mailServices[serviceKey] as Record<string, unknown>;
    return (
      <div className="grid grid-cols-[160px_1fr] items-center gap-x-3">
        <span className="text-muted-foreground text-sm">{label}</span>
        <input
          type={type}
          className="h-7 rounded border border-border bg-surface-1 px-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary-solid"
          value={String(serviceCfg[fieldKey] ?? '')}
          onChange={(e) => {
            const val =
              type === 'number' ? Number(e.target.value) : e.target.value;
            setCfg((prev: typeof cfg) => ({
              ...prev,
              mailServices: {
                ...prev.mailServices,
                [serviceKey]: {
                  ...prev.mailServices[serviceKey],
                  [fieldKey]: val,
                },
              },
            }));
          }}
        />
      </div>
    );
  }

  function serviceCheckbox(
    label: string,
    serviceKey: keyof AutoRegisterConfig['mailServices'],
    fieldKey: string,
  ) {
    const serviceCfg = cfg.mailServices[serviceKey] as Record<string, unknown>;
    return (
      <div className="grid grid-cols-[160px_1fr] items-center gap-x-3">
        <span className="text-muted-foreground text-sm">{label}</span>
        <input
          type="checkbox"
          className="size-4"
          checked={Boolean(serviceCfg[fieldKey])}
          onChange={(e) => {
            setCfg((prev: typeof cfg) => ({
              ...prev,
              mailServices: {
                ...prev.mailServices,
                [serviceKey]: {
                  ...prev.mailServices[serviceKey],
                  [fieldKey]: e.target.checked,
                },
              },
            }));
          }}
        />
      </div>
    );
  }

  function renderMailboxServiceFields() {
    if (cfg.mailboxService === 'cloudflare_temp_email') {
      return (
        <>
          {serviceField(
            t('settings.autoRegister.field.apiBase'),
            'cloudflareTempEmail',
            'apiBase',
          )}
          {serviceField(
            t('settings.autoRegister.field.adminPassword'),
            'cloudflareTempEmail',
            'adminPassword',
          )}
          {serviceField(
            t('settings.autoRegister.field.domain'),
            'cloudflareTempEmail',
            'domain',
          )}
        </>
      );
    }
    if (cfg.mailboxService === 'tempmail_lol') {
      return (
        <>
          {serviceField(
            t('settings.autoRegister.field.apiKeyOptional'),
            'tempmailLol',
            'apiKey',
          )}
          {serviceField(
            t('settings.autoRegister.field.domainOptional'),
            'tempmailLol',
            'domain',
          )}
        </>
      );
    }
    if (cfg.mailboxService === 'moemail') {
      return (
        <>
          {serviceField(
            t('settings.autoRegister.field.apiBase'),
            'moemail',
            'apiBase',
          )}
          {serviceField(
            t('settings.autoRegister.field.apiKey'),
            'moemail',
            'apiKey',
          )}
          {serviceField(
            t('settings.autoRegister.field.domain'),
            'moemail',
            'domain',
          )}
          {serviceField(
            t('settings.autoRegister.field.expiryTime'),
            'moemail',
            'expiryTime',
            'number',
          )}
        </>
      );
    }
    if (cfg.mailboxService === 'inbucket') {
      return (
        <>
          {serviceField(
            t('settings.autoRegister.field.apiBase'),
            'inbucket',
            'apiBase',
          )}
          {serviceField(
            t('settings.autoRegister.field.domain'),
            'inbucket',
            'domain',
          )}
          {serviceCheckbox(
            t('settings.autoRegister.field.randomSubdomain'),
            'inbucket',
            'randomSubdomain',
          )}
        </>
      );
    }
    if (cfg.mailboxService === 'duckmail') {
      return (
        <>
          {serviceField(
            t('settings.autoRegister.field.apiKey'),
            'duckmail',
            'apiKey',
          )}
          {serviceField(
            t('settings.autoRegister.field.defaultDomain'),
            'duckmail',
            'defaultDomain',
          )}
        </>
      );
    }
    return (
      <>
        {field(t('settings.autoRegister.field.apiUrl'), 'apiUrl')}
        {field(t('settings.autoRegister.field.apiKey'), 'apiKey')}
        {field(t('settings.autoRegister.field.adminPassword'), 'adminPassword')}
        {field(t('settings.autoRegister.field.groupId'), 'groupId')}
        {field(t('settings.autoRegister.field.tagIds'), 'tagIds')}
        {field(t('settings.autoRegister.field.emailFolder'), 'emailFolder')}
        {field(t('settings.autoRegister.field.emailTop'), 'emailTop', 'number')}
      </>
    );
  }

  return (
    <div className="h-full w-full">
      <OverlayScrollbar className="h-full" contentClassName="px-6 pt-24 pb-24">
        <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-8">
          <div>
            <h1 className="font-semibold text-foreground text-xl">
              {t('settings.autoRegister.title')}
            </h1>
            <p className="mt-1 text-muted-foreground text-sm">
              {t('settings.autoRegister.description')}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div ref={turnstileRef} className="empty:hidden" />
            <h3 className="font-medium text-foreground">
              {t('settings.autoRegister.section.mailbox')}
            </h3>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[160px_1fr] items-center gap-x-3">
                <span className="text-muted-foreground text-sm">
                  {t('settings.autoRegister.field.mailboxService')}
                </span>
                <select
                  className="h-7 rounded border border-border bg-surface-1 px-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary-solid"
                  value={cfg.mailboxService}
                  onChange={(e) => {
                    setCfg((prev: typeof cfg) => ({
                      ...prev,
                      mailboxService: e.target.value as MailboxService,
                    }));
                  }}
                >
                  <option value="outlook-manager-plus">
                    {t('settings.autoRegister.mailbox.outlookManagerPlus')}
                  </option>
                  <option value="cloudflare_temp_email">
                    cloudflare_temp_email
                  </option>
                  <option value="tempmail_lol">tempmail_lol</option>
                  <option value="moemail">moemail</option>
                  <option value="inbucket">inbucket_mail</option>
                  <option value="duckmail">duckmail</option>
                </select>
              </div>
              {renderMailboxServiceFields()}
              {field(
                t('settings.autoRegister.field.pollInterval'),
                'pollIntervalMs',
                'number',
              )}
            </div>

            <h3 className="mt-4 font-medium text-foreground">
              {t('settings.autoRegister.section.captcha')}
            </h3>
            <p className="text-muted-foreground text-xs">
              {t('settings.autoRegister.captcha.description')}
            </p>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[160px_1fr] items-center gap-x-3">
                <span className="text-muted-foreground text-sm">
                  {t('settings.autoRegister.captcha.label')}
                </span>
                <select
                  className="h-7 rounded border border-border bg-surface-1 px-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary-solid"
                  value={cfg.captchaProvider}
                  onChange={(e) => {
                    setCfg((prev: typeof cfg) => ({
                      ...prev,
                      captchaProvider: e.target.value as CaptchaProvider,
                    }));
                  }}
                >
                  <option value="console-handoff">
                    {t('settings.autoRegister.captcha.consoleHandoff')}
                  </option>
                  <option value="2captcha">
                    {t('settings.autoRegister.captcha.2captcha')}
                  </option>
                  <option value="capsolver">
                    {t('settings.autoRegister.captcha.capsolver')}
                  </option>
                  <option value="yescaptcha">
                    {t('settings.autoRegister.captcha.yescaptcha')}
                  </option>
                  <option value="browser-ui-flow">
                    {t('settings.autoRegister.captcha.browserUiFlow')}
                  </option>
                </select>
              </div>
              {(cfg.captchaProvider === '2captcha' ||
                cfg.captchaProvider === 'capsolver' ||
                cfg.captchaProvider === 'yescaptcha') && (
                <div className="grid grid-cols-[160px_1fr] items-center gap-x-3">
                  <span className="text-muted-foreground text-sm">
                    {t('settings.autoRegister.captcha.apiKey')}
                  </span>
                  <input
                    type="text"
                    className="h-7 rounded border border-border bg-surface-1 px-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary-solid"
                    value={
                      cfg.captchaApiKeys[
                        cfg.captchaProvider === '2captcha'
                          ? 'twocaptcha'
                          : cfg.captchaProvider === 'capsolver'
                            ? 'capsolver'
                            : 'yescaptcha'
                      ]
                    }
                    onChange={(e) => {
                      const key =
                        cfg.captchaProvider === '2captcha'
                          ? 'twocaptcha'
                          : cfg.captchaProvider === 'capsolver'
                            ? 'capsolver'
                            : 'yescaptcha';
                      setCfg((prev: typeof cfg) => ({
                        ...prev,
                        captchaApiKeys: {
                          ...prev.captchaApiKeys,
                          [key]: e.target.value,
                        },
                      }));
                    }}
                  />
                </div>
              )}
              {cfg.captchaProvider === 'console-handoff' && (
                <p className="text-muted-foreground text-xs">
                  {t('settings.autoRegister.captcha.consoleHandoffHint')}
                </p>
              )}
              {cfg.captchaProvider === 'browser-ui-flow' && (
                <p className="text-muted-foreground text-xs">
                  {t('settings.autoRegister.captcha.browserUiFlowHint')}
                </p>
              )}
            </div>

            {testResult && (
              <div
                className={
                  testResult.ok
                    ? 'text-green-600 text-xs dark:text-green-400'
                    : 'text-red-600 text-xs dark:text-red-400'
                }
              >
                {testResult.ok
                  ? t('settings.autoRegister.test.success').replace(
                      '{n}',
                      String(testResult.accountCount ?? 0),
                    )
                  : t('settings.autoRegister.test.fail').replace(
                      '{err}',
                      testResult.error ?? '',
                    )}
              </div>
            )}
            <div className="flex flex-wrap justify-start gap-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={testing}
                onClick={() => {
                  setTesting(true);
                  setTestResult(null);
                  void testRef
                    .current(cfg)
                    .then((r) => setTestResult(r))
                    .finally(() => setTesting(false));
                }}
              >
                {testing
                  ? t('settings.autoRegister.button.testing')
                  : t('settings.autoRegister.button.test')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={saving}
                onClick={() => void handleSaveConfig()}
              >
                {saving
                  ? t('settings.autoRegister.button.saving')
                  : t('settings.autoRegister.button.saveBack')}
              </Button>
            </div>
            {saveResult && (
              <div
                role="status"
                className={
                  saveResult.ok
                    ? 'text-success-foreground text-xs'
                    : 'text-error-foreground text-xs'
                }
              >
                {saveResult.ok
                  ? t('settings.autoRegister.save.success')
                  : t('settings.autoRegister.save.fail').replace(
                      '{err}',
                      saveResult.error ?? '',
                    )}
              </div>
            )}
          </div>
        </div>
      </OverlayScrollbar>
    </div>
  );
}
