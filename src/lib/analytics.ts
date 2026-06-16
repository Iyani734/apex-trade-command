// Pure analytics functions — computed entirely from TradeHistory[]
// Used by the Analytics page so the UI doesn't depend on backend-supplied stats.

import type { TradeHistory } from '@/store/tradingStore';

export type DateRange = { from: Date | null; to: Date | null };

// ---------- helpers ----------
const toDate = (s: string): Date => {
  if (!s) return new Date(0);
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(0) : d;
};

const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);
const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = avg(a);
  return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1));
};

export const formatDuration = (ms: number): string => {
  if (!ms || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${s}s`;
};

export const tradeDurationMs = (t: TradeHistory): number => {
  const o = toDate(t.openTime).getTime();
  const c = toDate(t.closeTime).getTime();
  if (!o || !c || c < o) return 0;
  return c - o;
};

export const tradeDurationLabel = (t: TradeHistory): string => {
  if (t.duration && t.duration !== '—') return t.duration;
  return formatDuration(tradeDurationMs(t));
};

// ---------- filtering ----------
export const filterByDateRange = (history: TradeHistory[], range: DateRange): TradeHistory[] => {
  if (!range.from && !range.to) return history;
  return history.filter((t) => {
    const d = toDate(t.closeTime || t.openTime);
    if (range.from && d < range.from) return false;
    if (range.to && d > range.to) return false;
    return true;
  });
};

export const firstTradeDate = (history: TradeHistory[]): Date | null => {
  if (!history.length) return null;
  const ms = Math.min(...history.map((t) => toDate(t.openTime).getTime()).filter((x) => x > 0));
  return ms ? new Date(ms) : null;
};

// ---------- core metrics ----------
export interface AdvancedMetrics {
  totalTrades: number;
  totalDeals: number;
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  expectedPayoff: number;
  recoveryFactor: number;
  sharpe: number;
  sortino: number;
  zScore: number;
  ahpr: number; // avg holding period return %
  ghpr: number; // geometric holding period return %
  winRate: number;
  lossRate: number;
  longTrades: number;
  longWinRate: number;
  shortTrades: number;
  shortWinRate: number;
  bestTrade: number;
  worstTrade: number;
  avgProfit: number;
  avgLoss: number;
  avgRR: number;
  // consecutive
  maxConsecWins: number;
  maxConsecWinsAmount: number;
  maxConsecLosses: number;
  maxConsecLossesAmount: number;
  avgConsecWins: number;
  avgConsecLosses: number;
  // duration
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  // risk
  riskOfRuin: number; // 0..1
}

export interface DrawdownStats {
  balanceDDAbsolute: number;
  balanceDDMaximal: number;
  balanceDDRelativePct: number;
  equityDDAbsolute: number;
  equityDDMaximal: number;
  equityDDRelativePct: number;
  maxDDDurationMs: number;
}

export const computeAdvancedMetrics = (history: TradeHistory[], startingBalance = 10000): AdvancedMetrics => {
  const trades = [...history].sort((a, b) => toDate(a.closeTime).getTime() - toDate(b.closeTime).getTime());
  const profits = trades.map((t) => t.profit);
  const wins = profits.filter((p) => p > 0);
  const losses = profits.filter((p) => p < 0);
  const longs = trades.filter((t) => t.type === 'BUY');
  const shorts = trades.filter((t) => t.type === 'SELL');
  const longWins = longs.filter((t) => t.profit > 0).length;
  const shortWins = shorts.filter((t) => t.profit > 0).length;

  const grossProfit = sum(wins);
  const grossLoss = Math.abs(sum(losses));
  const netProfit = grossProfit - grossLoss;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
  const lossRate = trades.length ? (losses.length / trades.length) * 100 : 0;
  const avgProfit = avg(wins);
  const avgLoss = Math.abs(avg(losses));
  const expectedPayoff = trades.length ? netProfit / trades.length : 0;

  // returns as fraction of starting balance per trade
  let bal = startingBalance;
  const returns: number[] = [];
  for (const t of trades) {
    returns.push(t.profit / Math.max(bal, 1));
    bal += t.profit;
  }
  const stdR = std(returns);
  const negR = returns.filter((r) => r < 0);
  const sharpe = stdR > 0 ? (avg(returns) / stdR) * Math.sqrt(252) : 0;
  const downside = std(negR);
  const sortino = downside > 0 ? (avg(returns) / downside) * Math.sqrt(252) : 0;
  const ahpr = avg(returns) * 100;
  const ghpr = returns.length
    ? (Math.pow(returns.reduce((p, r) => p * (1 + r), 1), 1 / returns.length) - 1) * 100
    : 0;

  // Z-Score (Wald): N runs, R = wins+losses, P = #wins*#losses
  const N = trades.length;
  const W = wins.length;
  const L = losses.length;
  let runs = 1;
  for (let i = 1; i < trades.length; i++) {
    if (Math.sign(trades[i].profit) !== Math.sign(trades[i - 1].profit)) runs++;
  }
  const P = W * L;
  const zScore = P > 0 ? (N * (runs - 0.5) - 2 * P) / Math.sqrt((2 * P * (2 * P - N)) / Math.max(N - 1, 1)) : 0;

  // consecutive wins / losses
  let curStreak = 0;
  let curStreakSign = 0;
  let curAmount = 0;
  let maxConsecWins = 0;
  let maxConsecLosses = 0;
  let maxConsecWinsAmount = 0;
  let maxConsecLossesAmount = 0;
  const winStreaks: number[] = [];
  const lossStreaks: number[] = [];
  for (const t of trades) {
    const sign = Math.sign(t.profit);
    if (sign === 0) continue;
    if (sign === curStreakSign) {
      curStreak++;
      curAmount += t.profit;
    } else {
      if (curStreakSign > 0) {
        winStreaks.push(curStreak);
        if (curStreak > maxConsecWins) {
          maxConsecWins = curStreak;
          maxConsecWinsAmount = curAmount;
        }
      } else if (curStreakSign < 0) {
        lossStreaks.push(curStreak);
        if (curStreak > maxConsecLosses) {
          maxConsecLosses = curStreak;
          maxConsecLossesAmount = curAmount;
        }
      }
      curStreak = 1;
      curStreakSign = sign;
      curAmount = t.profit;
    }
  }
  // flush last
  if (curStreakSign > 0) {
    winStreaks.push(curStreak);
    if (curStreak > maxConsecWins) { maxConsecWins = curStreak; maxConsecWinsAmount = curAmount; }
  } else if (curStreakSign < 0) {
    lossStreaks.push(curStreak);
    if (curStreak > maxConsecLosses) { maxConsecLosses = curStreak; maxConsecLossesAmount = curAmount; }
  }

  // duration
  const durations = trades.map(tradeDurationMs).filter((x) => x > 0);
  const avgDurationMs = avg(durations);
  const minDurationMs = durations.length ? Math.min(...durations) : 0;
  const maxDurationMs = durations.length ? Math.max(...durations) : 0;

  // RR
  const avgRR = avgLoss > 0 ? avgProfit / avgLoss : 0;

  // recovery factor uses max balance DD
  const dd = computeDrawdownStats(trades, startingBalance);
  const recoveryFactor = dd.balanceDDMaximal > 0 ? netProfit / dd.balanceDDMaximal : 0;

  // Risk of Ruin (simplified): R = ((1 - edge) / (1 + edge)) ^ units
  // edge = winRate - lossRate (fraction); units = bankroll / avgLoss
  const edge = (wins.length - losses.length) / Math.max(trades.length, 1);
  const units = avgLoss > 0 ? Math.max(startingBalance / avgLoss, 1) : 1;
  const riskOfRuin = edge > 0
    ? Math.min(Math.pow((1 - edge) / (1 + edge), units), 1)
    : 1;

  return {
    totalTrades: trades.length,
    totalDeals: trades.length * 2, // open + close
    netProfit, grossProfit, grossLoss, profitFactor, expectedPayoff, recoveryFactor,
    sharpe, sortino, zScore, ahpr, ghpr,
    winRate, lossRate,
    longTrades: longs.length,
    longWinRate: longs.length ? (longWins / longs.length) * 100 : 0,
    shortTrades: shorts.length,
    shortWinRate: shorts.length ? (shortWins / shorts.length) * 100 : 0,
    bestTrade: profits.length ? Math.max(...profits) : 0,
    worstTrade: profits.length ? Math.min(...profits) : 0,
    avgProfit, avgLoss, avgRR,
    maxConsecWins, maxConsecWinsAmount, maxConsecLosses, maxConsecLossesAmount,
    avgConsecWins: avg(winStreaks),
    avgConsecLosses: avg(lossStreaks),
    avgDurationMs, minDurationMs, maxDurationMs,
    riskOfRuin,
  };
};

export const computeDrawdownStats = (history: TradeHistory[], startingBalance = 10000): DrawdownStats => {
  const trades = [...history].sort((a, b) => toDate(a.closeTime).getTime() - toDate(b.closeTime).getTime());
  let bal = startingBalance;
  let peak = startingBalance;
  let balDDAbs = 0; // current absolute DD from initial deposit
  let balDDMax = 0; // max DD from any peak
  let balDDRelPct = 0;
  let ddStartTs: number | null = null;
  let maxDDDurationMs = 0;

  for (const t of trades) {
    bal += t.profit;
    const ts = toDate(t.closeTime).getTime();

    if (bal > peak) {
      // exit drawdown
      if (ddStartTs && ts > ddStartTs) {
        maxDDDurationMs = Math.max(maxDDDurationMs, ts - ddStartTs);
      }
      ddStartTs = null;
      peak = bal;
    } else if (bal < peak) {
      if (!ddStartTs) ddStartTs = ts;
    }

    const ddFromInitial = Math.max(startingBalance - bal, 0);
    if (ddFromInitial > balDDAbs) balDDAbs = ddFromInitial;

    const ddFromPeak = peak - bal;
    if (ddFromPeak > balDDMax) balDDMax = ddFromPeak;

    const relPct = peak > 0 ? (ddFromPeak / peak) * 100 : 0;
    if (relPct > balDDRelPct) balDDRelPct = relPct;
  }
  if (ddStartTs) {
    const lastTs = toDate(trades[trades.length - 1]?.closeTime).getTime();
    if (lastTs > ddStartTs) maxDDDurationMs = Math.max(maxDDDurationMs, lastTs - ddStartTs);
  }

  // For closed-trade history, equity tracks balance, so equity = balance numbers.
  return {
    balanceDDAbsolute: balDDAbs,
    balanceDDMaximal: balDDMax,
    balanceDDRelativePct: balDDRelPct,
    equityDDAbsolute: balDDAbs,
    equityDDMaximal: balDDMax,
    equityDDRelativePct: balDDRelPct,
    maxDDDurationMs,
  };
};

// ---------- equity & drawdown curves (computed from history, with date) ----------
export const computeEquityCurve = (history: TradeHistory[], startingBalance = 10000) => {
  const trades = [...history].sort((a, b) => toDate(a.closeTime).getTime() - toDate(b.closeTime).getTime());
  let bal = startingBalance;
  return trades.map((t) => {
    bal += t.profit;
    return { date: (t.closeTime || '').slice(0, 10), equity: Math.round(bal * 100) / 100 };
  });
};

export const computeDrawdownCurve = (history: TradeHistory[], startingBalance = 10000) => {
  const eq = computeEquityCurve(history, startingBalance);
  let peak = startingBalance;
  return eq.map((p) => {
    if (p.equity > peak) peak = p.equity;
    const dd = peak > 0 ? -((peak - p.equity) / peak) * 100 : 0;
    return { date: p.date, drawdown: Math.round(dd * 100) / 100 };
  });
};

// ---------- time-based aggregations ----------
export interface TimeBucket { key: string; trades: number; profit: number; winRate: number }

const aggregateBy = (history: TradeHistory[], keyFn: (t: TradeHistory) => string, order?: string[]): TimeBucket[] => {
  const map = new Map<string, { trades: number; wins: number; profit: number }>();
  for (const t of history) {
    const k = keyFn(t);
    const cur = map.get(k) || { trades: 0, wins: 0, profit: 0 };
    cur.trades++;
    if (t.profit > 0) cur.wins++;
    cur.profit += t.profit;
    map.set(k, cur);
  }
  let entries = Array.from(map.entries()).map(([key, v]) => ({
    key,
    trades: v.trades,
    profit: Math.round(v.profit * 100) / 100,
    winRate: v.trades ? (v.wins / v.trades) * 100 : 0,
  }));
  if (order) {
    entries = order.map((k) => entries.find((e) => e.key === k) || { key: k, trades: 0, profit: 0, winRate: 0 });
  } else {
    entries.sort((a, b) => a.key.localeCompare(b.key));
  }
  return entries;
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const byHour = (h: TradeHistory[]) =>
  aggregateBy(h, (t) => String(toDate(t.openTime).getUTCHours()).padStart(2, '0'), HOURS);

export const byWeekday = (h: TradeHistory[]) =>
  aggregateBy(h, (t) => WEEKDAYS[toDate(t.openTime).getUTCDay()] || 'Sun', WEEKDAYS);

export const byMonth = (h: TradeHistory[]) =>
  aggregateBy(h, (t) => MONTHS[toDate(t.openTime).getUTCMonth()] || 'Jan', MONTHS);

// ---------- correlation (MFE/MAE proxies — pips proxy when raw not available) ----------
export interface CorrelationPoint { x: number; y: number; profit: number; symbol: string }

const pearson = (xs: number[], ys: number[]): number => {
  if (xs.length < 2) return 0;
  const mx = avg(xs), my = avg(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den > 0 ? num / den : 0;
};

// Approximate MFE/MAE from pips & profit since broker MFE/MAE isn't tracked in TradeHistory.
// MFE proxy = max(0, pips * lots); MAE proxy = min(0, pips * lots) — gives signed magnitudes.
export const correlationData = (h: TradeHistory[]) => {
  const pts: CorrelationPoint[] = h.map((t) => {
    const mfe = Math.max(t.pips, 0) * t.lots;
    const mae = Math.min(t.pips, 0) * t.lots;
    return { x: mfe, y: mae, profit: t.profit, symbol: t.symbol };
  });
  return {
    points: pts,
    profitVsMFE: pearson(pts.map((p) => p.profit), pts.map((p) => p.x)),
    profitVsMAE: pearson(pts.map((p) => p.profit), pts.map((p) => p.y)),
    mfeVsMAE: pearson(pts.map((p) => p.x), pts.map((p) => p.y)),
  };
};

// ---------- per-symbol ----------
export const bySymbol = (h: TradeHistory[]): TimeBucket[] => {
  const map = new Map<string, { trades: number; wins: number; profit: number }>();
  for (const t of h) {
    const cur = map.get(t.symbol) || { trades: 0, wins: 0, profit: 0 };
    cur.trades++;
    if (t.profit > 0) cur.wins++;
    cur.profit += t.profit;
    map.set(t.symbol, cur);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, trades: v.trades, profit: Math.round(v.profit * 100) / 100, winRate: v.trades ? (v.wins / v.trades) * 100 : 0 }))
    .sort((a, b) => b.profit - a.profit);
};
