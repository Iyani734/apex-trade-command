import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addDays, endOfMonth, format, getDay, isSameMonth, startOfMonth } from 'date-fns';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, Lock, TrendingUp } from 'lucide-react';
import { api, type PublicShareResponse, type ShareSection } from '@/services/api';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const n = (value: unknown) => Number(value) || 0;
const money = (value: number) => `${value >= 0 ? '+' : ''}$${value.toFixed(2)}`;
const compactMoney = (value: number) => {
  const sign = value >= 0 ? '+' : '-';
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `${sign}$${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(abs)}`;
  }
  return money(value);
};

const DEFAULT_SHARE_SECTIONS: ShareSection[] = [
  'overview',
  'analytics',
  'risk_metrics',
  'trade_breakdown',
  'calendar',
  'open_positions',
  'closed_trades',
];

function dayKey(raw: unknown): string | null {
  if (!raw) return null;
  const value = String(raw).trim();
  const iso = value.match(/^(\d{4})[-.](\d{2})[-.](\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : format(date, 'yyyy-MM-dd');
}

export default function SharePage() {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublicShareResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const chartMargin = isMobile ? { top: 8, right: 4, bottom: 0, left: -18 } : { top: 10, right: 16, bottom: 0, left: 8 };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.share.resolvePublic(token)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError('');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Share link not found');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
        Loading shared dashboard...
      </div>
    );
  }

  if (error || !data?.payload.snapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="glass-card p-8 max-w-md text-center">
          <Lock className="w-10 h-10 mx-auto text-destructive mb-3" />
          <h1 className="text-xl font-bold mb-2">Link expired or invalid</h1>
          <p className="text-sm text-muted-foreground">{error || 'This shared dashboard link is no longer accessible.'}</p>
        </div>
      </div>
    );
  }

  const snap = data.payload.snapshot;
  const account = snap.account || {};
  const analytics = snap.analytics || {};
  const positions = Array.isArray(snap.open_positions) ? snap.open_positions : [];
  const history = Array.isArray(snap.trade_history) ? snap.trade_history : [];
  const rawSections = (snap as any).share_options?.sections;
  const sharedSections = new Set<ShareSection>(
    Array.isArray(rawSections) && rawSections.length
      ? rawSections.filter((section: string) => DEFAULT_SHARE_SECTIONS.includes(section as ShareSection))
      : DEFAULT_SHARE_SECTIONS,
  );
  const canShow = (section: ShareSection) => sharedSections.has(section);
  const balance = n(account.balance);
  const equity = n(account.equity);
  const runningPnl: number = (positions as any[]).reduce<number>((sum, p) => sum + n(p?.profit ?? p?.net_profit), 0);
  const equityCurve = Array.isArray((analytics as any).equity_curve)
    ? (analytics as any).equity_curve.map((p: any, index: number) => ({
        date: p.timestamp_human || p.date || `#${index + 1}`,
        equity: n(p.balance ?? p.equity ?? p.cumulative_profit),
      }))
    : [];
  const sessionStats = Array.isArray((analytics as any).session_stats)
    ? (analytics as any).session_stats.map((s: any) => ({
        name: s.session || 'Session',
        profit: n(s.net_profit ?? s.profit),
      }))
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">ForexAnalyzer Pro Read-only</h1>
              <p className="text-xs text-muted-foreground">
                {data.payload.accountAlias} · {data.payload.online ? 'live account online' : 'latest saved account snapshot'}
              </p>
            </div>
          </div>
          <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-primary">
            Powered by ForexAnalyzer Pro
          </Link>
        </header>

        {canShow('overview') && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Balance" value={`$${balance.toLocaleString()}`} />
            <Stat label="Equity" value={`$${equity.toLocaleString()}`} sub={money(runningPnl)} />
            <Stat label="Open PnL" value={money(runningPnl)} tone={runningPnl >= 0 ? 'positive' : 'negative'} />
            <Stat label="Win Rate" value={`${n((analytics as any).win_rate).toFixed(1)}%`} />
            <Stat label="Profit Factor" value={n((analytics as any).profit_factor).toFixed(2)} />
          </div>
        )}

        {canShow('risk_metrics') && (
          <RiskMetrics account={account} analytics={analytics} positions={positions} />
        )}

        {canShow('analytics') && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="glass-card p-4 sm:p-5 xl:col-span-2">
              <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Analytics</h3>
              <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
                <AreaChart data={equityCurve} margin={chartMargin}>
                  <defs>
                    <linearGradient id="shareEq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis width={isMobile ? 46 : 70} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="equity" stroke="hsl(var(--primary))" fill="url(#shareEq)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-4 sm:p-5">
              <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Sessions</h3>
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                <BarChart data={sessionStats} margin={chartMargin}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis width={isMobile ? 46 : 70} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {canShow('trade_breakdown') && (
          <TradeBreakdown analytics={analytics} history={history} />
        )}

        {canShow('calendar') && <SharedCalendar history={history} />}
        {canShow('open_positions') && <OpenPositions positions={positions} />}
        {canShow('closed_trades') && <ClosedTrades history={history} />}

        <p className="text-center text-xs text-muted-foreground pt-2">
          Read-only view. {data.link.expiresAt ? `Expires ${new Date(data.link.expiresAt).toLocaleString()}` : 'No expiry.'}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className="glass-card min-w-0 p-3 sm:p-4">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('mt-1 truncate font-mono text-[clamp(1rem,5vw,1.5rem)] font-bold', tone === 'positive' && 'profit-positive', tone === 'negative' && 'profit-negative')}>
        {value}
      </p>
      {sub && <p className={cn('text-xs mt-0.5', sub.startsWith('+') ? 'profit-positive' : 'profit-negative')}>{sub}</p>}
    </div>
  );
}

