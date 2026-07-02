export type CaptchaProvider =
  | 'console-handoff'
  | '2captcha'
  | 'capsolver'
  | 'yescaptcha'
  | 'browser-ui-flow';

export type MailboxService =
  | 'outlook-manager-plus'
  | 'cloudflare_temp_email'
  | 'tempmail_lol'
  | 'moemail'
  | 'inbucket'
  | 'duckmail';

export type AutoRegisterConfig = {
  mailboxService: MailboxService;
  apiUrl: string;
  apiKey: string;
  adminPassword: string;
  groupId: string;
  tagIds: string;
  emailFolder: string;
  emailTop: number;
  pollIntervalMs: number;
  proxyPool: string;
  captchaProvider: CaptchaProvider;
  captchaApiKeys: {
    twocaptcha: string;
    capsolver: string;
    yescaptcha: string;
  };
  mailServices: {
    cloudflareTempEmail: {
      apiBase: string;
      adminPassword: string;
      domain: string;
    };
    tempmailLol: {
      apiKey: string;
      domain: string;
    };
    moemail: {
      apiBase: string;
      apiKey: string;
      domain: string;
      expiryTime: number;
    };
    inbucket: {
      apiBase: string;
      domain: string;
      randomSubdomain: boolean;
    };
    duckmail: {
      apiKey: string;
      defaultDomain: string;
    };
  };
};

export const DEFAULT_AUTO_REGISTER_CONFIG: AutoRegisterConfig = {
  mailboxService: 'outlook-manager-plus',
  apiUrl: '',
  apiKey: '',
  adminPassword: '',
  groupId: '',
  tagIds: '',
  emailFolder: 'all',
  emailTop: 10,
  pollIntervalMs: 4000,
  proxyPool: '',
  captchaProvider: 'browser-ui-flow',
  captchaApiKeys: { twocaptcha: '', capsolver: '', yescaptcha: '' },
  mailServices: {
    cloudflareTempEmail: {
      apiBase: '',
      adminPassword: '',
      domain: '',
    },
    tempmailLol: {
      apiKey: '',
      domain: '',
    },
    moemail: {
      apiBase: '',
      apiKey: '',
      domain: '',
      expiryTime: 0,
    },
    inbucket: {
      apiBase: '',
      domain: '',
      randomSubdomain: true,
    },
    duckmail: {
      apiKey: '',
      defaultDomain: 'duckmail.sbs',
    },
  },
};

