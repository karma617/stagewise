import type { KartonContract } from '@shared/karton-contracts/ui';
import type {
  CurrentUsageResponse,
  UsageHistoryResponse,
} from '@shared/karton-contracts/pages-api/types';
import type { KartonService } from '../karton';
import type { Logger } from '../logger';
import {
  AuthServerInterop,
  createBetterAuthClient,
  openSocialAuthInSystemBrowser,
  openEmailAuthInSystemBrowser,
  sendSilentEmailOtp,
  verifySilentEmailOtp,
  type BetterAuthClient,
} from './server-interop';
import type { SocialAuthProvider } from '@shared/karton-contracts/ui/shared-types';
import { ALL_CALLBACK_PROTOCOLS } from './callback-scheme';
import {
  createDevLoopbackAuthServer,
  type DevLoopbackAuthServer,
} from './dev-loopback-auth';
import type { NotificationService } from '../notification';
import type { IdentifierService } from '../identifier';
import { DisposableService } from '../disposable';
import { z } from 'zod';
import {
  readPersistedData,
  writePersistedData,
} from '../../utils/persisted-data';
import {
  validateApiKeys,
  type ApiKeysInput,
} from '../../utils/validate-api-keys';
import {
  MailboxPool,
  type ClaimedAccount,
  type MailboxPoolConfig,
} from './mailbox-pool';
import {
  loadPool,
  upsertAccount,
  exportAccountPool,
  importAccountPool,
  removeAccount,
  removeInvalidAccounts,
  findAvailableAccount,
  markAccountThrottled,
  markAccountBanned,
  markAccountNormal,
  getUsageLimitWindow,
  updateAccountUsage,
  type AccountEntry,
} from './account-pool';
import {
  buildRegistrationProxyCandidates,
  createRegistrationFingerprint,
  describeProxyCandidate,
  logRegistrationStep,
  resolveEffectiveProxyUrl,
  setRegistrationNetworkDebugger,
  testProxyPool,
} from './registration-network';
import type { RegistrationFingerprint } from './registration-network';
import { acquireCaptchaCredentials } from './captcha-headless';
import { runCamoufoxUiFlow } from './browser-ui-flow';
import {
  solveTurnstileToken,
  type CaptchaProviderId,
} from './captcha-providers';
import { dbSaveConfig, dbLoadConfig } from './account-data-sqlite';

const CREDENTIALS_KEY = 'auth-session' as const;

