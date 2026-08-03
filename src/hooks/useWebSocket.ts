import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useTradingStore, type Position, type TradeHistory, type Analytics, type EAStatus, type JournalEntry } from '@/store/tradingStore';
import { userPrefs } from '@/lib/userPrefs';
import { alertsStore, type TriggeredAlert } from '@/lib/alerts';
import { scoreTrade } from '@/lib/tradeScore';
import { toast } from 'sonner';
import { getAccessToken } from '@/services/api';

// Derive HTTP base from env. VITE_WS_URL may be ws://host:port → convert to http://host:port.
function deriveSocketUrl(): string {
  const ws = import.meta.env.VITE_WS_URL as string | undefined;
  const api = import.meta.env.VITE_API_URL as string | undefined;
  if (ws) return ws.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
  if (api) return api.replace(/\/api\/?$/, '');
  return 'https://api.forexanalyzerpro.com';
}

const SOCKET_URL = deriveSocketUrl();

// ---------------------------------------------------------------------------
// FIX: MT5 date parser
// ---------------------------------------------------------------------------
// MT5's TimeToString() produces "2024.04.15 10:30" or "2024.04.15 10:30:00".
// JavaScript's Date.parse() cannot handle dots as date separators, returning
// NaN on all major browsers. This helper converts to a valid ISO-8601 string
// so every downstream Date.parse() / new Date() call works correctly.
// This fixes:
//   - durationMs always being 0 in exitSnapshot
//   - the symbol+openTime fallback match in journal reconciliation always failing
//   - the scoreTrade timing component always getting a neutral score
function parseMT5Time(s: string | undefined | null): string {
  if (!s) return '';
  // Match "2024.04.15 10:30" or "2024.04.15 10:30:00"
  const iso = s.replace(
    /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/,
    '$1-$2-$3T$4Z',
  );
  // If the result parses cleanly, return it; otherwise return original so we
  // don't silently swallow non-MT5 ISO strings that were already valid.
  return isNaN(Date.parse(iso)) ? s : iso;
}