export function normalizeAutoRegisterConfig(
  value: Record<string, unknown> | null | undefined,
): AutoRegisterConfig {
  const record = value ?? {};
  const captchaProvider = record.captchaProvider;
  const captchaApiKeys =
    record.captchaApiKeys && typeof record.captchaApiKeys === 'object'
      ? (record.captchaApiKeys as Record<string, unknown>)
      : {};
  const mailServices =
    record.mailServices && typeof record.mailServices === 'object'
      ? (record.mailServices as Record<string, unknown>)
      : {};
  const cloudflareTempEmail = asRecord(mailServices.cloudflareTempEmail);
  const tempmailLol = asRecord(mailServices.tempmailLol);
  const moemail = asRecord(mailServices.moemail);
  const inbucket = asRecord(mailServices.inbucket);
  const duckmail = asRecord(mailServices.duckmail);
  const mailboxService = record.mailboxService;
  return {
    ...DEFAULT_AUTO_REGISTER_CONFIG,
    ...record,
    mailboxService: isMailboxService(mailboxService)
      ? mailboxService
      : DEFAULT_AUTO_REGISTER_CONFIG.mailboxService,
    apiUrl: String(record.apiUrl ?? DEFAULT_AUTO_REGISTER_CONFIG.apiUrl),
    apiKey: String(record.apiKey ?? DEFAULT_AUTO_REGISTER_CONFIG.apiKey),
    adminPassword: String(
      record.adminPassword ?? DEFAULT_AUTO_REGISTER_CONFIG.adminPassword,
    ),
    groupId: String(record.groupId ?? DEFAULT_AUTO_REGISTER_CONFIG.groupId),
    tagIds: String(record.tagIds ?? DEFAULT_AUTO_REGISTER_CONFIG.tagIds),
    emailFolder: String(
      record.emailFolder ?? DEFAULT_AUTO_REGISTER_CONFIG.emailFolder,
    ),
    emailTop: Number(record.emailTop ?? DEFAULT_AUTO_REGISTER_CONFIG.emailTop),
    pollIntervalMs: Number(
      record.pollIntervalMs ?? DEFAULT_AUTO_REGISTER_CONFIG.pollIntervalMs,
    ),
    proxyPool: String(
      record.proxyPool ?? DEFAULT_AUTO_REGISTER_CONFIG.proxyPool,
    ),
    captchaProvider: isCaptchaProvider(captchaProvider)
      ? captchaProvider
      : DEFAULT_AUTO_REGISTER_CONFIG.captchaProvider,
    captchaApiKeys: {
      twocaptcha: String(captchaApiKeys.twocaptcha ?? ''),
      capsolver: String(captchaApiKeys.capsolver ?? ''),
      yescaptcha: String(captchaApiKeys.yescaptcha ?? ''),
    },
    mailServices: {
      cloudflareTempEmail: {
        apiBase: String(cloudflareTempEmail.apiBase ?? ''),
        adminPassword: String(cloudflareTempEmail.adminPassword ?? ''),
        domain: String(cloudflareTempEmail.domain ?? ''),
      },
      tempmailLol: {
        apiKey: String(tempmailLol.apiKey ?? ''),
        domain: String(tempmailLol.domain ?? ''),
      },
      moemail: {
        apiBase: String(moemail.apiBase ?? ''),
        apiKey: String(moemail.apiKey ?? ''),
        domain: String(moemail.domain ?? ''),
        expiryTime: Number(moemail.expiryTime ?? 0),
      },
      inbucket: {
        apiBase: String(inbucket.apiBase ?? ''),
        domain: String(inbucket.domain ?? ''),
        randomSubdomain:
          typeof inbucket.randomSubdomain === 'boolean'
            ? inbucket.randomSubdomain
            : true,
      },
      duckmail: {
        apiKey: String(duckmail.apiKey ?? ''),
        defaultDomain: String(duckmail.defaultDomain ?? 'duckmail.sbs'),
      },
    },
  };
}

export function isAutoRegisterConfigReady(cfg: AutoRegisterConfig): boolean {
  if (cfg.mailboxService === 'outlook-manager-plus') {
    return cfg.apiUrl.trim().length > 0 && cfg.apiKey.trim().length > 0;
  }
  if (cfg.mailboxService === 'cloudflare_temp_email') {
    return (
      cfg.mailServices.cloudflareTempEmail.apiBase.trim().length > 0 &&
      cfg.mailServices.cloudflareTempEmail.adminPassword.trim().length > 0
    );
  }
  if (cfg.mailboxService === 'tempmail_lol') return true;
  if (cfg.mailboxService === 'moemail') {
    return (
      cfg.mailServices.moemail.apiBase.trim().length > 0 &&
      cfg.mailServices.moemail.apiKey.trim().length > 0
    );
  }
  if (cfg.mailboxService === 'inbucket') {
    return (
      cfg.mailServices.inbucket.apiBase.trim().length > 0 &&
      cfg.mailServices.inbucket.domain.trim().length > 0
    );
  }
  if (cfg.mailboxService === 'duckmail') {
    return cfg.mailServices.duckmail.apiKey.trim().length > 0;
  }
  return false;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function isMailboxService(value: unknown): value is MailboxService {
  return (
    value === 'outlook-manager-plus' ||
    value === 'cloudflare_temp_email' ||
    value === 'tempmail_lol' ||
    value === 'moemail' ||
    value === 'inbucket' ||
    value === 'duckmail'
  );
}

function isCaptchaProvider(value: unknown): value is CaptchaProvider {
  return (
    value === 'console-handoff' ||
    value === '2captcha' ||
    value === 'capsolver' ||
    value === 'yescaptcha' ||
    value === 'browser-ui-flow'
  );
}
