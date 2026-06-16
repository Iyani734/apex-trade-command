import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTradingStore } from '@/store/tradingStore';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Line,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Target, Activity, Percent, Zap, Award, Skull,
  Shuffle, Hourglass, Repeat, AlertTriangle, BarChart3, Layers, Scale, Clock,
} from 'lucide-react';
import {
  filterByDateRange, firstTradeDate, computeAdvancedMetrics, computeDrawdownStats,
  computeEquityCurve, computeDrawdownCurve, byHour, byWeekday, byMonth, bySymbol,
  correlationData, formatDuration, type DateRange,
} from '@/lib/analytics';
import { MetricKPI } from '@/components/analytics/MetricKPI';
import { ChartTooltip } from '@/components/analytics/ChartTooltip';
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter';
import { AccountComparePicker } from '@/components/analytics/AccountComparePicker';
import { ClosedTradesTable } from '@/components/analytics/ClosedTradesTable';
import { TimeBarChart } from '@/components/analytics/TimeBarChart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';

const COMPARE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(38 92% 55%)',
  'hsl(145 70% 45%)',
  'hsl(330 80% 60%)',
];

export default function AnalyticsPage() {
  const accounts = useTradingStore((s) => s.accounts);
  const activeId = useTradingStore((s) => s.activeAccountId);
  const snapshots = useTradingStore((s) => s.snapshots);
  const history = useTradingStore((s) => s.history);
  const serverAnalytics = useTradingStore((s) => s.analytics);
  const account = accounts.find((a) => a.id === activeId);
  const isMobile = useIsMobile();
  const chartMargin = isMobile ? { top: 8, right: 4, bottom: 0, left: -18 } : { top: 10, right: 16, bottom: 0, left: 8 };
  const chartHeight = isMobile ? 240 : 300;
  // Real starting balance: equity - net profit (from server analytics) or fall back to balance
  const startingBalance = useMemo(() => {
    if (serverAnalytics && account) {
      const net = serverAnalytics.totalProfit || 0;
      const start = (account.balance || 0) - net;
      return start > 0 ? start : account.balance || 10000;
    }
    return account?.balance ?? 10000;
  }, [account, serverAnalytics]);

  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const minDate = useMemo(() => firstTradeDate(history), [history]);

  useEffect(() => {
    if (range.from && minDate && range.from < minDate) setRange((r) => ({ ...r, from: minDate }));
  }, [minDate, range.from]);

  const filtered = useMemo(() => filterByDateRange(history, range), [history, range]);

  const metrics = useMemo(() => computeAdvancedMetrics(filtered, startingBalance), [filtered, startingBalance]);
  const dd = useMemo(() => computeDrawdownStats(filtered, startingBalance), [filtered, startingBalance]);

  // Equity curve: prefer server-supplied curve when available AND no date filter is active
  const eqCurve = useMemo(() => {
    const isAllTime = !range.from && !range.to;
    if (isAllTime && serverAnalytics?.equityCurve?.length) {
      return serverAnalytics.equityCurve.map((p) => ({ date: p.date, equity: p.equity }));
    }
    return computeEquityCurve(filtered, startingBalance);
  }, [serverAnalytics, range, filtered, startingBalance]);

  const ddCurve = useMemo(() => {
    const isAllTime = !range.from && !range.to;
    if (isAllTime && serverAnalytics?.drawdownCurve?.length) {
      return serverAnalytics.drawdownCurve.map((p) => ({ date: p.date, drawdown: -Math.abs(p.drawdown) }));
    }
    return computeDrawdownCurve(filtered, startingBalance);
  }, [serverAnalytics, range, filtered, startingBalance]);

  const hourly = useMemo(() => byHour(filtered), [filtered]);
  const weekdayly = useMemo(() => byWeekday(filtered), [filtered]);
  const monthly = useMemo(() => byMonth(filtered), [filtered]);
  const symbolStats = useMemo(() => bySymbol(filtered), [filtered]);
  const corr = useMemo(() => correlationData(filtered), [filtered]);

  const equityDomain = useMemo<[number, number]>(() => {
    if (!eqCurve.length) return [0, 1];
    const vals = eqCurve.map((d) => d.equity);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max((max - min) * 0.08, 50);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [eqCurve]);

  const compareCurves = useMemo(() => {
    if (!compareIds.length) return null;
    const series: Record<string, { id: string; alias: string; color: string; data: { date: string; equity: number }[] }> = {};
    const allAccounts = [activeId, ...compareIds].filter(Boolean) as string[];
    allAccounts.forEach((id, i) => {
      const acc = accounts.find((a) => a.id === id);
      const snap = snapshots[id];
      if (!snap || !acc) return;
      const accHistory = filterByDateRange(snap.history || [], range);
      series[id] = {
        id,
        alias: acc.alias,
        color: COMPARE_COLORS[i % COMPARE_COLORS.length],
        data: computeEquityCurve(accHistory, acc.balance || 10000),
      };
    });
    const dateSet = new Set<string>();
    Object.values(series).forEach((s) => s.data.forEach((p) => dateSet.add(p.date)));
    const dates = Array.from(dateSet).sort();
    const merged = dates.map((d) => {
      const row: Record<string, string | number> = { date: d };
      Object.values(series).forEach((s) => {
        const pt = s.data.find((p) => p.date === d);
        if (pt) row[s.id] = pt.equity;
      });
      return row;
    });
    return { merged, series: Object.values(series) };
  }, [compareIds, activeId, accounts, snapshots, range]);

  if (!history.length) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <div className="glass-card p-12 text-center text-muted-foreground">
          No trade history yet. Once trades close, your analytics appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Visual performance · {account?.alias || '—'}
            {filtered.length !== history.length && (
              <span className="ml-2 text-primary font-mono">({filtered.length} of {history.length} trades)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter range={range} onChange={setRange} minDate={minDate} />
          <AccountComparePicker
            accounts={accounts}
            primaryId={activeId}
            selected={compareIds}
            onChange={setCompareIds}
          />
        </div>
      </motion.div>

      {/* === CHARTS FIRST — visual focus === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Balance Curve</h3>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                Account balance after each closed trade · starts at ${startingBalance.toFixed(2)}
              </p>
            </div>
            {compareCurves && (
              <div className="flex items-center gap-3 text-[10px] font-mono">
                {compareCurves.series.map((s) => (
                  <div key={s.id} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    <span className="text-muted-foreground">{s.alias}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={chartHeight}>
            {compareCurves ? (
              <AreaChart data={compareCurves.merged} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => v.slice(5)} minTickGap={isMobile ? 20 : 40} />
                <YAxis width={isMobile ? 46 : 70} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0)}`} />
                <Tooltip cursor={false} content={<ChartTooltip valueFormatter={(v) => `$${v.toFixed(2)}`} />} />
                {compareCurves.series.map((s) => (
                  <Line key={s.id} type="monotone" dataKey={s.id} name={s.alias} stroke={s.color} strokeWidth={2} dot={false} isAnimationActive={false} />
                ))}
              </AreaChart>
            ) : (
              <AreaChart data={eqCurve} margin={chartMargin}>
                <defs>
                  <linearGradient id="eqGradA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => (v && v.length > 10 ? v.slice(5, 16).replace('T', ' ') : v)} minTickGap={isMobile ? 20 : 40} />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  domain={equityDomain}
                  tickFormatter={(v) => {
                    const span = equityDomain[1] - equityDomain[0];
                    if (span < 1000) return `$${v.toFixed(0)}`;
                    if (span < 10000) return `$${(v / 1000).toFixed(2)}k`;
                    return `$${(v / 1000).toFixed(1)}k`;
                  }}
                  width={isMobile ? 46 : 70}
                  allowDecimals={false}
                />
                <Tooltip cursor={false} content={<ChartTooltip valueFormatter={(v) => `$${v.toFixed(2)}`} />} />
                <Area type="monotone" dataKey="equity" name="Balance" stroke="hsl(var(--primary))" fill="url(#eqGradA)" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Drawdown</h3>
          <p className="text-[10px] text-muted-foreground/60 mb-3">How far balance fell from its previous peak (%)</p>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={ddCurve} margin={chartMargin}>
              <defs>
                <linearGradient id="ddGradA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => v.slice(5)} minTickGap={isMobile ? 20 : 40} />
              <YAxis width={isMobile ? 38 : 60} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${v.toFixed(1)}%`} />
              <Tooltip cursor={false} content={<ChartTooltip valueFormatter={(v) => `${v.toFixed(2)}%`} />} />
              <Area type="monotone" dataKey="drawdown" name="Drawdown" stroke="hsl(var(--destructive))" fill="url(#ddGradA)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time-based visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeBarChart title="P&L by Hour (UTC)" data={hourly} metric="profit" xLabel={(k) => `${k}h`} />
        <TimeBarChart title="P&L by Weekday" data={weekdayly} metric="profit" />
        <TimeBarChart title="P&L by Month" data={monthly} metric="profit" />
        <TimeBarChart title="P&L by Symbol" data={symbolStats} metric="profit" />
      </div>

      {/* === DETAILED METRICS — tabbed to avoid clutter === */}
      <div className="glass-card p-4 sm:p-5">
        <Tabs defaultValue="core">
          <TabsList className="max-w-full justify-start overflow-x-auto bg-secondary/30">
            <TabsTrigger value="core">Core Performance</TabsTrigger>
            <TabsTrigger value="stats">Trade Stats</TabsTrigger>
            <TabsTrigger value="risk">Drawdown & Risk</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
          </TabsList>

          <TabsContent value="core" className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricKPI title="Net Profit" value={`${metrics.netProfit >= 0 ? '+' : ''}$${metrics.netProfit.toFixed(2)}`} icon={DollarSign} trend={metrics.netProfit >= 0 ? 'up' : 'down'} accent="primary" />
              <MetricKPI title="Gross Profit" value={`$${metrics.grossProfit.toFixed(2)}`} icon={TrendingUp} accent="success" />
              <MetricKPI title="Gross Loss" value={`-$${metrics.grossLoss.toFixed(2)}`} icon={TrendingDown} accent="destructive" />
              <MetricKPI title="Profit Factor" value={metrics.profitFactor.toFixed(2)} icon={Activity} accent="primary" />
              <MetricKPI title="Expected Payoff" value={`$${metrics.expectedPayoff.toFixed(2)}`} icon={Target} accent="accent" />
              <MetricKPI title="Recovery Factor" value={metrics.recoveryFactor.toFixed(2)} icon={Repeat} accent="primary" />
              <MetricKPI title="Sharpe Ratio" value={metrics.sharpe.toFixed(2)} subtitle="annualized" icon={Award} accent="accent" />
              <MetricKPI title="Z-Score" value={metrics.zScore.toFixed(2)} subtitle="randomness" icon={Shuffle} accent="warning" />
              <MetricKPI title="AHPR" value={`${metrics.ahpr.toFixed(3)}%`} icon={Percent} accent="primary" />
              <MetricKPI title="GHPR" value={`${metrics.ghpr.toFixed(3)}%`} icon={Percent} accent="primary" />
            </div>
          </TabsContent>

          <TabsContent value="stats" className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricKPI title="Total Trades" value={String(metrics.totalTrades)} icon={BarChart3} />
              <MetricKPI title="Win Rate" value={`${metrics.winRate.toFixed(1)}%`} icon={Target} accent="success" trend="up" />
              <MetricKPI title="Avg R:R" value={metrics.avgRR.toFixed(2)} icon={Scale} />
              <MetricKPI title="Best Trade" value={`+$${metrics.bestTrade.toFixed(0)}`} icon={Award} accent="success" trend="up" />
              <MetricKPI title="Worst Trade" value={`-$${Math.abs(metrics.worstTrade).toFixed(0)}`} icon={Skull} accent="destructive" trend="down" />
              <MetricKPI title="Avg Duration" value={formatDuration(metrics.avgDurationMs)} icon={Clock} />
              <MetricKPI title="Long Trades" value={String(metrics.longTrades)} subtitle={`${metrics.longWinRate.toFixed(1)}% won`} icon={TrendingUp} accent="success" />
              <MetricKPI title="Short Trades" value={String(metrics.shortTrades)} subtitle={`${metrics.shortWinRate.toFixed(1)}% won`} icon={TrendingDown} accent="destructive" />
              <MetricKPI title="Profit Trades" value={`${metrics.winRate.toFixed(1)}%`} icon={TrendingUp} accent="success" />
              <MetricKPI title="Loss Trades" value={`${metrics.lossRate.toFixed(1)}%`} icon={TrendingDown} accent="destructive" />
              <MetricKPI title="Avg Profit" value={`$${metrics.avgProfit.toFixed(2)}`} icon={DollarSign} accent="success" />
              <MetricKPI title="Avg Loss" value={`$${metrics.avgLoss.toFixed(2)}`} icon={DollarSign} accent="destructive" />
            </div>
          </TabsContent>

          <TabsContent value="risk" className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <MetricKPI title="Bal DD Absolute" value={`$${dd.balanceDDAbsolute.toFixed(2)}`} icon={TrendingDown} accent="warning" />
              <MetricKPI title="Bal DD Maximal" value={`$${dd.balanceDDMaximal.toFixed(2)}`} icon={TrendingDown} accent="destructive" />
              <MetricKPI title="Bal DD Relative" value={`${dd.balanceDDRelativePct.toFixed(2)}%`} icon={Percent} accent="destructive" />
              <MetricKPI title="Eq DD Absolute" value={`$${dd.equityDDAbsolute.toFixed(2)}`} icon={TrendingDown} accent="warning" />
              <MetricKPI title="Eq DD Maximal" value={`$${dd.equityDDMaximal.toFixed(2)}`} icon={TrendingDown} accent="destructive" />
              <MetricKPI title="Eq DD Relative" value={`${dd.equityDDRelativePct.toFixed(2)}%`} icon={Percent} accent="destructive" />
              <MetricKPI title="Max DD Duration" value={formatDuration(dd.maxDDDurationMs)} icon={Hourglass} accent="warning" />
              <MetricKPI title="Risk of Ruin" value={`${(metrics.riskOfRuin * 100).toFixed(2)}%`} icon={AlertTriangle} accent={metrics.riskOfRuin > 0.1 ? 'destructive' : 'success'} />
            </div>
          </TabsContent>

          <TabsContent value="behavior" className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <MetricKPI title="Max Consec Wins" value={String(metrics.maxConsecWins)} subtitle={`+$${metrics.maxConsecWinsAmount.toFixed(2)}`} icon={Layers} accent="success" />
              <MetricKPI title="Max Consec Losses" value={String(metrics.maxConsecLosses)} subtitle={`-$${Math.abs(metrics.maxConsecLossesAmount).toFixed(2)}`} icon={Layers} accent="destructive" />
              <MetricKPI title="Avg Consec Wins" value={metrics.avgConsecWins.toFixed(1)} icon={Repeat} accent="success" />
              <MetricKPI title="Avg Consec Losses" value={metrics.avgConsecLosses.toFixed(1)} icon={Repeat} accent="destructive" />
              <MetricKPI title="Min Duration" value={formatDuration(metrics.minDurationMs)} icon={Zap} />
              <MetricKPI title="Max Duration" value={formatDuration(metrics.maxDurationMs)} icon={Hourglass} />
              <MetricKPI title="Total Deals" value={String(metrics.totalDeals)} subtitle="open + close" icon={BarChart3} />
              <MetricKPI title="Sortino Ratio" value={metrics.sortino.toFixed(2)} icon={Award} accent="accent" />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* === CORRELATIONS — standalone card === */}
      <div className="glass-card p-4 space-y-5 sm:p-5">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Correlations</h3>
          <p className="text-xs text-muted-foreground/70 mt-1">
            How two things move together on a scale from −1 to +1. Near +1 = they rise together, near −1 = inverse, near 0 = no relationship.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <CorrelationCard
            label="Profit ↔ Pips gained"
            value={corr.profitVsMFE}
            hint="Strong positive = bigger winners directly grow your account."
          />
          <CorrelationCard
            label="Profit ↔ Pips lost"
            value={corr.profitVsMAE}
            hint="Strong negative = letting trades run against you erodes profit."
          />
          <CorrelationCard
            label="Pips gained ↔ Pips lost"
            value={corr.mfeVsMAE}
            hint="Negative = winners and losers rarely happen on the same setup."
          />
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Each dot is one trade — winners (top) vs losers (bottom)
          </h4>
          <ResponsiveContainer width="100%" height={isMobile ? 240 : 280}>
            <ScatterChart margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis type="number" dataKey="x" name="Pips gained" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis width={isMobile ? 38 : 60} type="number" dataKey="y" name="Pips lost" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <ZAxis type="number" dataKey="profit" range={[40, 200]} />
              <Tooltip cursor={false} content={<ChartTooltip valueFormatter={(v, n) => n === 'profit' ? `$${v.toFixed(2)}` : v.toFixed(1)} />} />
              <Scatter data={corr.points.filter((p) => p.profit >= 0)} fill="hsl(var(--success))" />
              <Scatter data={corr.points.filter((p) => p.profit < 0)} fill="hsl(var(--destructive))" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Closed trades table */}
      <ClosedTradesTable history={filtered} />
    </div>
  );
}

function CorrelationCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  const strength = Math.abs(value);
  const tone = value >= 0.4 ? 'text-success' : value <= -0.4 ? 'text-destructive' : 'text-muted-foreground';
  const verdict =
    strength >= 0.7 ? 'Very strong' :
    strength >= 0.4 ? 'Moderate' :
    strength >= 0.2 ? 'Weak' : 'Almost none';
  return (
    <div className="rounded-lg border border-border/30 bg-secondary/20 p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-3xl font-mono font-bold mt-1 ${tone}`}>{value.toFixed(2)}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{verdict} {value >= 0 ? 'positive' : 'negative'} link</p>
      <p className="text-[11px] text-muted-foreground/80 mt-2 leading-relaxed">{hint}</p>
    </div>
  );
}
