import { supabase } from '@/lib/supabase';
import { getOrCreateTrialDeviceId, type TrialLicense } from '@/lib/trial';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.forexanalyzerpro.com/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

let cachedAccessToken: string | null | undefined;
let tokenLoad: Promise<string | null> | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token || null;
  tokenLoad = null;
});

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

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
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
    me: () => request<{ user: { id: string; email: string; name: string; avatar?: string }; eaKey: { key_prefix: string; created_at: string } | null; license: TrialLicense }>('/auth/me'),
    rotateEaKey: () => request<{ apiKey: string; keyPrefix: string; message: string }>('/auth/ea-key/rotate', { method: 'POST' }),
  },

  share: {
    list: (accountId: string) =>
      request<{ links: ShareLinkRecord[] }>(`/share-links?accountId=${encodeURIComponent(accountId)}`),
    create: (data: { accountId: string; expiry: ShareExpiry; label?: string }) =>
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
    createPair: (data: { masterAccountId: string; slaveAccountId: string; lotMultiplier?: number; copySL?: boolean; copyTP?: boolean }) =>
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