// ---------------------------------------------------------------------------
// Copy-trade detection
// ---------------------------------------------------------------------------
// MT5 doesn't expose a built-in "this is a copied trade" flag, so the EA may
// or may not send `is_copy_trade`. We treat a trade as copier only when the
// EA/server explicitly marks it or attaches a copy source:
//   1. Explicit boolean flag set by the EA
//   2. A master/source account id is attached
//   3. The trade comment contains "copy", "copier", "slave" or "from "
// A non-zero magic number alone is NOT enough. Website-opened manual trades
// are routed through the EA and can also have a magic number.
function detectCopySource(t: any, accountId: string): { isCopy: boolean; from?: string } {
  if (t?.is_copy_trade) return { isCopy: true, from: String(t.master_account_id || t.copy_source || '') || undefined };
  const fromId = t?.master_account_id || t?.copy_source;
  if (fromId) return { isCopy: true, from: String(fromId) };

  const comment = String(t?.comment || '').toLowerCase();
  if (/copy|copier|slave|from\s/.test(comment)) {
    // Try to extract the source account id from comments like "copy from 12345"
    const m = comment.match(/(?:from|copy|copier)\s*[#:]?\s*(\d{4,})/);
    return { isCopy: true, from: m?.[1] };
  }

  return { isCopy: false };
}

/**
 * Socket.io client — v4.0 EA HTTP-push protocol.
 * Listens to: INIT, FULL_UPDATE, STATIC_UPDATE, STATUS_UPDATE,
 * EA_ONLINE/OFFLINE, COMMAND_RESULT, alert_triggered, symbol_missing.
 */
export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    console.log('[Socket.io] Connecting to', SOCKET_URL);
    let disposed = false;

    getAccessToken().then((token) => {
      if (disposed) return;
      if (!token) {
        console.warn('[Socket.io] No Supabase session; skipping socket connection');
        return;
      }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      useTradingStore.getState().setWsConnected(true);
      console.log('[Socket.io] ✅ Connected', socket.id);
    });
    socket.on('disconnect', () => {
      useTradingStore.getState().setWsConnected(false);
      console.log('[Socket.io] ❌ Disconnected');
    });
    socket.on('connect_error', (err) => {
      console.warn('[Socket.io] connect_error', err.message);
    });

    socket.on('INIT', (msg: any) => applyAccountsInit(msg?.data ?? msg));
    socket.on('FULL_UPDATE', (msg: any) => handleFullUpdate(msg));
    socket.on('STATIC_UPDATE', (msg: any) => handleFullUpdate(msg));
    socket.on('STATUS_UPDATE', (msg: any) => handleStatus(msg, true));
    socket.on('EA_ONLINE', (msg: any) => handleStatus(msg, true));
    socket.on('EA_OFFLINE', (msg: any) => handleStatus(msg, false));
    socket.on('COMMAND_RESULT', (msg: any) => {
      const r = msg?.data?.result || msg?.data || msg;
      if (r?.command_id) {
        useTradingStore.getState().updateCommand(r.command_id, {
          status: r.success ? 'success' : 'failed',
          executedAt: new Date().toISOString(),
          latency: r.execution_ms,
        });
      }
    });
    ['SUPPORT_TICKET_CREATED', 'SUPPORT_TICKET_UPDATED', 'SUPPORT_MESSAGE_CREATED'].forEach((eventName) => {
      socket.on(eventName, (msg: any) => {
        window.dispatchEvent(new CustomEvent('fap:support-updated', {
          detail: { eventName, ...(msg?.data || {}) },
        }));
      });
    });
    ['ADMIN_ACCOUNT_UPDATE', 'ADMIN_ACCOUNT_DELETED'].forEach((eventName) => {
      socket.on(eventName, (msg: any) => {
        window.dispatchEvent(new CustomEvent('fap:admin-insights-updated', {
          detail: { eventName, ...(msg?.data || {}) },
        }));
      });
    });
    socket.on('alert_triggered', (msg: any) => {
      const data = msg?.data || msg;
      const id = data?.accountId;
      const payload = data?.payload || data;
      if (!id || !payload?.alertId) return;
      const t: TriggeredAlert = {
        alertId: payload.alertId,
        accountId: id,
        symbol: payload.symbol,
        condition: payload.condition,
        value: payload.value,
        price: Number(payload.price) || 0,
        triggeredAt: payload.triggeredAt || new Date().toISOString(),
        note: payload.note,
      };
      alertsStore.pushTriggered(t);
      useTradingStore.getState().pushTriggeredAlert(t);
      toast.success(`🔔 ${t.symbol} ${t.condition} ${t.value}`, { description: `Price: ${t.price}` });
    });
    socket.on('symbol_missing', (msg: any) => {
      const sym = msg?.data?.symbol || msg?.symbol;
      if (!sym) return;
      toast.warning(`Symbol ${sym} not in Market Watch`, {
        description: 'Please add it in MT5 to enable alerts for this symbol.',
      });
    });

    // v5.0.0 — EA settings events. Dashboard listens via window CustomEvents.
    socket.on('SETTINGS_UPDATED', (msg: any) => {
      const data = msg?.data || msg;
      const id = data?.accountId;
      if (!id) return;
      window.dispatchEvent(new CustomEvent('tvp:settings-updated', {
        detail: { accountId: id, settings: data.settings },
      }));
      toast.success('EA settings saved', { description: 'Reloading on EA…' });
    });
    socket.on('SETTINGS_RELOADED', (msg: any) => {
      const data = msg?.data || msg;
      const id = data?.accountId;
      if (!id) return;
      window.dispatchEvent(new CustomEvent('tvp:settings-reloaded', {
        detail: { accountId: id, success: !!data.success, message: data.message },
      }));
      if (data.success) toast.success('EA reloaded settings', { description: data.message });
      else toast.error('EA reload failed', { description: data.message });
    });

    });

    return () => {
      disposed = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);
}

