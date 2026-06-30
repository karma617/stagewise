/**
 * Mailbox pool client for email-plus.pickstar.asia (outlookEmail API).
 * Logic mirrors mailbox_bridge.py OutlookEmailMailbox.
 * Flow: pool claim-random -> /api/external/accounts -> admin /api/accounts fallback
 */

import {
  fetchWithRegistrationFallback,
  logRegistrationStep,
} from './registration-network';

export interface MailboxPoolConfig {
  mailboxService?:
    | 'outlook-manager-plus'
    | 'cloudflare_temp_email'
    | 'tempmail_lol'
    | 'moemail'
    | 'inbucket'
    | 'duckmail';
  apiUrl: string;
  apiKey: string;
  adminPassword?: string;
  groupId?: string;
  /** Comma-separated tag IDs to filter accounts */
  tagIds?: string;
  /** Include accounts without any tags */
  includeUntagged?: boolean;
  skipTagNames?: string[];
  registerSuccessTagNames?: string[];
  invalidEmailTagNames?: string[];
  emailFolder?: string;
  emailTop?: number;
  pollIntervalMs?: number;
  proxyPool?: string;
  selectedProxyUrl?: string;
  mailServices?: {
    cloudflareTempEmail?: {
      apiBase?: string;
      adminPassword?: string;
      domain?: string;
    };
    tempmailLol?: {
      apiKey?: string;
      domain?: string;
    };
    moemail?: {
      apiBase?: string;
      apiKey?: string;
      domain?: string;
      expiryTime?: number;
    };
    inbucket?: {
      apiBase?: string;
      domain?: string;
      randomSubdomain?: boolean;
    };
    duckmail?: {
      apiKey?: string;
      defaultDomain?: string;
    };
  };
}

export interface ClaimedAccount {
  email: string;
  /** The real inbox email (no alias suffix) used for OTP polling */
  baseEmail: string;
  accountId: string;
  /** Opaque metadata passed back to markRegistered / releasePoolClaim */
  metadata: Record<string, unknown>;
  source: string;
}

const DEFAULT_POLL_INTERVAL_MS = 4000;
const DEFAULT_EMAIL_TOP = 10;
const OTP_PATTERN = /(?<!\d)(\d{6})(?!\d)/;
const OTP_PATTERN_GLOBAL = /(?<!\d)(\d{6})(?!\d)/g;

/**
 * Stagewise issues a "Confirm Sign In" email from auth@stagewise.io.
 * We use these markers to prefer that email over unrelated 6-digit numbers
 * (e.g. Microsoft security notices that may also land in junkmail).
 */
const STAGEWISE_FROM_HINTS = ['stagewise.io'];
const STAGEWISE_SUBJECT_HINTS = ['stagewise', 'sign in', 'sign-in', 'confirm'];

type MailboxService = NonNullable<MailboxPoolConfig['mailboxService']>;

type TempMailbox = {
  provider: MailboxService;
  address: string;
  token?: string;
  emailId?: string;
  mailboxName?: string;
  password?: string;
  accountId?: string;
  metadata?: Record<string, unknown>;
};

type NormalizedTempMessage = {
  provider: string;
  mailbox: string;
  messageId: string;
  subject: string;
  sender: string;
  textContent: string;
  htmlContent: string;
  receivedEpoch: number;
  raw: Record<string, unknown>;
};

/**
 * Extract the OTP from a stagewise verification email.
 *
 * We prefer 6-digit codes that appear right after explicit context words
 * ("code", "verification", "OTP", "verify", "sign in") so that order numbers,
 * timestamps, or other 6-digit sequences in the email body do not get picked
 * up by mistake. If no contextual match exists we fall back to the first
 * 6-digit number in the email.
 *
 * Returns `{ otp, allMatches }` so callers can log every candidate they
 * considered, which makes "Invalid OTP" failures debuggable from the log
 * stream alone.
 */
function extractStagewiseOtp(text: string): {
  otp: string | null;
  allMatches: string[];
  matchedBy: 'context' | 'first' | 'none';
} {
  const all = Array.from(text.matchAll(OTP_PATTERN_GLOBAL)).map((m) => m[1]!);
  if (all.length === 0) {
    return { otp: null, allMatches: [], matchedBy: 'none' };
  }
  // Look for a 6-digit code that appears within ~40 chars after a context
  // keyword. This mirrors how stagewise renders the OTP (e.g. "Your one-time
  // code is 123456").
  const ctxRegex =
    /(code|otp|one[-\s]?time|verification|verify|sign[-\s]?in)[^0-9]{0,40}(\d{6})(?!\d)/i;
  const ctxMatch = ctxRegex.exec(text);
  if (ctxMatch && ctxMatch[2]) {
    return { otp: ctxMatch[2], allMatches: all, matchedBy: 'context' };
  }
  return { otp: all[0]!, allMatches: all, matchedBy: 'first' };
}

function buildQuery(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '' && v !== false)
    .map(
      ([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)),
    );
  return entries.length ? '?' + entries.join('&') : '';
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

function pickFromAddress(msg: Record<string, unknown>): string {
  // Microsoft Graph format: from.emailAddress.address
  const fromObj = msg['from'] ?? msg['From'];
  if (fromObj && typeof fromObj === 'object') {
    const ea =
      (fromObj as Record<string, unknown>)['emailAddress'] ??
      (fromObj as Record<string, unknown>)['EmailAddress'];
    if (ea && typeof ea === 'object') {
      const addr =
        (ea as Record<string, unknown>)['address'] ??
        (ea as Record<string, unknown>)['Address'];
      if (typeof addr === 'string' && addr) return addr;
    }
    const addr2 = (fromObj as Record<string, unknown>)['address'];
    if (typeof addr2 === 'string' && addr2) return addr2;
  }
  // outlookEmailPlus /api/external/messages typically returns from_address or from as string.
  for (const k of [
    'from_address',
    'fromAddress',
    'sender_address',
    'sender',
  ] as const) {
    const v = msg[k];
    if (typeof v === 'string' && v) return v;
  }
  if (typeof msg['from'] === 'string') return msg['from'] as string;
  if (typeof msg['From'] === 'string') return msg['From'] as string;
  return '';
}

function extractMessageId(
  msg: Record<string, unknown>,
  folder: string,
): string {
  for (const k of [
    'id',
    'message_id',
    'internet_message_id',
    'internetMessageId',
  ]) {
    const v = msg[k];
    if (typeof v === 'string' && v) return v;
  }
  // fallback: composite from folder|date|from|subject (matches GeniusFKoai _message_id)
  const parts = [
    folder,
    String(msg['date'] ?? msg['created_at'] ?? ''),
    pickFromAddress(msg),
    pickString(msg, ['subject', 'Subject']),
    pickString(msg, [
      'body_preview',
      'bodyPreview',
      'content_preview',
      'preview',
    ]),
  ];
  return parts.filter(Boolean).join('|');
}

function parseEpoch(rawTs: unknown): number {
  if (rawTs === undefined || rawTs === null || rawTs === '') return 0;
  const n = Number.parseFloat(String(rawTs));
  if (!isNaN(n) && n > 1_000_000_000 && String(rawTs).match(/^[0-9.]+$/))
    return n;
  const ms = new Date(String(rawTs)).getTime();
  return isNaN(ms) ? 0 : ms / 1000;
}

