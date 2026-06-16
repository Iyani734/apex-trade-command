import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addDays, endOfMonth, format, getDay, isSameMonth, startOfMonth } from 'date-fns';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, Lock, TrendingUp } from 'lucide-react';
import { api, type PublicShareResponse } from '@/services/api';
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
  const balance = n(account.balance);
  const equity = n(account.equity);
  const runningPnl = positions.reduce((sum, p: any) => sum + n(p.profit ?? p.net_profit), 0);
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

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Balance" value={`$${balance.toLocaleString()}`} />
          <Stat label="Equity" value={`$${equity.toLocaleString()}`} sub={money(runningPnl)} />
          <Stat label="Open PnL" value={money(runningPnl)} tone={runningPnl >= 0 ? 'positive' : 'negative'} />
          <Stat label="Win Rate" value={`${n((analytics as any).win_rate).toFixed(1)}%`} />
          <Stat label="Profit Factor" value={n((analytics as any).profit_factor).toFixed(2)} />
        </div>

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

        <SharedCalendar history={history} />
        <OpenPositions positions={positions} />

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