export function applyAccountsInit(data: any) {
  if (!data || typeof data !== 'object') return;
  const ids = Object.keys(data);
  console.log('[Socket.io] INIT — accounts:', ids);
  const store = useTradingStore.getState();
  const previousAccountIds = new Set(store.accounts.map((account) => account.id));
  const hadAccountsBeforeInit = previousAccountIds.size > 0;

  const accounts = ids.map((id) => {
    const acc: any = data[id];
    const proc = acc?.data || acc?.processedData || {};
    const accInfo = proc.account || {};
    const meta = proc.meta || {};
    return {
      id: acc?.accountId || id,
      alias: acc?.config?.alias || acc?.accountId || id,
      broker: accInfo.broker || meta.broker || 'Unknown',
      platform: (accInfo.platform || meta.platform || 'MT5') as 'MT4' | 'MT5',
      status: acc?.online ? ('ONLINE' as const) : ('OFFLINE' as const),
      role: ((acc?.config?.role || meta?.account_config?.role || 'STANDALONE') as 'MASTER' | 'SLAVE' | 'STANDALONE'),
      balance: accInfo.balance || 0,
      equity: accInfo.equity || 0,
      margin: accInfo.margin || 0,
      freeMargin: accInfo.free_margin || 0,
      leverage: String(accInfo.leverage || meta.leverage || '1:100'),
    };
  });
  store.setAccounts(accounts);

  ids.forEach((id) => {
    const acc: any = data[id];
    const proc = acc?.data || acc?.processedData;
    if (proc) applySnapshot(id, proc, acc?.eaStatus);
    userPrefs.addOwned(id);
  });

  const newAccountId = hadAccountsBeforeInit
    ? accounts.map((account) => account.id).filter((id) => !previousAccountIds.has(id)).at(-1)
    : null;
  if (newAccountId) {
    store.setActiveAccount(newAccountId);
    toast.success(`Switched to new account ${newAccountId}`);
    return;
  }

  // Preserve the account the user was previously on. If it's no longer in the
  // list (e.g. account was disconnected), fall back to the first one.
  const current = useTradingStore.getState().activeAccountId;
  const stillExists = current && accounts.some((a) => a.id === current);
  if (!stillExists && accounts.length) store.setActiveAccount(accounts[0].id);
  else if (stillExists && current) {
    // Re-apply the snapshot to root state so the page shows correct data after refresh
    store.setActiveAccount(current);
  }
}

function handleFullUpdate(msg: any) {
  // { type, data: <processed dashboard object>, accountId, timestamp }
  const accountId = msg?.accountId || msg?.data?.accountId;
  const data = msg?.data;

  if (!accountId || !data) return;
  // ea_status may live on data.ea_status or in server_meta.ea_online
  const eaRaw = data?.ea_status || (data?.server_meta?.ea_online !== undefined
    ? { connected: data.server_meta.ea_online, last_heartbeat: new Date().toISOString() }
    : null);
  applySnapshot(accountId, data, eaRaw);
  detectNewPositions(accountId, data);
  refreshAccountNumbers(accountId, data);
}

function handleStatus(msg: any, online: boolean) {
  // STATUS_UPDATE: { type, data: { accountId, status }, accountId, timestamp }
  // EA_ONLINE/OFFLINE: { type, data: { accountId }, accountId, timestamp }
  const data = msg?.data || msg;
  const id = msg?.accountId || data?.accountId;
  if (!id) return;
  const store = useTradingStore.getState();
  const s = data?.status || {};
  const prev = store.snapshots[id]?.eaStatus;
  store.setEAStatus(id, {
    connected: online,
    lastHeartbeat: s.last_heartbeat || new Date().toISOString(),
    latency: Number(s.latency_ms ?? prev?.latency ?? 0),
    tradingPaused: !!(s.trading_paused ?? prev?.tradingPaused),
    executionAvg: Number(s.execution_avg_ms ?? prev?.executionAvg ?? 0),
    uptime: s.uptime || prev?.uptime || '—',
  });
  const accs = store.accounts.map((a) =>
    a.id === id ? { ...a, status: (online ? 'ONLINE' : 'OFFLINE') as 'ONLINE' | 'OFFLINE' } : a
  );
  store.setAccounts(accs);
}

