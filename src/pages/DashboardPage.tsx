import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useTradingStore } from '@/store/tradingStore';
import { KPICard } from '@/components/KPICard';
import {
  DollarSign, TrendingUp, TrendingDown, Target, Activity, BarChart3, Percent, Wallet,
  X, Shield, Pause, Play, Plus,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ChartTooltip } from '@/components/analytics/ChartTooltip';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ConfirmDialog';
import { promptDialog } from '@/components/PromptDialog';
import { useIsMobile } from '@/hooks/use-mobile';

export default function DashboardPage() {
  const account = useTradingStore((s) => s.accounts.find((a) => a.id === s.activeAccountId));
  const analytics = useTradingStore((s) => s.analytics);
  const positions = useTradingStore((s) => s.positions);
  const activeId = useTradingStore((s) => s.activeAccountId);
  const eaStatus = useTradingStore((s) => s.eaStatus);
  const addCommand = useTradingStore((s) => s.addCommand);
  const [busy, setBusy] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const totalProfit = useMemo(() => positions.reduce((s, p) => s + p.profit, 0), [positions]);
  const chartMargin = isMobile ? { top: 8, right: 4, bottom: 0, left: -18 } : { top: 10, right: 16, bottom: 0, left: 8 };
  const chartHeight = isMobile ? 240 : 280;

  // Dynamic equity curve — derive a y-domain that always has headroom
  const equityData = analytics?.equityCurve || [];
  const equityDomain = useMemo<[number, number]>(() => {
    if (!equityData.length) return [0, 1];
    const vals = equityData.map((d) => d.equity);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max((max - min) * 0.08, 50);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [equityData]);

  const send = async (label: string, fn: () => Promise<unknown>, key: string) => {
    if (!activeId) return toast.error('No active account');
    setBusy(key);
    const id = `${Date.now()}`;
    addCommand({ id, type: label, payload: {}, status: 'pending', sentAt: new Date().toISOString() });
    try { await fn(); toast.success(`${label} sent`); }
    catch (e: any) { toast.error(`${label} failed: ${e.message}`); }
    finally { setBusy(null); }
  };

  const handleClose = (ticket: number) =>
    send('Close', () => api.commands.close(activeId!, ticket), `close-${ticket}`);
  const handleBreakeven = (ticket: number) =>
    send('Breakeven', () => api.commands.breakeven(activeId!, ticket), `be-${ticket}`);
  const handleModify = async (ticket: number, currentSl: number, currentTp: number) => {
    const sl = await promptDialog({ title: 'New Stop Loss', placeholder: '0 to remove', defaultValue: String(currentSl || 0), type: 'number' });
    if (sl === null) return;
    const tp = await promptDialog({ title: 'New Take Profit', placeholder: '0 to remove', defaultValue: String(currentTp || 0), type: 'number' });
    if (tp === null) return;
    send('Modify SL/TP', () => api.commands.modify(activeId!, ticket, { sl: Number(sl), tp: Number(tp) }), `mod-${ticket}`);
  };
  const handlePartial = async (ticket: number, lots: number) => {
    const v = await promptDialog({ title: 'Partial Close', description: `Max ${lots.toFixed(2)} lots`, defaultValue: (lots / 2).toFixed(2), type: 'number' });
    if (!v) return;
    send('Partial Close', () => api.commands.partialClose(activeId!, ticket, { lots: Number(v) }), `pc-${ticket}`);
  };
  const handleCloseAll = async () => {
    const ok = await confirmDialog({
      title: 'Close all open positions?',
      description: `This will close ${positions.length} position(s) on ${account?.alias}. Cannot be undone.`,
      confirmLabel: 'Close All',
      destructive: true,
    });
    if (!ok) return;
    send('Close All', () => api.commands.closeAll(activeId!), 'close-all');
  };
  const handlePauseToggle = () => {
    if (eaStatus?.tradingPaused) send('Resume Trading', () => api.commands.resume(activeId!), 'pause');
    else send('Pause Trading', () => api.commands.pause(activeId!), 'pause');
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time overview of your trading performance</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/30">
          <div className={`w-2 h-2 rounded-full ${eaStatus?.connected ? 'bg-success animate-pulse-glow' : 'bg-destructive'}`} />
          <span className="text-xs font-mono text-muted-foreground">EA {eaStatus?.connected ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
      </motion.div>

      {/* KPI Grid — Floating PnL replaces the old big banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Balance" value={`$${account?.balance.toLocaleString() || '0'}`} icon={DollarSign} delay={0} />
        <KPICard title="Equity" value={`$${account?.equity.toLocaleString() || '0'}`} icon={Wallet} delay={0.05} />
        <KPICard
          title="Floating P&L"
          value={`${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}`}
          subtitle={`${positions.length} open`}
          icon={Activity}
          trend={totalProfit >= 0 ? 'up' : 'down'}
          delay={0.1}
        />
        <KPICard
          title="Daily P&L"
          value={`${(analytics?.dailyPnl ?? 0) >= 0 ? '+' : ''}$${analytics?.dailyPnl.toFixed(2) || '0'}`}
          subtitle={`${(analytics?.dailyPnlPercent ?? 0) >= 0 ? '+' : ''}${analytics?.dailyPnlPercent.toFixed(2) || '0'}%`}
          icon={BarChart3}
          trend={(analytics?.dailyPnl ?? 0) >= 0 ? 'up' : 'down'}
          delay={0.15}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Win Rate" value={`${analytics?.winRate || 0}%`} icon={Target} delay={0.2} />
        <KPICard title="Profit Factor" value={`${analytics?.profitFactor || 0}`} icon={Activity} delay={0.25} />
        <KPICard title="Avg R:R" value={`${analytics?.avgRR || 0}`} icon={Percent} delay={0.3} />
        <KPICard title="Max Drawdown" value={`${analytics?.maxDrawdown.toFixed(1) || '0'}%`} icon={TrendingDown} trend="down" delay={0.35} />
      </div>

      {/* Charts — fast load (no animation, static gradients) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="glass-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Equity Curve</h3>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={equityData} margin={chartMargin}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v) => (v && v.length > 10 ? v.slice(5, 16).replace('T', ' ') : v)}
                minTickGap={isMobile ? 20 : 40}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                domain={equityDomain}
                tickFormatter={(v) => {
                  const span = equityDomain[1] - equityDomain[0];
                  // when the range is tight (< $1k), show full dollars so labels don't all read "$100.0k"
                  if (span < 1000) return `$${v.toFixed(0)}`;
                  if (span < 10000) return `$${(v / 1000).toFixed(2)}k`;
                  return `$${(v / 1000).toFixed(1)}k`;
                }}
                width={isMobile ? 46 : 70}
                allowDecimals={false}
              />
              <Tooltip cursor={false} content={<ChartTooltip valueFormatter={(v) => `$${v.toFixed(2)}`} />} />
              <Area type="monotone" dataKey="equity" stroke="hsl(var(--primary))" fill="url(#eqGrad)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="glass-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Drawdown</h3>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={analytics?.drawdownCurve || []} margin={chartMargin}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => v.slice(5)} minTickGap={isMobile ? 20 : 40} />
              <YAxis width={isMobile ? 38 : 60} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${v.toFixed(1)}%`} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v.toFixed(2)}%`} />} />
              <Area type="monotone" dataKey="drawdown" stroke="hsl(var(--destructive))" fill="url(#ddGrad)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Open Positions WITH inline command actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Open Positions <span className="text-foreground/60 font-mono ml-2">({positions.length})</span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePauseToggle}
              disabled={busy === 'pause'}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 text-xs font-medium transition-colors disabled:opacity-50"
            >
              {eaStatus?.tradingPaused ? <Play className="w-3.5 h-3.5 text-success" /> : <Pause className="w-3.5 h-3.5 text-warning" />}
              {eaStatus?.tradingPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={handleCloseAll}
              disabled={busy === 'close-all' || positions.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" /> Close All
            </button>
          </div>
        </div>
        <div className="space-y-3 md:hidden">
          {positions.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No open positions</div>
          )}
          {positions.map((p) => (
            <div key={p.ticket} className="rounded-lg border border-border/40 bg-secondary/15 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold">{p.symbol}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${p.type === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {p.type}
                    </span>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${p.isCopy ? 'bg-accent/20 text-accent' : 'bg-secondary/50 text-muted-foreground'}`}>
                      {p.isCopy ? 'COPY' : 'MANUAL'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-muted-foreground">#{p.ticket} - {p.lots.toFixed(2)} lots</div>
                </div>
                <div className={`shrink-0 text-right font-mono text-lg font-bold ${p.profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                  {p.profit >= 0 ? '+' : ''}${p.profit.toFixed(2)}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-background/40 p-2">
                  <div className="uppercase tracking-wider text-muted-foreground/70">Current</div>
                  <div className="truncate font-mono text-sm text-foreground">{p.currentPrice}</div>
                </div>
                <div className="rounded-md bg-background/40 p-2">
                  <div className="uppercase tracking-wider text-muted-foreground/70">SL/TP</div>
                  <div className="truncate font-mono text-sm text-foreground">{p.sl || '-'} / {p.tp || '-'}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <button onClick={() => handleClose(p.ticket)} disabled={busy === `close-${p.ticket}`} className="rounded-lg bg-destructive/10 px-2 py-2 text-xs font-semibold text-destructive disabled:opacity-50">
                  Close
                </button>
                <button onClick={() => handleBreakeven(p.ticket)} disabled={busy === `be-${p.ticket}`} className="rounded-lg bg-primary/10 px-2 py-2 text-xs font-semibold text-primary disabled:opacity-50">
                  BE
                </button>
                <button onClick={() => handleModify(p.ticket, p.sl, p.tp)} disabled={busy === `mod-${p.ticket}`} className="rounded-lg bg-secondary px-2 py-2 text-xs font-semibold disabled:opacity-50">
                  SL/TP
                </button>
                <button onClick={() => handlePartial(p.ticket, p.lots)} disabled={busy === `pc-${p.ticket}`} className="rounded-lg bg-secondary px-2 py-2 text-xs font-semibold disabled:opacity-50">
                  1/2
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground/60 uppercase tracking-wider">
                <th className="text-left py-2 px-3">Symbol</th>
                <th className="text-left py-2 px-3">Type</th>
                <th className="text-right py-2 px-3">Lots</th>
                <th className="text-right py-2 px-3">Open</th>
                <th className="text-right py-2 px-3">Current</th>
                <th className="text-right py-2 px-3">SL/TP</th>
                <th className="text-right py-2 px-3">Profit</th>
                <th className="text-center py-2 px-3">Source</th>
                <th className="text-center py-2 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-muted-foreground text-sm">No open positions</td></tr>
              )}
              {positions.map((p) => (
                <tr key={p.ticket} className="border-t border-border/30 hover:bg-secondary/20 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-semibold">{p.symbol}</td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.type === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {p.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{p.lots.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{p.openPrice}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{p.currentPrice}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-[11px] text-muted-foreground">
                    {p.sl || '—'} / {p.tp || '—'}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-mono font-semibold ${p.profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                    {p.profit >= 0 ? '+' : ''}${p.profit.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${p.isCopy ? 'bg-accent/20 text-accent' : 'bg-secondary/50 text-muted-foreground'}`}>
                      {p.isCopy ? 'COPY' : 'MANUAL'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleClose(p.ticket)} disabled={busy === `close-${p.ticket}`} title="Close" className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50">
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleBreakeven(p.ticket)} disabled={busy === `be-${p.ticket}`} title="Breakeven" className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50">
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleModify(p.ticket, p.sl, p.tp)} disabled={busy === `mod-${p.ticket}`} title="Modify SL/TP" className="p-1.5 rounded hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50 text-[10px] font-mono">
                        SL/TP
                      </button>
                      <button onClick={() => handlePartial(p.ticket, p.lots)} disabled={busy === `pc-${p.ticket}`} title="Partial close" className="p-1.5 rounded hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50 text-[10px] font-mono">
                        ½
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