function collectMessageText(msg: Record<string, unknown>): string {
  // GeniusFKoai field list (core/outlook_email_mailbox.py _message_text)
  const fields = [
    'subject',
    'Subject',
    'body_preview',
    'bodyPreview',
    'content_preview',
    'contentPreview',
    'preview',
    'summary',
    'text',
    'content',
    'body',
    'Body',
    'body_text',
    'bodyText',
    'html_content',
    'htmlContent',
    'raw_content',
    'rawContent',
    'html',
    'from',
    'From',
    'from_address',
    'fromAddress',
  ] as const;
  const parts: string[] = [];
  for (const f of fields) {
    const v = msg[f];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') parts.push(v);
    else if (typeof v === 'object') {
      // Body may be { content, contentType } or { Content } in Graph
      const obj = v as Record<string, unknown>;
      for (const k of ['content', 'Content', 'text']) {
        const cv = obj[k];
        if (typeof cv === 'string' && cv) parts.push(cv);
      }
    }
  }
  return stripHtml(parts.join(' '));
}

function stripEmailAddresses(text: string): string {
  // Mirror GeniusFKoai wait_for_code: strip addresses so digits inside them don't fake-match.
  return text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ' ');
}

function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function randomMailboxName(): string {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const pick = (chars: string, len: number) =>
    Array.from({ length: len }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join('');
  return (
    pick(letters, 5) +
    pick(digits, 1 + Math.floor(Math.random() * 3)) +
    pick(letters, 1 + Math.floor(Math.random() * 3))
  );
}

function randomSubdomainLabel(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const len = 4 + Math.floor(Math.random() * 7);
  return Array.from({ length: len }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join('');
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value ?? '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickRandomString(items: string[]): string {
  return items[Math.floor(Math.random() * items.length)] ?? '';
}

function normalizeMailboxService(
  value: MailboxPoolConfig['mailboxService'],
): MailboxService {
  if (
    value === 'cloudflare_temp_email' ||
    value === 'tempmail_lol' ||
    value === 'moemail' ||
    value === 'inbucket' ||
    value === 'duckmail'
  ) {
    return value;
  }
  return 'outlook-manager-plus';
}

function extractTextCandidates(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(extractTextCandidates);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return ['address', 'email', 'name', 'value'].flatMap((key) =>
      extractTextCandidates(obj[key]),
    );
  }
  return [];
}

function messageMatchesEmail(data: Record<string, unknown>, email: string) {
  const target = email.trim().toLowerCase();
  const candidates = [
    'to',
    'mailTo',
    'receiver',
    'receivers',
    'address',
    'email',
    'envelope_to',
  ].flatMap((key) => extractTextCandidates(data[key]));
  return (
    !target ||
    candidates.length === 0 ||
    candidates.some((item) => item.trim().toLowerCase().includes(target))
  );
}

function responseItems(
  data: unknown,
  keys: string[],
): Array<Record<string, unknown>> {
  if (Array.isArray(data)) {
    return data.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object',
    );
  }
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object',
      );
    }
    if (value && typeof value === 'object') {
      const nested = responseItems(value, keys);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

function normalizeTempMessage(
  provider: string,
  mailbox: string,
  item: Record<string, unknown>,
): NormalizedTempMessage {
  const textContent =
    pickString(item, ['text_content', 'text', 'body', 'content']) ||
    (typeof item.raw === 'string' ? item.raw : '');
  const htmlContent = pickString(item, [
    'html_content',
    'html',
    'html_body',
    'body_html',
  ]);
  const senderRaw = item.from ?? item.sender ?? item.source ?? '';
  const sender =
    senderRaw && typeof senderRaw === 'object'
      ? pickString(senderRaw as Record<string, unknown>, [
          'address',
          'email',
          'name',
        ])
      : String(senderRaw ?? '');
  const messageId = String(
    item['id'] ?? item['_id'] ?? item['message_id'] ?? item['@id'] ?? '',
  ).replace('/messages/', '');
  const subject = pickString(item, ['subject', 'Subject']);
  const receivedEpoch = parseEpoch(
    item['createdAt'] ??
      item['created_at'] ??
      item['receivedAt'] ??
      item['received_at'] ??
      item['date'] ??
      item['timestamp'],
  );
  return {
    provider,
    mailbox,
    messageId,
    subject,
    sender,
    textContent,
    htmlContent,
    receivedEpoch,
    raw: item,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MailboxPool {
  private readonly mailboxService: MailboxService;
  private readonly mailServices: NonNullable<MailboxPoolConfig['mailServices']>;
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly adminPassword: string;
  private readonly groupId: string;
  private readonly tagIds: string;
  private readonly includeUntagged: boolean;
  private readonly skipTagNames: string[];
  private readonly registerSuccessTagNames: string[];
  private readonly invalidEmailTagNames: string[];
  private readonly emailFolder: string;
  private readonly emailTop: number;
  private readonly pollIntervalMs: number;
  private readonly selectedProxyUrl: string;
  private readonly tempMailboxesByEmail = new Map<string, TempMailbox>();
  private adminCsrfToken: string | null = null;
  private adminCookie = '';

  constructor(cfg: MailboxPoolConfig) {
    this.mailboxService = normalizeMailboxService(cfg.mailboxService);
    this.mailServices = cfg.mailServices ?? {};
    this.apiUrl = cfg.apiUrl.replace(/\/+$/, '');
    this.apiKey = cfg.apiKey;
    this.adminPassword = cfg.adminPassword ?? '';
    this.groupId = cfg.groupId ?? '';
    this.tagIds = cfg.tagIds ?? '';
    this.includeUntagged = cfg.includeUntagged ?? false;
    // Default tag taxonomy:
    //   - registerSuccessTagNames: applied when stagewise registration succeeds
    //   - invalidEmailTagNames:    applied when an email exhausts OTP retries
    //   - skipTagNames:            never re-use accounts already tagged with
    //                              either of the above (so the pool only ever
    //                              picks fresh mailboxes for new registrations)
    this.registerSuccessTagNames = cfg.registerSuccessTagNames ?? [
      'stagewise\u5df2\u6ce8\u518c',
    ];
    this.invalidEmailTagNames = cfg.invalidEmailTagNames ?? [
      'stagewise\u65e0\u6548\u90ae\u7bb1',
    ];
    this.skipTagNames =
      cfg.skipTagNames ??
      Array.from(
        new Set([
          ...this.registerSuccessTagNames,
          ...this.invalidEmailTagNames,
        ]),
      );
    this.emailFolder = cfg.emailFolder ?? 'all';
    this.emailTop = Math.max(
      1,
      Math.min(50, Math.floor(cfg.emailTop ?? DEFAULT_EMAIL_TOP)),
    );
    this.pollIntervalMs = cfg.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.selectedProxyUrl = cfg.selectedProxyUrl ?? '';
  }

  private apiHeaders(): Record<string, string> {
    return {
      'x-api-key': this.apiKey,
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'stagewise-manager/outlookEmail',
    };
  }

  private async apiGet<T = unknown>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const url = this.apiUrl + path + buildQuery(params ?? {});
    const resp = await fetchWithRegistrationFallback(
      url,
      { method: 'GET', headers: this.apiHeaders() },
      this.selectedProxyUrl || undefined,
    );
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      const err = new Error(
        'mailboxPool GET ' + path + ' failed: HTTP ' + resp.status + ' ' + body,
      ) as Error & { statusCode: number };
      err.statusCode = resp.status;
      throw err;
    }
    return resp.json() as Promise<T>;
  }

  private async apiPost<T = unknown>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const url = this.apiUrl + path;
    const resp = await fetchWithRegistrationFallback(
      url,
      {
        method: 'POST',
        headers: this.apiHeaders(),
        body: JSON.stringify(body),
      },
      this.selectedProxyUrl || undefined,
    );
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        'mailboxPool POST ' +
          path +
          ' failed: HTTP ' +
          resp.status +
          ' ' +
          text,
      );
    }
    return resp.json() as Promise<T>;
  }

  private async serviceRequest<T = unknown>(
    serviceName: string,
    method: string,
    url: string,
    opts: {
      headers?: Record<string, string>;
      params?: Record<string, string | number | boolean | undefined>;
      body?: Record<string, unknown>;
      expected?: number[];
    } = {},
  ): Promise<T> {
    const fullUrl = url + buildQuery(opts.params ?? {});
    const resp = await fetchWithRegistrationFallback(
      fullUrl,
      {
        method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': 'stagewise-manager/mailbox-service',
          ...(opts.headers ?? {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      },
      this.selectedProxyUrl || undefined,
    );
    const expected = opts.expected ?? [200];
    if (!expected.includes(resp.status)) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        serviceName +
          ' request failed: ' +
          method +
          ' ' +
          url +
          ' HTTP ' +
          resp.status +
          ' ' +
          text.slice(0, 300),
      );
    }
    if (resp.status === 204) return {} as T;
    const text = await resp.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  private async createTempMailbox(): Promise<TempMailbox> {
    if (this.mailboxService === 'cloudflare_temp_email') {
      const cfg = this.mailServices.cloudflareTempEmail ?? {};
      const apiBase = String(cfg.apiBase ?? '').replace(/\/+$/, '');
      const adminPassword = String(cfg.adminPassword ?? '');
      if (!apiBase || !adminPassword) {
        throw new Error(
          'cloudflare_temp_email requires API Base and admin password',
        );
      }
      const domains = parseStringList(cfg.domain);
      const body: Record<string, unknown> = {
        enablePrefix: true,
        name: randomMailboxName(),
      };
      if (domains.length > 0) body.domain = pickRandomString(domains);
      const data = await this.serviceRequest<Record<string, unknown>>(
        'cloudflare_temp_email',
        'POST',
        apiBase + '/admin/new_address',
        {
          headers: { 'x-admin-auth': adminPassword },
          body,
          expected: [200, 201],
        },
      );
      const address = String(data.address ?? '').trim();
      const token = String(data.jwt ?? data.token ?? '').trim();
      if (!address || !token) {
        throw new Error(
          'cloudflare_temp_email did not return address or token',
        );
      }
      return { provider: this.mailboxService, address, token, metadata: data };
    }

    if (this.mailboxService === 'tempmail_lol') {
      const cfg = this.mailServices.tempmailLol ?? {};
      const domains = parseStringList(cfg.domain);
      const body: Record<string, unknown> = {};
      if (domains.length > 0) {
        const domain = pickRandomString(domains).toLowerCase();
        if (domain.startsWith('*.') && domain.length > 2) {
          body.domain = randomSubdomainLabel() + '.' + domain.slice(2);
          body.prefix = randomMailboxName();
        } else {
          body.domain = domain;
        }
      }
      const apiKey = String(cfg.apiKey ?? '').trim();
      const data = await this.serviceRequest<Record<string, unknown>>(
        'tempmail_lol',
        'POST',
        'https://api.tempmail.lol/v2/inbox/create',
        {
          headers: apiKey ? { authorization: 'Bearer ' + apiKey } : undefined,
          body,
          expected: [200, 201],
        },
      );
      const address = String(data.address ?? '').trim();
      const token = String(data.token ?? '').trim();
      if (!address || !token) {
        throw new Error('tempmail_lol did not return address or token');
      }
      return { provider: this.mailboxService, address, token, metadata: data };
    }

    if (this.mailboxService === 'moemail') {
      const cfg = this.mailServices.moemail ?? {};
      const apiBase = String(cfg.apiBase ?? '').replace(/\/+$/, '');
      const apiKey = String(cfg.apiKey ?? '').trim();
      if (!apiBase || !apiKey) {
        throw new Error('moemail requires API Base and API Key');
      }
      const domains = parseStringList(cfg.domain);
      const body: Record<string, unknown> = {
        name: randomMailboxName(),
        expiryTime: Number(cfg.expiryTime ?? 0),
      };
      if (domains.length > 0) body.domain = pickRandomString(domains);
      const data = await this.serviceRequest<Record<string, unknown>>(
        'moemail',
        'POST',
        apiBase + '/api/emails/generate',
        {
          headers: { 'x-api-key': apiKey },
          body,
          expected: [200, 201],
        },
      );
      const address = String(data.email ?? data.address ?? '').trim();
      const emailId = String(data.id ?? data.email_id ?? '').trim();
      if (!address || !emailId) {
        throw new Error('moemail did not return email or id');
      }
      return {
        provider: this.mailboxService,
        address,
        emailId,
        metadata: data,
      };
    }

    if (this.mailboxService === 'inbucket') {
      const cfg = this.mailServices.inbucket ?? {};
      const apiBase = String(cfg.apiBase ?? '').replace(/\/+$/, '');
      const domains = parseStringList(cfg.domain);
      if (!apiBase || domains.length === 0) {
        throw new Error('inbucket requires API Base and domain');
      }
      const baseDomain = pickRandomString(domains);
      const domain =
        cfg.randomSubdomain === false
          ? baseDomain
          : randomSubdomainLabel() + '.' + baseDomain;
      const localPart = randomMailboxName();
      const address = localPart + '@' + domain;
      return {
        provider: this.mailboxService,
        address,
        mailboxName: localPart,
        metadata: { base_domain: baseDomain },
      };
    }

    if (this.mailboxService === 'duckmail') {
      const cfg = this.mailServices.duckmail ?? {};
      const apiKey = String(cfg.apiKey ?? '').trim();
      const defaultDomain = String(cfg.defaultDomain ?? 'duckmail.sbs').trim();
      if (!apiKey) throw new Error('duckmail requires API Key');
      const password =
        Math.random().toString(36).slice(2, 10) +
        Math.random().toString(36).slice(2, 6);
      const address = randomMailboxName() + '@' + defaultDomain;
      const body = { address, password };
      const account = await this.serviceRequest<Record<string, unknown>>(
        'duckmail',
        'POST',
        'https://api.duckmail.sbs/accounts',
        {
          headers: { authorization: 'Bearer ' + apiKey },
          body,
          expected: [200, 201],
        },
      );
      const tokenData = await this.serviceRequest<Record<string, unknown>>(
        'duckmail',
        'POST',
        'https://api.duckmail.sbs/token',
        {
          headers: { authorization: 'Bearer ' + apiKey },
          body,
          expected: [200, 201],
        },
      );
      const token = String(tokenData.token ?? '').trim();
      if (!token) throw new Error('duckmail did not return token');
      return {
        provider: this.mailboxService,
        address,
        token,
        password,
        accountId: String(account.id ?? ''),
        metadata: account,
      };
    }

    throw new Error('Unsupported mailbox service: ' + this.mailboxService);
  }

  private async fetchTempLatestMessage(
    mailbox: TempMailbox,
  ): Promise<NormalizedTempMessage | null> {
    if (mailbox.provider === 'cloudflare_temp_email') {
      const cfg = this.mailServices.cloudflareTempEmail ?? {};
      const apiBase = String(cfg.apiBase ?? '').replace(/\/+$/, '');
      const data = await this.serviceRequest<unknown>(
        'cloudflare_temp_email',
        'GET',
        apiBase + '/api/mails',
        {
          headers: { authorization: 'Bearer ' + String(mailbox.token ?? '') },
          params: { limit: 10, offset: 0 },
        },
      );
      const messages = responseItems(data, [
        'results',
        'items',
        'messages',
      ]).filter((item) => messageMatchesEmail(item, mailbox.address));
      const item = messages[0];
      return item
        ? normalizeTempMessage(mailbox.provider, mailbox.address, item)
        : null;
    }

    if (mailbox.provider === 'tempmail_lol') {
      const cfg = this.mailServices.tempmailLol ?? {};
      const apiKey = String(cfg.apiKey ?? '').trim();
      const data = await this.serviceRequest<unknown>(
        'tempmail_lol',
        'GET',
        'https://api.tempmail.lol/v2/inbox',
        {
          headers: apiKey ? { authorization: 'Bearer ' + apiKey } : undefined,
          params: { token: String(mailbox.token ?? '') },
        },
      );
      const messages = responseItems(data, ['emails', 'messages']);
      const item = messages
        .sort((a, b) => parseEpoch(b.date) - parseEpoch(a.date))
        .at(0);
      return item
        ? normalizeTempMessage(mailbox.provider, mailbox.address, item)
        : null;
    }

    if (mailbox.provider === 'moemail') {
      const cfg = this.mailServices.moemail ?? {};
      const apiBase = String(cfg.apiBase ?? '').replace(/\/+$/, '');
      const apiKey = String(cfg.apiKey ?? '').trim();
      const emailId = String(mailbox.emailId ?? '').trim();
      const data = await this.serviceRequest<Record<string, unknown>>(
        'moemail',
        'GET',
        apiBase + '/api/emails/' + encodeURIComponent(emailId),
        { headers: { 'x-api-key': apiKey } },
      );
      const messages = responseItems(data, ['messages']);
      const item = messages
        .sort(
          (a, b) =>
            parseEpoch(b.createdAt ?? b.created_at ?? b.date ?? b.timestamp) -
            parseEpoch(a.createdAt ?? a.created_at ?? a.date ?? a.timestamp),
        )
        .at(0);
      if (!item) return null;
      const messageId = String(item.id ?? item.message_id ?? item._id ?? '');
      const detail = messageId
        ? await this.serviceRequest<Record<string, unknown>>(
            'moemail',
            'GET',
            apiBase +
              '/api/emails/' +
              encodeURIComponent(emailId) +
              '/' +
              encodeURIComponent(messageId),
            { headers: { 'x-api-key': apiKey } },
          )
        : { message: item };
      const msg =
        detail.message && typeof detail.message === 'object'
          ? (detail.message as Record<string, unknown>)
          : detail;
      return normalizeTempMessage(mailbox.provider, mailbox.address, {
        ...item,
        ...msg,
      });
    }

    if (mailbox.provider === 'inbucket') {
      const cfg = this.mailServices.inbucket ?? {};
      const apiBase = String(cfg.apiBase ?? '').replace(/\/+$/, '');
      const mailboxName = String(mailbox.mailboxName ?? '').trim();
      const data = await this.serviceRequest<unknown>(
        'inbucket',
        'GET',
        apiBase + '/api/v1/mailbox/' + encodeURIComponent(mailboxName),
      );
      const items = responseItems(data, []);
      items.sort((a, b) => parseEpoch(b.date) - parseEpoch(a.date));
      for (const item of items) {
        const messageId = String(item.id ?? '').trim();
        if (!messageId) continue;
        const detail = await this.serviceRequest<Record<string, unknown>>(
          'inbucket',
          'GET',
          apiBase +
            '/api/v1/mailbox/' +
            encodeURIComponent(mailboxName) +
            '/' +
            encodeURIComponent(messageId),
        );
        const header =
          detail.header && typeof detail.header === 'object'
            ? (detail.header as Record<string, unknown>)
            : {};
        const body =
          detail.body && typeof detail.body === 'object'
            ? (detail.body as Record<string, unknown>)
            : {};
        const normalized = normalizeTempMessage(
          mailbox.provider,
          mailbox.address,
          {
            ...detail,
            id: messageId,
            text: body.text,
            html: body.html,
            to: header.To,
          },
        );
        if (messageMatchesEmail({ to: header.To }, mailbox.address)) {
          return normalized;
        }
      }
      return null;
    }

    if (mailbox.provider === 'duckmail') {
      const token = String(mailbox.token ?? '');
      const data = await this.serviceRequest<unknown>(
        'duckmail',
        'GET',
        'https://api.duckmail.sbs/messages',
        {
          headers: { authorization: 'Bearer ' + token },
          params: { page: 1 },
        },
      );
      const items = responseItems(data, ['hydra:member', 'member', 'data']);
      const first = items[0];
      if (!first) return null;
      const messageId = String(first.id ?? first['@id'] ?? '').replace(
        '/messages/',
        '',
      );
      const detail = messageId
        ? await this.serviceRequest<Record<string, unknown>>(
            'duckmail',
            'GET',
            'https://api.duckmail.sbs/messages/' +
              encodeURIComponent(messageId),
            { headers: { authorization: 'Bearer ' + token } },
          )
        : first;
      const html = detail.html;
      return normalizeTempMessage(mailbox.provider, mailbox.address, {
        ...detail,
        id: messageId,
        html: Array.isArray(html) ? html.join('') : html,
      });
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Pool claim (primary path - no group/tag filters needed)
  // ---------------------------------------------------------------------------

  private async claimPoolAccount(): Promise<{
    email: string;
    accountId: string;
    claimToken: string;
    callerId: string;
    taskId: string;
  }> {
    const callerId = randomId();
    const taskId = randomId();
    type ClaimResp = {
      email?: string;
      account_id?: string;
      id?: string;
      claim_token?: string;
    };
    const data = await this.apiPost<ClaimResp>(
      '/api/external/pool/claim-random',
      { caller_id: callerId, task_id: taskId },
    );
    if (!data.email) throw new Error('pool claim-random did not return email');
    return {
      email: String(data.email),
      accountId: String(data.account_id ?? data.id ?? data.email),
      claimToken: String(data.claim_token ?? ''),
      callerId,
      taskId,
    };
  }

  private async claimPoolAccountWithRetry(): Promise<{
    email: string;
    accountId: string;
    claimToken: string;
    callerId: string;
    taskId: string;
  }> {
    const delays = [0, 800, 1500];
    let lastErr: unknown = null;
    for (let i = 0; i < delays.length; i += 1) {
      if (delays[i]! > 0) await sleep(delays[i]!);
      try {
        return await this.claimPoolAccount();
      } catch (err) {
        lastErr = err;
        logRegistrationStep(
          '[mailbox] pool claim-random failed (attempt ' +
            (i + 1) +
            '/' +
            delays.length +
            '): ' +
            String(err),
        );
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  // ---------------------------------------------------------------------------
  // Release / complete pool claim
  // ---------------------------------------------------------------------------

  async releasePoolClaim(
    metadata: Record<string, unknown>,
    reason: string,
  ): Promise<void> {
    const accountId = String(metadata['account_id'] ?? metadata['id'] ?? '');
    const claimToken = String(metadata['claim_token'] ?? '');
    const callerId = String(metadata['caller_id'] ?? '');
    const taskId = String(metadata['task_id'] ?? '');
    if (!accountId || !claimToken || !callerId || !taskId) return;
    try {
      await this.apiPost('/api/external/pool/claim-release', {
        account_id: accountId,
        claim_token: claimToken,
        caller_id: callerId,
        task_id: taskId,
        reason,
      });
    } catch {
      /* best-effort */
    }
  }

  private async completePoolClaim(
    metadata: Record<string, unknown>,
    result: 'success' | 'failed',
    detail: string,
  ): Promise<void> {
    const accountId = String(metadata['account_id'] ?? metadata['id'] ?? '');
    const claimToken = String(metadata['claim_token'] ?? '');
    const callerId = String(metadata['caller_id'] ?? '');
    const taskId = String(metadata['task_id'] ?? '');
    if (!accountId || !claimToken || !callerId || !taskId) return;
    try {
      await this.apiPost('/api/external/pool/claim-complete', {
        account_id: accountId,
        claim_token: claimToken,
        caller_id: callerId,
        task_id: taskId,
        result,
        detail,
      });
    } catch {
      /* best-effort */
    }
  }

  // ---------------------------------------------------------------------------
  // Claim email: pool -> external accounts list -> admin accounts fallback
  // ---------------------------------------------------------------------------

  async claimEmail(): Promise<ClaimedAccount> {
    if (this.mailboxService !== 'outlook-manager-plus') {
      const mailbox = await this.createTempMailbox();
      this.tempMailboxesByEmail.set(mailbox.address.toLowerCase(), mailbox);
      logRegistrationStep(
        '[mailbox] created ' +
          this.mailboxService +
          ' mailbox: ' +
          mailbox.address,
      );
      return {
        email: mailbox.address,
        baseEmail: mailbox.address,
        accountId: mailbox.accountId ?? mailbox.address,
        metadata: {
          mailbox_service: this.mailboxService,
          temp_mailbox: mailbox,
        },
        source: this.mailboxService,
      };
    }

    // Step 1: Try pool claim-random (works when no group/tag filter needed)
    if (!this.groupId && !this.tagIds) {
      try {
        const claimed = await this.claimPoolAccountWithRetry();
        const metadata: Record<string, unknown> = {
          account_id: claimed.accountId,
          claim_token: claimed.claimToken,
          caller_id: claimed.callerId,
          task_id: claimed.taskId,
        };
        const email = claimed.email;
        return {
          email,
          baseEmail: email,
          accountId: claimed.accountId,
          metadata,
          source: 'pool_claim',
        };
      } catch (err) {
        logRegistrationStep(
          '[mailbox] pool claim-random exhausted; falling back to /api/external/accounts: ' +
            String(err),
        );
        // fall through to account list
      }
    } else {
      logRegistrationStep(
        '[mailbox] group/tag filter configured; skip claim-random and use /api/external/accounts',
      );
    }

    // Step 2: /api/external/accounts list
    type AccountsResp = { accounts?: unknown[]; items?: unknown[] };
    const params: Record<string, string | number | boolean | undefined> = {
      limit: 100,
      offset: 0,
      group_id: this.groupId || undefined,
      tag_ids: this.tagIds || undefined,
      include_untagged: this.includeUntagged ? 'true' : undefined,
    };

    let accounts: Array<Record<string, unknown>> = [];
    let source = 'account_list';
    let usedAdmin = false;

    try {
      const data = await this.apiGet<AccountsResp>(
        '/api/external/accounts',
        params,
      );
      accounts = (data.accounts ?? data.items ?? []) as Array<
        Record<string, unknown>
      >;
    } catch (err) {
      // Step 3: fallback to admin /api/accounts on 404
      const status = (err as Error & { statusCode?: number }).statusCode;
      if (status === 404 && this.adminPassword) {
        try {
          type AdminResp = { accounts?: Array<Record<string, unknown>> };
          const csrf = await this.ensureAdminSession();
          const qs = buildQuery({
            page: '1',
            page_size: '100',
            ...(this.groupId ? { group_id: this.groupId } : {}),
          });
          const resp = await fetchWithRegistrationFallback(
            this.apiUrl + '/api/accounts' + qs,
            {
              headers: {
                accept: 'application/json',
                'x-csrftoken': csrf,
                cookie: this.adminCookie,
              },
            },
            this.selectedProxyUrl || undefined,
          );
          if (!resp.ok)
            throw new Error('admin accounts failed: ' + resp.status);
          const data = (await resp.json()) as AdminResp;
          accounts = data.accounts ?? [];
          source = 'account_list_admin';
          usedAdmin = true;
        } catch (adminErr) {
          throw new Error(
            'mailboxPool: /api/external/accounts returned 404 and admin fallback also failed: ' +
              String(adminErr) +
              '. The mailbox service may not support /api/external/accounts. ' +
              'If group_id/tag_ids are not required, clear them to use /api/external/pool/claim-random.',
          );
        }
      } else {
        if (status === 404) {
          throw new Error(
            'mailboxPool: /api/external/accounts returned 404. The mailbox service may not support the account-list API. ' +
              'If group_id/tag_ids are not required, clear them to use /api/external/pool/claim-random.',
          );
        }
        throw err;
      }
    }

    const blockedLower = [
      ...this.skipTagNames,
      ...this.invalidEmailTagNames,
    ].map((n) => n.toLowerCase());

    const usable = accounts.filter((item) => {
      const email = String(item['email'] ?? item['address'] ?? '').trim();
      if (!email) return false;
      const tags = Array.isArray(item['tags'])
        ? (item['tags'] as unknown[])
        : [];
      const tagNames = tags.map((t) => {
        if (typeof t === 'object' && t !== null && 'name' in t)
          return String((t as Record<string, unknown>)['name']).toLowerCase();
        return String(t).toLowerCase();
      });
      if (tagNames.some((tn) => blockedLower.includes(tn))) return false;
      // skip disabled accounts
      const status = String(item['status'] ?? '').toLowerCase();
      const refreshStatus = String(
        item['last_refresh_status'] ?? '',
      ).toLowerCase();
      const disabled = new Set([
        'disabled',
        'deleted',
        'inactive',
        'failed',
        'error',
        'invalid',
      ]);
      return !disabled.has(status) && !disabled.has(refreshStatus);
    });

    if (usable.length === 0) {
      throw new Error(
        'No usable emails in pool (group_id=' +
          this.groupId +
          ', tag_ids=' +
          this.tagIds +
          ', source=' +
          source +
          ')',
      );
    }

    const item = usable[Math.floor(Math.random() * usable.length)]!;
    const baseEmail = String(item['email'] ?? item['address'] ?? '').trim();
    const accountId = String(item['id'] ?? item['account_id'] ?? baseEmail);

    // Generate alias only when NOT using admin source (admin accounts may not support aliases)
    let email = baseEmail;
    if (!usedAdmin) {
      const atIdx = baseEmail.indexOf('@');
      const alias = 'sw' + Date.now().toString(36);
      email =
        atIdx >= 0
          ? baseEmail.slice(0, atIdx) + '+' + alias + baseEmail.slice(atIdx)
          : baseEmail;
    }

    return {
      email,
      baseEmail,
      accountId,
      metadata: { account_id: accountId },
      source,
    };
  }

  // ---------------------------------------------------------------------------
  // OTP polling via /api/external/messages
  // ---------------------------------------------------------------------------

  async pollOtp(
    baseEmail: string,
    opts: {
      sentAfterEpoch?: number;
      sentAfterSlackSeconds?: number;
      timeoutMs?: number;
      onStep?: (msg: string) => void;
      shouldAbort?: () => boolean;
    } = {},
  ): Promise<string> {
    if (this.mailboxService !== 'outlook-manager-plus') {
      return this.pollTempMailboxOtp(baseEmail, opts);
    }

    const {
      sentAfterEpoch = 0,
      sentAfterSlackSeconds = 600,
      timeoutMs = 180_000,
      onStep,
      shouldAbort,
    } = opts;
    const deadline = Date.now() + timeoutMs;
    const seenIds = new Set<string>();
    const folders =
      this.emailFolder === 'all'
        ? ['inbox', 'junkemail', 'deleteditems']
        : [this.emailFolder];

    const step = (msg: string) => {
      logRegistrationStep('[mailbox] ' + msg);
      if (onStep) onStep(msg);
    };
    const checkAbort = () => {
      if (shouldAbort?.()) {
        throw new Error('Registration was cancelled by user.');
      }
    };

    // CR-2026-06-28: rewrite based on GeniusFKoai/core/outlook_email_mailbox.py wait_for_code
    //   - drop /api/emails/{email} admin route (requires login session)
    //   - call /api/external/messages per folder, aggregate the full GeniusFKoai field list
    //   - strip email addresses before regex so digits inside addresses don't match
    //   - on body-preview miss, fetch /api/external/messages/{id} for full body and retry
    //   - verbose per-message logging so failures are diagnosable from the log file

    step(
      '\u5f00\u59cb\u8f6e\u8be2\u90ae\u7bb1 ' +
        baseEmail +
        ' (\u8d85\u65f6 ' +
        Math.floor(timeoutMs / 1000) +
        's, \u6587\u4ef6\u5939=' +
        folders.join(',') +
        ', top=' +
        this.emailTop +
        ', \u95f4\u9694=' +
        this.pollIntervalMs +
        'ms)',
    );
    if (sentAfterEpoch > 0) {
      const cutoffEpoch = sentAfterEpoch - sentAfterSlackSeconds;
      step(
        '\u8fc7\u6ee4\u6761\u4ef6: \u53ea\u8003\u8651 epoch >= ' +
          Math.floor(cutoffEpoch) +
          ' (sentAt=' +
          Math.floor(sentAfterEpoch) +
          ', \u5bbd\u677e ' +
          sentAfterSlackSeconds +
          's \u65f6\u949f\u6f02\u79fb\u5bb9\u5dee)',
      );
    }
    let attempt = 0;
    let lastErrorMessage = '';
    while (Date.now() < deadline) {
      checkAbort();
      attempt += 1;
      let totalThisRound = 0;
      const folderStats: string[] = [];

      for (const folder of folders) {
        checkAbort();
        const params: Record<string, string | number | boolean | undefined> = {
          email: baseEmail,
          folder,
          top: this.emailTop,
          skip: 0,
        };
        const url = this.apiUrl + '/api/external/messages' + buildQuery(params);
        let msgs: Array<Record<string, unknown>> = [];
        try {
          type MessagesResp = {
            emails?: unknown[];
            items?: unknown[];
            messages?: unknown[];
            data?: unknown;
            success?: boolean;
          };
          const data = await this.apiGet<MessagesResp>(
            '/api/external/messages',
            params,
          );
          if (Array.isArray(data.emails))
            msgs = data.emails as Array<Record<string, unknown>>;
          else if (Array.isArray(data.items))
            msgs = data.items as Array<Record<string, unknown>>;
          else if (Array.isArray(data.messages))
            msgs = data.messages as Array<Record<string, unknown>>;
          else if (Array.isArray(data.data))
            msgs = data.data as Array<Record<string, unknown>>;
          else if (data.data && typeof data.data === 'object') {
            const dd = data.data as Record<string, unknown>;
            if (Array.isArray(dd.emails))
              msgs = dd.emails as Array<Record<string, unknown>>;
            else if (Array.isArray(dd.items))
              msgs = dd.items as Array<Record<string, unknown>>;
            else if (Array.isArray(dd.messages))
              msgs = dd.messages as Array<Record<string, unknown>>;
          }
        } catch (err) {
          const errMsg = (err as Error)?.message || String(err);
          lastErrorMessage = errMsg;
          folderStats.push(
            folder + ':\u8bf7\u6c42\u5931\u8d25(' + errMsg.slice(0, 80) + ')',
          );
          step(
            '  \u2192 ' + folder + ' GET ' + url + ' \u5931\u8d25: ' + errMsg,
          );
          continue;
        }

        totalThisRound += msgs.length;
        checkAbort();
        folderStats.push(folder + ':' + msgs.length);
        step(
          '  \u2192 ' +
            folder +
            ' GET ' +
            url +
            ' \u8fd4\u56de ' +
            msgs.length +
            ' \u5c01',
        );
        for (let idx = 0; idx < msgs.length; idx += 1) {
          checkAbort();
          const msg = msgs[idx]!;
          const id = extractMessageId(msg, folder);
          const subject = pickString(msg, ['subject', 'Subject']);
          const fromAddr = pickFromAddress(msg);
          const rawTs =
            msg['timestamp'] ??
            msg['received_at'] ??
            msg['receivedDateTime'] ??
            msg['created_at'] ??
            msg['date'];
          const epoch = parseEpoch(rawTs);
          step(
            '    #' +
              (idx + 1) +
              ' id=' +
              truncate(id, 32) +
              ' from=' +
              (fromAddr || '?') +
              ' subject="' +
              truncate(subject, 80) +
              '" date=' +
              (rawTs ? String(rawTs) : '?') +
              ' epoch=' +
              Math.floor(epoch),
          );

          if (
            id &&
            seenIds.has(id) &&
            !(sentAfterEpoch > 0 && epoch >= sentAfterEpoch - 30)
          ) {
            step('      \u00b7 skip: \u5df2\u5904\u7406\u8fc7');
            continue;
          }
          if (
            sentAfterEpoch > 0 &&
            epoch > 0 &&
            epoch < sentAfterEpoch - sentAfterSlackSeconds
          ) {
            step(
              '      \u00b7 skip: \u65e9\u4e8e\u53d1\u9001\u65f6\u95f4 ' +
                sentAfterSlackSeconds +
                's (epoch=' +
                Math.floor(epoch) +
                ' < ' +
                Math.floor(sentAfterEpoch - sentAfterSlackSeconds) +
                ')',
            );
            if (id) seenIds.add(id);
            continue;
          }

          const fromLower = (fromAddr || '').toLowerCase();
          const subjectLower = (subject || '').toLowerCase();
          const isStagewiseSender = STAGEWISE_FROM_HINTS.some((h) =>
            fromLower.includes(h),
          );
          const isStagewiseSubject = STAGEWISE_SUBJECT_HINTS.some((h) =>
            subjectLower.includes(h),
          );
          if (!isStagewiseSender && !isStagewiseSubject) {
            step(
              '      \u00b7 skip: \u53d1\u4ef6\u4eba/\u4e3b\u9898\u4e0d\u5305\u542b stagewise \u5173\u952e\u5b57\uff0c\u8df3\u8fc7\u4ee5\u907f\u514d\u968f\u673a 6 \u4f4d\u6570\u5b57\u8bef\u5339\u914d',
            );
            if (id) seenIds.add(id);
            continue;
          }
          const previewText = collectMessageText(msg);
          const sanitized = stripEmailAddresses(previewText);
          const previewExtract = extractStagewiseOtp(sanitized);
          step(
            '      \u00b7 preview text len=' +
              sanitized.length +
              ', all 6-digit candidates=[' +
              previewExtract.allMatches
                .map((m) => m.slice(0, 2) + '****' + m.slice(-1))
                .join(',') +
              '], matchedBy=' +
              previewExtract.matchedBy +
              ', sample="' +
              truncate(sanitized, 200) +
              '"',
          );
          if (previewExtract.otp) {
            step(
              '  \u2713 [' +
                folder +
                '] \u63d0\u53d6\u5230 OTP=' +
                previewExtract.otp.slice(0, 2) +
                '****' +
                previewExtract.otp.slice(-1) +
                ' from=' +
                (fromAddr || '?') +
                ' subject=' +
                truncate(subject, 60) +
                ' (matchedBy=' +
                previewExtract.matchedBy +
                ')',
            );
            return previewExtract.otp;
          }
          // GeniusFKoai parity: try to fetch full message detail if preview missed.
          if (id) {
            try {
              type DetailResp = {
                email?: Record<string, unknown>;
                data?: Record<string, unknown>;
                success?: boolean;
              };
              const detail = await this.apiGet<DetailResp>(
                '/api/external/messages/' + encodeURIComponent(id),
                { email: baseEmail, folder },
              );
              const detailMsg =
                (detail?.email as Record<string, unknown> | undefined) ??
                (detail?.data && typeof detail.data === 'object'
                  ? (detail.data as Record<string, unknown>)
                  : undefined) ??
                (detail as unknown as Record<string, unknown>);
              const fullText = stripEmailAddresses(
                collectMessageText({ ...msg, ...(detailMsg || {}) }),
              );
              const detailExtract = extractStagewiseOtp(fullText);
              step(
                '      \u00b7 detail text len=' +
                  fullText.length +
                  ', all 6-digit candidates=[' +
                  detailExtract.allMatches
                    .map((m) => m.slice(0, 2) + '****' + m.slice(-1))
                    .join(',') +
                  '], matchedBy=' +
                  detailExtract.matchedBy +
                  ', sample="' +
                  truncate(fullText, 240) +
                  '"',
              );
              if (detailExtract.otp) {
                step(
                  '  \u2713 [' +
                    folder +
                    '] \u8be6\u60c5\u63d0\u53d6\u5230 OTP=' +
                    detailExtract.otp.slice(0, 2) +
                    '****' +
                    detailExtract.otp.slice(-1) +
                    ' subject=' +
                    truncate(subject, 60) +
                    ' (matchedBy=' +
                    detailExtract.matchedBy +
                    ')',
                );
                return detailExtract.otp;
              }
            } catch (detailErr) {
              const dm = (detailErr as Error)?.message || String(detailErr);
              step('      \u00b7 detail \u8bf7\u6c42\u5931\u8d25: ' + dm);
            }
          }

          if (id) seenIds.add(id);
        }
      }

      step(
        '\u8f6e\u8be2 #' +
          attempt +
          ' \u7ed3\u675f\uff0c\u5404\u6587\u4ef6\u5939: ' +
          folderStats.join(', ') +
          (totalThisRound === 0
            ? '\uff0c\u672c\u8f6e\u672a\u83b7\u53d6\u5230\u4efb\u4f55\u90ae\u4ef6'
            : ''),
      );

      if (Date.now() >= deadline) break;
      const sleepUntil = Date.now() + this.pollIntervalMs;
      while (Date.now() < sleepUntil) {
        checkAbort();
        await new Promise<void>((res) =>
          setTimeout(res, Math.min(500, sleepUntil - Date.now())),
        );
      }
    }

    step(
      '\u8f6e\u8be2\u8d85\u65f6\u672a\u53d6\u5230 OTP\uff0c\u6700\u540e\u9519\u8bef: ' +
        (lastErrorMessage || '\u65e0'),
    );
    throw new Error('OTP polling timed out after ' + timeoutMs / 1000 + 's');
  }

  private async pollTempMailboxOtp(
    baseEmail: string,
    opts: {
      sentAfterEpoch?: number;
      sentAfterSlackSeconds?: number;
      timeoutMs?: number;
      onStep?: (msg: string) => void;
      shouldAbort?: () => boolean;
    } = {},
  ): Promise<string> {
    const {
      sentAfterEpoch = 0,
      sentAfterSlackSeconds = 600,
      timeoutMs = 180_000,
      onStep,
      shouldAbort,
    } = opts;
    const mailbox = this.tempMailboxesByEmail.get(baseEmail.toLowerCase());
    if (!mailbox) {
      throw new Error('Temporary mailbox metadata not found for ' + baseEmail);
    }
    const deadline = Date.now() + timeoutMs;
    const seenIds = new Set<string>();
    const step = (msg: string) => {
      logRegistrationStep('[mailbox] ' + msg);
      if (onStep) onStep(msg);
    };
    const checkAbort = () => {
      if (shouldAbort?.()) {
        throw new Error('Registration was cancelled by user.');
      }
    };

    step(
      '开始轮询 ' +
        this.mailboxService +
        ' 邮箱 ' +
        baseEmail +
        ' (超时 ' +
        Math.floor(timeoutMs / 1000) +
        's, 间隔=' +
        this.pollIntervalMs +
        'ms)',
    );

    let attempt = 0;
    let lastErrorMessage = '';
    while (Date.now() < deadline) {
      checkAbort();
      attempt += 1;
      try {
        const msg = await this.fetchTempLatestMessage(mailbox);
        if (!msg) {
          step('轮询 #' + attempt + ' 未获取到邮件');
        } else {
          const id =
            msg.messageId ||
            msg.provider +
              ':' +
              msg.mailbox +
              ':' +
              msg.receivedEpoch +
              ':' +
              msg.subject;
          step(
            '轮询 #' +
              attempt +
              ' 获取到邮件 id=' +
              truncate(id, 32) +
              ' from=' +
              (msg.sender || '?') +
              ' subject="' +
              truncate(msg.subject, 80) +
              '" epoch=' +
              Math.floor(msg.receivedEpoch),
          );
          if (
            id &&
            seenIds.has(id) &&
            !(sentAfterEpoch > 0 && msg.receivedEpoch >= sentAfterEpoch - 30)
          ) {
            step('  · skip: 已处理过');
          } else if (
            sentAfterEpoch > 0 &&
            msg.receivedEpoch > 0 &&
            msg.receivedEpoch < sentAfterEpoch - sentAfterSlackSeconds
          ) {
            step(
              '  · skip: 早于发送时间 ' +
                sentAfterSlackSeconds +
                's (epoch=' +
                Math.floor(msg.receivedEpoch) +
                ' < ' +
                Math.floor(sentAfterEpoch - sentAfterSlackSeconds) +
                ')',
            );
            if (id) seenIds.add(id);
          } else {
            const fromLower = msg.sender.toLowerCase();
            const subjectLower = msg.subject.toLowerCase();
            const isStagewiseSender = STAGEWISE_FROM_HINTS.some((h) =>
              fromLower.includes(h),
            );
            const isStagewiseSubject = STAGEWISE_SUBJECT_HINTS.some((h) =>
              subjectLower.includes(h),
            );
            if (!isStagewiseSender && !isStagewiseSubject) {
              step('  · skip: 发件人/主题不包含 stagewise 关键字');
              if (id) seenIds.add(id);
            } else {
              const text = stripEmailAddresses(
                stripHtml(
                  [
                    msg.subject,
                    msg.sender,
                    msg.textContent,
                    msg.htmlContent,
                  ].join(' '),
                ),
              );
              const extracted = extractStagewiseOtp(text);
              step(
                '  · text len=' +
                  text.length +
                  ', all 6-digit candidates=[' +
                  extracted.allMatches
                    .map((m) => m.slice(0, 2) + '****' + m.slice(-1))
                    .join(',') +
                  '], matchedBy=' +
                  extracted.matchedBy +
                  ', sample="' +
                  truncate(text, 200) +
                  '"',
              );
              if (extracted.otp) {
                step(
                  '✓ 提取到 OTP=' +
                    extracted.otp.slice(0, 2) +
                    '****' +
                    extracted.otp.slice(-1) +
                    ' subject=' +
                    truncate(msg.subject, 60),
                );
                return extracted.otp;
              }
              if (id) seenIds.add(id);
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        lastErrorMessage = message;
        step('轮询 #' + attempt + ' 请求失败: ' + message);
      }

      if (Date.now() >= deadline) break;
      const sleepUntil = Date.now() + this.pollIntervalMs;
      while (Date.now() < sleepUntil) {
        checkAbort();
        await new Promise<void>((res) =>
          setTimeout(res, Math.min(500, sleepUntil - Date.now())),
        );
      }
    }

    step('轮询超时未取到 OTP，最后错误: ' + (lastErrorMessage || '无'));
    throw new Error('OTP polling timed out after ' + timeoutMs / 1000 + 's');
  }
  // ---------------------------------------------------------------------------
  // Post-registration tagging
  // ---------------------------------------------------------------------------

  async markRegistered(
    baseEmail: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    // Complete pool claim if applicable
    void this.completePoolClaim(metadata, 'success', 'registration_success');

    if (!this.adminPassword || this.registerSuccessTagNames.length === 0)
      return;
    try {
      await this.applyTags(baseEmail, this.registerSuccessTagNames);
    } catch {
      /* best-effort */
    }
  }

  async markInvalid(
    baseEmail: string,
    metadata: Record<string, unknown> = {},
    reason = 'invalid_email_no_otp',
  ): Promise<void> {
    void this.completePoolClaim(metadata, 'failed', reason);
    if (!this.adminPassword || this.invalidEmailTagNames.length === 0) return;
    try {
      await this.applyTags(baseEmail, this.invalidEmailTagNames);
    } catch {
      /* best-effort */
    }
  }

  // ---------------------------------------------------------------------------
  // Test connection (verify API key and list accounts)
  // ---------------------------------------------------------------------------

  async testConnection(): Promise<{
    ok: boolean;
    accountCount?: number;
    error?: string;
  }> {
    if (this.mailboxService !== 'outlook-manager-plus') {
      try {
        const mailbox = await this.createTempMailbox();
        this.tempMailboxesByEmail.set(mailbox.address.toLowerCase(), mailbox);
        return { ok: true, accountCount: 1 };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // Try external API first, fall back to admin if 404
    try {
      type AccountsResp = { accounts?: unknown[]; items?: unknown[] };
      const data = await this.apiGet<AccountsResp>('/api/external/accounts', {
        limit: 5,
        offset: 0,
      });
      const items = (data.accounts ?? data.items ?? []) as unknown[];
      return { ok: true, accountCount: items.length };
    } catch (extErr) {
      const status = (extErr as Error & { statusCode?: number }).statusCode;
      if (status === 404 && this.adminPassword) {
        try {
          type AdminResp = { accounts?: unknown[]; total?: number };
          const csrf = await this.ensureAdminSession();
          const qs = buildQuery({
            page: '1',
            page_size: '5',
            ...(this.groupId ? { group_id: this.groupId } : {}),
          });
          const resp = await fetchWithRegistrationFallback(
            this.apiUrl + '/api/accounts' + qs,
            {
              headers: {
                accept: 'application/json',
                'x-csrftoken': csrf,
                cookie: this.adminCookie,
              },
            },
            this.selectedProxyUrl || undefined,
          );
          if (!resp.ok) throw new Error('admin accounts: ' + resp.status);
          const data = (await resp.json()) as AdminResp;
          const count = (data.accounts ?? []).length;
          return { ok: true, accountCount: count };
        } catch (adminErr) {
          return {
            ok: false,
            error:
              '\u5916\u90e8 API 404\uff0cadmin \u767b\u5f55\u5931\u8d25: ' +
              String(adminErr),
          };
        }
      }
      return { ok: false, error: String(extErr) };
    }
  }

  // ---------------------------------------------------------------------------
  // Admin session helpers
  // ---------------------------------------------------------------------------

  private async ensureAdminSession(): Promise<string> {
    if (this.adminCsrfToken) return this.adminCsrfToken;
    if (!this.adminPassword) throw new Error('Admin password not configured');
    const loginResp = await fetchWithRegistrationFallback(
      this.apiUrl + '/login',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ password: this.adminPassword }),
      },
      this.selectedProxyUrl || undefined,
    );
    // Capture session cookie
    const setCookie = loginResp.headers.get('set-cookie') ?? '';
    this.adminCookie = setCookie
      .split(',')
      .map((c: string) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
    const csrfResp = await fetchWithRegistrationFallback(
      this.apiUrl + '/api/csrf-token',
      {
        headers: { accept: 'application/json', cookie: this.adminCookie },
      },
      this.selectedProxyUrl || undefined,
    );
    if (!csrfResp.ok)
      throw new Error('Failed to get CSRF token: ' + csrfResp.status);
    const csrfData = (await csrfResp.json()) as { csrf_token?: string };
    this.adminCsrfToken = csrfData.csrf_token ?? '';
    return this.adminCsrfToken;
  }

  private async applyTags(
    baseEmail: string,
    tagNames: string[],
  ): Promise<void> {
    const csrf = await this.ensureAdminSession();
    const accountId = await this.resolveAccountId(baseEmail, csrf);
    if (!accountId) return;
    for (const tagName of tagNames) {
      const tagId = await this.getOrCreateTagId(tagName, csrf);
      if (!tagId) continue;
      await fetchWithRegistrationFallback(
        this.apiUrl + '/api/accounts/tags',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-csrftoken': csrf,
            cookie: this.adminCookie,
          },
          body: JSON.stringify({
            account_ids: [accountId],
            tag_id: tagId,
            action: 'add',
          }),
        },
        this.selectedProxyUrl || undefined,
      );
    }
  }

  private async resolveAccountId(
    baseEmail: string,
    csrf: string,
  ): Promise<unknown> {
    type AdminResp = { accounts?: Array<Record<string, unknown>> };
    const qs = buildQuery({
      page: '1',
      page_size: '50',
      ...(this.groupId ? { group_id: this.groupId } : {}),
    });
    const resp = await fetchWithRegistrationFallback(
      this.apiUrl + '/api/accounts' + qs,
      {
        headers: {
          accept: 'application/json',
          'x-csrftoken': csrf,
          cookie: this.adminCookie,
        },
      },
      this.selectedProxyUrl || undefined,
    );
    const data = (await resp.json()) as AdminResp;
    const acct = (data.accounts ?? []).find(
      (a) => String(a['email'] ?? '').toLowerCase() === baseEmail.toLowerCase(),
    );
    return acct ? (acct['id'] ?? acct['account_id']) : null;
  }

  private async getOrCreateTagId(
    tagName: string,
    csrf: string,
  ): Promise<number | null> {
    type TagsResp = { tags?: Array<{ id: number; name: string }> };
    const resp = await fetchWithRegistrationFallback(
      this.apiUrl + '/api/tags',
      {
        headers: {
          accept: 'application/json',
          'x-csrftoken': csrf,
          cookie: this.adminCookie,
        },
      },
      this.selectedProxyUrl || undefined,
    );
    const tagsData = (await resp.json()) as TagsResp;
    const existing = (tagsData.tags ?? []).find(
      (t) => t.name.toLowerCase() === tagName.toLowerCase(),
    );
    if (existing) return existing.id;
    type CreateTagResp = { tag?: { id: number } };
    const created = await fetchWithRegistrationFallback(
      this.apiUrl + '/api/tags',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-csrftoken': csrf,
          cookie: this.adminCookie,
        },
        body: JSON.stringify({ name: tagName, color: '#1a1a1a' }),
      },
      this.selectedProxyUrl || undefined,
    ).then((r) => r.json() as Promise<CreateTagResp>);
    return created.tag?.id ?? null;
  }
}