function refreshAccountNumbers(accountId: string, data: any) {
  const accInfo = data?.account || {};
  const accs = useTradingStore.getState().accounts.map((a) =>
    a.id === accountId
      ? {
          ...a,
          balance: accInfo.balance ?? a.balance,
          equity: accInfo.equity ?? a.equity,
          margin: accInfo.margin ?? a.margin,
          freeMargin: accInfo.free_margin ?? a.freeMargin,
          status: data?.server_meta?.ea_online !== undefined
            ? (data.server_meta.ea_online ? 'ONLINE' : 'OFFLINE')
            : a.status,
        }
      : a
  );
  useTradingStore.getState().setAccounts(accs);
}

function applySnapshot(accountId: string, data: any, eaStatusRaw: any) {
  const positions: Position[] = (data.open_positions || []).map((p: any) => ({
    ticket: Number(p.ticket),
    symbol: p.symbol,
    type: p.type,
    lots: Number(p.lots) || 0,
    openPrice: Number(p.open_price) || 0,
    currentPrice: Number(p.current_price ?? p.open_price) || 0,
    sl: Number(p.sl) || 0,
    tp: Number(p.tp) || 0,
    profit: Number(p.profit ?? p.net_profit) || 0,
    swap: Number(p.swap) || 0,
    commission: Number(p.commission) || 0,
    // FIX: wrap with parseMT5Time so "2024.04.15 10:30" becomes a valid ISO string
    openTime: parseMT5Time(p.open_time_human),
    session: p.session || '',
    isCopy: detectCopySource(p, accountId).isCopy,
    // FIX: EA sends "magic" not "magic_number"
    magicNumber: Number(p.magic) || 0,
  }));

  // MT5 uses several ticket-like IDs for the same trade: position_id, order_ticket,
  // deal_ticket. The journal records the position ticket, so we keep ALL of them
  // around to reconcile reliably.
const rawHistory: any[] = data.trade_history || [];
const history: TradeHistory[] = rawHistory.map((t: any) => {
  return {
    ticket: Number(t.deal_ticket || t.ticket || t.position_id || t.order_ticket),
    symbol: t.symbol,
    type: t.type,
    lots: Number(t.lots) || 0,
    openPrice: Number(t.entry_price ?? t.open_price) || 0,
    closePrice: Number(t.exit_price ?? t.close_price) || 0,
    profit: Number(t.net_profit ?? t.profit) || 0,
    openTime: parseMT5Time(t.entry_time_human ?? t.open_time_human),
    closeTime: parseMT5Time(t.exit_time_human ?? t.close_time_human),
    duration: t.duration_human || String(t.duration_minutes ?? ''),
    pips: Number(t.pips) || 0,
    isCopy: detectCopySource(t, accountId).isCopy,
    magicNumber: Number(t.magic) || 0,
  };
});

  let analytics: Analytics | null = null;
  if (data.analytics) {
    const a = data.analytics;
    const accInfo = data.account || {};

    // Prefer live account-level daily PnL & drawdown (updates every push)
    const dailyPnl = accInfo.daily_pnl ?? a.period_returns?.daily?.net_profit ?? a.net_profit ?? 0;
    const dailyPnlPct = accInfo.daily_pnl_pct ?? a.period_returns?.daily?.return_pct ?? 0;
    const maxDD = accInfo.max_drawdown_pct
      ?? (a.drawdown_curve?.length ? Math.max(...a.drawdown_curve.map((d: any) => d.drawdown_pct || 0)) : 0);

    // ---------------------------------------------------------------------------
    // FIX: Compute best/worst trade, expectancy and equity curve from history
    // when the EA's analytics block doesn't include them (EA v4.x only sends
    // total_trades, wins, losses, win_rate, gross_profit, gross_loss,
    // net_profit, profit_factor).
    // ---------------------------------------------------------------------------
    const wins  = Number(a.wins  || 0);
    const losses = Number(a.losses || 0);
    const grossProfit = Number(a.gross_profit || 0);
    const grossLoss   = Number(a.gross_loss   || 0);
    const avgWin  = wins   > 0 ? grossProfit / wins   : 0;
    const avgLoss = losses > 0 ? grossLoss   / losses : 0;
    const winRate = Number(a.win_rate || 0); // already a percentage 0-100
    // Expectancy = (winRate% * avgWin) - (lossRate% * avgLoss)
    const expectancy = a.expectancy
      ?? ((winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss);

    // Best / worst from the history items we just parsed (most accurate source)
    let bestTrade  = a.best_trade?.net_profit  ?? (history.length ? -Infinity : 0);
    let worstTrade = a.worst_trade?.net_profit ?? (history.length ?  Infinity : 0);
    if (history.length && bestTrade === -Infinity) {
      history.forEach((h) => {
        if (h.profit > bestTrade)  bestTrade  = h.profit;
        if (h.profit < worstTrade) worstTrade = h.profit;
      });
    }
    if (!isFinite(bestTrade))  bestTrade  = 0;
    if (!isFinite(worstTrade)) worstTrade = 0;

    // Simple equity curve from sorted history (running cumulative P&L)
    // EA doesn't send this; we build an approximation from the history slice.
    let equityCurve: { date: string; equity: number }[] = [];
    if (a.equity_curve?.length) {
      // Server already computed it — use that
      equityCurve = a.equity_curve.map((p: any) => ({
        date: parseMT5Time(p.timestamp_human) || new Date((p.timestamp || 0) * 1000).toISOString().slice(0, 10),
        equity: p.balance ?? p.equity ?? p.cumulative_profit ?? 0,
      }));
    } else if (history.length) {
      // Build from trade history: sort by closeTime, accumulate profit
      const sorted = [...history]
        .filter((h) => h.closeTime)
        .sort((a, b) => Date.parse(a.closeTime) - Date.parse(b.closeTime));
      let running = 0;
      equityCurve = sorted.map((h) => {
        running += h.profit;
        return { date: h.closeTime.slice(0, 10), equity: parseFloat(running.toFixed(2)) };
      });
    }

    analytics = {
      winRate,
      profitFactor: Number(a.profit_factor) || 0,
      avgRR: Number(a.risk_reward_ratio ?? a.avg_rr ?? 0),
      expectancy: parseFloat(expectancy.toFixed(2)),
      bestTrade,
      worstTrade,
      totalTrades: Number(a.total_trades) || 0,
      totalProfit: Number(a.net_profit) || 0,
      maxDrawdown: maxDD,
      dailyPnl,
      dailyPnlPercent: dailyPnlPct,
      equityCurve,
      drawdownCurve: (a.drawdown_curve || []).map((p: any) => ({
        date: parseMT5Time(p.timestamp_human) || new Date((p.timestamp || 0) * 1000).toISOString().slice(0, 10),
        drawdown: p.drawdown_pct || 0,
      })),
      sessionStats: toStatsArray(a.session_stats, 'session'),
      symbolStats: toStatsArray(a.symbol_stats, 'symbol'),
      dayStats: toStatsArray(a.day_of_week_stats, 'day').map((d: any) => ({
        day: d.day,
        trades: d.trades,
        profit: d.net_profit ?? d.profit ?? 0,
      })),
    };
  }

  let eaStatus: EAStatus | null = null;
  if (eaStatusRaw) {
    const connected = eaStatusRaw.connected !== undefined
      ? !!eaStatusRaw.connected
      : data?.server_meta?.ea_online !== undefined
        ? !!data.server_meta.ea_online
        : true;
    eaStatus = {
      connected,
      lastHeartbeat: eaStatusRaw.last_heartbeat || new Date().toISOString(),
      latency: eaStatusRaw.latency_ms || 0,
      tradingPaused: !!(eaStatusRaw.trading_paused ?? data?.meta?.trading_paused),
      executionAvg: eaStatusRaw.execution_avg_ms || 0,
      uptime: eaStatusRaw.uptime || '—',
    };
  }

  const store = useTradingStore.getState();
  store.setSnapshot(accountId, {
    positions,
    history,
    ...(analytics ? { analytics } : {}),
    ...(eaStatus ? { eaStatus } : {}),
  });
  seedJournalFromHistory(accountId, rawHistory, history, data?.account || {});
  // Reconcile journal "open" entries against this account's live state:
  //   1. If ticket appears in history → mark closed + score (existing behaviour)
  //   2. If ticket is gone from open_positions AND not in history yet → still mark
  //      closed using the last known data so the journal doesn't keep stale "open" trades.
  const openTickets = new Set(positions.map((p) => p.ticket));

  // Index history by EVERY ticket-like id we can find so journal entries
  // (which only know the original position ticket) reliably match.
  const historyByTicket = new Map<number, TradeHistory>();
  rawHistory.forEach((t: any, i: number) => {
    const h = history[i];
    [t.position_id, t.order_ticket, t.deal_ticket, t.ticket]
      .map((x) => Number(x))
      .filter((x) => x && !isNaN(x))
      .forEach((id) => { if (!historyByTicket.has(id)) historyByTicket.set(id, h); });
  });

  if (history.length || positions.length) {
    const peerProfits = history.map((h) => Math.abs(h.profit)).filter((n) => n > 0);
    const peerAvg = peerProfits.length ? peerProfits.reduce((a, b) => a + b, 0) / peerProfits.length : 0;

    store.journal
      .filter((e) => e.accountId === accountId && e.status === 'open')
      .forEach((j) => {
        // Try direct ticket match first, then symbol+openTime fallback for copier
        // trades whose ticket numbering differs between master and slave streams.
        let h = historyByTicket.get(j.ticket);
        if (!h && j.openTime) {
          // FIX: Date.parse() now works correctly because parseMT5Time() was applied
          // to both j.openTime (via autoRecord) and h.openTime (via history mapping).
          const jOpenMs = Date.parse(j.openTime);
          if (!isNaN(jOpenMs)) {
            h = history.find((x) => {
              const xOpenMs = Date.parse(x.openTime);
              return (
                x.symbol === j.symbol &&
                x.type === j.type &&
                !isNaN(xOpenMs) &&
                Math.abs(xOpenMs - jOpenMs) < 60_000
              );
            });
          }
        }

        if (h) {
          // Found in closed history — full score path
          // FIX: Date.parse() now returns valid ms values instead of NaN,
          // so durationMs is computed correctly for the timing score component.
          const openMs  = j.openTime  ? Date.parse(j.openTime)  : 0;
          const closeMs = h.closeTime ? Date.parse(h.closeTime) : 0;
          const durationMs = openMs && closeMs && closeMs > openMs ? closeMs - openMs : 0;
          const exitSnapshot = { closePrice: h.closePrice, pips: h.pips, durationMs };
          const updated = { ...j, status: 'closed' as const, closeTime: h.closeTime, profit: h.profit, exitSnapshot };
          const { score, breakdown } = scoreTrade(updated, peerAvg);
          store.updateJournalEntry(j.id, {
            status: 'closed',
            closeTime: h.closeTime,
            profit: h.profit,
            exitSnapshot,
            score,
            scoreBreakdown: breakdown,
          });
        } else if (!openTickets.has(j.ticket)) {
          // Disappeared from open positions — broker likely closed it but it's not
          // yet in the history slice we received. Mark closed defensively so the
          // user doesn't see a phantom "OPEN" in the journal.
          store.updateJournalEntry(j.id, {
            status: 'closed',
            closeTime: j.closeTime || new Date().toISOString(),
          });
        }
      });
  }
}
/**
 * Seeds closed journal entries from trade_history for trades that were
 * already closed before the user first connected. Without this, the journal
 * only contains trades that were OPEN at connection time and closed during
 * the session. This runs on every snapshot push but skips trades that
 * already have a journal entry so it is safe to call repeatedly.
 */
function seedJournalFromHistory(accountId: string, rawHistory: any[], history: TradeHistory[], accInfo: any = {}) {
  const store = useTradingStore.getState();

  // Build a set of every ticket variant already in the journal for this account
  const existingTickets = new Set<number>(
    store.journal
      .filter((j) => j.accountId === accountId)
      .map((j) => j.ticket),
  );

  const peerProfits = history.map((h) => Math.abs(h.profit)).filter((n) => n > 0);
  const peerAvg = peerProfits.length
    ? peerProfits.reduce((a, b) => a + b, 0) / peerProfits.length
    : 0;

  rawHistory.forEach((t: any, i: number) => {
    const h = history[i];

    // Check all ticket variants to avoid duplicates
    const ticketVariants = [t.position_id, t.deal_ticket, t.ticket, t.order_ticket]
      .map((x) => Number(x))
      .filter((x) => x && !isNaN(x));

    if (ticketVariants.some((tk) => existingTickets.has(tk))) return;

    // Use position_id as the canonical ticket — matches what open_positions uses
    const ticket = Number(t.position_id || t.deal_ticket || t.ticket);
    if (!ticket) return;

    const openTime  = parseMT5Time(t.entry_time_human);
    const closeTime = parseMT5Time(t.exit_time_human);
    const openMs    = openTime  ? Date.parse(openTime)  : 0;
    const closeMs   = closeTime ? Date.parse(closeTime) : 0;
    const durationMs = openMs && closeMs && closeMs > openMs ? closeMs - openMs : 0;

    const copyInfo = detectCopySource(t, accountId);
    const entry: JournalEntry = {
      id: `auto-hist-${accountId}-${ticket}-${Math.random().toString(36).slice(2, 9)}`,
      accountId,
      ticket,
      symbol:    t.symbol,
      type:      t.type as 'BUY' | 'SELL',
      reason:    copyInfo.isCopy ? `Auto-copied from ${copyInfo.from || 'master'}` : '',
      strategy:  copyInfo.isCopy ? 'Copy Trading' : '',
      emotion:   '',
      openTime,
      closeTime,
      profit:    h.profit,
      status:    'closed',
      source:    copyInfo.isCopy ? 'copier' : 'manual',
      copierFromAccount: copyInfo.from,
      entrySnapshot: {
        lots:      h.lots,
        openPrice: h.openPrice,
        sl:        Number(t.sl) || 0,
        tp:        Number(t.tp) || 0,
        accountBalance: Number(t.balance_at_open ?? accInfo.balance) || undefined,
        accountEquity:  Number(t.equity_at_open  ?? accInfo.equity)  || undefined,
        spreadPips:     Number(t.spread_pips ?? t.spread) || undefined,
      },
      exitSnapshot: {
        closePrice: h.closePrice,
        pips:       h.pips,
        durationMs,
      },
    };

    const { score, breakdown } = scoreTrade(entry, peerAvg);
    entry.score          = score;
    entry.scoreBreakdown = breakdown;

    store.addJournalEntry(entry);

    // Track all variants so we don't double-insert within the same batch
    ticketVariants.forEach((tk) => existingTickets.add(tk));
  });
}

function toStatsArray(input: any, keyName: string): any[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((s: any) => ({
      [keyName]: s[keyName],
      trades: s.trades || 0,
      profit: s.net_profit ?? s.profit ?? 0,
      winRate: s.win_rate || 0,
    }));
  }
  return Object.entries(input).map(([k, v]: [string, any]) => ({
    [keyName]: k,
    trades: (v as any).trades || 0,
    profit: (v as any).net_profit ?? (v as any).profit ?? 0,
    winRate: (v as any).win_rate || 0,
  }));
}