const credentialsSchema = z
  .object({
    token: z.string(),
    user: z
      .object({
        id: z.string(),
        email: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
  })
  .nullable();

type StoredCredentials = z.infer<typeof credentialsSchema>;

export type AuthState = KartonContract['state']['userAccount'];

type RegistrationCaptchaProvider = CaptchaProviderId | 'browser-ui-flow';

function normalizeRegistrationCaptchaProvider(
  value: unknown,
): RegistrationCaptchaProvider {
  if (
    value === '2captcha' ||
    value === 'capsolver' ||
    value === 'yescaptcha' ||
    value === 'console-handoff'
  ) {
    return value;
  }
  return 'browser-ui-flow';
}

const SESSION_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SOCIAL_AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class AuthService extends DisposableService {
  private readonly identifierService: IdentifierService;
  private readonly uiKarton: KartonService;
  private readonly notificationService: NotificationService;
  private readonly logger: Logger;

  private _credentials: StoredCredentials = null;
  private serverInterop: AuthServerInterop;
  private authClient: BetterAuthClient;

  private _refreshInterval: NodeJS.Timeout | null = null;
  private authChangeCallbacks: ((newAuthState: AuthState) => void)[] = [];
  // In-memory batch registration tasks keyed by task id.
  private batchTasks: Map<
    string,
    {
      status: 'running' | 'completed' | 'cancelled' | 'error';
      total: number;
      done: number;
      failed: number;
      logs: string[];
      emails: string[];
      error?: string;
      cancelRequested: boolean;
    }
  > = new Map();
  private poolHealthTasks: Map<
    string,
    {
      status: 'running' | 'completed' | 'error';
      total: number;
      done: number;
      failed: number;
      skipped: number;
      activeEmails: string[];
      logs: string[];
      logsByEmail: Record<string, string[]>;
      error?: string;
    }
  > = new Map();
  private pendingHandoffAuth: {
    resolve: (result: { error?: string }) => void;
    timeout: NodeJS.Timeout;
  } | null = null;
  private activeLoopbackAuthServer: DevLoopbackAuthServer | null = null;
  // Injected by main.ts: solves Turnstile via the UI renderer.
  private _solveTurnstile: (() => Promise<string | null>) | null = null;
  // Set to true when the user requests cancellation of an in-flight
  // single-account auto-registration. Checked between major steps.
  private _registrationAborted = false;
  // Optional listener that mirrors every pushRegistrationStep() call.
  // Used by the batch task runner to copy detailed steps into per-task logs
  // without disturbing the existing Karton state stream.
  private _stepListener: ((msg: string) => void) | null = null;

  private constructor(
    identifierService: IdentifierService,
    uiKarton: KartonService,
    notificationService: NotificationService,
    logger: Logger,
  ) {
    super();
    this.identifierService = identifierService;
    this.uiKarton = uiKarton;
    this.notificationService = notificationService;
    this.logger = logger;
    this.serverInterop = new AuthServerInterop(logger);
    this.authClient = createBetterAuthClient(
      () => this._credentials?.token ?? null,
      (token) => {
        this.persistCredentials({
          ...this._credentials,
          token,
        });
        this.logger.debug('[AuthService] Token captured/refreshed');
      },
    );
  }

  private persistCredentials(credentials: StoredCredentials): void {
    this._credentials = credentials;
    void writePersistedData(CREDENTIALS_KEY, credentialsSchema, credentials, {
      encrypt: true,
    });
  }

  private async initialize(): Promise<void> {
    const persisted = await readPersistedData(
      CREDENTIALS_KEY,
      credentialsSchema,
      null,
      { encrypt: true },
    );

    if (persisted?.token) {
      this._credentials = persisted;
      this.logger.debug(
        '[AuthService] Restored persisted credentials, validating session...',
      );

      await this.refreshSession();
    } else {
      this.updateAuthState((draft) => {
        draft.userAccount = {
          status: 'unauthenticated',
          machineId: this.identifierService.getMachineId(),
        };
      });
    }

    this._refreshInterval = setInterval(() => {
      if (this._credentials?.token) {
        void this.refreshSession();
      }
    }, SESSION_REFRESH_INTERVAL_MS);

    this.registerProcedureHandlers();

    // Wire registration-network tracing to the logger so every fetch in
    // the auto-register pipeline shows up in the dev terminal.
    setRegistrationNetworkDebugger((msg) => {
      this.logger.info('[reg-net] ' + msg);
    });

    this.logger.debug('[AuthService] Initialized');
  }

  private registerProcedureHandlers(): void {
    this.uiKarton.registerServerProcedureHandler(
      'userAccount.sendOtp',
      async (
        _callingClientId: string,
        email: string,
        turnstileToken: string,
      ) => {
        return this.sendOtp(email, turnstileToken);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.verifyOtp',
      async (_callingClientId: string, email: string, code: string) => {
        return this.verifyOtp(email, code);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.signInSocial',
      async (_callingClientId: string, provider: SocialAuthProvider) => {
        return this.signInSocial(provider);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.signInEmail',
      async (_callingClientId: string) => {
        return this.signInEmail();
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.cancelSignInEmail',
      async (_callingClientId: string) => {
        return this.cancelSignInEmail();
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.logout',
      async (_callingClientId: string) => {
        await this.logout();
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.refreshStatus',
      async (_callingClientId: string) => {
        await this.refreshSession();
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.validateApiKeys',
      async (_callingClientId: string, keys: ApiKeysInput) => {
        this.logger.debug('[AuthService] Validating API keys');
        return validateApiKeys(keys);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.autoRegister',
      async (
        _callingClientId: string,
        cfg: MailboxPoolConfig,
        captchaToken?: string,
      ) => {
        return this.autoRegisterNewAccount(cfg, captchaToken);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.testMailboxConnection',
      async (_callingClientId: string, cfg: MailboxPoolConfig) => {
        const pool = new MailboxPool(cfg);
        return pool.testConnection();
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.testProxyPool',
      async (_callingClientId: string, urls: string[]) => {
        return testProxyPool(urls);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.getAccountPool',
      async (_callingClientId) => {
        return loadPool();
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.exportAccountPool',
      async () => {
        return exportAccountPool();
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.importAccountPool',
      async (_callingClientId, rawJson) => {
        return importAccountPool(rawJson);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.saveAutoRegisterConfig',
      async (_callingClientId, config: Record<string, unknown>) => {
        await dbSaveConfig(config);
        return { ok: true };
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.loadAutoRegisterConfig',
      async () => {
        return dbLoadConfig();
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.checkPoolHealth',
      async (_callingClientId) => {
        return this.checkPoolHealth();
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.startPoolHealthCheck',
      async () => {
        return this.startPoolHealthCheck();
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.getPoolHealthCheckStatus',
      async (_callingClientId, taskId) => {
        return this.getPoolHealthCheckStatus(taskId);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.refreshPoolUsage',
      async (_callingClientId) => {
        return this.refreshPoolUsage();
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.refreshPoolAccountUsage',
      async (_callingClientId, email) => {
        return this.refreshPoolAccountUsage(email);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.cleanupInvalidPoolAccounts',
      async () => {
        return this.cleanupInvalidPoolAccounts();
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.removeFromPool',
      async (_callingClientId, email) => {
        await removeAccount(email);
        return { ok: true };
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.switchToAccount',
      async (_callingClientId, email) => {
        return this.switchToPoolAccount(email);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.switchToAvailablePoolAccount',
      async (_callingClientId, currentEmail, throttledResetsAt) => {
        return this.switchToAvailablePoolAccount(
          currentEmail,
          throttledResetsAt,
        );
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.autoSwitchOnQuotaExceeded',
      async (
        _callingClientId,
        cfg,
        currentEmail,
        throttledResetsAt,
        captchaToken,
      ) => {
        return this.autoSwitchOnQuotaExceeded(
          cfg,
          currentEmail,
          throttledResetsAt,
          captchaToken,
        );
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.autoRegisterBatch',
      async (_callingClientId, params) => {
        return this.startBatchTask(params);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.getBatchTaskStatus',
      async (_callingClientId, taskId) => {
        return this.getBatchTaskStatus(taskId);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.cancelBatchTask',
      async (_callingClientId, taskId) => {
        return this.cancelBatchTask(taskId);
      },
    );
  }

  public static async create(
    identifierService: IdentifierService,
    uiKarton: KartonService,
    notificationService: NotificationService,
    logger: Logger,
  ): Promise<AuthService> {
    const authService = new AuthService(
      identifierService,
      uiKarton,
      notificationService,
      logger,
    );
    await authService.initialize();
    return authService;
  }

  /**
   * Inject a Turnstile solver that delegates to the UI renderer.
   * When set, auto-registration uses this instead of the hidden-window
   * approach that Cloudflare Turnstile rejects in Electron webContents.
   */
  public setTurnstileSolver(fn: (() => Promise<string | null>) | null): void {
    this._solveTurnstile = fn;
  }

  protected async onTeardown(): Promise<void> {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }

    await this.cancelPendingHandoffAuth({
      error: 'Sign-in was cancelled.',
    });

    await this.disposeActiveLoopbackAuthServer();

    this.uiKarton.removeServerProcedureHandler('userAccount.sendOtp');
    this.uiKarton.removeServerProcedureHandler('userAccount.verifyOtp');
    this.uiKarton.removeServerProcedureHandler('userAccount.signInSocial');
    this.uiKarton.removeServerProcedureHandler('userAccount.signInEmail');
    this.uiKarton.removeServerProcedureHandler('userAccount.cancelSignInEmail');
    this.uiKarton.removeServerProcedureHandler('userAccount.logout');
    this.uiKarton.removeServerProcedureHandler('userAccount.refreshStatus');
    this.uiKarton.removeServerProcedureHandler('userAccount.validateApiKeys');
    this.uiKarton.removeServerProcedureHandler('userAccount.autoRegister');
    this.uiKarton.removeServerProcedureHandler(
      'userAccount.testMailboxConnection',
    );
    this.uiKarton.removeServerProcedureHandler('userAccount.testProxyPool');
    this.uiKarton.removeServerProcedureHandler('userAccount.getAccountPool');
    this.uiKarton.removeServerProcedureHandler('userAccount.exportAccountPool');
    this.uiKarton.removeServerProcedureHandler('userAccount.importAccountPool');
    this.uiKarton.removeServerProcedureHandler(
      'userAccount.saveAutoRegisterConfig',
    );
    this.uiKarton.removeServerProcedureHandler(
      'userAccount.loadAutoRegisterConfig',
    );
    this.uiKarton.removeServerProcedureHandler('userAccount.checkPoolHealth');
    this.uiKarton.removeServerProcedureHandler(
      'userAccount.startPoolHealthCheck',
    );
    this.uiKarton.removeServerProcedureHandler(
      'userAccount.getPoolHealthCheckStatus',
    );
    this.uiKarton.removeServerProcedureHandler('userAccount.refreshPoolUsage');
    this.uiKarton.removeServerProcedureHandler(
      'userAccount.refreshPoolAccountUsage',
    );
    this.uiKarton.removeServerProcedureHandler(
      'userAccount.cleanupInvalidPoolAccounts',
    );
    this.uiKarton.removeServerProcedureHandler('userAccount.removeFromPool');
    this.uiKarton.removeServerProcedureHandler('userAccount.switchToAccount');
    this.uiKarton.removeServerProcedureHandler(
      'userAccount.switchToAvailablePoolAccount',
    );
    this.uiKarton.removeServerProcedureHandler(
      'userAccount.autoSwitchOnQuotaExceeded',
    );
    this.uiKarton.removeServerProcedureHandler('userAccount.autoRegisterBatch');
    this.uiKarton.removeServerProcedureHandler(
      'userAccount.getBatchTaskStatus',
    );
    this.uiKarton.removeServerProcedureHandler('userAccount.cancelBatchTask');
    this.authChangeCallbacks = [];

    this.logger.debug('[AuthService] Teardown complete');
  }

  // ---------------------------------------------------------------------------
  // OTP flow
  // ---------------------------------------------------------------------------

  public async sendOtp(
    email: string,
    turnstileToken?: string,
  ): Promise<{ error?: string }> {
    try {
      const { error } = await this.authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
        fetchOptions: turnstileToken
          ? { headers: { 'x-captcha-response': turnstileToken } }
          : undefined,
      });
      if (error) {
        this.logger.error(`[AuthService] Failed to send OTP: ${error.message}`);
        return { error: error.message };
      }
      this.logger.debug(`[AuthService] OTP sent to ${email}`);
      return {};
    } catch (err) {
      this.logger.error(`[AuthService] Unexpected error sending OTP: ${err}`);
      return { error: 'An unexpected error occurred.' };
    }
  }

  public async verifyOtp(
    email: string,
    code: string,
  ): Promise<{ error?: string }> {
    try {
      const { data, error } = await this.authClient.signIn.emailOtp({
        email,
        otp: code,
      });

      if (error) {
        this.logger.error(
          `[AuthService] Failed to verify OTP: ${error.message}`,
        );
        return { error: error.message };
      }

      // The global onSuccess handler already persisted the token.
      // Now update auth state with the user info.
      const user = data?.user;
      this.updateAuthState((draft) => {
        draft.userAccount = {
          ...draft.userAccount,
          status: 'authenticated',
          machineId: this.identifierService.getMachineId(),
          user: user ? { id: user.id, email: user.email ?? '' } : undefined,
        };
      });

      const currentToken = this._credentials?.token;
      if (user && currentToken) {
        this.persistCredentials({
          ...this._credentials,
          token: currentToken,
          user: {
            id: user.id,
            email: user.email ?? undefined,
            name: user.name ?? undefined,
          },
        });
      }

      if (currentToken) {
        void this.fetchSubscription(currentToken);
      }

      this.logger.debug('[AuthService] Signed in via OTP');
      return {};
    } catch (err) {
      this.logger.error(`[AuthService] Unexpected error verifying OTP: ${err}`);
      return { error: 'An unexpected error occurred.' };
    }
  }

  private completePendingHandoffAuth(result: { error?: string }): void {
    if (!this.pendingHandoffAuth) return;
    clearTimeout(this.pendingHandoffAuth.timeout);
    const { resolve } = this.pendingHandoffAuth;
    this.pendingHandoffAuth = null;
    void this.disposeActiveLoopbackAuthServer();
    resolve(result);
  }

  private async cancelPendingHandoffAuth(result: {
    error?: string;
  }): Promise<void> {
    if (!this.pendingHandoffAuth) return;
    clearTimeout(this.pendingHandoffAuth.timeout);
    const { resolve } = this.pendingHandoffAuth;
    this.pendingHandoffAuth = null;
    await this.disposeActiveLoopbackAuthServer();
    resolve(result);
  }

  private async disposeActiveLoopbackAuthServer(): Promise<void> {
    const server = this.activeLoopbackAuthServer;
    if (!server) return;
    this.activeLoopbackAuthServer = null;
    await server.dispose();
  }

  public async handleAuthCallbackUrl(url: string): Promise<boolean> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }

    let activeLoopbackCallback: URL | null = null;
    if (this.activeLoopbackAuthServer) {
      try {
        activeLoopbackCallback = new URL(
          this.activeLoopbackAuthServer.callbackUrl,
        );
      } catch {
        activeLoopbackCallback = null;
      }
    }
    const isLoopbackCallback =
      !!activeLoopbackCallback &&
      parsed.protocol === activeLoopbackCallback.protocol &&
      parsed.host === activeLoopbackCallback.host &&
      parsed.pathname === activeLoopbackCallback.pathname;

    if (!ALL_CALLBACK_PROTOCOLS.has(parsed.protocol) && !isLoopbackCallback) {
      this.logger.warn(
        `[AuthService] Auth callback protocol mismatch: got ${parsed.protocol}, expected one of ${[...ALL_CALLBACK_PROTOCOLS].join(', ')}`,
      );
      return false;
    }

    const callbackPath = parsed.hostname
      ? `/${parsed.hostname}${parsed.pathname}`
      : parsed.pathname;
    const isAuthCallback =
      callbackPath === '/auth/callback' ||
      callbackPath.includes('/auth') ||
      parsed.searchParams.has('error') ||
      parsed.hash.startsWith('#token=');

    if (!isAuthCallback) {
      return false;
    }
    if (!this.pendingHandoffAuth) {
      return false;
    }
    const currentPending = this.pendingHandoffAuth;

    const fragmentParams = new URLSearchParams(parsed.hash.slice(1));
    const callbackError =
      parsed.searchParams.get('error_description') ??
      parsed.searchParams.get('error') ??
      fragmentParams.get('error_description') ??
      fragmentParams.get('error');

    if (callbackError) {
      this.logger.error(
        `[AuthService] Social sign-in failed: ${callbackError}`,
      );
      this.completePendingHandoffAuth({ error: callbackError });
      return true;
    }

    const token =
      fragmentParams.get('token') ?? parsed.searchParams.get('token');

    if (!token) {
      const message = 'Sign-in callback did not include a token.';
      this.logger.error(`[AuthService] ${message}`);
      this.completePendingHandoffAuth({ error: message });
      return true;
    }

    try {
      const { data, error } = await this.authClient.authenticate({ token });
      if (this.pendingHandoffAuth !== currentPending) {
        this.logger.debug(
          '[AuthService] Ignoring stale sign-in callback after authentication',
        );
        return true;
      }
      if (error || !data?.token) {
        const message = error?.message ?? 'Sign-in failed.';
        this.logger.error(`[AuthService] Sign-in failed: ${message}`);
        if (this.pendingHandoffAuth !== currentPending) {
          this.logger.debug(
            '[AuthService] Ignoring stale sign-in failure after authentication',
          );
          return true;
        }
        this.completePendingHandoffAuth({ error: message });
        return true;
      }

      this.persistCredentials({
        token: data.token,
        user: {
          id: data.user.id,
          email: data.user.email ?? undefined,
          name: data.user.name ?? undefined,
        },
      });

      this.updateAuthState((draft) => {
        draft.userAccount = {
          ...draft.userAccount,
          status: 'authenticated',
          machineId: this.identifierService.getMachineId(),
          user: { id: data.user.id, email: data.user.email ?? '' },
        };
      });

      this.logger.debug('[AuthService] Completed sign-in callback');
      this.completePendingHandoffAuth({});
      void this.refreshSession().catch((refreshError) => {
        this.logger.warn(
          `[AuthService] Session refresh after sign-in failed: ${refreshError}`,
        );
      });
      return true;
    } catch (err) {
      this.logger.error(
        `[AuthService] Unexpected error handling auth callback: ${err}`,
      );
      if (this.pendingHandoffAuth !== currentPending) {
        this.logger.debug(
          '[AuthService] Ignoring stale sign-in error after callback failure',
        );
        return true;
      }
      this.completePendingHandoffAuth({
        error: 'Failed to complete sign-in.',
      });
      return true;
    }
  }

  public async signInSocial(
    provider: SocialAuthProvider,
  ): Promise<{ error?: string }> {
    if (this.pendingHandoffAuth) {
      this.logger.debug(
        '[AuthService] Cancelling previous sign-in before starting a new one',
      );
      await this.cancelPendingHandoffAuth({
        error: 'Sign-in was cancelled.',
      });
    }

    const completion = new Promise<{ error?: string }>((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingHandoffAuth = null;
        void this.disposeActiveLoopbackAuthServer();
        resolve({ error: 'Social sign-in timed out.' });
      }, SOCIAL_AUTH_TIMEOUT_MS);

      this.pendingHandoffAuth = { resolve, timeout };
    });

    try {
      this.logger.debug(`[AuthService] Starting social sign-in: ${provider}`);
      this.activeLoopbackAuthServer = await createDevLoopbackAuthServer(
        (callbackUrl) => this.handleAuthCallbackUrl(callbackUrl),
      );
      await openSocialAuthInSystemBrowser(
        provider,
        this.activeLoopbackAuthServer
          ? {
              kind: 'loopback',
              callbackUrl: this.activeLoopbackAuthServer.callbackUrl,
            }
          : undefined,
      );
      return await completion;
    } catch (err) {
      await this.disposeActiveLoopbackAuthServer();
      this.logger.error(
        `[AuthService] Unexpected error during social sign-in: ${err}`,
      );
      this.completePendingHandoffAuth({
        error: 'Failed to complete social sign-in.',
      });
      return await completion;
    }
  }

  // ---------------------------------------------------------------------------
  // Email sign-in via console (desktop handoff)
  // ---------------------------------------------------------------------------

  public async signInEmail(): Promise<{ error?: string }> {
    if (this.pendingHandoffAuth) {
      this.logger.debug(
        '[AuthService] Cancelling previous sign-in before starting email sign-in',
      );
      await this.cancelPendingHandoffAuth({
        error: 'Sign-in was cancelled.',
      });
    }

    const completion = new Promise<{ error?: string }>((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingHandoffAuth = null;
        resolve({ error: 'Email sign-in timed out.' });
      }, SOCIAL_AUTH_TIMEOUT_MS);

      this.pendingHandoffAuth = { resolve, timeout };
    });

    try {
      this.logger.debug('[AuthService] Starting email sign-in via console');
      await openEmailAuthInSystemBrowser();
      const result = await completion;
      return result;
    } catch (err) {
      this.logger.error(
        `[AuthService] Unexpected error during email sign-in: ${err}`,
      );
      this.completePendingHandoffAuth({
        error: 'Failed to open email sign-in.',
      });
      return await completion;
    }
  }

  public async cancelSignInEmail(): Promise<{ ok: boolean }> {
    this.logger.info('[AuthService] Cancelling sign-in / registration');
    this._registrationAborted = true;
    await this.cancelPendingHandoffAuth({
      error: 'Sign-in was cancelled by user.',
    });
    return { ok: true };
  }

  private checkRegistrationAborted(): void {
    if (this._registrationAborted) {
      throw new Error('Registration was cancelled by user.');
    }
  }

  private isRegistrationCancelledError(err: unknown): boolean {
    if (this._registrationAborted) return true;
    const message = err instanceof Error ? err.message : String(err);
    return /cancelled|canceled|aborted/i.test(message);
  }

  // ---------------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------------

  private async refreshSession(): Promise<void> {
    if (!this._credentials?.token) {
      this.updateAuthState((draft) => {
        draft.userAccount = {
          status: 'unauthenticated',
          machineId: this.identifierService.getMachineId(),
        };
      });
      return;
    }

    const tokenAtStart = this._credentials.token;
    try {
      const { data, error } = await this.authClient.getSession();
      if (this._credentials?.token !== tokenAtStart) {
        this.logger.debug(
          '[AuthService] Ignoring stale session refresh for previous token',
        );
        return;
      }

      if (error || !data) {
        this.logger.warn(
          `[AuthService] Session refresh failed: ${error?.message ?? 'no session'} (status: ${error?.status ?? 'unknown'})`,
        );
        // Only treat definitive auth rejections as unauthenticated.
        // 5xx, 429, or any other non-auth HTTP error means the server is
        // temporarily unavailable �?keep credentials intact.
        const isAuthRejection = error?.status === 401 || error?.status === 403;
        if (isAuthRejection) {
          if (this._credentials?.token === tokenAtStart) {
            this.persistCredentials(null);
          }
          this.updateAuthState((draft) => {
            draft.userAccount = {
              status: 'unauthenticated',
              machineId: this.identifierService.getMachineId(),
            };
          });
        } else {
          this.updateAuthState((draft) => {
            draft.userAccount.status = 'server_unreachable';
          });
        }
        return;
      }

      const user = data.user;
      const credentials = this._credentials;
      if (user && credentials && credentials.token === tokenAtStart) {
        this.persistCredentials({
          ...credentials,
          user: {
            id: user.id,
            email: user.email ?? undefined,
            name: user.name ?? undefined,
          },
        });
      }

      this.updateAuthState((draft) => {
        draft.userAccount = {
          ...draft.userAccount,
          status: 'authenticated',
          machineId: this.identifierService.getMachineId(),
          user: user
            ? { id: user.id, email: user.email ?? '' }
            : draft.userAccount.user,
        };
      });

      const token = this._credentials?.token;
      if (token) {
        void this.fetchSubscription(token);
      }
    } catch (err) {
      this.logger.error(`[AuthService] Failed to refresh session: ${err}`);
      this.updateAuthState((draft) => {
        draft.userAccount.status = 'server_unreachable';
      });
    }
  }

  private async fetchSubscription(accessToken: string): Promise<void> {
    const subscriptionData =
      await this.serverInterop.getSubscription(accessToken);

    if (subscriptionData) {
      this.updateAuthState((draft) => {
        draft.userAccount = {
          ...draft.userAccount,
          subscription: {
            active:
              subscriptionData.status === 'active' ||
              subscriptionData.status === 'trialing',
            plan: subscriptionData.plan || undefined,
            expiresAt: subscriptionData.currentPeriodEnd || undefined,
          },
        };
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  public async logout(): Promise<void> {
    try {
      await this.authClient.signOut();
    } catch {
      // Sign-out may fail if server is unreachable; we still clear local state.
    }

    this.persistCredentials(null);

    this.updateAuthState((draft) => {
      draft.userAccount = {
        status: 'unauthenticated',
        machineId: this.identifierService.getMachineId(),
      };
    });

    this.notificationService.showNotification({
      title: 'Logged out',
      message: 'You have been logged out of stagewise.',
      type: 'info',
      duration: 5000,
      actions: [],
    });

    this.logger.debug('[AuthService] Logged out');
  }

  public get authState(): AuthState {
    this.assertNotDisposed();
    return this.uiKarton.state.userAccount;
  }

  public get accessToken(): string | undefined {
    this.assertNotDisposed();
    return this._credentials?.token ?? undefined;
  }

  public async refreshAuthState(): Promise<AuthState> {
    await this.refreshSession();
    return this.authState;
  }

  public async getUsageCurrent(): Promise<CurrentUsageResponse> {
    const token = this.accessToken;
    if (!token) throw new Error('Not authenticated');
    return this.serverInterop.getUsageCurrent(token);
  }

  public async getUsageHistory(days?: number): Promise<UsageHistoryResponse> {
    const token = this.accessToken;
    if (!token) throw new Error('Not authenticated');
    return this.serverInterop.getUsageHistory(token, days);
  }

  // ---------------------------------------------------------------------------
  // State management
  // ---------------------------------------------------------------------------

  private updateAuthState(
    draft: Parameters<typeof this.uiKarton.setState>[0],
  ): void {
    const oldState = structuredClone(this.uiKarton.state.userAccount);
    this.uiKarton.setState(draft);
    const newState = this.uiKarton.state.userAccount;
    if (JSON.stringify(oldState) !== JSON.stringify(newState)) {
      for (const callback of this.authChangeCallbacks) {
        try {
          callback(newState);
        } catch {
          // NO-OP
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Auto-registration via mailbox pool
  // -------------------------------------------------------------------------

  /**
   * Switch to an existing account from the pool by email.
   * Requires the account to have a stored token.
   */
  public async switchToPoolAccount(
    email: string,
  ): Promise<{ error?: string; email?: string }> {
    const pool = await loadPool();
    const entry = pool.find((a) => a.email === email);
    if (!entry) {
      return { error: 'Account not found in pool' };
    }
    if (!entry.token) {
      // No token means we cannot restore this session; mark it banned so the
      // pool scheduler stops offering it and UI health checks reflect reality.
      await markAccountBanned(email);
      return { error: 'Account has no stored token, cannot switch' };
    }
    try {
      // Restore credentials using the stored token
      this.persistCredentials({
        token: entry.token,
        user: { id: email, email },
      });
      await this.refreshSession();

      // refreshSession flips status to 'unauthenticated' on 401/403 (token
      // rejected by server). Treat that as a dead account: ban it so we never
      // offer it again, then surface the failure to the caller / scheduler.
      const postStatus = this.uiKarton.state.userAccount.status;
      if (postStatus === 'unauthenticated') {
        await markAccountBanned(email);
        this.logger.warn(
          '[AuthService] Pool account token rejected (401/403), banned: ' +
            email,
        );
        return {
          error: 'Account token rejected by server, marked as banned',
          email,
        };
      }

      this.logger.info('[AuthService] Switched to pool account: ' + email);
      return { email };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }

  public async switchToAvailablePoolAccount(
    currentEmail?: string,
    throttledResetsAt?: string,
  ): Promise<{ error?: string; email?: string }> {
    if (currentEmail) {
      await markAccountThrottled(currentEmail, throttledResetsAt);
    }
    const skippedEmails = new Set<string>();
    let available: AccountEntry | null = null;
    while (
      (available = await findAvailableAccount({
        currentEmail,
        excludedEmails: skippedEmails,
      }))
    ) {
      if (!available.token) continue;
      skippedEmails.add(available.email);
      try {
        const usage = await this.serverInterop.getUsageCurrent(
          available.token,
        );
        await updateAccountUsage(available.email, usage);
        if (!getUsageLimitWindow(usage)) {
          break;
        }
      } catch (err) {
        if (this.isAuthRejectionError(err)) {
          await markAccountBanned(available.email);
          continue;
        }
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          '[AuthService] Failed to verify pool account usage before switch: ' +
            `${available.email}: ${message}`,
        );
        await updateAccountUsage(available.email, null);
        continue;
      }
    }
    if (!available?.token) {
      return {
        error:
          '\u5e10\u53f7\u6c60\u6ca1\u6709\u53ef\u7528\u5e10\u53f7\uff0c\u8bf7\u5148\u5728\u5e10\u53f7\u6c60\u6dfb\u52a0\u53ef\u7528\u5e10\u53f7\u3002',
      };
    }
    return this.switchToPoolAccount(available.email);
  }

  /**
   * Validate every pool account's token against the server without disturbing
   * the active session. Returns the refreshed pool so the UI can render updated
   * statuses. Used by the "health check" button in the account-pool section.
   * Also refreshes usage info for each healthy account.
   */
  public async checkPoolHealth(): Promise<AccountEntry[]> {
    const pool = await loadPool();
    await this.processPoolUsageRefresh(pool, 12);
    return loadPool();
  }

  public async startPoolHealthCheck(): Promise<{ taskId: string }> {
    const pool = await loadPool();
    const taskId =
      'pool-health-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 8);
    const task = {
      status: 'running' as const,
      total: pool.length,
      done: 0,
      failed: 0,
      skipped: 0,
      activeEmails: [] as string[],
      logsByEmail: {},
      logs: [
        `\u5065\u5eb7\u68c0\u6d4b\u5df2\u542f\u52a8\uff0c\u5171 ${pool.length} \u4e2a\u8d26\u53f7\uff0c\u5e76\u53d1 12`,
      ],
    };
    this.poolHealthTasks.set(taskId, task);
    void this.runPoolHealthCheckTask(taskId, pool);
    return { taskId };
  }

  private pushPoolHealthLog(taskId: string, message: string): void {
    const task = this.poolHealthTasks.get(taskId);
    if (!task) return;
    task.logs.push(message);
    if (task.logs.length > 300) {
      task.logs.splice(0, task.logs.length - 300);
    }
  }

  private pushPoolHealthAccountLog(
    taskId: string,
    email: string,
    message: string,
  ): void {
    const task = this.poolHealthTasks.get(taskId);
    if (!task) return;
    const logs = task.logsByEmail[email] ?? [];
    logs.push(message);
    if (logs.length > 80) {
      logs.splice(0, logs.length - 80);
    }
    task.logsByEmail[email] = logs;
  }

  private async runPoolHealthCheckTask(
    taskId: string,
    pool: AccountEntry[],
  ): Promise<void> {
    const task = this.poolHealthTasks.get(taskId);
    if (!task) return;
    const active = new Set<string>();
    const concurrency = Math.min(12, Math.max(1, pool.length));
    let cursor = 0;
    try {
      const workers = Array.from({ length: concurrency }, async () => {
        while (cursor < pool.length) {
          const idx = cursor++;
          const entry = pool[idx];
          if (!entry) continue;
          active.add(entry.email);
          task.activeEmails = Array.from(active);
          this.pushPoolHealthLog(
            taskId,
            `\u5f00\u59cb\u68c0\u6d4b\uff1a${entry.email}`,
          );
          try {
            this.pushPoolHealthAccountLog(
              taskId,
              entry.email,
              `请求：${entry.email} GET /v1/usage/current tokenLen=${entry.token?.length ?? 0}`,
            );
            if (!entry.token) {
              await markAccountBanned(entry.email);
              task.skipped++;
              this.pushPoolHealthAccountLog(
                taskId,
                entry.email,
                `错误：${entry.email} 没有 token，已标记为异常`,
              );
              this.pushPoolHealthLog(
                taskId,
                `\u8df3\u8fc7\uff1a${entry.email} \u6ca1\u6709 token\uff0c\u5df2\u6807\u8bb0\u4e3a\u5f02\u5e38`,
              );
              continue;
            }
            const usage = await this.serverInterop.getUsageCurrent(entry.token);
            await updateAccountUsage(entry.email, usage);
            this.pushPoolHealthAccountLog(
              taskId,
              entry.email,
              `成功：${entry.email} plan=${usage.plan} prepaid=${usage.prepaidBalance} windows=[${this.formatUsageWindows(usage)}]`,
            );
            this.pushPoolHealthLog(
              taskId,
              `\u5b8c\u6210\uff1a${entry.email} plan=${usage.plan} prepaid=${usage.prepaidBalance}`,
            );
          } catch (err) {
            task.failed++;
            const status = (err as Error & { status?: number })?.status;
            const message = err instanceof Error ? err.message : String(err);
            if (this.isAuthRejectionError(err)) {
              await markAccountBanned(entry.email);
              this.pushPoolHealthAccountLog(
                taskId,
                entry.email,
                `错误：${entry.email} token 被服务器拒绝 status=${status ?? 'unknown'} message=${message}，已标记为异常`,
              );
              this.pushPoolHealthLog(
                taskId,
                `\u5931\u6548\uff1a${entry.email} token \u88ab\u670d\u52a1\u5668\u62d2\u7edd\uff0c\u5df2\u6807\u8bb0\u4e3a\u5f02\u5e38`,
              );
            } else {
              this.pushPoolHealthAccountLog(
                taskId,
                entry.email,
                `错误：${entry.email} 额度接口请求失败 status=${status ?? 'unknown'} message=${message}`,
              );
              this.pushPoolHealthLog(
                taskId,
                `\u5931\u8d25\uff1a${entry.email} ${message}`,
              );
            }
          } finally {
            active.delete(entry.email);
            task.activeEmails = Array.from(active);
            task.done++;
          }
        }
      });
      await Promise.all(workers);
      task.status = 'completed';
      this.pushPoolHealthLog(
        taskId,
        `\u5065\u5eb7\u68c0\u6d4b\u5b8c\u6210\uff0c\u5df2\u5904\u7406 ${task.done} \u4e2a\uff0c\u5931\u8d25 ${task.failed} \u4e2a\uff0c\u8df3\u8fc7 ${task.skipped} \u4e2a`,
      );
    } catch (err) {
      task.status = 'error';
      task.error = err instanceof Error ? err.message : String(err);
      this.pushPoolHealthLog(
        taskId,
        `\u5065\u5eb7\u68c0\u6d4b\u5f02\u5e38\uff1a${task.error}`,
      );
    } finally {
      task.activeEmails = [];
    }
  }

  public async getPoolHealthCheckStatus(taskId: string): Promise<{
    taskId: string;
    status: 'running' | 'completed' | 'error';
    total: number;
    done: number;
    failed: number;
    skipped: number;
    activeEmails: string[];
    logs: string[];
    logsByEmail: Record<string, string[]>;
    accounts: AccountEntry[];
    error?: string;
  }> {
    const task = this.poolHealthTasks.get(taskId);
    if (!task) {
      return {
        taskId,
        status: 'error',
        total: 0,
        done: 0,
        failed: 0,
        skipped: 0,
        activeEmails: [],
        logs: [],
        logsByEmail: {},
        accounts: await loadPool(),
        error: 'Task not found',
      };
    }
    if (task.status !== 'running') {
      setTimeout(() => this.poolHealthTasks.delete(taskId), 60000);
    }
    return {
      taskId,
      status: task.status,
      total: task.total,
      done: task.done,
      failed: task.failed,
      skipped: task.skipped,
      activeEmails: [...task.activeEmails],
      logs: [...task.logs],
      logsByEmail: Object.fromEntries(
        Object.entries(task.logsByEmail).map(([email, logs]) => [
          email,
          [...logs],
        ]),
      ),
      accounts: await loadPool(),
      error: task.error,
    };
  }

  private isAuthRejectionError(err: unknown): boolean {
    const status = (err as Error & { status?: number })?.status;
    if (status === 401 || status === 403) return true;
    const message = err instanceof Error ? err.message : String(err);
    return /\b(401|403)\b/.test(message);
  }

  private formatUsageWindows(usage: CurrentUsageResponse): string {
    return usage.windows
      .map(
        (window) =>
          `${window.type}=${window.usedPercent}%${window.exceeded ? '(exceeded)' : ''}`,
      )
      .join(', ');
  }

  private async refreshOnePoolAccountUsage(
    entry: AccountEntry,
    logs?: string[],
  ): Promise<void> {
    const pushLog = (message: string) => {
      logs?.push(message);
    };
    pushLog(
      `请求：${entry.email} GET /v1/usage/current tokenLen=${entry.token?.length ?? 0}`,
    );
    if (!entry.token) {
      await markAccountBanned(entry.email);
      pushLog(`错误：${entry.email} 没有 token，已标记为异常`);
      return;
    }
    try {
      const usage = await this.serverInterop.getUsageCurrent(entry.token);
      await updateAccountUsage(entry.email, usage);
      pushLog(
        `成功：${entry.email} plan=${usage.plan} prepaid=${usage.prepaidBalance} windows=[${this.formatUsageWindows(usage)}]`,
      );
    } catch (err) {
      const status = (err as Error & { status?: number })?.status;
      const message = err instanceof Error ? err.message : String(err);
      if (this.isAuthRejectionError(err)) {
        await markAccountBanned(entry.email);
        pushLog(
          `错误：${entry.email} token 被服务器拒绝 status=${status ?? 'unknown'} message=${message}，已标记为异常`,
        );
      } else {
        pushLog(
          `错误：${entry.email} 额度接口请求失败 status=${status ?? 'unknown'} message=${message}`,
        );
      }
      // Network/5xx/rate-limit blips keep the previous snapshot/status.
    }
  }

  private async processPoolUsageRefresh(
    entries: AccountEntry[],
    concurrency: number,
  ): Promise<void> {
    let cursor = 0;
    const workers = Array.from(
      { length: Math.min(concurrency, entries.length) },
      async () => {
        while (cursor < entries.length) {
          const idx = cursor++;
          const entry = entries[idx];
          if (!entry || entry.status === 'banned') continue;
          await this.refreshOnePoolAccountUsage(entry);
        }
      },
    );
    await Promise.all(workers);
  }

  private async refreshPoolUsageForAutoSwitch(): Promise<string> {
    const usageCheckedAfter = new Date().toISOString();
    const pool = await loadPool();
    await this.processPoolUsageRefresh(pool, 16);
    return usageCheckedAfter;
  }

  public async refreshPoolAccountUsage(email: string): Promise<{
    accounts: AccountEntry[];
    logs: string[];
  }> {
    const logs: string[] = [];
    const pool = await loadPool();
    const entry = pool.find((e) => e.email === email);
    if (entry) {
      await this.refreshOnePoolAccountUsage(entry, logs);
    } else {
      logs.push(`错误：账号不存在 ${email}`);
    }
    return {
      accounts: await loadPool(),
      logs,
    };
  }

  /**
   * Fetch current usage for every healthy pool account.
   * Called by the UI when viewing the account pool to populate usage bars.
   */
  public async refreshPoolUsage(): Promise<AccountEntry[]> {
    const pool = await loadPool();
    await this.processPoolUsageRefresh(pool, 16);
    return loadPool();
  }

  public async cleanupInvalidPoolAccounts(): Promise<{
    removed: number;
    accounts: AccountEntry[];
  }> {
    const removed = await removeInvalidAccounts();
    return { removed, accounts: await loadPool() };
  }

  /**
   * On quota exceeded: find available pool account and switch, or register new one.
   */
  public async autoSwitchOnQuotaExceeded(
    cfg: MailboxPoolConfig,
    currentEmail?: string,
    throttledResetsAt?: string,
    captchaToken?: string,
  ): Promise<{
    error?: string;
    email?: string;
    action?: 'switched' | 'registered';
  }> {
    const switchResult = await this.switchToAvailablePoolAccount(
      currentEmail,
      throttledResetsAt,
    );
    if (!switchResult.error) {
      return { ...switchResult, action: 'switched' };
    }

    // No available account - register new one
    const result = await this.autoRegisterNewAccount(cfg, captchaToken);
    if (!result.error) {
      return { ...result, action: 'registered' };
    }
    return result;
  }

  /**
   * Register a fresh stagewise account using an email from the pool.
   * Flow: claimEmail -> silent console OTP -> pollOtp -> verify OTP token -> markRegistered
   * On success, adds the new account to the account pool.
   */
  /** Push a step entry into the UI Karton state so the auto-register UI can
   * show live progress. Also forwards to logRegistrationStep for file/log
   * traces. Keeps at most the last 200 entries.
   */
  private pushRegistrationStep(msg: string): void {
    logRegistrationStep(msg);
    if (this._stepListener) {
      try {
        this._stepListener(msg);
      } catch {
        // best-effort listener
      }
    }
    try {
      this.uiKarton.setState((draft) => {
        if (!draft.userAccount.registrationSteps) {
          draft.userAccount.registrationSteps = [];
        }
        draft.userAccount.registrationSteps.push({ ts: Date.now(), msg });
        if (draft.userAccount.registrationSteps.length > 200) {
          draft.userAccount.registrationSteps.splice(
            0,
            draft.userAccount.registrationSteps.length - 200,
          );
        }
      });
    } catch {
      // best-effort UI push
    }
  }

  private resetRegistrationProgress(running: boolean): void {
    try {
      this.uiKarton.setState((draft) => {
        draft.userAccount.registrationSteps = [];
        draft.userAccount.registrationRunning = running;
      });
    } catch {
      // best-effort
    }
  }

  private endRegistrationProgress(): void {
    try {
      this.uiKarton.setState((draft) => {
        draft.userAccount.registrationRunning = false;
      });
    } catch {
      // best-effort
    }
  }

  /**
   * Poll the mailbox for an OTP, verify it against stagewise, and retry up
   * to maxAttempts times when stagewise rejects the OTP (e.g. "Invalid OTP",
   * "expired"). Each retry re-uses the existing captcha token / visitorId /
   * fingerprint so we do not burn a fresh captcha solve on every attempt.
   *
   * On each retry we re-poll the mailbox using a moving sentAfter watermark
   * so we pick up a freshly-issued OTP email if stagewise resent one, while
   * still being willing to re-try the previously-seen code once in case the
   * first verify failed for a transient reason on the server side.
   */
  private async verifyOtpWithRetry(opts: {
    mailboxPool: MailboxPool;
    baseEmail: string;
    claimedEmail: string;
    captchaToken?: string;
    proxyUrl?: string;
    fingerprint: RegistrationFingerprint;
    visitorId?: string;
    sentAfterEpoch: number;
    pollTimeoutMs: number;
    onResendOtp?: () => Promise<void>;
    maxAttempts?: number;
  }): Promise<string> {
    const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
    let lastCode: string | null = null;
    let lastError: unknown = null;
    let watermark = opts.sentAfterEpoch;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      this.checkRegistrationAborted();
      this.pushRegistrationStep(
        '[verify] \u7b2c ' +
          attempt +
          ' / ' +
          maxAttempts +
          ' \u6b21\u5c1d\u8bd5\uff1a' +
          (attempt === 1
            ? '\u8f6e\u8be2\u90ae\u7bb1\u83b7\u53d6 OTP'
            : '\u91cd\u65b0\u8f6e\u8be2\u90ae\u7bb1\u83b7\u53d6\u65b0 OTP\uff08\u590d\u7528 captcha token\uff0c\u4e0d\u8c03\u7528 yescaptcha\uff09'),
      );
      let code: string;
      try {
        code = await opts.mailboxPool.pollOtp(opts.baseEmail, {
          sentAfterEpoch: watermark,
          timeoutMs: opts.pollTimeoutMs,
          onStep: (msg) => this.pushRegistrationStep(msg),
          shouldAbort: () => this._registrationAborted,
        });
      } catch (pollErr) {
        if (this.isRegistrationCancelledError(pollErr)) {
          throw pollErr;
        }
        lastError = pollErr;
        const pm = pollErr instanceof Error ? pollErr.message : String(pollErr);
        this.pushRegistrationStep(
          '[verify] \u90ae\u7bb1\u8f6e\u8be2\u5931\u8d25: ' + pm,
        );
        // If we already have a previously-extracted code from attempt 1, try
        // verifying it directly before giving up. Otherwise re-poll on next
        // attempt with the same watermark.
        if (!lastCode) {
          if (attempt >= maxAttempts) break;
          continue;
        }
        code = lastCode;
        this.pushRegistrationStep(
          '[verify] \u6539\u7528\u4e0a\u4e00\u8f6e\u63d0\u53d6\u5230\u7684 OTP \u91cd\u8bd5\u9a8c\u8bc1',
        );
      }
      lastCode = code;
      this.pushRegistrationStep(
        '[verify] \u63d0\u4ea4\u9a8c\u8bc1: email=' +
          opts.claimedEmail +
          ', otp=' +
          code.slice(0, 2) +
          '****' +
          code.slice(-1) +
          ' (\u957f\u5ea6 ' +
          code.length +
          ')',
      );
      try {
        this.checkRegistrationAborted();
        const token = await verifySilentEmailOtp(
          opts.claimedEmail,
          code,
          opts.captchaToken,
          opts.proxyUrl,
          opts.fingerprint,
          opts.visitorId,
        );
        this.pushRegistrationStep(
          '[verify] \u9a8c\u8bc1\u901a\u8fc7\uff0c\u5df2\u83b7\u53d6 session token (len=' +
            token.length +
            ')',
        );
        return token;
      } catch (err) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);
        this.pushRegistrationStep(
          '[verify] \u7b2c ' +
            attempt +
            ' \u6b21\u9a8c\u8bc1\u88ab stagewise \u62d2\u7edd: ' +
            message,
        );
        const lower = message.toLowerCase();
        const isOtpRateLimited =
          lower.includes('too many attempts') ||
          lower.includes('try again later') ||
          lower.includes('rate limit') ||
          lower.includes('429');
        if (isOtpRateLimited) {
          this.pushRegistrationStep(
            '[verify] OTP \u9a8c\u8bc1\u5df2\u88ab\u670d\u52a1\u7aef\u9650\u6d41\uff0c\u505c\u6b62\u91cd\u8bd5\uff0c\u907f\u514d\u7ee7\u7eed\u6d88\u8017\u5c1d\u8bd5\u6b21\u6570',
          );
          throw new Error('OTP verification rate-limited: ' + message);
        }
        const isOtpError =
          lower.includes('otp') ||
          lower.includes('invalid') ||
          lower.includes('expired') ||
          lower.includes('verification');
        if (!isOtpError) {
          // Non-OTP error (network / 5xx / proxy) - do not waste captcha.
          throw err;
        }
        if (attempt >= maxAttempts) break;
        // Push the watermark forward by 1 second so the next poll is more
        // likely to pick up a newer OTP email if stagewise resent one.
        watermark = Date.now() / 1000 + 1;
        if (opts.onResendOtp) {
          try {
            this.checkRegistrationAborted();
            this.pushRegistrationStep(
              '[verify] \u8bf7\u6c42 stagewise \u91cd\u65b0\u53d1\u9001 OTP \u90ae\u4ef6\u4ee5\u4fbf\u4e0b\u4e00\u8f6e\u8f6e\u8be2',
            );
            await opts.onResendOtp();
          } catch (sendErr) {
            const sm =
              sendErr instanceof Error ? sendErr.message : String(sendErr);
            this.pushRegistrationStep(
              '[verify] \u91cd\u65b0\u53d1\u9001 OTP \u8bf7\u6c42\u5931\u8d25\uff08\u4ecd\u5c06\u91cd\u8bd5\u8f6e\u8be2\u73b0\u6709\u90ae\u4ef6\uff09: ' +
                sm,
            );
          }
        }
      }
    }
    const finalMsg =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      'OTP \u9a8c\u8bc1\u8fde\u7eed ' +
        maxAttempts +
        ' \u6b21\u5931\u8d25\uff0c\u6700\u540e\u9519\u8bef: ' +
        finalMsg,
    );
  }
  public async autoRegisterNewAccount(
    cfg: MailboxPoolConfig,
    captchaToken?: string,
  ): Promise<{ error?: string; email?: string }> {
    const selectedProxyUrl = await resolveEffectiveProxyUrl(cfg.proxyPool);
    const proxyCandidates = await buildRegistrationProxyCandidates(
      selectedProxyUrl,
      process.env.STAGEWISE_CONSOLE_URL || 'https://console.stagewise.io',
    );
    const fingerprint = createRegistrationFingerprint();
    const mailboxPool = new MailboxPool({
      ...cfg,
      selectedProxyUrl,
    });

    this._registrationAborted = false;
    this.resetRegistrationProgress(true);
    this.pushRegistrationStep('准备中: 初始化邮箱池客户端、读取代理配置');
    if (selectedProxyUrl) {
      this.pushRegistrationStep('使用代理: ' + selectedProxyUrl);
    } else {
      this.pushRegistrationStep('未使用代理，直连请求');
    }
    this.pushRegistrationStep(
      '网络链路: ' + proxyCandidates.map(describeProxyCandidate).join(' -> '),
    );
    let lastClaimed: {
      baseEmail: string;
      metadata: Record<string, unknown>;
    } | null = null;
    try {
      if (selectedProxyUrl) {
        this.logger.info(
          '[AuthService] Auto-register: using proxy (pool/system/direct)',
        );
      }

      const captchaProviderForFlow = normalizeRegistrationCaptchaProvider(
        (cfg as { captchaProvider?: unknown }).captchaProvider,
      );
      if (captchaProviderForFlow === 'browser-ui-flow') {
        // Camoufox registration: drive the real console sign-in page
        // end-to-end and capture set-auth-token off the response.
        return await this.runBrowserUiFlowRegistration(
          mailboxPool,
          selectedProxyUrl,
          proxyCandidates,
          fingerprint,
          /* switchActiveAccount */ true,
        );
      }

      let effectiveCaptchaToken = captchaToken;
      let visitorId: string | undefined;
      if (effectiveCaptchaToken) {
        this.pushRegistrationStep(
          '安全验证 token 已由 UI 提供，跳过 headless 获取',
        );
      }
      if (!effectiveCaptchaToken) {
        this.pushRegistrationStep(
          '未提供验证 token，启动 headless console 获取 Turnstile token',
        );
        this.logger.info(
          '[AuthService] Auto-register: no captcha token supplied, acquiring via headless console',
        );
        const captchaProvider = normalizeRegistrationCaptchaProvider(
          (cfg as { captchaProvider?: unknown }).captchaProvider,
        );
        const captchaApiKeys = (
          cfg as {
            captchaApiKeys?: {
              twocaptcha?: string;
              capsolver?: string;
              yescaptcha?: string;
            };
          }
        ).captchaApiKeys;
        const captchaApiKey = captchaApiKeys
          ? ((captchaProvider === '2captcha'
              ? captchaApiKeys.twocaptcha
              : captchaProvider === 'capsolver'
                ? captchaApiKeys.capsolver
                : captchaProvider === 'yescaptcha'
                  ? captchaApiKeys.yescaptcha
                  : undefined) ?? undefined)
          : undefined;
        if (
          captchaProvider !== 'console-handoff' &&
          captchaProvider !== 'browser-ui-flow'
        ) {
          this.pushRegistrationStep(
            '\u4f7f\u7528\u7b2c\u4e09\u65b9\u9a8c\u8bc1\u670d\u52a1: ' +
              captchaProvider +
              ' \u83b7\u53d6 Turnstile token',
          );
          const solvedToken = await solveTurnstileToken({
            provider: captchaProvider,
            apiKey: captchaApiKey,
            proxyUrl: selectedProxyUrl,
            onStep: (msg) => this.pushRegistrationStep('[captcha] ' + msg),
          });
          this.checkRegistrationAborted();
          effectiveCaptchaToken = solvedToken;
          this.pushRegistrationStep(
            '\u5df2\u83b7\u53d6 token via ' +
              captchaProvider +
              ' (len=' +
              solvedToken.length +
              ')',
          );
          logRegistrationStep('[auto-register] captcha via ' + captchaProvider);
        } else {
          let cred: Awaited<ReturnType<typeof acquireCaptchaCredentials>>;
          try {
            cred = await acquireCaptchaCredentials({
              consoleUrl:
                process.env.STAGEWISE_CONSOLE_URL ||
                'https://console.stagewise.io',
              proxyUrl: selectedProxyUrl,
              userAgent: fingerprint.userAgent,
              solveTurnstile: this._solveTurnstile ?? undefined,
              onStep: (msg) => this.pushRegistrationStep('[captcha] ' + msg),
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (
              msg.includes('ERR_NO_SUPPORTED_PROXIES') ||
              msg.includes('-336')
            ) {
              throw new Error(
                '\u4ee3\u7406\u8fde\u63a5\u5931\u8d25\uff1a\u914d\u7f6e\u7684\u4ee3\u7406\u670d\u52a1\u5668\u4e0d\u53ef\u7528\u3002' +
                  '\u8bf7\u68c0\u67e5\u300c\u81ea\u52a8\u6ce8\u518c\u914d\u7f6e\u300d\u4e2d\u7684\u4ee3\u7406\u6c60\u914d\u7f6e\uff0c' +
                  '\u6216\u7559\u7a7a\u4ee5\u76f4\u63a5\u8fde\u63a5\u3002\u539f\u59cb\u9519\u8bef\uff1a' +
                  msg,
              );
            }
            if (msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) {
              throw new Error(
                '\u7f51\u7edc\u8fde\u63a5\u8d85\u65f6\uff1a\u65e0\u6cd5\u8bbf\u95ee console.stagewise.io\u3002' +
                  '\u8bf7\u68c0\u67e5\u7f51\u7edc\u8fde\u63a5\u6216\u4ee3\u7406\u914d\u7f6e\u3002\u539f\u59cb\u9519\u8bef\uff1a' +
                  msg,
              );
            }
            throw err;
          }
          effectiveCaptchaToken = cred.captchaToken;
          this.checkRegistrationAborted();
          visitorId = cred.visitorId;
          this.pushRegistrationStep(
            '已获取安全验证 token (visitor=' + cred.visitorId.slice(0, 6) + ')',
          );
          logRegistrationStep(
            '[auto-register] captcha acquired (visitor=' +
              cred.visitorId.slice(0, 6) +
              ')',
          );
          this.logger.info(
            '[AuthService] Auto-register: captcha acquired (visitor=' +
              cred.visitorId.slice(0, 6) +
              '..)',
          );
        }
      }

      this.checkRegistrationAborted();
      this.pushRegistrationStep('从邮箱池领取一个可用邮箱…');
      this.logger.info('[AuthService] Auto-register: claiming email from pool');
      const claimed = await mailboxPool.claimEmail();
      this.pushRegistrationStep(
        '已领取邮箱: ' + claimed.email + ' (source=' + claimed.source + ')',
      );
      lastClaimed = {
        baseEmail: claimed.baseEmail,
        metadata: claimed.metadata,
      };
      logRegistrationStep('[auto-register] email claimed: ' + claimed.email);
      this.logger.info('[AuthService] Auto-register: claimed ' + claimed.email);

      this.checkRegistrationAborted();
      this.pushRegistrationStep(
        '调用 stagewise sendVerificationOtp，请求邮箱发送 OTP…',
      );
      const otpSentAtEpoch = Date.now() / 1000;
      await sendSilentEmailOtp(
        claimed.email,
        effectiveCaptchaToken,
        selectedProxyUrl,
        fingerprint,
        visitorId,
      );
      this.pushRegistrationStep(
        'OTP 已发送到 ' + claimed.email + '，开始轮询邮箱',
      );
      logRegistrationStep(
        '[auto-register] OTP sent to ' + claimed.email + ', polling mailbox',
      );
      this.logger.info(
        '[AuthService] Auto-register: OTP sent, polling mailbox',
      );

      const token = await this.verifyOtpWithRetry({
        mailboxPool,
        baseEmail: claimed.baseEmail,
        claimedEmail: claimed.email,
        captchaToken: effectiveCaptchaToken,
        proxyUrl: selectedProxyUrl,
        fingerprint,
        visitorId,
        sentAfterEpoch: otpSentAtEpoch,
        pollTimeoutMs: 180000,
        maxAttempts: 3,
        onResendOtp: async () => {
          this.checkRegistrationAborted();
          await sendSilentEmailOtp(
            claimed.email,
            effectiveCaptchaToken,
            selectedProxyUrl,
            fingerprint,
            visitorId,
          );
        },
      });
      this.persistCredentials({
        token,
        user: { id: claimed.email, email: claimed.email },
      });
      await this.refreshSession();

      void mailboxPool.markRegistered(claimed.baseEmail, claimed.metadata);

      // Add to account pool
      await upsertAccount({
        email: claimed.email,
        token: token,
        status: 'normal',
        addedAt: new Date().toISOString(),
      });

      this.pushRegistrationStep(
        '注册成功，已入账号池并切换到新账号: ' + claimed.email,
      );
      logRegistrationStep('[auto-register] SUCCESS: ' + claimed.email);
      this.logger.info('[AuthService] Auto-register success: ' + claimed.email);
      this.endRegistrationProgress();
      return { email: claimed.email };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.pushRegistrationStep('注册失败: ' + message);
      logRegistrationStep('[auto-register] FAILED: ' + message);
      this.logger.error('[AuthService] Auto-register failed: ' + message);
      // Tag the mailbox as invalid so the pool never hands it out again.
      // Skipped only when we never managed to claim a mailbox (e.g. captcha
      // or proxy errors before claimEmail()).
      if (lastClaimed && !this.isRegistrationCancelledError(err)) {
        try {
          this.pushRegistrationStep(
            '[mailbox] \u5c06\u90ae\u7bb1\u6253\u6807\u4e3a stagewise\u65e0\u6548\u90ae\u7bb1: ' +
              lastClaimed.baseEmail,
          );
          await mailboxPool.markInvalid(
            lastClaimed.baseEmail,
            lastClaimed.metadata,
            'stagewise_register_failed',
          );
        } catch (tagErr) {
          this.pushRegistrationStep(
            '[mailbox] \u6253\u6807\u5931\u8d25 (\u5ffd\u7565): ' +
              (tagErr instanceof Error ? tagErr.message : String(tagErr)),
          );
        }
      }
      this.endRegistrationProgress();
      return { error: message };
    }
  }

  /**
   * Shared implementation of the browser-ui-flow captcha mode.
   *
   * The provider name is kept for UI/settings compatibility, but the runtime
   * flow is Camoufox-only. It drives the real console.stagewise.io sign-in
   * page, fills the email + OTP, and captures the bearer token from the
   * set-auth-token response header. Used by both single-account and batch
   * registration paths.
   *
   * When switchActiveAccount=true, persists the new token as the active
   * session (autoRegisterNewAccount behaviour). When false, the new account
   * is only inserted into the pool (registerToPoolOnly behaviour).
   */
  private async runBrowserUiFlowRegistration(
    mailboxPool: MailboxPool,
    selectedProxyUrl: string | undefined,
    proxyCandidates: Array<string | undefined>,
    fingerprint: RegistrationFingerprint,
    switchActiveAccount: boolean,
  ): Promise<{ error?: string; email?: string }> {
    let claimed: ClaimedAccount | null = null;
    try {
      this.checkRegistrationAborted();
      this.pushRegistrationStep(
        '[camoufox] \u4ece\u90ae\u7bb1\u6c60\u9886\u53d6\u4e00\u4e2a\u53ef\u7528\u90ae\u7bb1',
      );
      claimed = await mailboxPool.claimEmail();
      const activeClaim = claimed;
      this.checkRegistrationAborted();
      this.pushRegistrationStep(
        '[camoufox] \u5df2\u9886\u53d6\u90ae\u7bb1: ' + activeClaim.email,
      );

      // Keep the real console page visible by default. Turnstile can require
      // foreground rendering and manual user interaction. Set
      // STAGEWISE_BROWSER_UI_FLOW_VISIBLE=0 only for explicit diagnostics.
      const visible = process.env.STAGEWISE_BROWSER_UI_FLOW_VISIBLE !== '0';

      const otpSentAtEpoch = Date.now() / 1000;
      const waitForOtp = async (): Promise<string> => {
        const code = await mailboxPool.pollOtp(activeClaim.baseEmail, {
          sentAfterEpoch: otpSentAtEpoch,
          sentAfterSlackSeconds: 90,
          timeoutMs: 180000,
          onStep: (msg) => this.pushRegistrationStep('[camoufox] ' + msg),
          shouldAbort: () => this._registrationAborted,
        });
        return code;
      };

      const flowOptions = {
        email: activeClaim.email,
        waitForOtp,
        proxyUrl: selectedProxyUrl,
        proxyCandidates,
        acceptLanguage: fingerprint.acceptLanguage,
        visible,
        consoleUrl:
          process.env.STAGEWISE_CONSOLE_URL || 'https://console.stagewise.io',
        onStep: (msg: string) => this.pushRegistrationStep(msg),
        shouldAbort: () => this._registrationAborted,
      };

      const result = await runCamoufoxUiFlow(flowOptions);

      this.checkRegistrationAborted();
      const token = result.bearerToken;
      if (switchActiveAccount) {
        this.persistCredentials({
          token,
          user: { id: activeClaim.email, email: activeClaim.email },
        });
        await this.refreshSession();
      }
      this.checkRegistrationAborted();
      await upsertAccount({
        email: activeClaim.email,
        token,
        status: 'normal',
        addedAt: new Date().toISOString(),
      });
      void mailboxPool.markRegistered(
        activeClaim.baseEmail,
        activeClaim.metadata,
      );

      this.pushRegistrationStep(
        '[camoufox] \u6ce8\u518c\u6210\u529f' +
          (switchActiveAccount
            ? '\uff0c\u5df2\u5207\u6362\u767b\u5f55'
            : '\uff08\u672a\u5207\u6362\u767b\u5f55\uff09') +
          ': ' +
          activeClaim.email,
      );
      logRegistrationStep('[camoufox] SUCCESS: ' + activeClaim.email);
      this.endRegistrationProgress();
      return { email: activeClaim.email };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.pushRegistrationStep(
        '[camoufox] \u6ce8\u518c\u5931\u8d25: ' + message,
      );
      logRegistrationStep('[camoufox] FAILED: ' + message);
      this.logger.error('[AuthService] camoufox flow failed: ' + message);
      if (claimed && !this.isRegistrationCancelledError(err)) {
        const environmentError = this.isRegistrationEnvironmentError(message);
        const reason = environmentError
          ? 'stagewise_environment_error'
          : /too many attempts|try again later|rate-limit|rate limited|429/i.test(
                message,
              )
            ? 'stagewise_otp_rate_limited'
            : 'stagewise_register_failed';
        try {
          if (environmentError) {
            this.pushRegistrationStep(
              '[mailbox] \u672c\u5730\u73af\u5883\u9519\u8bef\uff0c\u91ca\u653e\u90ae\u7bb1 claim\uff0c\u4e0d\u6807\u8bb0\u90ae\u7bb1\u65e0\u6548: ' +
                claimed.baseEmail,
            );
            await mailboxPool.releasePoolClaim(claimed.metadata, reason);
          } else {
            this.pushRegistrationStep(
              '[mailbox] \u6ce8\u518c\u5931\u8d25\uff0c\u5b8c\u6210\u90ae\u7bb1 claim \u5931\u8d25\u72b6\u6001: ' +
                claimed.baseEmail +
                ' (' +
                reason +
                ')',
            );
            await mailboxPool.markInvalid(
              claimed.baseEmail,
              claimed.metadata,
              reason,
            );
          }
        } catch (tagErr) {
          this.pushRegistrationStep(
            '[mailbox] \u5931\u8d25\u6807\u8bb0\u5199\u5165\u5931\u8d25\uff08\u5ffd\u7565\uff09: ' +
              (tagErr instanceof Error ? tagErr.message : String(tagErr)),
          );
        }
      }
      this.endRegistrationProgress();
      return { error: message };
    }
  }

  /**
   * Register a new account and add it to the pool, but do NOT switch the
   * active session. Used by batch tasks so the signed-in user keeps working.
   *
   * Mirrors `autoRegisterNewAccount` step-by-step (proxy, captcha provider
   * selection, mailbox polling, OTP verification) so that batch registrations
   * honour the same `captchaProvider` / `captchaApiKeys` settings as the
   * single-account flow on the Account page. The only intentional difference
   * is that we do NOT persist credentials or refresh the session afterwards;
   * the newly-registered account is only inserted into the pool.
   */
  private async registerToPoolOnly(
    cfg: MailboxPoolConfig,
    captchaToken?: string,
  ): Promise<{ email: string }> {
    const selectedProxyUrl = await resolveEffectiveProxyUrl(cfg.proxyPool);
    const proxyCandidates = await buildRegistrationProxyCandidates(
      selectedProxyUrl,
      process.env.STAGEWISE_CONSOLE_URL || 'https://console.stagewise.io',
    );
    const fingerprint = createRegistrationFingerprint();
    const mailboxPool = new MailboxPool({ ...cfg, selectedProxyUrl });

    // Reset the renderer-facing progress stream so the Account page (if open)
    // also sees per-step progress while the batch task is running.
    this._registrationAborted = false;
    this.resetRegistrationProgress(true);
    this.pushRegistrationStep(
      '\u51c6\u5907\u4e2d: \u521d\u59cb\u5316\u90ae\u7bb1\u6c60\u5ba2\u6237\u7aef\u3001\u8bfb\u53d6\u4ee3\u7406\u914d\u7f6e',
    );
    if (selectedProxyUrl) {
      this.pushRegistrationStep(
        '\u4f7f\u7528\u4ee3\u7406: ' + selectedProxyUrl,
      );
      this.logger.info(
        '[AuthService] Batch register: using proxy (pool/system/direct)',
      );
    } else {
      this.pushRegistrationStep(
        '\u672a\u4f7f\u7528\u4ee3\u7406\uff0c\u76f4\u8fde\u8bf7\u6c42',
      );
    }
    this.pushRegistrationStep(
      '网络链路: ' + proxyCandidates.map(describeProxyCandidate).join(' -> '),
    );

    let lastClaimed: {
      baseEmail: string;
      metadata: Record<string, unknown>;
    } | null = null;
    try {
      const captchaProviderForFlow = normalizeRegistrationCaptchaProvider(
        (cfg as { captchaProvider?: unknown }).captchaProvider,
      );
      if (captchaProviderForFlow === 'browser-ui-flow') {
        this.checkRegistrationAborted();
        const res = await this.runBrowserUiFlowRegistration(
          mailboxPool,
          selectedProxyUrl,
          proxyCandidates,
          fingerprint,
          /* switchActiveAccount */ false,
        );
        if (res.error) {
          throw new Error(res.error);
        }
        return { email: res.email as string };
      }

      let effectiveCaptchaToken = captchaToken;
      let visitorId: string | undefined;
      if (effectiveCaptchaToken) {
        this.pushRegistrationStep(
          '\u5b89\u5168\u9a8c\u8bc1 token \u5df2\u7531 UI \u63d0\u4f9b\uff0c\u8df3\u8fc7 headless \u83b7\u53d6',
        );
      } else {
        this.pushRegistrationStep(
          '\u672a\u63d0\u4f9b\u9a8c\u8bc1 token\uff0c\u542f\u52a8 headless console \u83b7\u53d6 Turnstile token',
        );
        this.logger.info(
          '[AuthService] Batch register: no captcha token supplied, acquiring via headless console',
        );
        const captchaProvider = normalizeRegistrationCaptchaProvider(
          (cfg as { captchaProvider?: unknown }).captchaProvider,
        );
        const captchaApiKeys = (
          cfg as {
            captchaApiKeys?: {
              twocaptcha?: string;
              capsolver?: string;
              yescaptcha?: string;
            };
          }
        ).captchaApiKeys;
        const captchaApiKey = captchaApiKeys
          ? ((captchaProvider === '2captcha'
              ? captchaApiKeys.twocaptcha
              : captchaProvider === 'capsolver'
                ? captchaApiKeys.capsolver
                : captchaProvider === 'yescaptcha'
                  ? captchaApiKeys.yescaptcha
                  : undefined) ?? undefined)
          : undefined;
        if (
          captchaProvider !== 'console-handoff' &&
          captchaProvider !== 'browser-ui-flow'
        ) {
          this.pushRegistrationStep(
            '\u4f7f\u7528\u7b2c\u4e09\u65b9\u9a8c\u8bc1\u670d\u52a1: ' +
              captchaProvider +
              ' \u83b7\u53d6 Turnstile token',
          );
          const solvedToken = await solveTurnstileToken({
            provider: captchaProvider,
            apiKey: captchaApiKey,
            proxyUrl: selectedProxyUrl,
            onStep: (msg) => this.pushRegistrationStep('[captcha] ' + msg),
          });
          this.checkRegistrationAborted();
          effectiveCaptchaToken = solvedToken;
          this.pushRegistrationStep(
            '\u5df2\u83b7\u53d6 token via ' +
              captchaProvider +
              ' (len=' +
              solvedToken.length +
              ')',
          );
          logRegistrationStep(
            '[batch-register] captcha via ' + captchaProvider,
          );
        } else {
          let cred: Awaited<ReturnType<typeof acquireCaptchaCredentials>>;
          try {
            cred = await acquireCaptchaCredentials({
              consoleUrl:
                process.env.STAGEWISE_CONSOLE_URL ||
                'https://console.stagewise.io',
              proxyUrl: selectedProxyUrl,
              userAgent: fingerprint.userAgent,
              solveTurnstile: this._solveTurnstile ?? undefined,
              onStep: (msg) => this.pushRegistrationStep('[captcha] ' + msg),
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (
              msg.includes('ERR_NO_SUPPORTED_PROXIES') ||
              msg.includes('-336')
            ) {
              throw new Error(
                '\u4ee3\u7406\u8fde\u63a5\u5931\u8d25\uff1a\u914d\u7f6e\u7684\u4ee3\u7406\u670d\u52a1\u5668\u4e0d\u53ef\u7528\u3002' +
                  '\u8bf7\u68c0\u67e5\u300c\u81ea\u52a8\u6ce8\u518c\u914d\u7f6e\u300d\u4e2d\u7684\u4ee3\u7406\u6c60\u914d\u7f6e\uff0c' +
                  '\u6216\u7559\u7a7a\u4ee5\u76f4\u63a5\u8fde\u63a5\u3002\u539f\u59cb\u9519\u8bef\uff1a' +
                  msg,
              );
            }
            if (msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) {
              throw new Error(
                '\u7f51\u7edc\u8fde\u63a5\u8d85\u65f6\uff1a\u65e0\u6cd5\u8bbf\u95ee console.stagewise.io\u3002' +
                  '\u8bf7\u68c0\u67e5\u7f51\u7edc\u8fde\u63a5\u6216\u4ee3\u7406\u914d\u7f6e\u3002\u539f\u59cb\u9519\u8bef\uff1a' +
                  msg,
              );
            }
            throw err;
          }
          effectiveCaptchaToken = cred.captchaToken;
          this.checkRegistrationAborted();
          visitorId = cred.visitorId;
          this.pushRegistrationStep(
            '\u5df2\u83b7\u53d6\u5b89\u5168\u9a8c\u8bc1 token (visitor=' +
              cred.visitorId.slice(0, 6) +
              ')',
          );
        }
      }

      this.pushRegistrationStep(
        '\u4ece\u90ae\u7bb1\u6c60\u9886\u53d6\u4e00\u4e2a\u53ef\u7528\u90ae\u7bb1',
      );
      this.checkRegistrationAborted();
      const claimed = await mailboxPool.claimEmail();
      this.checkRegistrationAborted();
      this.pushRegistrationStep(
        '\u5df2\u9886\u53d6\u90ae\u7bb1: ' + claimed.email,
      );
      lastClaimed = {
        baseEmail: claimed.baseEmail,
        metadata: claimed.metadata,
      };

      const otpSentAtEpoch = Date.now() / 1000;
      this.pushRegistrationStep(
        '\u8c03\u7528 sendSilentEmailOtp \u53d1\u9001\u9a8c\u8bc1\u7801',
      );
      this.checkRegistrationAborted();
      await sendSilentEmailOtp(
        claimed.email,
        effectiveCaptchaToken,
        selectedProxyUrl,
        fingerprint,
        visitorId,
      );
      this.pushRegistrationStep(
        '\u9a8c\u8bc1\u7801\u5df2\u53d1\u9001\uff0c\u8f6e\u8be2\u90ae\u7bb1\u6c60\u83b7\u53d6 OTP',
      );

      const token = await this.verifyOtpWithRetry({
        mailboxPool,
        baseEmail: claimed.baseEmail,
        claimedEmail: claimed.email,
        captchaToken: effectiveCaptchaToken,
        proxyUrl: selectedProxyUrl,
        fingerprint,
        visitorId,
        sentAfterEpoch: otpSentAtEpoch,
        pollTimeoutMs: 120000,
        maxAttempts: 3,
        onResendOtp: async () => {
          this.checkRegistrationAborted();
          await sendSilentEmailOtp(
            claimed.email,
            effectiveCaptchaToken,
            selectedProxyUrl,
            fingerprint,
            visitorId,
          );
        },
      });

      // Batch path: DO NOT persistCredentials / refreshSession.
      // We only insert the new account into the pool so the active session
      // (signed-in user) is untouched.
      this.checkRegistrationAborted();
      await upsertAccount({
        email: claimed.email,
        token,
        status: 'normal',
        addedAt: new Date().toISOString(),
      });
      void mailboxPool.markRegistered(claimed.baseEmail, claimed.metadata);

      this.pushRegistrationStep(
        '\u6ce8\u518c\u6210\u529f\uff0c\u5df2\u5165\u8d26\u53f7\u6c60 (\u672a\u5207\u6362\u767b\u5f55): ' +
          claimed.email,
      );
      logRegistrationStep('[batch-register] SUCCESS: ' + claimed.email);
      this.logger.info(
        '[AuthService] Batch register success: ' + claimed.email,
      );
      this.endRegistrationProgress();
      return { email: claimed.email };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.pushRegistrationStep('\u6ce8\u518c\u5931\u8d25: ' + message);
      logRegistrationStep('[batch-register] FAILED: ' + message);
      this.logger.error('[AuthService] Batch register failed: ' + message);
      if (lastClaimed && !this.isRegistrationCancelledError(err)) {
        const environmentError = this.isRegistrationEnvironmentError(message);
        try {
          if (environmentError) {
            this.pushRegistrationStep(
              '[mailbox] 本地网络/环境错误，释放邮箱 claim，不标记邮箱无效: ' +
                lastClaimed.baseEmail,
            );
            await mailboxPool.releasePoolClaim(
              lastClaimed.metadata,
              'stagewise_environment_error',
            );
          } else {
            this.pushRegistrationStep(
              '[mailbox] \u5c06\u90ae\u7bb1\u6253\u6807\u4e3a stagewise\u65e0\u6548\u90ae\u7bb1: ' +
                lastClaimed.baseEmail,
            );
            await mailboxPool.markInvalid(
              lastClaimed.baseEmail,
              lastClaimed.metadata,
              'stagewise_register_failed',
            );
          }
        } catch (tagErr) {
          this.pushRegistrationStep(
            '[mailbox] \u6253\u6807\u5931\u8d25 (\u5ffd\u7565): ' +
              (tagErr instanceof Error ? tagErr.message : String(tagErr)),
          );
        }
      }
      this.endRegistrationProgress();
      throw err;
    }
  }

  public async startBatchTask(params: {
    cfg: MailboxPoolConfig;
    total: number;
    intervalMs?: number;
    captchaToken?: string;
  }): Promise<{ taskId: string }> {
    const taskId =
      'batch-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 8);
    const intervalMs = params.intervalMs ?? 2000;
    const total = Math.max(1, Math.floor(params.total));
    const task = {
      status: 'running' as const,
      total,
      done: 0,
      failed: 0,
      logs: [
        '\u4efb\u52a1\u5df2\u542f\u52a8\uff0c\u76ee\u6807\u6ce8\u518c ' +
          total +
          ' \u4e2a\u8d26\u53f7',
      ],
      emails: [] as string[],
      cancelRequested: false,
    };
    this.batchTasks.set(taskId, task);
    void this.runBatchLoop(taskId, params.cfg, params.captchaToken, intervalMs);
    return { taskId };
  }

  private async runBatchLoop(
    taskId: string,
    cfg: MailboxPoolConfig,
    captchaToken: string | undefined,
    intervalMs: number,
  ): Promise<void> {
    const task = this.batchTasks.get(taskId);
    if (!task) return;
    const sleep = async (ms: number) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (task.cancelRequested) {
          this._registrationAborted = true;
          return;
        }
        await new Promise<void>((r) =>
          setTimeout(r, Math.min(500, end - Date.now())),
        );
      }
    };
    try {
      let consecutiveOtpRejections = 0;
      for (let i = 0; i < task.total; i++) {
        let nextDelayMs = intervalMs;
        if (task.cancelRequested) {
          task.logs.push('\u4efb\u52a1\u5df2\u53d6\u6d88');
          task.status = 'cancelled';
          return;
        }
        task.logs.push(
          '\u6b63\u5728\u6ce8\u518c\u7b2c ' +
            (i + 1) +
            ' / ' +
            task.total +
            ' \u4e2a\u8d26\u53f7\u2026',
        );
        // Mirror every pushRegistrationStep() call into the per-task log
        // stream so the account-pool batch task panel shows the same
        // detailed steps as the Account page does for single registrations.
        const prevListener = this._stepListener;
        this._stepListener = (msg: string) => {
          if (task.cancelRequested) {
            this._registrationAborted = true;
          }
          task.logs.push('  - ' + msg);
        };
        try {
          const { email } = await this.registerToPoolOnly(cfg, captchaToken);
          if (task.cancelRequested) {
            task.status = 'cancelled';
            task.logs.push('\u4efb\u52a1\u5df2\u53d6\u6d88');
            return;
          }
          task.emails.push(email);
          task.done++;
          consecutiveOtpRejections = 0;
          task.logs.push('\u6ce8\u518c\u6210\u529f\uff1a' + email);
        } catch (err) {
          if (task.cancelRequested || this.isRegistrationCancelledError(err)) {
            task.status = 'cancelled';
            task.logs.push('\u4efb\u52a1\u5df2\u53d6\u6d88');
            return;
          }
          task.failed++;
          const msg = err instanceof Error ? err.message : String(err);
          task.logs.push('\u6ce8\u518c\u5931\u8d25\uff1a' + msg);
          if (this.isOtpRateLimitOrRejectionMessage(msg)) {
            consecutiveOtpRejections += 1;
            const maxConsecutiveOtpRejections =
              this.getMaxConsecutiveOtpRejections();
            if (
              consecutiveOtpRejections >= maxConsecutiveOtpRejections
            ) {
              task.status = 'error';
              task.error =
                '连续触发 OTP/Cloudflare 风控拒绝（连续 ' +
                consecutiveOtpRejections +
                ' 次，阈值 ' +
                maxConsecutiveOtpRejections +
                ' 次），批量任务已终止，不会继续注册剩余账号；请更换代理或等待风控冷却后重新启动任务';
              task.logs.push(task.error);
              return;
            }
            nextDelayMs = Math.max(
              intervalMs,
              this.getRegistrationBackoffMs(consecutiveOtpRejections),
            );
            task.logs.push(
              '检测到 OTP 验证/Cloudflare 风控拒绝（连续 ' +
                consecutiveOtpRejections +
                ' 次），下一轮自动冷却 ' +
                nextDelayMs +
                ' ms，避免连续触发 Too many attempts',
            );
          } else {
            consecutiveOtpRejections = 0;
          }
        } finally {
          this._stepListener = prevListener;
        }
        if (i < task.total - 1 && !task.cancelRequested) {
          task.logs.push(
            '\u7b49\u5f85 ' +
              nextDelayMs +
              ' ms \u540e\u5f00\u59cb\u4e0b\u4e00\u8f6e\u2026',
          );
          await sleep(nextDelayMs);
          if (task.cancelRequested) {
            task.status = 'cancelled';
            task.logs.push('\u4efb\u52a1\u5df2\u53d6\u6d88');
            return;
          }
        }
      }
      if (!task.cancelRequested) {
        task.status = 'completed';
        task.logs.push(
          '\u4efb\u52a1\u5b8c\u6210\uff0c\u6210\u529f ' +
            task.done +
            ' \u4e2a\uff0c\u5931\u8d25 ' +
            task.failed +
            ' \u4e2a',
        );
      }
    } catch (err) {
      task.status = 'error';
      task.error = err instanceof Error ? err.message : String(err);
      task.logs.push('\u4efb\u52a1\u5f02\u5e38\uff1a' + task.error);
    }
  }

  private isOtpRateLimitOrRejectionMessage(message: string): boolean {
    return /too many attempts|try again later|rate.?limit|status=40[13]|status=429|otp verification rejected|otp verification failed|otp verification rate-limited/i.test(
      message,
    );
  }

  private isRegistrationEnvironmentError(message: string): boolean {
    return /geoip extra|camoufox python package missing|camoufox browser binary|bootstrap command failed|python executable not found|pip install|module not found|no module named|playwright sync api inside the asyncio loop|NS_ERROR_NET_INTERRUPT|NS_ERROR_PROXY_CONNECTION_REFUSED|NS_ERROR_CONNECTION_REFUSED|NS_ERROR_NET_TIMEOUT|ERR_PROXY_CONNECTION_FAILED|ERR_TUNNEL_CONNECTION_FAILED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_CONNECTION_TIMED_OUT|Page\.goto|net::/i.test(
      message,
    );
  }

  private getRegistrationBackoffMs(consecutiveRejections: number): number {
    const configured = Number(process.env.STAGEWISE_REGISTER_BACKOFF_MS);
    const baseMs =
      Number.isFinite(configured) && configured >= 0
        ? Math.floor(configured)
        : 60_000;
    const multiplier = Math.min(5, Math.max(1, consecutiveRejections));
    const jitter = 0.8 + Math.random() * 0.4;
    return Math.floor(baseMs * multiplier * jitter);
  }

  private getMaxConsecutiveOtpRejections(): number {
    const configured = Number(
      process.env.STAGEWISE_REGISTER_MAX_OTP_REJECTIONS,
    );
    if (Number.isFinite(configured) && configured > 0) {
      return Math.floor(configured);
    }
    return 3;
  }

  public async getBatchTaskStatus(taskId: string): Promise<{
    taskId: string;
    status: 'running' | 'completed' | 'cancelled' | 'error';
    total: number;
    done: number;
    failed: number;
    logs: string[];
    emails: string[];
    error?: string;
  }> {
    const task = this.batchTasks.get(taskId);
    if (!task) {
      return {
        taskId,
        status: 'error',
        total: 0,
        done: 0,
        failed: 0,
        logs: [],
        emails: [],
        error: 'Task not found',
      };
    }
    if (task.status !== 'running') {
      setTimeout(() => this.batchTasks.delete(taskId), 60000);
    }
    return {
      taskId,
      status: task.status,
      total: task.total,
      done: task.done,
      failed: task.failed,
      logs: [...task.logs],
      emails: [...task.emails],
      error: task.error,
    };
  }

  public async cancelBatchTask(taskId: string): Promise<{ ok: boolean }> {
    const task = this.batchTasks.get(taskId);
    if (!task) return { ok: false };
    task.cancelRequested = true;
    this._registrationAborted = true;
    if (task.status === 'running') {
      const lastLog = task.logs[task.logs.length - 1] ?? '';
      const cancelMsg =
        '\u5df2\u8bf7\u6c42\u53d6\u6d88\uff0c\u6b63\u5728\u505c\u6b62\u5f53\u524d\u6b65\u9aa4\u2026';
      if (lastLog !== cancelMsg) {
        task.logs.push(cancelMsg);
      }
    }
    return { ok: true };
  }
  public registerAuthStateChangeCallback(
    callback: (newAuthState: AuthState) => void,
  ): void {
    this.authChangeCallbacks.push(callback);
  }

  public unregisterAuthStateChangeCallback(
    callback: (newAuthState: AuthState) => void,
  ): void {
    this.authChangeCallbacks = this.authChangeCallbacks.filter(
      (c) => c !== callback,
    );
  }
}
