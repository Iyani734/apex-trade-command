import { create } from 'zustand';
import { userPrefs } from '@/lib/userPrefs';
import { commandsStore } from '@/lib/commandsStore';
import type { TriggeredAlert } from '@/lib/alerts';

export interface Account {
  id: string;
  alias: string;
  broker: string;
  platform: 'MT4' | 'MT5';
  status: 'ONLINE' | 'OFFLINE';
  role: 'MASTER' | 'SLAVE' | 'STANDALONE';
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: string;
}

export interface Position {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  lots: number;
  openPrice: number;
  currentPrice: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  commission: number;
  openTime: string;
  session: string;
  isCopy: boolean;
  magicNumber: number;
}

export interface TradeHistory {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  lots: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  openTime: string;
  closeTime: string;
  duration: string;
  pips: number;
  isCopy?: boolean;
  magicNumber?: number;
}

export interface EAStatus {
  connected: boolean;
  lastHeartbeat: string;
  latency: number;
  tradingPaused: boolean;
  executionAvg: number;
  uptime: string;
}

export interface JournalEntry {
  id: string;
  accountId: string;
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  reason: string;
  strategy: string;
  /** Optional sub-tag of the strategy (e.g. "A+", "B", "C"). */
  setup?: string;
  /** Trader-rated 1-5 conviction at entry. */
  confidence?: number;
  /** Free-form trader note added after the trade. */
  notes?: string;
  emotion: string;
  openTime: string;
  closeTime?: string;
  profit?: number;
  /** Snapshot of the position at entry (lots, prices, SL/TP, equity, spread). */
  entrySnapshot?: {
    lots: number;
    openPrice: number;
    sl: number;
    tp: number;
    accountBalance?: number;
    accountEquity?: number;
    spreadPips?: number;
  };
  /** Snapshot at close (filled when ticket appears in history). */
  exitSnapshot?: {
    closePrice: number;
    pips: number;
    durationMs: number;
  };
  /** Auto-computed on close: composite trade score 0-100. */
  score?: number;
  scoreBreakdown?: { rr: number; rule: number; timing: number; outcome: number };
  status: 'open' | 'closed';
  source: 'manual' | 'copier';
  copierFromAccount?: string;
}

export interface Command {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed';
  sentAt: string;
  executedAt?: string;
  latency?: number;
}

export interface Analytics {
  winRate: number;
  profitFactor: number;
  avgRR: number;
  expectancy: number;
  bestTrade: number;
  worstTrade: number;
  totalTrades: number;
  totalProfit: number;
  maxDrawdown: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  equityCurve: { date: string; equity: number }[];
  drawdownCurve: { date: string; drawdown: number }[];
  sessionStats: { session: string; trades: number; profit: number; winRate: number }[];
  symbolStats: { symbol: string; trades: number; profit: number; winRate: number }[];
  dayStats: { day: string; trades: number; profit: number }[];
}

export interface CopyConfig {
  masterId: string;
  slaveIds: string[];
  lotMultiplier: number;
  fixedLot: number | null;
  copySL: boolean;
  copyTP: boolean;
  active: boolean;
}

// Per-account cached snapshot so switching is instant
export interface AccountSnapshot {
  positions: Position[];
  history: TradeHistory[];
  analytics: Analytics | null;
  eaStatus: EAStatus | null;
}

export interface TradingStore {
  accounts: Account[];
  activeAccountId: string | null;
  snapshots: Record<string, AccountSnapshot>;
  positions: Position[];
  history: TradeHistory[];
  analytics: Analytics | null;
  eaStatus: EAStatus | null;
  journal: JournalEntry[];
  commands: Command[];
  copyConfigs: CopyConfig[];
  wsConnected: boolean;
  // pending journal prompt (queue)
  journalPrompts: { accountId: string; position: Position }[];
  // alerts triggered (in-memory + persisted via alertsStore)
  triggeredAlerts: TriggeredAlert[];

  setAccounts: (accounts: Account[]) => void;
  setActiveAccount: (id: string) => void;
  setSnapshot: (accountId: string, snap: Partial<AccountSnapshot>) => void;
  setEAStatus: (accountId: string, status: EAStatus) => void;
  renameAccount: (id: string, alias: string) => void;

  addJournalEntry: (entry: JournalEntry) => void;
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void;
  deleteJournalEntry: (id: string) => void;

  enqueueJournalPrompt: (accountId: string, position: Position) => void;
  shiftJournalPrompt: () => void;

  addCommand: (command: Command) => void;
  updateCommand: (id: string, updates: Partial<Command>) => void;
  clearCommands: () => void;
  deleteCommand: (id: string) => void;
  setWsConnected: (connected: boolean) => void;
  setCopyConfigs: (configs: CopyConfig[]) => void;

  setTriggeredAlerts: (list: TriggeredAlert[]) => void;
  pushTriggeredAlert: (t: TriggeredAlert) => void;
}

