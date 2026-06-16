import type { JournalEntry } from '@/store/tradingStore';
import { scoreGrade } from '@/lib/tradeScore';
import { X, TrendingUp, TrendingDown, Clock, DollarSign, Target, Activity, Layers, Wallet, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  entry: JournalEntry | null;
  onClose: () => void;
}

const fmt = (n?: number, digits = 5) =>
  n === undefined || n === null || isNaN(n) ? '—' : n.toFixed(digits);
const fmtMoney = (n?: number) => (n === undefined || n === null ? '—' : `$${n.toFixed(2)}`);
const fmtDuration = (ms?: number) => {
  if (!ms || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
};

export function TradeDetailDrawer({ entry, onClose }: Props) {
  if (!entry) return null;
  const snap = entry.entrySnapshot;
  const exit = entry.exitSnapshot;
  const profit = entry.profit ?? 0;
  const score = entry.score;
  const grade = score !== undefined ? scoreGrade(score) : null;
  const breakdown = entry.scoreBreakdown;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-card max-w-2xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border/30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono font-bold text-lg">{entry.symbol}</span>
            <span className={cn('text-xs font-bold px-2 py-0.5 rounded',
              entry.type === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
            )}>{entry.type}</span>
            <span className="text-xs font-mono text-muted-foreground">#{entry.ticket}</span>
            <span className={cn('text-[10px] uppercase font-mono px-2 py-0.5 rounded',
              entry.source === 'copier' ? 'bg-accent/15 text-accent' : 'bg-secondary/60 text-muted-foreground'
            )}>
              {entry.source === 'copier' ? 'COPIER' : 'MANUAL'}
            </span>
            {entry.status === 'closed' ? (
              <span className={cn('font-mono font-bold', profit >= 0 ? 'profit-positive' : 'profit-negative')}>
                {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
              </span>
            ) : (
              <span className="text-xs text-primary font-mono">● OPEN</span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Score card */}
          {score !== undefined && grade && breakdown && (
            <div className="glass-card p-4 grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4 items-center">
              <div className="text-center">
                <div className={cn('text-5xl font-mono font-extrabold', grade.tone)}>{grade.label}</div>
                <div className="text-xs text-muted-foreground font-mono mt-1">SCORE {score}/100</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                {[
                  { k: 'RR', v: breakdown.rr, icon: Target },
                  { k: 'Rules', v: breakdown.rule, icon: BookOpen },
                  { k: 'Timing', v: breakdown.timing, icon: Clock },
                  { k: 'Outcome', v: breakdown.outcome, icon: TrendingUp },
                ].map(({ k, v, icon: Icon }) => (
                  <div key={k} className="rounded-lg bg-secondary/30 p-2">
                    <Icon className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
                    <div className="font-mono font-bold text-sm">{v}<span className="text-muted-foreground/60">/25</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trade specs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Spec icon={Layers} label="Lots" value={fmt(snap?.lots, 2)} />
            <Spec icon={DollarSign} label="Entry" value={fmt(snap?.openPrice)} />
            <Spec icon={DollarSign} label="Exit" value={fmt(exit?.closePrice)} />
            <Spec icon={TrendingDown} label="Stop Loss" value={snap?.sl ? fmt(snap.sl) : '—'} tone={snap?.sl ? 'destructive' : 'muted'} />
            <Spec icon={TrendingUp} label="Take Profit" value={snap?.tp ? fmt(snap.tp) : '—'} tone={snap?.tp ? 'success' : 'muted'} />
            <Spec icon={Activity} label="Pips" value={exit?.pips !== undefined ? `${exit.pips >= 0 ? '+' : ''}${exit.pips.toFixed(1)}` : '—'} tone={exit && exit.pips >= 0 ? 'success' : 'destructive'} />
            <Spec icon={Clock} label="Open" value={entry.openTime ? new Date(entry.openTime).toLocaleString() : '—'} small />
            <Spec icon={Clock} label="Close" value={entry.closeTime ? new Date(entry.closeTime).toLocaleString() : '—'} small />
            <Spec icon={Clock} label="Duration" value={fmtDuration(exit?.durationMs)} />
            <Spec icon={Activity} label="Spread@Entry" value={snap?.spreadPips ? `${snap.spreadPips.toFixed(1)} pips` : '—'} />
            <Spec icon={Wallet} label="Balance@Entry" value={fmtMoney(snap?.accountBalance)} />
            <Spec icon={Wallet} label="Equity@Entry" value={fmtMoney(snap?.accountEquity)} />
          </div>

          {/* Journal context */}
          <div className="glass-card p-4 space-y-3">
            <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Journal Context</h4>
            <Row label="Strategy" value={entry.strategy || '—'} />
            <Row label="Setup" value={entry.setup || '—'} />
            <Row label="Confidence" value={entry.confidence ? `${entry.confidence} / 5` : '—'} />
            <Row label="Emotion" value={entry.emotion && entry.emotion !== '—' ? entry.emotion : '—'} />
            <Row label="Reason" value={entry.reason || '—'} multiline />
            {entry.notes && <Row label="Notes" value={entry.notes} multiline />}
            {entry.copierFromAccount && (
              <Row label="Copied From" value={entry.copierFromAccount} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Spec({
  icon: Icon, label, value, tone, small,
}: { icon: any; label: string; value: string; tone?: 'success' | 'destructive' | 'muted'; small?: boolean }) {
  return (
    <div className="rounded-lg border border-border/30 bg-secondary/20 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={cn(
        'font-mono font-semibold',
        small ? 'text-xs' : 'text-sm',
        tone === 'success' && 'text-success',
        tone === 'destructive' && 'text-destructive',
        tone === 'muted' && 'text-muted-foreground',
      )}>
        {value}
      </div>
    </div>
  );
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={cn('grid gap-2 text-sm', multiline ? 'grid-cols-1' : 'grid-cols-[120px_1fr]')}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-foreground/90', multiline && 'whitespace-pre-wrap leading-relaxed')}>
        {value}
      </div>
    </div>
  );
}
