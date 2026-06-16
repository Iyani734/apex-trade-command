import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTradingStore } from '@/store/tradingStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isSameMonth,
  addMonths, subMonths, addYears, subYears, getDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { mockMode } from '@/hooks/useMockData';

// Mon–Fri only (markets closed Sat/Sun)
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr'];

type ViewMode = 'month' | 'year';

function formatCalendarMoney(value: number, compact = false) {
  const sign = value >= 0 ? '+' : '-';
  const abs = Math.abs(value);
  if (compact && abs >= 10000) {
    const formatted = new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: abs >= 100000 ? 1 : 0,
    }).format(abs);
    return `${sign}$${formatted}`;
  }
  return `${sign}$${abs.toFixed(2)}`;
}

// Robust date parser — accepts: ISO, "YYYY-MM-DD HH:mm:ss", "DD.MM.YYYY HH:mm",
// "MM/DD/YYYY HH:mm", "DD-MM-YYYY HH:mm". Returns "YYYY-MM-DD" or null.
function parseDayKey(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Try native first
  const native = new Date(s);
  if (!isNaN(native.getTime()) && native.getFullYear() > 1990) {
    return format(native, 'yyyy-MM-dd');
  }
  // ISO-ish prefix
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // dd.mm.yyyy or dd-mm-yyyy
  const dmy = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
  if (dmy) {
    const [, a, b, y] = dmy;
    // Heuristic: if first part > 12 it must be day; else assume dd.mm
    const day = Number(a), mon = Number(b);
    const d = day > 12 ? day : day;
    const m = day > 12 ? mon : mon;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

// Generate synthetic demo trades when history is empty so the UI is visible
function generateDemoHistory() {
  const trades: any[] = [];
  const today = new Date();
  let ticket = 900000;
  for (let i = 120; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    // 0–4 trades per day
    const n = Math.floor(Math.random() * 5);
    for (let j = 0; j < n; j++) {
      const win = Math.random() > 0.45;
      const profit = win
        ? Math.round((Math.random() * 280 + 20) * 100) / 100
        : -Math.round((Math.random() * 200 + 15) * 100) / 100;
      trades.push({
        ticket: ticket++,
        symbol: ['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY'][j % 4],
        type: win ? 'BUY' : 'SELL',
        lots: 0.1,
        openPrice: 1, closePrice: 1,
        profit, swap: 0, commission: 0,
        openTime: format(d, "yyyy-MM-dd'T'HH:mm:ss"),
        closeTime: format(d, "yyyy-MM-dd'T'HH:mm:ss"),
        duration: '1h', pips: 0,
      });
    }
  }
  return trades;
}

export default function CalendarPage() {
  const realHistory = useTradingStore((s) => s.history);
  const account = useTradingStore((s) => s.accounts.find((a) => a.id === s.activeAccountId));
  const demoAllowed = mockMode.isEnabled();

  // Demo fallback — generated once if real history is empty
  const demoHistory = useMemo(() => (demoAllowed ? generateDemoHistory() : []), [demoAllowed]);
  const usingDemo = demoAllowed && (!realHistory || realHistory.length === 0);
  const history = usingDemo ? demoHistory : realHistory;

  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<ViewMode>('month');
  const wheelLockRef = useRef(0);
  const initRef = useRef(false);

  // Aggregate per day: profit, trades, fees — pre-computed once for fast paint
  const dailyMap = useMemo(() => {
    const map = new Map<string, { profit: number; trades: number; fees: number; wins: number; losses: number }>();
    history.forEach((t: any) => {
      const key = parseDayKey(t.closeTime) || parseDayKey(t.openTime);
      if (!key) return;
      const cur = map.get(key) || { profit: 0, trades: 0, fees: 0, wins: 0, losses: 0 };
      const fees = (Number(t.commission) || 0) + (Number(t.swap) || 0);
      const p = Number(t.profit) || 0;
      cur.profit += p;
      cur.fees += fees;
      cur.trades += 1;
      if (p > 0) cur.wins += 1;
      else if (p < 0) cur.losses += 1;
      map.set(key, cur);
    });
    return map;
  }, [history]);

  // Bounds — derived from parseDayKey for safety across date formats
  const { firstTradeMonth, latestTradeMonth } = useMemo(() => {
    const ts: number[] = [];
    history.forEach((t: any) => {
      const k = parseDayKey(t.closeTime) || parseDayKey(t.openTime);
      if (k) ts.push(new Date(k + 'T00:00:00').getTime());
    });
    if (!ts.length) return { firstTradeMonth: null as Date | null, latestTradeMonth: startOfMonth(new Date()) };
    return {
      firstTradeMonth: startOfMonth(new Date(Math.min(...ts))),
      latestTradeMonth: startOfMonth(new Date(Math.max(...ts))),
    };
  }, [history]);

  // Auto-jump on first load to the latest month with trades
  useEffect(() => {
    if (initRef.current) return;
    if (history.length && latestTradeMonth) {
      setCursor(latestTradeMonth);
      initRef.current = true;
    }
  }, [history.length, latestTradeMonth]);

  const cursorMonth = startOfMonth(cursor);
  const todayMonth = startOfMonth(new Date());
  const canGoBack = !firstTradeMonth || cursorMonth.getTime() > firstTradeMonth.getTime();
  const canGoForward = cursorMonth.getTime() < todayMonth.getTime();

  const goPrev = () => {
    if (view === 'year') {
      const next = subYears(cursor, 1);
      if (!firstTradeMonth || next.getTime() >= firstTradeMonth.getTime() - 1) setCursor(next);
    } else if (canGoBack) setCursor((c) => subMonths(c, 1));
  };
  const goNext = () => {
    if (view === 'year') {
      const next = addYears(cursor, 1);
      if (next.getTime() <= todayMonth.getTime()) setCursor(next);
    } else if (canGoForward) setCursor((c) => addMonths(c, 1));
  };
  const goToday = () => setCursor(new Date());

  // Labels for prev/next buttons
  const prevLabel = view === 'year'
    ? format(subYears(cursor, 1), 'yyyy')
    : format(subMonths(cursor, 1), 'MMM yyyy');
  const nextLabel = view === 'year'
    ? format(addYears(cursor, 1), 'yyyy')
    : format(addMonths(cursor, 1), 'MMM yyyy');
  const showNext = view === 'year'
    ? addYears(cursor, 1).getTime() <= todayMonth.getTime()
    : canGoForward;
  const showPrev = view === 'year'
    ? (!firstTradeMonth || subYears(cursor, 1).getTime() >= startOfMonth(new Date(firstTradeMonth.getFullYear(), 0, 1)).getTime())
    : canGoBack;

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  // Filter weekends out
  const days = allDays.filter((d) => {
    const dow = getDay(d); // 0 Sun .. 6 Sat
    return dow >= 1 && dow <= 5;
  });

  // Pad to start on Monday: Monday=0 ... Friday=4
  const padStart = (() => {
    const dow = getDay(monthStart); // 0..6
    if (dow === 0) return 4;       // Sun -> show as if Fri+1? skip
    if (dow === 6) return 4;       // Sat
    return dow - 1;                 // Mon=0
  })();

  // Month totals (calculated from history filtered by cursor month)
  const monthTotal = useMemo(() => {
    let profit = 0, trades = 0, fees = 0, winDays = 0, lossDays = 0;
    let bestDay: { date: Date; profit: number } | null = null;
    let worstDay: { date: Date; profit: number } | null = null;
    let wins = 0, losses = 0;

    history.forEach((t: any) => {
      const d = new Date(t.closeTime || t.openTime || '');
      if (isNaN(d.getTime())) return;
      if (!isSameMonth(d, cursor)) return;
      const p = Number(t.profit) || 0;
      if (p > 0) wins += 1;
      else if (p < 0) losses += 1;
    });

    days.forEach((d) => {
      const key = format(d, 'yyyy-MM-dd');
      const e = dailyMap.get(key);
      if (e) {
        profit += e.profit;
        fees += e.fees;
        trades += e.trades;
        if (e.profit > 0) winDays += 1;
        else if (e.profit < 0) lossDays += 1;
        if (!bestDay || e.profit > bestDay.profit) bestDay = { date: d, profit: e.profit };
        if (!worstDay || e.profit < worstDay.profit) worstDay = { date: d, profit: e.profit };
      }
    });

    const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
    const grossProfit = history
      .filter((t: any) => isSameMonth(new Date(t.closeTime || t.openTime || ''), cursor) && (Number(t.profit) || 0) > 0)
      .reduce((s: number, t: any) => s + (Number(t.profit) || 0), 0);
    const grossLoss = Math.abs(history
      .filter((t: any) => isSameMonth(new Date(t.closeTime || t.openTime || ''), cursor) && (Number(t.profit) || 0) < 0)
      .reduce((s: number, t: any) => s + (Number(t.profit) || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const avgWin = wins > 0 ? grossProfit / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;

    const dailyProfits: number[] = [];
    days.forEach((d) => {
      const e = dailyMap.get(format(d, 'yyyy-MM-dd'));
      if (e) dailyProfits.push(e.profit);
    });
    const mean = dailyProfits.length ? dailyProfits.reduce((a, b) => a + b, 0) / dailyProfits.length : 0;
    const variance = dailyProfits.length ? dailyProfits.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyProfits.length : 0;
    const dailyVol = Math.sqrt(variance);
    const sharpe = dailyVol > 0 ? (mean / dailyVol) : 0;

    return { profit, fees, trades, winDays, lossDays, bestDay, worstDay, winRate, profitFactor, avgWin, avgLoss, dailyVol, sharpe };
  }, [days, dailyMap, cursor, history]);

  // Build weeks (Mon–Fri only) — each row = one week
  const weeks = useMemo(() => {
    const cells: (Date | null)[] = [];
    for (let i = 0; i < padStart; i++) cells.push(null);
    days.forEach((d) => cells.push(d));
    while (cells.length % 5 !== 0) cells.push(null);
    const result: { weekIdx: number; cells: (Date | null)[]; profit: number; trades: number }[] = [];
    for (let i = 0; i < cells.length; i += 5) {
      const slice = cells.slice(i, i + 5);
      let profit = 0, trades = 0;
      slice.forEach((d) => {
        if (!d) return;
        const e = dailyMap.get(format(d, 'yyyy-MM-dd'));
        if (e) { profit += e.profit; trades += e.trades; }
      });
      result.push({ weekIdx: i / 5, cells: slice, profit, trades });
    }
    return result;
  }, [days, padStart, dailyMap]);

  // Year view: per-month aggregates
  const yearMonths = useMemo(() => {
    const year = cursor.getFullYear();
    return Array.from({ length: 12 }, (_, m) => {
      const start = new Date(year, m, 1);
      const end = endOfMonth(start);
      let profit = 0, trades = 0;
      history.forEach((t: any) => {
        const d = new Date(t.closeTime || t.openTime || '');
        if (isNaN(d.getTime())) return;
        if (d >= start && d <= end) { profit += Number(t.profit) || 0; trades += 1; }
      });
      return { date: start, profit, trades };
    });
  }, [cursor, history]);

  const today = new Date();

  const grandTotal = useMemo(() => {
    let profit = 0, trades = 0;
    history.forEach((t: any) => { profit += Number(t.profit) || 0; trades += 1; });
    return { profit, trades };
  }, [history]);

  return (
    <div className="space-y-5">
      {/* Title row */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trading Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Daily P&L heatmap · {account?.alias || '—'}
            {usingDemo && <span className="ml-2 px-1.5 py-0.5 rounded bg-warning/20 text-warning text-[10px] font-semibold uppercase tracking-wider">Demo data</span>}
          </p>
        </div>
      </motion.div>

      {/* Header strip — month label + grand total */}
      <div className="glass-card px-3 py-2.5 sm:px-4 flex items-center justify-between flex-wrap gap-x-6 gap-y-1 text-[11px] sm:text-xs">
        <div className="flex items-center gap-2 flex-wrap text-foreground">
          <span className="font-semibold">{format(cursor, 'MMMM yyyy')}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="text-muted-foreground">{format(today, 'MMM d')}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="text-muted-foreground">TZ: UTC{format(today, 'xxx')}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={cn('font-mono font-semibold', grandTotal.profit >= 0 ? 'profit-positive' : 'profit-negative')}>
            Total: {grandTotal.profit >= 0 ? '+' : ''}${grandTotal.profit.toFixed(2)}
          </span>
          <span className="text-muted-foreground font-mono">Trades: {grandTotal.trades}</span>
        </div>
      </div>

      {/* Stats summary moved to TOP */}
      {view === 'month' && (
        <>
          <div className="glass-card p-3 sm:px-5 sm:py-4">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
              <CalendarMetric label="Win Rate" value={`${monthTotal.winRate.toFixed(1)}%`} />
              <CalendarMetric label="Profit Factor" value={isFinite(monthTotal.profitFactor) ? monthTotal.profitFactor.toFixed(2) : '∞'} />
              <CalendarMetric label="Avg Win" value={`$${monthTotal.avgWin.toFixed(2)}`} tone="positive" />
              <CalendarMetric
                label="Avg Loss"
                value={monthTotal.avgLoss > 0 ? `-$${monthTotal.avgLoss.toFixed(2)}` : '$0.00'}
                tone="negative"
              />
              <CalendarMetric label="Sharpe" value={monthTotal.sharpe.toFixed(2)} />
              <CalendarMetric label="Daily Vol" value={`$${monthTotal.dailyVol.toFixed(2)}`} />
              {monthTotal.bestDay && (
                <CalendarMetric
                  label="Best Day"
                  value={`${format(monthTotal.bestDay.date, 'MMM d')} ${formatCalendarMoney(monthTotal.bestDay.profit, true)}`}
                  tone="positive"
                />
              )}
              {monthTotal.worstDay && (
                <CalendarMetric
                  label="Worst Day"
                  value={`${format(monthTotal.worstDay.date, 'MMM d')} ${formatCalendarMoney(monthTotal.worstDay.profit, true)}`}
                  tone="negative"
                />
              )}
            </div>
          </div>
          <div className="hidden">
          <div className="flex items-center gap-x-6 gap-y-2 flex-wrap text-foreground">
            <span>Win Rate: <span className="font-mono font-bold text-base">{monthTotal.winRate.toFixed(1)}%</span></span>
            <span className="text-muted-foreground/40">·</span>
            <span>Profit Factor: <span className="font-mono font-bold text-base">{isFinite(monthTotal.profitFactor) ? monthTotal.profitFactor.toFixed(2) : '∞'}</span></span>
            <span className="text-muted-foreground/40">·</span>
            <span>Avg Win: <span className="font-mono font-bold text-base profit-positive">${monthTotal.avgWin.toFixed(2)}</span></span>
            <span className="text-muted-foreground/40">·</span>
            <span>Avg Loss: <span className="font-mono font-bold text-base profit-negative">${monthTotal.avgLoss.toFixed(2)}</span></span>
            <span className="text-muted-foreground/40">·</span>
            <span>Sharpe: <span className="font-mono font-bold">{monthTotal.sharpe.toFixed(2)}</span></span>
            <span className="text-muted-foreground/40">·</span>
            <span>Daily Vol: <span className="font-mono font-bold">${monthTotal.dailyVol.toFixed(2)}</span></span>
            {monthTotal.bestDay && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>Best: <span className="font-mono text-foreground">{format(monthTotal.bestDay.date, 'MMM d')}</span> <span className="profit-positive font-mono font-bold">+${monthTotal.bestDay.profit.toFixed(2)}</span></span>
              </>
            )}
            {monthTotal.worstDay && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>Worst: <span className="font-mono text-foreground">{format(monthTotal.worstDay.date, 'MMM d')}</span> <span className="profit-negative font-mono font-bold">${monthTotal.worstDay.profit.toFixed(2)}</span></span>
              </>
            )}
          </div>
          </div>
        </>
      )}

      {/* Toolbar — view toggle + arrows with month labels */}
      <div className="glass-card p-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-1 items-center justify-start gap-2 flex-wrap sm:flex-none sm:justify-end">
          <ToolbarToggle active={view === 'year'} onClick={() => setView('year')}>Year</ToolbarToggle>
          <ToolbarToggle active={view === 'month'} onClick={() => setView('month')}>Month</ToolbarToggle>
        </div>
        <div className="flex flex-1 items-center justify-start gap-2 flex-wrap sm:flex-none sm:justify-end">
          {showPrev && (
            <ToolbarBtn onClick={goPrev}><ChevronLeft className="w-4 h-4" /> {prevLabel}</ToolbarBtn>
          )}
          <ToolbarBtn onClick={goToday}>Today</ToolbarBtn>
          {showNext && (
            <ToolbarBtn onClick={goNext}>{nextLabel} <ChevronRight className="w-4 h-4" /></ToolbarBtn>
          )}
        </div>
      </div>

      {/* Grid — Mon–Fri + Σ Week column */}
      {view === 'month' ? (
        <div className="glass-card p-2.5 sm:p-4">
          <div className="sm:hidden">
            <div className="grid grid-cols-5 gap-1 mb-1.5">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-[10px] font-bold text-muted-foreground/90 text-center uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {weeks.map((w) => (
                <div key={w.weekIdx}>
                  <div className="grid grid-cols-5 gap-1">
                    {w.cells.map((d, i) => {
                      if (!d) return <div key={i} className="h-[74px] rounded-lg bg-secondary/10" />;
                      const key = format(d, 'yyyy-MM-dd');
                      const entry = dailyMap.get(key);
                      const isToday = isSameDay(d, today);
                      const inMonth = isSameMonth(d, cursor);
                      const profit = entry?.profit ?? 0;
                      const trades = entry?.trades ?? 0;
                      const hasData = !!entry && trades > 0;
                      const bg = hasData
                        ? profit >= 0
                          ? 'bg-success/60 border-success'
                          : 'bg-destructive/60 border-destructive'
                        : 'bg-secondary/30 border-border/30';
                      return (
                        <div
                          key={i}
                          className={cn(
                            'h-[74px] rounded-lg border p-1.5 flex min-w-0 flex-col',
                            bg,
                            isToday && 'ring-1 ring-primary ring-offset-1 ring-offset-background',
                            !inMonth && 'opacity-30',
                          )}
                        >
                          <span className={cn('text-[12px] font-bold leading-none', isToday ? 'text-primary' : 'text-foreground')}>
                            {format(d, 'd')}
                          </span>
                          <div className="flex flex-1 min-w-0 flex-col items-center justify-center text-center">
                            {hasData ? (
                              <>
                                <div
                                  className="w-full truncate font-mono text-[clamp(0.62rem,2.75vw,0.82rem)] font-extrabold leading-tight"
                                  style={{ color: profit >= 0 ? 'hsl(145 90% 88%)' : 'hsl(0 90% 92%)' }}
                                  title={formatCalendarMoney(profit)}
                                >
                                  {formatCalendarMoney(profit, true)}
                                </div>
                                <div
                                  className="mt-0.5 font-mono text-[10px] font-semibold opacity-90"
                                  style={{ color: profit >= 0 ? 'hsl(145 90% 88%)' : 'hsl(0 90% 92%)' }}
                                >
                                  {trades}t
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground/50 text-xs">-</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <div className="min-w-[880px]">
              <div className="grid grid-cols-[repeat(5,minmax(0,1fr))_170px] gap-2 mb-2">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-xs font-bold text-muted-foreground/90 text-center pb-1 uppercase tracking-wider">
                    {d}
                  </div>
                ))}
                <div className="text-xs font-bold text-primary text-center pb-1 uppercase tracking-wider">Week</div>
              </div>
              <div className="space-y-2">
                {weeks.map((w) => (
                  <div key={w.weekIdx} className="grid grid-cols-[repeat(5,minmax(0,1fr))_170px] gap-2">
                    {w.cells.map((d, i) => {
                      if (!d) return <div key={i} className="h-[88px] rounded-lg bg-secondary/10" />;
                      const key = format(d, 'yyyy-MM-dd');
                      const entry = dailyMap.get(key);
                      const isToday = isSameDay(d, today);
                      const inMonth = isSameMonth(d, cursor);
                      const profit = entry?.profit ?? 0;
                      const trades = entry?.trades ?? 0;
                      const hasData = !!entry && trades > 0;
                      const bg = hasData
                        ? profit >= 0
                          ? 'bg-success/60 border-success'
                          : 'bg-destructive/60 border-destructive'
                        : 'bg-secondary/30 border-border/30';
                      return (
                        <div
                          key={i}
                          className={cn(
                            'h-[88px] rounded-lg border-2 p-2 flex flex-col',
                            bg,
                            isToday && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                            !inMonth && 'opacity-30',
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className={cn('text-sm font-bold', isToday ? 'text-primary' : 'text-foreground')}>
                              {format(d, 'd')}
                            </span>
                          </div>
                          <div className="flex-1 flex flex-col items-center justify-center text-center">
                            {hasData ? (
                              <>
                                <div className="text-base font-mono font-extrabold leading-tight"
                                  style={{ color: profit >= 0 ? 'hsl(145 90% 88%)' : 'hsl(0 90% 92%)' }}
                                >
                                  {formatCalendarMoney(profit)}
                                </div>
                                <div className="text-[11px] font-mono font-semibold mt-1 opacity-90"
                                  style={{ color: profit >= 0 ? 'hsl(145 90% 88%)' : 'hsl(0 90% 92%)' }}
                                >
                                  {trades} {trades === 1 ? 'trade' : 'trades'}
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground/50 text-xs">-</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div className={cn(
                      'h-[88px] rounded-lg border-2 p-2 flex flex-col justify-center items-center text-center overflow-hidden',
                      w.trades === 0
                        ? 'bg-secondary/30 border-border/30'
                        : w.profit >= 0
                          ? 'bg-success/60 border-success'
                          : 'bg-destructive/60 border-destructive',
                    )}>
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-0.5"
                        style={{ color: w.trades === 0 ? undefined : (w.profit >= 0 ? 'hsl(145 90% 88%)' : 'hsl(0 90% 92%)') }}
                      >Week</span>
                      <span className="max-w-full truncate font-mono text-[clamp(0.78rem,1vw,1.05rem)] font-extrabold leading-tight"
                        style={{ color: w.trades === 0 ? undefined : (w.profit >= 0 ? 'hsl(145 90% 88%)' : 'hsl(0 90% 92%)') }}
                        title={formatCalendarMoney(w.profit)}
                      >
                        {formatCalendarMoney(w.profit)}
                      </span>
                      <span className="text-xs font-mono font-semibold mt-0.5 opacity-90"
                        style={{ color: w.trades === 0 ? undefined : (w.profit >= 0 ? 'hsl(145 90% 88%)' : 'hsl(0 90% 92%)') }}
                      >{w.trades}t</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card p-3 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
            {yearMonths.map((m) => (
              <button
                key={m.date.getTime()}
                onClick={() => { setCursor(m.date); setView('month'); }}
                className={cn(
                  'min-w-0 rounded-lg border-2 p-3 text-left transition-all hover:scale-[1.02] sm:p-4',
                  m.trades === 0 ? 'bg-secondary/20 border-border/20' :
                    m.profit >= 0 ? 'bg-success/50 border-success' : 'bg-destructive/50 border-destructive',
                )}
              >
                <div className="truncate text-sm font-bold">{format(m.date, 'MMMM')}</div>
                <div
                  className={cn('mt-2 truncate font-mono text-[clamp(0.9rem,4.2vw,1.25rem)] font-extrabold', m.profit >= 0 ? 'profit-positive' : 'profit-negative')}
                  title={formatCalendarMoney(m.profit)}
                >
                  {formatCalendarMoney(m.profit, true)}
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-1 font-semibold">{m.trades} trades</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          No closed trades yet — your daily P&L will appear here as trades close.
        </div>
      )}
    </div>
  );
}

function CalendarMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  return (
    <div className="min-w-0 border-b border-border/30 pb-2 last:border-b-0 sm:border-b-0 sm:pb-0">
      <div className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 truncate font-mono text-[clamp(0.95rem,4vw,1.15rem)] font-extrabold leading-tight text-foreground',
          tone === 'positive' && 'profit-positive',
          tone === 'negative' && 'profit-negative',
        )}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function ToolbarBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary/15 hover:bg-primary/25 text-primary text-xs font-semibold transition-colors"
    >
      {children}
    </button>
  );
}

function ToolbarToggle({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-primary/15 text-primary hover:bg-primary/25',
      )}
    >
      {children}
    </button>
  );
}