function rawText(value: unknown, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function profitTone(value: number) {
  return value >= 0 ? 'profit-positive' : 'profit-negative';
}

function RiskMetrics({ account, analytics, positions }: { account: any; analytics: any; positions: any[] }) {
  const runningPnl = positions.reduce((sum, position) => sum + n(position?.profit ?? position?.net_profit), 0);
  const openLots = positions.reduce((sum, position) => sum + n(position?.lots ?? position?.volume), 0);
  const marginLevel = n(account.margin_level ?? account.marginLevel);
  const freeMargin = n(account.free_margin ?? account.margin_free ?? account.freeMargin);
  const firstDeposit = n(account.first_deposit ?? account.initial_deposit);
  const totalDeposits = n(account.total_deposits ?? account.deposits_total);
  const totalWithdrawals = n(account.total_withdrawals ?? account.withdrawals_total);
  const maxDrawdown = n(analytics.max_drawdown ?? analytics.maxDrawdown ?? analytics.drawdown);
  const dailyVolatility = n(analytics.daily_volatility ?? analytics.dailyVolatility ?? analytics.daily_vol);

  const metrics: Array<{ label: string; value: string; tone?: 'positive' | 'negative' }> = [
    { label: 'First deposit', value: firstDeposit ? `$${firstDeposit.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-' },
    { label: 'Total deposits', value: totalDeposits ? `$${totalDeposits.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-' },
    { label: 'Withdrawals', value: totalWithdrawals ? `$${totalWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-' },
    { label: 'Account type', value: rawText(account.account_type ?? account.accountType ?? account.type, 'Unknown') },
    { label: 'Currency', value: rawText(account.currency, 'USD') },
    { label: 'Leverage', value: rawText(account.leverage, '-') },
    { label: 'Free margin', value: `$${freeMargin.toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
    { label: 'Margin level', value: marginLevel ? `${marginLevel.toFixed(1)}%` : '-' },
    { label: 'Open lots', value: openLots.toFixed(2) },
    { label: 'Running PnL', value: money(runningPnl), tone: runningPnl >= 0 ? 'positive' : 'negative' },
    { label: 'Max drawdown', value: `${maxDrawdown.toFixed(1)}%`, tone: 'negative' },
    { label: 'Daily volatility', value: dailyVolatility ? `$${dailyVolatility.toFixed(2)}` : '-' },
  ];

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Risk and account details</h3>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {positions.length} open position{positions.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 rounded-xl border border-border/40 bg-secondary/15 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{metric.label}</p>
            <p className={cn('mt-1 truncate font-mono text-sm font-bold sm:text-base', metric.tone === 'positive' && 'profit-positive', metric.tone === 'negative' && 'profit-negative')}>
              {metric.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildSymbolRows(analytics: any, history: any[]) {
  const symbolStats = Array.isArray(analytics.symbol_stats) ? analytics.symbol_stats : [];
  if (symbolStats.length) {
    return symbolStats.slice(0, 8).map((row: any) => ({
      name: rawText(row.symbol, 'Symbol'),
      profit: n(row.net_profit ?? row.profit),
      trades: n(row.trades ?? row.count),
      winRate: n(row.win_rate ?? row.winRate),
    }));
  }

  const grouped = new Map<string, { profit: number; trades: number; wins: number }>();
  history.forEach((trade) => {
    const symbol = rawText(trade.symbol, 'Unknown');
    const profit = n(trade.net_profit ?? trade.profit);
    const current = grouped.get(symbol) || { profit: 0, trades: 0, wins: 0 };
    current.profit += profit;
    current.trades += 1;
    if (profit > 0) current.wins += 1;
    grouped.set(symbol, current);
  });

  return [...grouped.entries()]
    .map(([name, row]) => ({
      name,
      profit: row.profit,
      trades: row.trades,
      winRate: row.trades ? (row.wins / row.trades) * 100 : 0,
    }))
    .sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit))
    .slice(0, 8);
}

function buildSessionRows(analytics: any) {
  const rows = Array.isArray(analytics.session_stats) ? analytics.session_stats : [];
  return rows.slice(0, 6).map((row: any) => ({
    name: rawText(row.session ?? row.name, 'Session'),
    profit: n(row.net_profit ?? row.profit),
    trades: n(row.trades ?? row.count),
  }));
}

function TradeBreakdown({ analytics, history }: { analytics: any; history: any[] }) {
  const symbols = buildSymbolRows(analytics, history);
  const sessions = buildSessionRows(analytics);
  const avgWin = n(analytics.avg_win ?? analytics.average_win ?? analytics.avgWin);
  const avgLoss = n(analytics.avg_loss ?? analytics.average_loss ?? analytics.avgLoss);
  const totalClosed = history.length;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
      <div className="glass-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Trade analytics</h3>
          <span className="rounded-full bg-secondary/40 px-3 py-1 text-xs font-mono text-muted-foreground">
            {totalClosed} closed trade{totalClosed === 1 ? '' : 's'}
          </span>
        </div>
        <div className="space-y-2">
          {symbols.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No symbol breakdown in this shared snapshot.</div>
          )}
          {symbols.map((row) => (
            <div key={row.name} className="rounded-xl border border-border/40 bg-secondary/15 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-bold">{row.name}</p>
                  <p className="text-[11px] text-muted-foreground">{row.trades || 0} trade{row.trades === 1 ? '' : 's'} · {row.winRate.toFixed(1)}% win rate</p>
                </div>
                <p className={cn('shrink-0 font-mono text-sm font-bold', profitTone(row.profit))}>{money(row.profit)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Behavior snapshot</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-1">
          {[
            { label: 'Avg win', value: money(avgWin), tone: 'positive' as const },
            { label: 'Avg loss', value: money(avgLoss), tone: 'negative' as const },
          ].map((item) => (
            <div key={item.label} className="min-w-0 rounded-xl border border-border/40 bg-secondary/15 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className={cn('mt-1 truncate font-mono text-base font-bold', item.tone === 'positive' ? 'profit-positive' : 'profit-negative')}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {sessions.map((row) => (
            <div key={row.name} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/15 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-semibold">{row.name}</p>
                <p className="text-[11px] text-muted-foreground">{row.trades || 0} trade{row.trades === 1 ? '' : 's'}</p>
              </div>
              <p className={cn('font-mono font-bold', profitTone(row.profit))}>{money(row.profit)}</p>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="rounded-lg bg-secondary/15 px-3 py-5 text-center text-sm text-muted-foreground">No session breakdown available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function OpenPositions({ positions }: { positions: any[] }) {
  return (
    <div className="glass-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Open Positions ({positions.length})</h3>
      <div className="space-y-3 md:hidden">
        {positions.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No open positions</div>
        )}
        {positions.map((p) => {
          const profit = n(p.profit ?? p.net_profit);
          return (
            <div key={p.ticket} className="rounded-lg border border-border/40 bg-secondary/15 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold">{p.symbol}</span>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', p.type === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                      {p.type}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-muted-foreground">{n(p.lots).toFixed(2)} lots</div>
                </div>
                <div className={cn('shrink-0 text-right font-mono text-lg font-bold', profit >= 0 ? 'profit-positive' : 'profit-negative')}>
                  {money(profit)}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-background/40 p-2">
                  <div className="uppercase tracking-wider text-muted-foreground/70">Open</div>
                  <div className="truncate font-mono text-sm">{n(p.open_price).toFixed(5)}</div>
                </div>
                <div className="rounded-md bg-background/40 p-2">
                  <div className="uppercase tracking-wider text-muted-foreground/70">Current</div>
                  <div className="truncate font-mono text-sm">{n(p.current_price ?? p.open_price).toFixed(5)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="text-xs text-muted-foreground/60 uppercase tracking-wider">
          <tr>
            <th className="text-left py-2">Symbol</th>
            <th className="text-left py-2">Type</th>
            <th className="text-right py-2">Lots</th>
            <th className="text-right py-2">Open</th>
            <th className="text-right py-2">Current</th>
            <th className="text-right py-2">Profit</th>
          </tr>
        </thead>
        <tbody>
          {positions.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-muted-foreground">No open positions</td>
            </tr>
          )}
          {positions.map((p) => {
            const profit = n(p.profit ?? p.net_profit);
            return (
              <tr key={p.ticket} className="border-t border-border/30">
                <td className="py-2 font-mono font-semibold">{p.symbol}</td>
                <td className="py-2">
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded', p.type === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                    {p.type}
                  </span>
                </td>
                <td className="py-2 text-right font-mono">{n(p.lots).toFixed(2)}</td>
                <td className="py-2 text-right font-mono">{n(p.open_price).toFixed(5)}</td>
                <td className="py-2 text-right font-mono">{n(p.current_price ?? p.open_price).toFixed(5)}</td>
                <td className={cn('py-2 text-right font-mono font-semibold', profit >= 0 ? 'profit-positive' : 'profit-negative')}>
                  {money(profit)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function ClosedTrades({ history }: { history: any[] }) {
  const rows = history.slice(0, 20);

  return (
    <div className="glass-card p-4 sm:p-5">
      <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">
        Recent Closed Trades ({history.length})
      </h3>
      <div className="space-y-3 md:hidden">
        {rows.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No closed trades in this snapshot</div>
        )}
        {rows.map((trade, index) => {
          const profit = n(trade.net_profit ?? trade.profit);
          const type = String(trade.type || trade.order_type || '').toUpperCase();
          return (
            <div key={trade.ticket || index} className="rounded-lg border border-border/40 bg-secondary/15 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold">{trade.symbol || '-'}</span>
                    {type && (
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', type.includes('BUY') ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                        {type.replace('ORDER_TYPE_', '')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-muted-foreground">
                    {trade.exit_time_human || trade.close_time_human || trade.closeTime || trade.open_time_human || ''}
                  </div>
                </div>
                <div className={cn('shrink-0 text-right font-mono text-lg font-bold', profit >= 0 ? 'profit-positive' : 'profit-negative')}>
                  {money(profit)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-xs text-muted-foreground/60 uppercase tracking-wider">
            <tr>
              <th className="text-left py-2">Ticket</th>
              <th className="text-left py-2">Symbol</th>
              <th className="text-left py-2">Type</th>
              <th className="text-right py-2">Lots</th>
              <th className="text-right py-2">Open</th>
              <th className="text-right py-2">Close</th>
              <th className="text-right py-2">Profit</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">No closed trades in this snapshot</td>
              </tr>
            )}
            {rows.map((trade, index) => {
              const profit = n(trade.net_profit ?? trade.profit);
              const type = String(trade.type || trade.order_type || '').toUpperCase().replace('ORDER_TYPE_', '');
              return (
                <tr key={trade.ticket || index} className="border-t border-border/30">
                  <td className="py-2 font-mono text-xs">{trade.ticket || '-'}</td>
                  <td className="py-2 font-mono font-semibold">{trade.symbol || '-'}</td>
                  <td className="py-2">
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded', type.includes('BUY') ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                      {type || '-'}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono">{n(trade.lots ?? trade.volume).toFixed(2)}</td>
                  <td className="py-2 text-right font-mono">{n(trade.open_price ?? trade.entry_price).toFixed(5)}</td>
                  <td className="py-2 text-right font-mono">{n(trade.close_price ?? trade.exit_price).toFixed(5)}</td>
                  <td className={cn('py-2 text-right font-mono font-semibold', profit >= 0 ? 'profit-positive' : 'profit-negative')}>
                    {money(profit)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {history.length > rows.length && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Showing latest {rows.length} closed trades from this read-only snapshot.
        </p>
      )}
    </div>
  );
}

function SharedCalendar({ history }: { history: any[] }) {
  const calendar = useMemo(() => {
    const latestDay = history.reduce<Date | null>((latest, t) => {
      const key = dayKey(t.exit_time_human || t.close_time_human || t.closeTime || t.open_time_human || t.openTime);
      if (!key) return latest;
      const date = new Date(`${key}T00:00:00`);
      return !latest || date > latest ? date : latest;
    }, null);
    const cursor = startOfMonth(latestDay || new Date());
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const firstCell = addDays(monthStart, -(getDay(monthStart) || 7) + 1);
    const cells = Array.from({ length: 35 }, (_, i) => addDays(firstCell, i));
    const map = new Map<string, { profit: number; trades: number }>();

    history.forEach((t) => {
      const key = dayKey(t.exit_time_human || t.close_time_human || t.closeTime || t.open_time_human || t.openTime);
      if (!key) return;
      const current = map.get(key) || { profit: 0, trades: 0 };
      current.profit += n(t.net_profit ?? t.profit);
      current.trades += 1;
      map.set(key, current);
    });

    return { cursor, cells, map };
  }, [history]);

  return (
    <div className="glass-card p-3 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> Calendar
        </h3>
        <span className="text-xs font-mono text-muted-foreground">{format(calendar.cursor, 'MMMM yyyy')}</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[9px] text-muted-foreground uppercase mb-2 sm:text-[10px]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendar.cells.map((date) => {
          const key = format(date, 'yyyy-MM-dd');
          const item = calendar.map.get(key);
          const profit = item?.profit || 0;
          return (
            <div
              key={key}
              className={cn(
                'min-h-14 min-w-0 rounded-md border p-1 text-[11px] sm:min-h-16 sm:p-1.5 sm:text-xs',
                !isSameMonth(date, calendar.cursor) && 'opacity-30',
                item ? profit >= 0 ? 'border-success/40 bg-success/15' : 'border-destructive/40 bg-destructive/15' : 'border-border/30 bg-secondary/20',
              )}
            >
              <div className="font-semibold">{format(date, 'd')}</div>
              {item ? (
                <div className={cn('mt-1 truncate font-mono text-[10px] font-bold sm:text-xs', profit >= 0 ? 'profit-positive' : 'profit-negative')} title={money(profit)}>
                  {compactMoney(profit)}
                  <div className="text-[10px] text-muted-foreground font-normal">{item.trades}t</div>
                </div>
              ) : (
                <div className="mt-3 text-muted-foreground/50">-</div>
              )}
            </div>
          );
        })}
      </div>
      {history.length === 0 && (
        <p className="text-sm text-muted-foreground text-center mt-5">No closed trades in this shared snapshot yet.</p>
      )}
    </div>
  );
}
