import { supabase } from '@/lib/supabase';
import { getOrCreateTrialDeviceId, getTrialBrowserFingerprint, type TrialLicense } from '@/lib/trial';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.forexanalyzerpro.com/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');
const REFERRAL_STORAGE_KEY = 'forexAnalyzer.referralCode';

let cachedAccessToken: string | null | undefined;
let tokenLoad: Promise<string | null> | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token || null;
  tokenLoad = null;
});

export function getStoredReferralCode() {
  try {
    return (localStorage.getItem(REFERRAL_STORAGE_KEY) || '').trim().toUpperCase();
  } catch {
    return '';
  }
}

export function clearStoredReferralCode() {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // Ignore storage failures; referral acceptance is already persisted server-side.
  }
}

export function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

export function storeReferralCode(rawCode: string | null | undefined) {
  const code = String(rawCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
  if (!code) return;
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch {
    // Ignore storage failures; the referral still works if the URL is present during auth.
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken !== undefined) return cachedAccessToken;
  if (!tokenLoad) {
    tokenLoad = supabase.auth.getSession().then(({ data }) => {
      cachedAccessToken = data.session?.access_token || null;
      return cachedAccessToken;
    });
  }
  return tokenLoad;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const deviceId = getOrCreateTrialDeviceId();
  if (deviceId) headers.set('x-fap-device-id', deviceId);
  const browserFingerprint = getTrialBrowserFingerprint();
  if (browserFingerprint) headers.set('x-fap-device-fingerprint', browserFingerprint);
  const timezone = getBrowserTimeZone();
  if (timezone) headers.set('x-fap-timezone', timezone);
  const referralCode = getStoredReferralCode();
  if (referralCode) headers.set('x-fap-referral-code', referralCode);

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const payload = await res.json();
      detail = String(payload?.error || payload?.message || '');
    } catch {
      try {
        detail = await res.text();
      } catch {
        detail = '';
      }
    }
    throw new Error(detail ? `API Error: ${res.status} - ${detail}` : `API Error: ${res.status}`);
  }
  return res.json();
}

// Types matching the server v2 response shapes
export interface ServerDashboardData {
  meta: Record<string, unknown>;
  account: Record<string, unknown>;
  open_positions: unknown[];
  pending_orders: unknown[];
  trade_history: unknown[];
  analytics: Record<string, unknown>;
  insights: unknown[];
  symbols: unknown[];
  risk_config: Record<string, unknown>;
  copy_config: Record<string, unknown>;
  journal_pending: unknown[];
  ea_status: Record<string, unknown> | null;
  server_meta: {
    processed_at: number;
    data_age_seconds: number;
    ws_clients: number;
    ea_online: boolean;
  };
}

export type ShareExpiry = '24h' | '7d' | 'never';
export type ShareSection =
  | 'overview'
  | 'analytics'
  | 'risk_metrics'
  | 'trade_breakdown'
  | 'calendar'
  | 'open_positions'
  | 'closed_trades';

export interface ShareLinkRecord {
  token: string;
  accountId: string;
  label?: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt?: string | null;
}

export interface PublicShareResponse {
  link: ShareLinkRecord;
  payload: {
    accountId: string;
    accountAlias: string;
    online: boolean;
    lastSeen: number | null;
    generatedAt: number;
    snapshot: ServerDashboardData | null;
  };
}

export type SupportCategory =
  | 'account_connection'
  | 'ea_api_key'
  | 'billing'
  | 'trade_data'
  | 'copy_trading'
  | 'alerts'
  | 'general';

export type SupportPriority = 'low' | 'normal' | 'urgent';
export type SupportStatus = 'open' | 'pending' | 'resolved' | 'closed';