/**
 * Auto-record EVERY new opened position into the journal (manual or copier)
 * so traders can come back later and add reason/strategy/emotion.
 * For manual trades, also queue an in-the-moment journal prompt.
 */
function detectNewPositions(accountId: string, data: any) {
  const positions = data.open_positions || [];
  const accInfo = data.account || {};
  const currentTickets: number[] = positions.map((p: any) => Number(p.ticket));
  const seen = userPrefs.getSeen(accountId);

  if (seen.length === 0) {
    // first ever sync — auto-record everything we see now (so users don't lose history)
    const store = useTradingStore.getState();
    positions.forEach((p: any) => autoRecord(store, accountId, p, accInfo));
    userPrefs.setSeen(accountId, currentTickets);
    return;
  }

  const newOnes = positions.filter((p: any) => !seen.includes(Number(p.ticket)));
  if (newOnes.length === 0) {
    userPrefs.setSeen(accountId, currentTickets);
    return;
  }

  const store = useTradingStore.getState();
  newOnes.forEach((p: any) => {
    autoRecord(store, accountId, p, accInfo);
    const isCopyNew = detectCopySource(p, accountId).isCopy;
    if (!isCopyNew) {
      // also surface the in-the-moment prompt for manual trades
      store.enqueueJournalPrompt(accountId, {
        ticket: Number(p.ticket),
        symbol: p.symbol,
        type: p.type,
        lots: Number(p.lots) || 0,
        openPrice: Number(p.open_price) || 0,
        currentPrice: Number(p.current_price ?? p.open_price) || 0,
        sl: Number(p.sl) || 0,
        tp: Number(p.tp) || 0,
        profit: Number(p.profit ?? p.net_profit) || 0,
        swap: Number(p.swap) || 0,
        commission: Number(p.commission) || 0,
        // FIX: parse MT5 date format so the prompt shows a valid timestamp
        openTime: parseMT5Time(p.open_time_human) || new Date().toISOString(),
        session: p.session || '',
        isCopy: false,
        // FIX: EA sends "magic" not "magic_number"
        magicNumber: Number(p.magic) || 0,
      });
    }
  });

  userPrefs.setSeen(accountId, currentTickets);
}

