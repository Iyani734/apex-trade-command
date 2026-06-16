import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, BookOpen, TrendingUp, TrendingDown, Target, Award, Clock,
  Layers, Activity, DollarSign, Calendar as CalendarIcon, Hash, Percent,
  Flame, ShieldAlert,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  AreaChart, Area, Cell, ComposedChart, Line,
} from 'recharts';
import { useTradingStore, type JournalEntry } from '@/store/tradingStore';
import { scoreGrade } from '@/lib/tradeScore';
import { TradeDetailDrawer } from '@/components/journal/TradeDetailDrawer';
import { cn } from '@/lib/utils';
import { useState } from 'react';

// Vibrant, high-contrast chart palette tailored for the dark theme.
const CHART = {
  primary: 'hsl(190 95% 55%)',    // cyan
  accent:  'hsl(265 85% 65%)',    // violet
  success: 'hsl(150 75% 50%)',    // emerald
  danger:  'hsl(0 80% 62%)',      // coral
  warning: 'hsl(40 95% 60%)',     // amber
  muted:   'hsl(220 15% 55%)',
};

const SESSION_COLORS: Record<string, string> = {
  Asia: CHART.accent,
  London: CHART.primary,
  Overlap: CHART.warning,
  'New York': CHART.success,
  'After hours': CHART.muted,
  Unknown: CHART.muted,
};