export interface SupportCustomer {
  userId: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  accountId: string;
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  assignedTo: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  customer?: SupportCustomer;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  userId: string;
  senderRole: 'user' | 'agent';
  body: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface SupportAgent {
  userId: string;
  role: string;
  displayName: string;
}

export interface ReferralRecord {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  referralCode: string;
  awardedDays: number;
  awardedAt: string;
  createdAt: string;
  referredUser?: SupportCustomer;
}

export interface ReferralSummary {
  code: string | null;
  link: string | null;
  bonusDays: number;
  referrals: ReferralRecord[];
}

export interface TradingStreak {
  currentStreak: number;
  longestStreak: number;
  active: boolean;
  fireState: 'burning' | 'dull' | string;
  status: string;
  activationPending?: boolean;
  requiredActiveMs?: number;
  activeSessionMs?: number;
  activationProgress?: number;
  today: string;
  timezone: string;
  marketDay: boolean;
  marketPaused: boolean;
  lastActiveDate: string | null;
  lastSeenAt: string | null;
  restoreLimit: number;
  restoresUsedThisMonth: number;
  restoresRemaining: number;
  totalRestoresUsed: number;
  monthlyRestorePeriod: string;
  nextMilestone: number | null;
  milestonesSent: number[];
  consistencyLabel: string;
  restored?: boolean;
  lost?: boolean;
  restoresUsed?: number;
  milestoneAchieved?: {
    days: number;
    title: string;
    message: string;
  } | null;
}

export interface AdminClientOverview {
  user_id: string;
  email?: string;
  full_name?: string;
  nickname?: string;
  plan_mode?: string;
  license_status?: string;
  trial_started_at?: string;
  trial_ends_at?: string;
  grace_ends_at?: string;
  paid_until?: string;
  account_id?: string;
  connection_method?: string;
  broker?: string;
  account_role?: string;
  balance?: number | string | null;
  equity?: number | string | null;
  open_trades?: number | string | null;
  closed_trades?: number | string | null;
  ea_status?: string | null;
  last_seen_at?: string | null;
  snapshot_updated_at?: string | null;
}

export interface FeedbackResponse {
  id: string;
  userId?: string;
  email?: string;
  name?: string;
  sessionId?: string;
  pagePath?: string;
  score?: number;
  responses: Record<string, unknown>;
  userAgent?: string;
  createdAt: string;
}

export interface AdminAccountInsight {
  userId?: string;
  userName?: string;
  userEmail?: string;
  accountId: string;
  accountName: string;
  broker: string;
  server: string;
  currency: string;
  leverage: string;
  accountType: string;
  environment: 'live' | 'demo' | 'unknown' | string;
  connectionMethod: string;
  role: string;
  online: boolean;
  eaStatus: string;
  lastSeenAt: string | null;
  snapshotUpdatedAt: string | null;
  balance: number | null;
  equity: number | null;
  runningProfit: number | null;
  realizedProfit: number | null;
  initialDeposit: number | null;
  initialDepositSource: 'ea' | 'estimated' | string;
  firstDeposit: number | null;
  totalDeposits: number | null;
  totalWithdrawals: number | null;
  netDeposits: number | null;
  totalCredit: number | null;
  estimatedInitialDeposit: number | null;
  openTrades: number;
  closedTrades: number;
  winRate: number | null;
  profitFactor: number | null;
  maxDrawdown: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  bestSymbol: { symbol: string; profit: number | null; winRate: number | null } | null;
  lastTradeAt: string | null;
}

export interface AdminUserInsight {
  userId: string;
  email: string;
  name: string;
  avatar: string;
  planMode: string;
  licenseStatus: string;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  paidUntil: string | null;
  lastSeenAt: string | null;
  pageViewsToday: number;
  mostUsedPage: string;
  openTickets: number;
  pendingTickets: number;
  feedbackCount: number;
  latestFeedbackScore: number | null;
  accounts: AdminAccountInsight[];
  accountCount: number;
  totalBalance: number;
  totalEquity: number;
  streak?: TradingStreak | null;
}

export interface AdminInsightsResponse {
  agent: SupportAgent;
  generatedAt: string;
  metrics: {
    totalUsers: number;
    usersOpenedToday: number;
    activeLastHour: number;
    pageViewsToday: number;
    mostUsedPage: string;
    connectedAccounts: number;
    liveAccounts: number;
    demoAccounts: number;
    onlineAccounts: number;
    totalTrackedBalance: number;
    totalTrackedEquity: number;
    liveTrackedBalance: number;
    demoTrackedBalance: number;
    liveTrackedEquity: number;
    demoTrackedEquity: number;
    openTickets: number;
    urgentTickets: number;
    solvedTickets: number;
    archivedTickets: number;
    archivedSupportMessages: number;
    feedbackCount: number;
    averageFeedbackScore: number | null;
  };
  pageUsage: Array<{ path: string; views: number }>;
  ticketTotals: Record<string, number>;
  warnings?: string[];
  users: AdminUserInsight[];
  accounts: AdminAccountInsight[];
  recentFeedback: FeedbackResponse[];
}

/**
 * EASettings — full remote configuration for the EA (v5.0.0).
 * Sent by GET /ea/settings/:accountId and accepted by PUT /api/accounts/:accountId/settings.
 * All fields are optional on save (server merges with defaults).
 */
export interface EASettings {
  // Identity (v5.1.0: server-managed, derived from copy pairs — read-only on dashboard)
  EARole?: 'STANDALONE' | 'MASTER' | 'SLAVE';
  MasterAccountId?: string;
  // Timing (v5.1.0: advanced/operator-only — hidden from regular users)
  LivePushIntervalMs?: number;
  StatusPushIntervalMs?: number;
  StaticPushIntervalMs?: number;
  CommandPollMs?: number;
  /** @deprecated v5.1.0: locked ON in EA, stripped from API responses. */
  IncludeHistory?: boolean;
  /** @deprecated v5.1.0: locked unlimited in EA, stripped from API responses. */
  MaxHistoryDays?: number;
  // Copy trading
  LotMultiplier?: number;
  UseFixedLot?: boolean;
  FixedLotSize?: number;
  CopyStopLoss?: boolean;
  CopyTakeProfit?: boolean;
  // Risk management
  EnableRiskManager?: boolean;
  MaxLotSize?: number;
  MaxOpenTrades?: number;
  MaxDrawdownPct?: number;
  MaxDailyLossPct?: number;
  EquityProtectionPct?: number;
  AutoResumeDaily?: boolean;
  // Session filters
  FilterBySession?: boolean;
  TradeAsia?: boolean;
  TradeLondon?: boolean;
  TradeNewYork?: boolean;
  TradeOverlap?: boolean;
  // Execution & alerts
  MaxRetries?: number;
  RetryDelayMs?: number;
  SlippagePoints?: number;
  MagicNumberBase?: number;
  /** @deprecated v5.1.0: locked ON in EA — read-only on dashboard. */
  EnablePriceAlerts?: boolean;
  EnablePushNotifications?: boolean;
  EnablePCAlerts?: boolean;
  AlertReloadMs?: number;
}

export const api = {
  // Health check
  health: () => request<{ status: string; version: string; accounts: number; supabase_database?: boolean }>('/health'),

  auth: {
    me: () => request<{
      user: { id: string; email: string; name: string; avatar?: string };
      eaKey: { key_prefix: string; created_at: string } | null;
      license: TrialLicense;
      supportAgent: SupportAgent | null;
      referral: Omit<ReferralSummary, 'referrals'> & { accepted?: ReferralRecord | null };
      streak?: TradingStreak | null;
    }>('/auth/me'),
    rotateEaKey: () => request<{ apiKey: string; keyPrefix: string; message: string }>('/auth/ea-key/rotate', { method: 'POST' }),
  },

  referrals: {
    me: () => request<ReferralSummary>('/referrals/me'),
  },

  feedback: {
    submit: (data: {
      score?: number;
      responses: Record<string, unknown>;
      sessionId?: string;
      pagePath?: string;
      email?: string;
    }) =>
      request<{ success: boolean }>('/public/feedback', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  activity: {
    pageView: (data: { pagePath: string; pageTitle?: string; referrer?: string; metadata?: Record<string, unknown> }) =>
      request<{ success: boolean; missingTable?: boolean }>('/activity/page-view', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  streak: {
    me: () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return request<{ streak: TradingStreak; missingTable?: boolean; databaseDisabled?: boolean }>(
        `/streak/me?timezone=${encodeURIComponent(timezone || '')}`,
      );
    },
    checkIn: (data?: { pagePath?: string; source?: string; activeSessionMs?: number }) =>
      request<{ streak: TradingStreak; missingTable?: boolean; databaseDisabled?: boolean }>('/streak/check-in', {
        method: 'POST',
        body: JSON.stringify({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          metadata: {
            source: data?.source || 'site_open',
            pagePath: data?.pagePath || window.location.pathname,
            activeSessionMs: data?.activeSessionMs || 0,
          },
        }),
      }),
  },

  share: {
    list: (accountId: string) =>
      request<{ links: ShareLinkRecord[] }>(`/share-links?accountId=${encodeURIComponent(accountId)}`),
    create: (data: { accountId: string; expiry: ShareExpiry; label?: string; sections?: ShareSection[] }) =>
      request<{ link: ShareLinkRecord }>('/share-links', { method: 'POST', body: JSON.stringify(data) }),
    revoke: (token: string) =>
      request<{ success: boolean }>(`/share-links/${encodeURIComponent(token)}`, { method: 'DELETE' }),
    resolvePublic: async (token: string) => {
      const res = await fetch(`${API_ORIGIN}/public/share/${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error(res.status === 410 ? 'Share link expired' : 'Share link not found');
      return res.json() as Promise<PublicShareResponse>;
    },
  },

  // Multi-account endpoints (v2)
  accounts: {
    list: () => request<Record<string, unknown>>('/accounts'),
    register: (data: { accountId: string; config?: Record<string, unknown> }) =>
      request('/accounts/register', { method: 'POST', body: JSON.stringify(data) }),
    updateConfig: (accountId: string, config: Record<string, unknown>) =>
      request(`/accounts/${accountId}/config`, { method: 'PUT', body: JSON.stringify(config) }),
    delete: (accountId: string) =>
      request(`/accounts/${accountId}`, { method: 'DELETE' }),
    dashboard: (accountId: string) =>
      request<ServerDashboardData>(`/accounts/${accountId}/dashboard`),
    status: (accountId: string) =>
      request<{ online: boolean; lastSeen: number; eaStatus: unknown }>(`/accounts/${accountId}/status`),
    positions: (accountId: string) =>
      request<unknown[]>(`/accounts/${accountId}/positions`),
    history: (accountId: string, params?: { symbol?: string; session?: string; day?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.symbol) qs.set('symbol', params.symbol);
      if (params?.session) qs.set('session', params.session);
      if (params?.day) qs.set('day', params.day);
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.offset) qs.set('offset', String(params.offset));
      const query = qs.toString();
      return request<{ total: number; data: unknown[] }>(`/accounts/${accountId}/history${query ? '?' + query : ''}`);
    },
    analytics: (accountId: string) =>
      request<Record<string, unknown>>(`/accounts/${accountId}/analytics`),
  },

  // Per-account command endpoints (v2)
  commands: {
    send: (accountId: string, command: Record<string, unknown>) =>
      request(`/accounts/${accountId}/command`, { method: 'POST', body: JSON.stringify(command) }),
    open: (accountId: string, data: { symbol: string; order_type: string; lots: number; sl?: number; tp?: number }) =>
      request(`/accounts/${accountId}/open`, { method: 'POST', body: JSON.stringify(data) }),
    close: (accountId: string, ticket: string | number) =>
      request(`/accounts/${accountId}/close/${ticket}`, { method: 'POST' }),
    closeAll: (accountId: string) =>
      request(`/accounts/${accountId}/close-all`, { method: 'POST' }),
    modify: (accountId: string, ticket: string | number, data: { sl?: number; tp?: number }) =>
      request(`/accounts/${accountId}/modify/${ticket}`, { method: 'POST', body: JSON.stringify(data) }),
    partialClose: (accountId: string, ticket: string | number, data: { lots: number }) =>
      request(`/accounts/${accountId}/partial-close/${ticket}`, { method: 'POST', body: JSON.stringify(data) }),
    pause: (accountId: string) =>
      request(`/accounts/${accountId}/pause`, { method: 'POST' }),
    resume: (accountId: string) =>
      request(`/accounts/${accountId}/resume`, { method: 'POST' }),
    breakeven: (accountId: string, ticket: string | number) =>
      request(`/accounts/${accountId}/breakeven/${ticket}`, { method: 'POST' }),
    trail: (accountId: string, ticket: string | number, trailPips: number) =>
      request(`/accounts/${accountId}/trail/${ticket}`, { method: 'POST', body: JSON.stringify({ trail_pips: trailPips }) }),
    log: (limit = 50) =>
      request<{ commands: unknown[] }>(`/commands?limit=${limit}`),
  },

  // Copy trading endpoints (v4.1.0)
  copy: {
    getPairs: () =>
      request<{ pairs: Array<{ masterAccountId: string; slaveAccountId: string; lotMultiplier: number; copySL: boolean; copyTP: boolean; active: boolean; createdAt?: string; latency?: { avg_ms: number; min_ms: number; max_ms: number; last_ms: number; count: number } | null }> }>('/copy/pairs'),
    createPair: (data: { masterAccountId: string; slaveAccountId?: string; slaveAccountIds?: string[]; lotMultiplier?: number; copySL?: boolean; copyTP?: boolean }) =>
      request('/copy/pairs', { method: 'POST', body: JSON.stringify(data) }),
    updatePair: (slaveAccountId: string, data: { lotMultiplier?: number; copySL?: boolean; copyTP?: boolean; active?: boolean }) =>
      request(`/copy/pairs/${slaveAccountId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePair: (slaveAccountId: string) =>
      request(`/copy/pairs/${slaveAccountId}`, { method: 'DELETE' }),
    latency: () =>
      request<{ latency: Record<string, { avg_ms: number; min_ms: number; max_ms: number; last_ms: number; samples: number }> }>('/copy/latency'),
    queueStats: () =>
      request<{ queues: Record<string, { depth: number; seen_tickets: number; pending_close: number }> }>('/copy/queue-stats'),
  },

  // Alerts (per ALERTS_INTEGRATION.md)
  alerts: {
    list: (accountId: string) =>
      request<{ alerts: unknown[] }>(`/alerts/${accountId}`),
    saveAll: (accountId: string, alerts: unknown[]) =>
      request<{ ok: boolean; count: number }>(`/alerts/${accountId}`, {
        method: 'POST',
        body: JSON.stringify({ alerts }),
      }),
  },

  support: {
    listTickets: () =>
      request<{ tickets: SupportTicket[] }>('/support/tickets'),
    createTicket: (data: {
      subject: string;
      body: string;
      category: SupportCategory;
      priority: SupportPriority;
      accountId?: string;
    }) =>
      request<{ ticket: SupportTicket; messages: SupportMessage[] }>('/support/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getTicket: (ticketId: string) =>
      request<{ ticket: SupportTicket; messages: SupportMessage[] }>(`/support/tickets/${ticketId}`),
    sendMessage: (ticketId: string, body: string) =>
      request<{ ticket: SupportTicket; message: SupportMessage }>(`/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    updateStatus: (ticketId: string, status: Extract<SupportStatus, 'open' | 'closed'>) =>
      request<{ ticket: SupportTicket }>(`/support/tickets/${ticketId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    admin: {
      listTickets: (params?: {
        status?: SupportStatus | 'all';
        priority?: SupportPriority | 'all';
        category?: SupportCategory | 'all';
      }) => {
        const qs = new URLSearchParams();
        if (params?.status && params.status !== 'all') qs.set('status', params.status);
        if (params?.priority && params.priority !== 'all') qs.set('priority', params.priority);
        if (params?.category && params.category !== 'all') qs.set('category', params.category);
        const query = qs.toString();
        return request<{ tickets: SupportTicket[]; agent: { userId: string; role: string; displayName: string } }>(
          `/support/admin/tickets${query ? '?' + query : ''}`,
        );
      },
      getTicket: (ticketId: string) =>
        request<{ ticket: SupportTicket; messages: SupportMessage[]; agent: { userId: string; role: string; displayName: string } }>(
          `/support/admin/tickets/${ticketId}`,
        ),
      sendMessage: (ticketId: string, body: string, status: SupportStatus = 'pending') =>
        request<{ ticket: SupportTicket; message: SupportMessage }>(`/support/admin/tickets/${ticketId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ body, status }),
        }),
      updateTicket: (ticketId: string, data: {
        status?: SupportStatus;
        priority?: SupportPriority;
        category?: SupportCategory;
        assignToMe?: boolean;
        clearAssignee?: boolean;
      }) =>
        request<{ ticket: SupportTicket }>(`/support/admin/tickets/${ticketId}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      listUsers: () =>
        request<{ users: AdminClientOverview[]; agent: SupportAgent }>('/support/admin/users'),
      insights: (refresh = false) =>
        request<AdminInsightsResponse>(`/support/admin/insights${refresh ? '?refresh=1' : ''}`),
      listFeedback: () =>
        request<{ feedback: FeedbackResponse[]; agent: SupportAgent }>('/support/admin/feedback'),
    },
  },

  // Journal endpoints
  journal: {
    list: (params?: { symbol?: string; strategy?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.symbol) qs.set('symbol', params.symbol);
      if (params?.strategy) qs.set('strategy', params.strategy);
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.offset) qs.set('offset', String(params.offset));
      const query = qs.toString();
      return request<{ total: number; data: unknown[] }>(`/journal${query ? '?' + query : ''}`);
    },
    create: (data: { ticket: string | number; symbol?: string; reason?: string; strategy_tag?: string; confidence?: number; notes?: string }) =>
      request('/journal', { method: 'POST', body: JSON.stringify(data) }),
    delete: (ticket: string | number) =>
      request(`/journal/${ticket}`, { method: 'DELETE' }),
  },

  // EA Settings (v5.0.0 — remote configuration)
  settings: {
    /** Factory defaults — used to pre-populate the form. */
    defaults: () => request<{ settings: EASettings }>(`/settings/defaults`),
    /** Get current settings for an account (merged: defaults + per-account overrides). */
    get: (accountId: string) =>
      request<{ accountId: string; settings: EASettings; isDefault: boolean; lastSettingsFetch?: number; savedAt?: number }>(
        `/accounts/${accountId}/settings`,
      ),
    /** Save partial or full settings; server queues RELOAD_SETTINGS. */
    save: (accountId: string, settings: Partial<EASettings>) =>
      request<{ success: boolean; settings: EASettings; command_id?: string; message?: string }>(
        `/accounts/${accountId}/settings`,
        { method: 'PUT', body: JSON.stringify(settings) },
      ),
    /** Reset to factory defaults (deletes per-account file). */
    reset: (accountId: string) =>
      request<{ success: boolean; settings: EASettings; command_id?: string; message?: string }>(
        `/accounts/${accountId}/settings/reset`,
        { method: 'POST' },
      ),
  },

  // Legacy single-account endpoints (backward compat)
  legacy: {
    dashboard: () => request<ServerDashboardData>('/dashboard'),
    positions: () => request<unknown[]>('/positions'),
    analytics: () => request<Record<string, unknown>>('/analytics'),
    insights: () => request<unknown[]>('/insights'),
    equityCurve: () => request<unknown[]>('/equity-curve'),
    equityHistory: () => request<unknown[]>('/equity-history'),
  },
};