function createAutoJournalId(accountId: string, ticket: number, openTime?: string) {
  // openTime is now ISO (post parseMT5Time), so Date.parse() is reliable here
  const timePart = openTime ? Date.parse(openTime) || openTime.replace(/\W+/g, '') : Date.now();
  return `auto-${accountId}-${ticket}-${timePart}-${Math.random().toString(36).slice(2, 7)}`;
}

function autoRecord(
  store: ReturnType<typeof useTradingStore.getState>,
  accountId: string,
  p: any,
  accInfo: any = {},
) {
  const ticket = Number(p.ticket);
  if (store.journal.some((j) => j.ticket === ticket && j.accountId === accountId)) return;
  const copyInfo = detectCopySource(p, accountId);
  const isCopy = copyInfo.isCopy;
  // FIX: parse the MT5 date before storing so every downstream Date.parse() works
  const openTime = parseMT5Time(p.open_time_human) || new Date().toISOString();
  store.addJournalEntry({
    id: createAutoJournalId(accountId, ticket, openTime),
    accountId,
    ticket,
    symbol: p.symbol,
    type: p.type,
    reason: isCopy ? `Auto-copied from ${copyInfo.from || 'master'}` : '',
    strategy: isCopy ? 'Copy Trading' : '',
    emotion: '',
    openTime,
    status: 'open',
    source: isCopy ? 'copier' : 'manual',
    copierFromAccount: copyInfo.from,
    entrySnapshot: {
      lots: Number(p.lots) || 0,
      openPrice: Number(p.open_price) || 0,
      sl: Number(p.sl) || 0,
      tp: Number(p.tp) || 0,
      accountBalance: Number(accInfo.balance) || undefined,
      accountEquity: Number(accInfo.equity) || undefined,
      spreadPips: Number(p.spread_pips ?? p.spread) || undefined,
    },
  });
}