const SESSION_OF = (iso?: string): string => {
  if (!iso) return 'Unknown';
  const h = new Date(iso).getUTCHours();
  if (h >= 0 && h < 7) return 'Asia';
  if (h >= 7 && h < 12) return 'London';
  if (h >= 12 && h < 16) return 'Overlap';
  if (h >= 16 && h < 21) return 'New York';
  return 'After hours';
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StrategyDetailPage() {
  const { strategy: strategyParam = '', setup: setupParam = '—' } = useParams();
  const strategy = decodeURIComponent(strategyParam);
  const setup = decodeURIComponent(setupParam);
  const navigate = useNavigate();

  const allJournal = useTradingStore((s) => s.journal);
  const activeAccountId = useTradingStore((s) => s.activeAccountId);
  const [drawerEntry, setDrawerEntry] = useState<JournalEntry | null>(null);

  const trades = useMemo(() => {
    if (!activeAccountId) return [];
    return allJournal
      .filter((e) =>
        e.accountId === activeAccountId &&
        e.status === 'closed' &&
        e.strategy === strategy &&
        (e.setup || '—') === setup,
      )
      .sort((a, b) => Date.parse(b.closeTime || b.openTime) - Date.parse(a.closeTime || a.openTime));
  }, [allJournal, activeAccountId, strategy, setup]);

  const stats = useMemo(() => {
    const total = trades.length;
    const wins = trades.filter((t) => (t.profit ?? 0) > 0).length;
    const losses = trades.filter((t) => (t.profit ?? 0) < 0).length;
    const breakeven = total - wins - losses;
    const profit = trades.reduce((s, t) => s + (t.profit ?? 0), 0);
    const grossWin = trades.filter((t) => (t.profit ?? 0) > 0).reduce((s, t) => s + (t.profit ?? 0), 0);
    const grossLoss = Math.abs(trades.filter((t) => (t.profit ?? 0) < 0).reduce((s, t) => s + (t.profit ?? 0), 0));
    const pf = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
    const winRate = total ? (wins / total) * 100 : 0;
    const avgWin = wins ? grossWin / wins : 0;
    const avgLoss = losses ? grossLoss / losses : 0;
    const expectancy = total ? profit / total : 0;
    const best = trades.reduce((m, t) => Math.max(m, t.profit ?? -Infinity), -Infinity);
    const worst = trades.reduce((m, t) => Math.min(m, t.profit ?? Infinity), Infinity);
    const avgScore = (() => {
      const s = trades.filter((t) => t.score !== undefined);
      if (!s.length) return 0;
      return s.reduce((a, t) => a + (t.score ?? 0), 0) / s.length;
    })();

    // streaks
    const sorted = [...trades].sort((a, b) =>
      Date.parse(a.closeTime || a.openTime) - Date.parse(b.closeTime || b.openTime),
    );
    let curStreak = 0, curSign = 0, bestWinStreak = 0, worstLoseStreak = 0;
    sorted.forEach((t) => {
      const s = (t.profit ?? 0) > 0 ? 1 : (t.profit ?? 0) < 0 ? -1 : 0;
      if (s === 0) { curStreak = 0; curSign = 0; return; }
      if (s === curSign) curStreak += 1; else { curStreak = 1; curSign = s; }
      if (s === 1 && curStreak > bestWinStreak) bestWinStreak = curStreak;
      if (s === -1 && curStreak > worstLoseStreak) worstLoseStreak = curStreak;
    });

    // average duration (mins)
    const durs = trades.map((t) => t.exitSnapshot?.durationMs || 0).filter(Boolean);
    const avgDurMin = durs.length ? Math.round((durs.reduce((a, b) => a + b, 0) / durs.length) / 60000) : 0;

    // max drawdown on equity curve
    let cum = 0, peak = 0, maxDD = 0;
    sorted.forEach((t) => {
      cum += t.profit ?? 0;
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDD) maxDD = dd;
    });

    return {
      total, wins, losses, breakeven, profit, pf, winRate, avgWin, avgLoss, expectancy,
      best: best === -Infinity ? 0 : best,
      worst: worst === Infinity ? 0 : worst,
      avgScore, bestWinStreak, worstLoseStreak, avgDurMin, maxDD,
    };
  }, [trades]);

  const sessionBreakdown = useMemo(() => {
    const m = new Map<string, { session: string; trades: number; wins: number; profit: number }>();
    trades.forEach((t) => {
      const s = SESSION_OF(t.openTime);
      const cur = m.get(s) || { session: s, trades: 0, wins: 0, profit: 0 };
      cur.trades += 1;
      if ((t.profit ?? 0) > 0) cur.wins += 1;
      cur.profit += t.profit ?? 0;
      m.set(s, cur);
    });
    return Array.from(m.values())
      .map((s) => ({ ...s, winRate: s.trades ? (s.wins / s.trades) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit);
  }, [trades]);

  const symbolBreakdown = useMemo(() => {
    const m = new Map<string, { symbol: string; trades: number; wins: number; profit: number }>();
    trades.forEach((t) => {
      const cur = m.get(t.symbol) || { symbol: t.symbol, trades: 0, wins: 0, profit: 0 };
      cur.trades += 1;
      if ((t.profit ?? 0) > 0) cur.wins += 1;
      cur.profit += t.profit ?? 0;
      m.set(t.symbol, cur);
    });
    return Array.from(m.values())
      .map((s) => ({ ...s, winRate: s.trades ? (s.wins / s.trades) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit);
  }, [trades]);

  const dowBreakdown = useMemo(() => {
    const arr = DOW.map((d) => ({ day: d, profit: 0, trades: 0, wins: 0 }));
    trades.forEach((t) => {
      const d = new Date(t.openTime).getUTCDay();
      arr[d].profit += t.profit ?? 0;
      arr[d].trades += 1;
      if ((t.profit ?? 0) > 0) arr[d].wins += 1;
    });
    return arr;
  }, [trades]);

  // Hour-of-day heat
  const hourBreakdown = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, profit: 0, trades: 0 }));
    trades.forEach((t) => {
      const h = new Date(t.openTime).getUTCHours();
      arr[h].profit += t.profit ?? 0;
      arr[h].trades += 1;
    });
    return arr;
  }, [trades]);

  // Cumulative equity + drawdown band
  const equityCurve = useMemo(() => {
    const sorted = [...trades].sort((a, b) =>
      Date.parse(a.closeTime || a.openTime) - Date.parse(b.closeTime || b.openTime),
    );
    let cum = 0, peak = 0;
    return sorted.map((t, i) => {
      cum += t.profit ?? 0;
      if (cum > peak) peak = cum;
      return {
        i: i + 1,
        date: (t.closeTime || t.openTime).slice(0, 10),
        cum: Number(cum.toFixed(2)),
        dd: Number((peak - cum).toFixed(2)),
      };
    });
  }, [trades]);

  // Monthly performance
  const monthlyBreakdown = useMemo(() => {
    const m = new Map<string, { month: string; profit: number; trades: number; wins: number }>();
    trades.forEach((t) => {
      const d = new Date(t.closeTime || t.openTime);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const cur = m.get(key) || { month: key, profit: 0, trades: 0, wins: 0 };
      cur.profit += t.profit ?? 0;
      cur.trades += 1;
      if ((t.profit ?? 0) > 0) cur.wins += 1;
      m.set(key, cur);
    });
    return Array.from(m.values())
      .map((x) => ({ ...x, winRate: x.trades ? (x.wins / x.trades) * 100 : 0 }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [trades]);

  const grade = stats.avgScore ? scoreGrade(stats.avgScore) : null;
  const bestSession = sessionBreakdown[0];
  const bestSymbol = symbolBreakdown[0];

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/journal')}
            className="p-2 rounded-lg bg-secondary/40 hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors"
            title="Back to Journal"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <BookOpen className="w-6 h-6 text-accent shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">{strategy}</h1>
            <p className="text-xs text-muted-foreground">
              Strategy deep dive
              {setup && setup !== '—' && (
                <>
                  {' · '}
                  <span className="text-primary font-mono">{setup}</span>
                </>
              )}
              {' · '}
              <span className="font-mono">{stats.total} closed trades</span>
            </p>
          </div>
        </div>
        {grade && (
          <div className="px-4 py-2 rounded-xl bg-secondary/40 border border-border/50 text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Average Grade</div>
            <div className={cn('text-xl font-mono font-bold', grade.tone)}>
              {grade.label} · {stats.avgScore.toFixed(0)}
            </div>
          </div>
        )}
      </motion.div>

      {trades.length === 0 ? (
        <div className="glass-card p-16 text-center text-muted-foreground text-sm">
          No closed trades yet for {strategy}{setup !== '—' ? ` · ${setup}` : ''} on this account.
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <KPI icon={DollarSign} label="Net P/L"
              value={`${stats.profit >= 0 ? '+' : ''}$${stats.profit.toFixed(2)}`}
              tone={stats.profit >= 0 ? 'success' : 'destructive'} />
            <KPI icon={Target} label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
            <KPI icon={Activity} label="Profit Factor"
              value={stats.pf === Infinity ? '∞' : stats.pf.toFixed(2)}
              tone={stats.pf >= 1.5 ? 'success' : stats.pf < 1 ? 'destructive' : undefined} />
            <KPI icon={Layers} label="Expectancy" value={`$${stats.expectancy.toFixed(2)}`} />
            <KPI icon={TrendingUp} label="Avg Win" value={`$${stats.avgWin.toFixed(2)}`} tone="success" />
            <KPI icon={TrendingDown} label="Avg Loss" value={`$${stats.avgLoss.toFixed(2)}`} tone="destructive" />
            <KPI icon={Hash} label="Trades" value={String(stats.total)} />
            <KPI icon={Percent} label="Wins / Losses"
              value={`${stats.wins} / ${stats.losses}${stats.breakeven ? ` (${stats.breakeven} BE)` : ''}`} />
            <KPI icon={Flame} label="Best Streak" value={`${stats.bestWinStreak} W`} tone="success" />
            <KPI icon={ShieldAlert} label="Worst Streak" value={`${stats.worstLoseStreak} L`} tone="destructive" />
            <KPI icon={Clock} label="Avg Duration"
              value={stats.avgDurMin >= 60 ? `${(stats.avgDurMin / 60).toFixed(1)}h` : `${stats.avgDurMin}m`} />
            <KPI icon={ShieldAlert} label="Max Drawdown" value={`-$${stats.maxDD.toFixed(2)}`} tone="destructive" />
          </div>

          {/* Equity + DD */}
          <Section title="Equity curve & drawdown" subtitle="Cumulative P/L and rolling drawdown for this strategy.">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={equityCurve}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART.primary} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={CHART.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART.danger} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CHART.danger} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.25} />
                <XAxis dataKey="i" stroke={CHART.muted} tick={{ fontSize: 10 }} />
                <YAxis stroke={CHART.muted} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(225 30% 10%)',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8, fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="cum" stroke={CHART.primary} strokeWidth={2.2}
                  fill="url(#eqGrad)" name="Equity" />
                <Area type="monotone" dataKey="dd" stroke={CHART.danger} strokeWidth={1.5}
                  fill="url(#ddGrad)" name="Drawdown" />
              </ComposedChart>
            </ResponsiveContainer>
          </Section>

          {/* Two-col: session + symbol */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Performance by session"
              subtitle={bestSession ? `Best: ${bestSession.session} · +$${bestSession.profit.toFixed(2)}` : ''}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sessionBreakdown} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} horizontal={false} />
                  <XAxis type="number" stroke={CHART.muted} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="session" stroke={CHART.muted} tick={{ fontSize: 11 }} width={80} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(225 30% 10%)',
                      border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12,
                    }}
                    formatter={(v: any, _n, p: any) => [`$${Number(v).toFixed(2)} · ${p.payload.trades} trades · ${p.payload.winRate.toFixed(0)}% win`, 'P/L']}
                  />
                  <Bar dataKey="profit" radius={[0, 6, 6, 0]}>
                    {sessionBreakdown.map((d, i) => (
                      <Cell key={i} fill={d.profit >= 0 ? (SESSION_COLORS[d.session] || CHART.primary) : CHART.danger} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Performance by symbol"
              subtitle={bestSymbol ? `Best: ${bestSymbol.symbol} · +$${bestSymbol.profit.toFixed(2)}` : ''}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={symbolBreakdown.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                  <XAxis dataKey="symbol" stroke={CHART.muted} tick={{ fontSize: 10 }} />
                  <YAxis stroke={CHART.muted} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(225 30% 10%)',
                      border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12,
                    }}
                    formatter={(v: any, _n, p: any) => [`$${Number(v).toFixed(2)} · ${p.payload.trades} trades · ${p.payload.winRate.toFixed(0)}% win`, 'P/L']}
                  />
                  <Bar dataKey="profit" radius={[6, 6, 0, 0]}>
                    {symbolBreakdown.slice(0, 10).map((d, i) => (
                      <Cell key={i} fill={d.profit >= 0 ? CHART.success : CHART.danger} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>

          {/* Day-of-week + Hour-of-day */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="P/L by day of week">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dowBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                  <XAxis dataKey="day" stroke={CHART.muted} tick={{ fontSize: 11 }} />
                  <YAxis stroke={CHART.muted} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(225 30% 10%)',
                      border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12,
                    }}
                  />
                  <Bar dataKey="profit" radius={[6, 6, 0, 0]}>
                    {dowBreakdown.map((d, i) => (
                      <Cell key={i} fill={d.profit >= 0 ? CHART.success : CHART.danger} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Trades by hour of day (UTC)">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={hourBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                  <XAxis dataKey="hour" stroke={CHART.muted} tick={{ fontSize: 9 }} interval={1} />
                  <YAxis stroke={CHART.muted} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(225 30% 10%)',
                      border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12,
                    }}
                  />
                  <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                    {hourBreakdown.map((d, i) => (
                      <Cell key={i} fill={d.profit >= 0 ? CHART.primary : CHART.danger} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>

          {/* Monthly performance */}
          {monthlyBreakdown.length > 0 && (
            <Section title="Monthly performance" subtitle="P/L grouped by month — bars colored by win rate.">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={monthlyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                  <XAxis dataKey="month" stroke={CHART.muted} tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" stroke={CHART.muted} tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" stroke={CHART.warning} tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(225 30% 10%)',
                      border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12,
                    }}
                  />
                  <Bar yAxisId="left" dataKey="profit" radius={[6, 6, 0, 0]} name="P/L">
                    {monthlyBreakdown.map((d, i) => (
                      <Cell key={i} fill={d.profit >= 0 ? CHART.success : CHART.danger} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="winRate" stroke={CHART.warning}
                    strokeWidth={2.2} dot={{ r: 3, fill: CHART.warning }} name="Win rate %" />
                </ComposedChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* Trade list */}
          <Section title={`All trades (${trades.length})`}
            subtitle="Click a row to inspect entry / exit, SL/TP, pips, journal context.">
            <div className="space-y-1.5 max-h-[500px] overflow-auto pr-1">
              {trades.map((t) => {
                const g = t.score !== undefined ? scoreGrade(t.score) : null;
                return (
                  <button
                    key={t.id}
                    onClick={() => setDrawerEntry(t)}
                    className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_1fr_auto] items-center gap-3 text-xs px-3 py-2.5 rounded-lg hover:bg-secondary/40 border border-border/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-semibold">{t.symbol}</span>
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded',
                        t.type === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                      )}>{t.type}</span>
                      <span className="text-muted-foreground font-mono truncate">#{t.ticket}</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground font-mono">
                      <CalendarIcon className="w-3 h-3" />
                      {(t.closeTime || t.openTime).slice(0, 10)}
                    </div>
                    <div className="hidden sm:block text-muted-foreground">
                      {SESSION_OF(t.openTime)}
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      {g && <span className={cn('font-mono text-[10px]', g.tone)}>{g.label}</span>}
                      <span className={cn('font-mono font-semibold', (t.profit ?? 0) >= 0 ? 'profit-positive' : 'profit-negative')}>
                        {(t.profit ?? 0) >= 0 ? '+' : ''}${(t.profit ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>
        </>
      )}

      <TradeDetailDrawer entry={drawerEntry} onClose={() => setDrawerEntry(null)} />
    </div>
  );
}

function KPI({ icon: Icon, label, value, tone }: {
  icon: any; label: string; value: string; tone?: 'success' | 'destructive';
}) {
  return (
    <div className="rounded-xl border border-border/30 bg-secondary/15 p-3 hover:bg-secondary/30 transition-colors">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
        <Icon className="w-3 h-3" />
        <span className="truncate">{label}</span>
      </div>
      <div className={cn('font-mono font-bold text-sm sm:text-base truncate',
        tone === 'success' && 'profit-positive',
        tone === 'destructive' && 'profit-negative',
      )}>{value}</div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="mb-4">
        <h4 className="text-sm font-semibold tracking-tight">{title}</h4>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