const applyActiveSnapshot = (snapshots: Record<string, AccountSnapshot>, id: string | null) => {
  if (!id || !snapshots[id]) return { positions: [], history: [], analytics: null, eaStatus: null };
  const s = snapshots[id];
  return { positions: s.positions, history: s.history, analytics: s.analytics, eaStatus: s.eaStatus };
};

export const useTradingStore = create<TradingStore>((set, get) => ({
  accounts: [],
  activeAccountId: userPrefs.getActiveAccount(),
  snapshots: {},
  positions: [],
  history: [],
  analytics: null,
  eaStatus: null,
  journal: userPrefs.getJournal(),
  commands: [],
  copyConfigs: [],
  wsConnected: false,
  journalPrompts: [],
  triggeredAlerts: [],

  setAccounts: (accounts) => {
    // apply nicknames
    const nicks = userPrefs.getNicknames();
    const withNicks = accounts.map((a) => ({ ...a, alias: nicks[a.id] || a.alias }));
    set((s) => {
      const activeStillExists = !!s.activeAccountId && withNicks.some((account) => account.id === s.activeAccountId);
      if (!activeStillExists) {
        if (s.activeAccountId) userPrefs.setActiveAccount(null);
        return {
          accounts: withNicks,
          activeAccountId: null,
          positions: [],
          history: [],
          analytics: null,
          eaStatus: null,
          commands: [],
        };
      }
      return { accounts: withNicks };
    });
  },

  setActiveAccount: (id) => {
    userPrefs.setActiveAccount(id);
    set((s) => ({
      activeAccountId: id,
      ...applyActiveSnapshot(s.snapshots, id),
      // hydrate per-account command log so each account only shows its own
      commands: commandsStore.load(id),
    }));
  },

  setSnapshot: (accountId, snap) =>
    set((s) => {
      const existing = s.snapshots[accountId] || { positions: [], history: [], analytics: null, eaStatus: null };
      const merged = { ...existing, ...snap };
      const snapshots = { ...s.snapshots, [accountId]: merged };
      // if it's the active account, also reflect on root state
      if (accountId === s.activeAccountId) {
        return { snapshots, ...applyActiveSnapshot(snapshots, accountId) };
      }
      return { snapshots };
    }),

  setEAStatus: (accountId, status) =>
    set((s) => {
      const existing = s.snapshots[accountId] || { positions: [], history: [], analytics: null, eaStatus: null };
      const snapshots = { ...s.snapshots, [accountId]: { ...existing, eaStatus: status } };
      if (accountId === s.activeAccountId) return { snapshots, eaStatus: status };
      return { snapshots };
    }),

  renameAccount: (id, alias) => {
    userPrefs.setNickname(id, alias);
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, alias } : a)) }));
  },

  addJournalEntry: (entry) => {
    userPrefs.addJournal(entry);
    set((s) => ({ journal: [entry, ...s.journal] }));
  },
  updateJournalEntry: (id, updates) => {
    userPrefs.updateJournal(id, updates);
    set((s) => ({ journal: s.journal.map((j) => (j.id === id ? { ...j, ...updates } : j)) }));
  },
  deleteJournalEntry: (id) => {
    userPrefs.deleteJournal(id);
    set((s) => ({ journal: s.journal.filter((j) => j.id !== id) }));
  },

  enqueueJournalPrompt: (accountId, position) =>
    set((s) => {
      // dedupe by ticket
      if (s.journalPrompts.some((p) => p.position.ticket === position.ticket)) return {};
      if (s.journal.some((j) => j.ticket === position.ticket)) return {};
      return { journalPrompts: [...s.journalPrompts, { accountId, position }] };
    }),
  shiftJournalPrompt: () => set((s) => ({ journalPrompts: s.journalPrompts.slice(1) })),

  addCommand: (command) => {
    const id = get().activeAccountId;
    if (!id) return;
    commandsStore.add(id, command);
    set((s) => ({ commands: [command, ...s.commands] }));
  },
  updateCommand: (id, updates) => {
    const acct = get().activeAccountId;
    if (!acct) return;
    commandsStore.update(acct, id, updates);
    set((s) => ({ commands: s.commands.map((c) => (c.id === id ? { ...c, ...updates } : c)) }));
  },
  deleteCommand: (id) => {
    const acct = get().activeAccountId;
    if (!acct) return;
    commandsStore.remove(acct, id);
    set((s) => ({ commands: s.commands.filter((c) => c.id !== id) }));
  },
  clearCommands: () => {
    const acct = get().activeAccountId;
    if (!acct) return;
    commandsStore.clear(acct);
    set({ commands: [] });
  },
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setCopyConfigs: (configs) => set({ copyConfigs: configs }),

  setTriggeredAlerts: (list) => set({ triggeredAlerts: list }),
  pushTriggeredAlert: (t) =>
    set((s) => ({ triggeredAlerts: [t, ...s.triggeredAlerts].slice(0, 200) })),
}));
