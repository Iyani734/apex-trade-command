import { motion } from 'framer-motion';
import { useTradingStore } from '@/store/tradingStore';
import { X, Shield, TrendingUp, Pause, Play, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { useState } from 'react';
import { confirmDialog } from '@/components/ConfirmDialog';
import { promptDialog } from '@/components/PromptDialog';

export default function TradesPage() {
  const positions = useTradingStore((s) => s.positions);
  const activeId = useTradingStore((s) => s.activeAccountId);
  const accounts = useTradingStore((s) => s.accounts);
  const eaStatus = useTradingStore((s) => s.eaStatus);
  const addCommand = useTradingStore((s) => s.addCommand);
  const [busy, setBusy] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const activeAccount = accounts.find((a) => a.id === activeId);
  const runningPnl = positions.reduce((sum, p) => sum + p.profit, 0);
  const totalLots = positions.reduce((sum, p) => sum + p.lots, 0);
  const marginLevel = activeAccount?.margin
    ? ((activeAccount.equity / activeAccount.margin) * 100)
    : 0;

  const send = async (label: string, action: () => Promise<unknown>, key: string) => {
    if (!activeId) {
      toast.error('No active account');
      return;
    }
    setBusy(key);
    const id = `${Date.now()}`;
    addCommand({ id, type: label, payload: {}, status: 'pending', sentAt: new Date().toISOString() });
    try {
      await action();
      toast.success(`${label} sent`);
    } catch (e: any) {
      toast.error(`${label} failed: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleClose = (ticket: number) =>
    send('Close', () => api.commands.close(activeId!, ticket), `close-${ticket}`);
  const handleBreakeven = (ticket: number) =>
    send('Breakeven', () => api.commands.breakeven(activeId!, ticket), `be-${ticket}`);
  const handleTrail = async (ticket: number) => {
    const v = await promptDialog({ title: 'Trailing stop distance', placeholder: 'pips', defaultValue: '20', type: 'number' });
    const pips = Number(v);
    if (!pips) return;
    send('Trailing Stop', () => api.commands.trail(activeId!, ticket, pips), `trail-${ticket}`);
  };
  const handleModify = async (ticket: number, currentSl: number, currentTp: number) => {
    const sl = await promptDialog({ title: 'New Stop Loss', placeholder: '0 to remove', defaultValue: String(currentSl || 0), type: 'number' });
    if (sl === null) return;
    const tp = await promptDialog({ title: 'New Take Profit', placeholder: '0 to remove', defaultValue: String(currentTp || 0), type: 'number' });
    if (tp === null) return;
    send('Modify SL/TP', () => api.commands.modify(activeId!, ticket, { sl: Number(sl), tp: Number(tp) }), `mod-${ticket}`);
  };
  const handlePartial = async (ticket: number, lots: number) => {
    const v = await promptDialog({ title: 'Partial Close', description: `Max ${lots.toFixed(2)} lots`, defaultValue: (lots / 2).toFixed(2), type: 'number' });
    const partial = Number(v);
    if (!partial) return;
    send('Partial Close', () => api.commands.partialClose(activeId!, ticket, { lots: partial }), `pc-${ticket}`);
  };
  const handleCloseAll = async () => {
    const ok = await confirmDialog({
      title: 'Close all open positions?',
      description: `This will close ${positions.length} position(s). Cannot be undone.`,
      confirmLabel: 'Close All',
      destructive: true,
    });
    if (!ok) return;
    send('Close All', () => api.commands.closeAll(activeId!), 'close-all');
  };
  const handlePauseToggle = () => {
    if (eaStatus?.tradingPaused) {
      send('Resume Trading', () => api.commands.resume(activeId!), 'pause');
    } else {
      send('Pause Trading', () => api.commands.pause(activeId!), 'pause');
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Open Trades</h1>
          <p className="text-sm text-muted-foreground">Live positions on {activeId || '—'}</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-wrap">
          <button
            onClick={() => setOpenForm((o) => !o)}
            className="flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors sm:flex-none"
          >
            <Plus className="w-4 h-4" /> New Trade
          </button>
          <button
            onClick={handlePauseToggle}
            disabled={busy === 'pause'}
            className="flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/70 text-sm font-medium transition-colors disabled:opacity-50 sm:flex-none"
          >
            {eaStatus?.tradingPaused ? <Play className="w-4 h-4 text-success" /> : <Pause className="w-4 h-4 text-warning" />}
            {eaStatus?.tradingPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={handleCloseAll}
            disabled={busy === 'close-all' || positions.length === 0}
            className="flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50 sm:flex-none"
          >
            <X className="w-4 h-4" /> Close All
          </button>
        </div>
      </motion.div>

      {openForm && <NewTradeForm accountId={activeId} onDone={() => setOpenForm(false)} />}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <AccountStat label="Balance" value={`$${(activeAccount?.balance || 0).toLocaleString()}`} />
        <AccountStat label="Equity" value={`$${(activeAccount?.equity || 0).toLocaleString()}`} />
        <AccountStat label="Free Margin" value={`$${(activeAccount?.freeMargin || 0).toLocaleString()}`} />
        <AccountStat label="Margin Level" value={marginLevel ? `${marginLevel.toFixed(1)}%` : '—'} />
        <AccountStat label="Open Lots" value={totalLots.toFixed(2)} />
        <AccountStat label="Running PnL" value={`${runningPnl >= 0 ? '+' : ''}$${runningPnl.toFixed(2)}`} tone={runningPnl >= 0 ? 'positive' : 'negative'} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
        <div className="space-y-3 p-3 md:hidden">
          {positions.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">No open positions</div>
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
                  <div className="uppercase tracking-wider text-muted-foreground/70">Open</div>
                  <div className="truncate font-mono text-sm text-foreground">{p.openPrice}</div>
                </div>
                <div className="rounded-md bg-background/40 p-2">
                  <div className="uppercase tracking-wider text-muted-foreground/70">Current</div>
                  <div className="truncate font-mono text-sm text-foreground">{p.currentPrice}</div>
                </div>
                <div className="rounded-md bg-background/40 p-2">
                  <div className="uppercase tracking-wider text-muted-foreground/70">SL</div>
                  <div className="truncate font-mono text-sm text-foreground">{p.sl || '-'}</div>
                </div>
                <div className="rounded-md bg-background/40 p-2">
                  <div className="uppercase tracking-wider text-muted-foreground/70">TP</div>
                  <div className="truncate font-mono text-sm text-foreground">{p.tp || '-'}</div>
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
          {positions.length > 0 && (
            <div className="rounded-lg bg-secondary/20 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Total running PnL</span>
                <span className={`font-mono font-bold ${runningPnl >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                  {runningPnl >= 0 ? '+' : ''}${runningPnl.toFixed(2)}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{positions.length} open - {totalLots.toFixed(2)} lots</div>
            </div>
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground/60 uppercase tracking-wider bg-secondary/20">
                <th className="text-left py-3 px-4">Ticket</th>
                <th className="text-left py-3 px-4">Symbol</th>
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-right py-3 px-4">Lots</th>
                <th className="text-right py-3 px-4">Open</th>
                <th className="text-right py-3 px-4">Current</th>
                <th className="text-right py-3 px-4">SL</th>
                <th className="text-right py-3 px-4">TP</th>
                <th className="text-right py-3 px-4">Profit</th>
                <th className="text-center py-3 px-4">Source</th>
                <th className="text-center py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-muted-foreground text-sm">
                    No open positions
                  </td>
                </tr>
              )}
              {positions.map((p) => (
                <tr key={p.ticket} className="border-t border-border/30 hover:bg-secondary/10 transition-colors">
                  <td className="py-3 px-4 font-mono text-muted-foreground">#{p.ticket}</td>
                  <td className="py-3 px-4 font-mono font-semibold">{p.symbol}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${p.type === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {p.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono">{p.lots.toFixed(2)}</td>
                  <td className="py-3 px-4 text-right font-mono">{p.openPrice}</td>
                  <td className="py-3 px-4 text-right font-mono">{p.currentPrice}</td>
                  <td className="py-3 px-4 text-right font-mono text-muted-foreground">{p.sl || '—'}</td>
                  <td className="py-3 px-4 text-right font-mono text-muted-foreground">{p.tp || '—'}</td>
                  <td className={`py-3 px-4 text-right font-mono font-semibold ${p.profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                    {p.profit >= 0 ? '+' : ''}${p.profit.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${p.isCopy ? 'bg-accent/20 text-accent' : 'bg-secondary/50 text-muted-foreground'}`}>
                      {p.isCopy ? 'COPY' : 'MANUAL'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleClose(p.ticket)} disabled={busy === `close-${p.ticket}`} title="Close" className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50">
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleBreakeven(p.ticket)} disabled={busy === `be-${p.ticket}`} title="Breakeven" className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50">
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleTrail(p.ticket)} disabled={busy === `trail-${p.ticket}`} title="Trailing stop" className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50">
                        <TrendingUp className="w-3.5 h-3.5" />
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
            <tfoot>
              <tr className="border-t border-border/50 bg-secondary/20">
                <td colSpan={8} className="py-3 px-4 text-right text-xs uppercase tracking-wider text-muted-foreground">
                  Total running PnL
                </td>
                <td className={`py-3 px-4 text-right font-mono font-bold ${runningPnl >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                  {runningPnl >= 0 ? '+' : ''}${runningPnl.toFixed(2)}
                </td>
                <td colSpan={2} className="py-3 px-4 text-xs text-muted-foreground">
                  {positions.length} open · {totalLots.toFixed(2)} lots
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function AccountStat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className="glass-card min-w-0 p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`mt-1 truncate font-mono text-[clamp(1rem,5vw,1.125rem)] font-bold ${tone === 'positive' ? 'profit-positive' : tone === 'negative' ? 'profit-negative' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function NewTradeForm({ accountId, onDone }: { accountId: string | null; onDone: () => void }) {
  const [symbol, setSymbol] = useState('EURUSD');
  const [orderType, setOrderType] = useState('BUY');
  const [lots, setLots] = useState(0.1);
  const [sl, setSl] = useState(0);
  const [tp, setTp] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!accountId) return;
    setSubmitting(true);
    try {
      await api.commands.open(accountId, { symbol, order_type: orderType, lots, sl, tp });
      toast.success(`${orderType} ${lots} ${symbol} sent`);
      onDone();
    } catch (e: any) {
      toast.error(`Open failed: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-card p-5">
      <h3 className="text-sm font-semibold mb-3">Open New Trade</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Symbol</label>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm font-mono border border-border/50 focus:outline-none focus:border-primary/50" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Type</label>
          <select value={orderType} onChange={(e) => setOrderType(e.target.value)} className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm font-mono border border-border/50 focus:outline-none focus:border-primary/50">
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
            <option value="BUY_LIMIT">BUY_LIMIT</option>
            <option value="SELL_LIMIT">SELL_LIMIT</option>
            <option value="BUY_STOP">BUY_STOP</option>
            <option value="SELL_STOP">SELL_STOP</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Lots</label>
          <input type="number" step="0.01" value={lots} onChange={(e) => setLots(Number(e.target.value))} className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm font-mono border border-border/50 focus:outline-none focus:border-primary/50" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">SL</label>
          <input type="number" step="0.00001" value={sl} onChange={(e) => setSl(Number(e.target.value))} className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm font-mono border border-border/50 focus:outline-none focus:border-primary/50" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">TP</label>
          <input type="number" step="0.00001" value={tp} onChange={(e) => setTp(Number(e.target.value))} className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm font-mono border border-border/50 focus:outline-none focus:border-primary/50" />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <button onClick={onDone} className="px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          Cancel
        </button>
        <button onClick={submit} disabled={submitting || !accountId} className="px-4 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
          {submitting ? 'Sending...' : 'Send Order'}
        </button>
      </div>
    </motion.div>
  );
}
