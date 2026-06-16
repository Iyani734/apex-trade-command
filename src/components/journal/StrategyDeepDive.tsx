import { useMemo } from 'react';
import type { JournalEntry } from '@/store/tradingStore';
import { scoreGrade } from '@/lib/tradeScore';
import { cn } from '@/lib/utils';
import {
  X, TrendingUp, TrendingDown, Target, Award, Clock, Layers,
  BookOpen, Activity, DollarSign,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  LineChart, Line,
} from 'recharts';

interface Props {
  entries: JournalEntry[];          // already scoped to active account
  strategy: string | null;
  setup: string | null;             // '—' for "no setup"
  onClose: () => void;
  onSelectTrade: (entry: JournalEntry) => void;
}

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

export function StrategyDeepDive({ entries, strategy, setup, onClose, onSelectTrade }: Props) {
  const open = !!strategy;

  const trades = useMemo(() => {
    if (!strategy) return [];
    return entries
      .filter((e) => e.status === 'closed' && e.strategy === strategy && (e.setup || '—') === setup)
      .sort((a, b) => Date.parse(b.closeTime || b.openTime) - Date.parse(a.closeTime || a.openTime));
  }, [entries, strategy, setup]);

  const stats = useMemo(() => {
    const total = trades.length;
    const wins = trades.filter((t) => (t.profit ?? 0) > 0).length;
    const losses = trades.filter((t) => (t.profit ?? 0) < 0).length;
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
    return {
      total, wins, losses, profit, pf, winRate, avgWin, avgLoss, expectancy,
      best: best === -Infinity ? 0 : best,
      worst: worst === Infinity ? 0 : worst,
      avgScore,
    };
  }, [trades]);

  // Per-session breakdown
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

  // Per-symbol breakdown
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

  // Per day-of-week
  const dowBreakdown = useMemo(() => {
    const arr = DOW.map((d) => ({ day: d, profit: 0, trades: 0 }));
    trades.forEach((t) => {
      const d = new Date(t.openTime).getUTCDay();
      arr[d].profit += t.profit ?? 0;
      arr[d].trades += 1;
    });
    return arr;
  }, [trades]);

  // Cumulative equity (for this strategy only)
  const equityCurve = useMemo(() => {
    const sorted = [...trades].sort((a, b) =>
      Date.parse(a.closeTime || a.openTime) - Date.parse(b.closeTime || b.openTime),
    );
    let cum = 0;
    return sorted.map((t, i) => {
      cum += t.profit ?? 0;
      return {
        i: i + 1,
        date: (t.closeTime || t.openTime).slice(0, 10),
        cum: Number(cum.toFixed(2)),
      };
    });
  }, [trades]);

  if (!open) return null;
  const grade = stats.avgScore ? scoreGrade(stats.avgScore) : null;
  const bestSession = sessionBreakdown[0];
  const bestSymbol = symbolBreakdown[0];

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-5xl max-h-[92vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border/30 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <BookOpen className="w-5 h-5 text-accent shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold truncate">{strategy}</h2>
            {setup && setup !== '—' && (
              <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded font-mono">{setup}</span>
            )}
            <span className="text-xs text-muted-foreground font-mono">{stats.total} trades</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary text-muted-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Headline KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI icon={DollarSign} label="Net P/L" value={`${stats.profit >= 0 ? '+' : ''}$${stats.profit.toFixed(2)}`}
              tone={stats.profit >= 0 ? 'success' : 'destructive'} />
            <KPI icon={Target} label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
            <KPI icon={Activity} label="Profit Factor"
              value={stats.pf === Infinity ? '∞' : stats.pf.toFixed(2)} />
            <KPI icon={Award} label="Avg Score" value={grade ? `${grade.label} · ${stats.avgScore.toFixed(0)}` : '—'} />
            <KPI icon={TrendingUp} label="Avg Win" value={`$${stats.avgWin.toFixed(2)}`} tone="success" />
            <KPI icon={TrendingDown} label="Avg Loss" value={`$${stats.avgLoss.toFixed(2)}`} tone="destructive" />
            <KPI icon={Layers} label="Expectancy" value={`$${stats.expectancy.toFixed(2)}/trade`} />
            <KPI icon={Clock} label="Best Session" value={bestSession ? `${bestSession.session}` : '—'} />
          </div>

          {/* Equity curve */}
          {equityCurve.length > 1 && (
            <Section title="Cumulative P/L for this strategy">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="i" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="cum" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* Session + Symbol grids */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Performance by session">
              {sessionBreakdown.length === 0 ? (
                <Empty />
              ) : (
                <div className="space-y-2">
                  {sessionBreakdown.map((s) => (
                    <BreakdownRow
                      key={s.session}
                      label={s.session}
                      sub={`${s.trades} trades · ${s.winRate.toFixed(0)}% win`}
                      profit={s.profit}
                    />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Performance by symbol">
              {symbolBreakdown.length === 0 ? (
                <Empty />
              ) : (
                <div className="space-y-2">
                  {symbolBreakdown.map((s) => (
                    <BreakdownRow
                      key={s.symbol}
                      label={s.symbol}
                      sub={`${s.trades} trades · ${s.winRate.toFixed(0)}% win`}
                      profit={s.profit}
                    />
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Day-of-week chart */}
          <Section title="P/L by day of week">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dowBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                  {dowBreakdown.map((d, i) => (
                    <rect key={i} fill={d.profit >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>

          {/* Trade list */}
          <Section title={`All trades (${trades.length})`}>
            <div className="space-y-1.5 max-h-80 overflow-auto">
              {trades.map((t) => {
                const g = t.score !== undefined ? scoreGrade(t.score) : null;
                return (
                  <button
                    key={t.id}
                    onClick={() => onSelectTrade(t)}
                    className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_1fr_auto] items-center gap-3 text-xs px-3 py-2 rounded-lg hover:bg-secondary/40 border border-border/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-semibold">{t.symbol}</span>
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded',
                        t.type === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                      )}>{t.type}</span>
                      <span className="text-muted-foreground font-mono truncate">#{t.ticket}</span>
                    </div>
                    <div className="hidden sm:block text-muted-foreground font-mono">
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
        </div>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: 'success' | 'destructive' }) {
  return (
    <div className="rounded-lg border border-border/30 bg-secondary/20 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={cn('font-mono font-bold text-sm sm:text-base',
        tone === 'success' && 'profit-positive',
        tone === 'destructive' && 'profit-negative',
      )}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-4">
      <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">{title}</h4>
      {children}
    </div>
  );
}

function BreakdownRow({ label, sub, profit }: { label: string; sub: string; profit: number }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-secondary/20 border border-border/20">
      <div className="min-w-0">
        <div className="font-semibold text-sm truncate">{label}</div>
        <div className="text-[11px] text-muted-foreground truncate">{sub}</div>
      </div>
      <div className={cn('font-mono font-bold text-sm', profit >= 0 ? 'profit-positive' : 'profit-negative')}>
        {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
      </div>
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-muted-foreground text-center py-4">No data yet.</p>;
}
