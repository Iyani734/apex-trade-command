import { useMemo, useState } from 'react';
import type { TradeHistory } from '@/store/tradingStore';
import { tradeDurationMs, tradeDurationLabel } from '@/lib/analytics';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortKey = 'closeTime' | 'symbol' | 'type' | 'lots' | 'pips' | 'profit' | 'duration';
type SortDir = 'asc' | 'desc';

interface Props {
  history: TradeHistory[];
}

const PAGE_SIZE = 50;

export function ClosedTradesTable({ history }: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [minLots, setMinLots] = useState('');
  const [minPips, setMinPips] = useState('');
  const [minProfit, setMinProfit] = useState('');
  const [profitSign, setProfitSign] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('closeTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const s = search.trim().toUpperCase();
    return history.filter((t) => {
      if (s && !t.symbol.toUpperCase().includes(s) && !String(t.ticket).includes(s)) return false;
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
      if (minLots && t.lots < Number(minLots)) return false;
      if (minPips && Math.abs(t.pips) < Number(minPips)) return false;
      if (minProfit && Math.abs(t.profit) < Number(minProfit)) return false;
      if (profitSign === 'WIN' && t.profit <= 0) return false;
      if (profitSign === 'LOSS' && t.profit >= 0) return false;
      return true;
    });
  }, [history, search, typeFilter, minLots, minPips, minProfit, profitSign]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case 'closeTime': av = a.closeTime; bv = b.closeTime; break;
        case 'symbol': av = a.symbol; bv = b.symbol; break;
        case 'type': av = a.type; bv = b.type; break;
        case 'lots': av = a.lots; bv = b.lots; break;
        case 'pips': av = a.pips; bv = b.pips; break;
        case 'profit': av = a.profit; bv = b.profit; break;
        case 'duration': av = tradeDurationMs(a); bv = tradeDurationMs(b); break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('desc'); }
  };

  const SortHead = ({ k, label, align = 'left' }: { k: SortKey; label: string; align?: 'left' | 'right' | 'center' }) => (
    <th className={cn('py-2 px-3 select-none', align === 'right' && 'text-right', align === 'center' && 'text-center', align === 'left' && 'text-left')}>
      <button
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors"
      >
        {label}
        {sortKey === k ? (
          sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </th>
  );

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Closed Trades <span className="text-foreground/60 font-mono ml-2">({sorted.length})</span>
        </h3>
        <div className="flex w-full items-center gap-2 flex-wrap sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Symbol or #ticket"
              className="h-8 w-full rounded-lg border border-border/40 bg-secondary/40 pl-7 pr-2 text-xs focus:border-primary/40 focus:outline-none sm:w-40"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as typeof typeFilter); setPage(0); }}
            className="h-8 text-xs rounded-lg bg-secondary/40 border border-border/40 focus:border-primary/40 focus:outline-none px-2"
          >
            <option value="ALL">All Types</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          <select
            value={profitSign}
            onChange={(e) => { setProfitSign(e.target.value as typeof profitSign); setPage(0); }}
            className="h-8 text-xs rounded-lg bg-secondary/40 border border-border/40 focus:border-primary/40 focus:outline-none px-2"
          >
            <option value="ALL">All Results</option>
            <option value="WIN">Wins</option>
            <option value="LOSS">Losses</option>
          </select>
          <input
            value={minLots} onChange={(e) => { setMinLots(e.target.value); setPage(0); }}
            placeholder="Min lots" type="number" step="0.01"
            className="h-8 text-xs rounded-lg bg-secondary/40 border border-border/40 focus:border-primary/40 focus:outline-none px-2 w-24 font-mono"
          />
          <input
            value={minPips} onChange={(e) => { setMinPips(e.target.value); setPage(0); }}
            placeholder="Min |pips|" type="number"
            className="h-8 text-xs rounded-lg bg-secondary/40 border border-border/40 focus:border-primary/40 focus:outline-none px-2 w-24 font-mono"
          />
          <input
            value={minProfit} onChange={(e) => { setMinProfit(e.target.value); setPage(0); }}
            placeholder="Min |$|" type="number"
            className="h-8 text-xs rounded-lg bg-secondary/40 border border-border/40 focus:border-primary/40 focus:outline-none px-2 w-24 font-mono"
          />
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {pageData.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No trades match your filters</div>
        )}
        {pageData.map((t) => {
          const isCopy = t.isCopy === true || (t.magicNumber !== undefined && t.magicNumber > 0);
          return (
            <div key={t.ticket} className="rounded-lg border border-border/40 bg-secondary/15 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold">{t.symbol}</span>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded',
                      t.type === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    )}>{t.type}</span>
                    <span className={cn('text-[10px] uppercase font-mono px-2 py-0.5 rounded',
                      isCopy ? 'bg-accent/15 text-accent' : 'bg-secondary/50 text-muted-foreground'
                    )}>
                      {isCopy ? 'COPIER' : 'MANUAL'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-muted-foreground">#{t.ticket}</div>
                </div>
                <div className={cn('shrink-0 text-right font-mono text-lg font-bold', t.profit >= 0 ? 'profit-positive' : 'profit-negative')}>
                  {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-background/40 p-2">
                  <div className="uppercase tracking-wider text-muted-foreground/70">Lots</div>
                  <div className="font-mono text-sm">{t.lots.toFixed(2)}</div>
                </div>
                <div className="rounded-md bg-background/40 p-2">
                  <div className="uppercase tracking-wider text-muted-foreground/70">Pips</div>
                  <div className={cn('font-mono text-sm', t.pips >= 0 ? 'profit-positive' : 'profit-negative')}>
                    {t.pips >= 0 ? '+' : ''}{t.pips.toFixed(1)}
                  </div>
                </div>
                <div className="rounded-md bg-background/40 p-2">
                  <div className="uppercase tracking-wider text-muted-foreground/70">Time</div>
                  <div className="font-mono text-sm">{tradeDurationLabel(t)}</div>
                </div>
              </div>
              <div className="mt-2 truncate text-[11px] text-muted-foreground">
                Closed {(t.closeTime || '').slice(0, 16).replace('T', ' ')}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30">
              <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-muted-foreground/70">Ticket</th>
              <SortHead k="closeTime" label="Closed" />
              <SortHead k="symbol" label="Symbol" />
              <SortHead k="type" label="Type" />
              <SortHead k="lots" label="Lots" align="right" />
              <SortHead k="pips" label="Pips" align="right" />
              <SortHead k="profit" label="Profit" align="right" />
              <SortHead k="duration" label="Duration" align="right" />
              <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-muted-foreground/70">Source</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-muted-foreground text-sm">No trades match your filters</td></tr>
            )}
            {pageData.map((t) => {
              const isCopy = t.isCopy === true || (t.magicNumber !== undefined && t.magicNumber > 0);
              return (
                <tr key={t.ticket} className="border-b border-border/20 hover:bg-secondary/15 transition-colors">
                  <td className="py-2 px-3 font-mono text-muted-foreground">#{t.ticket}</td>
                  <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{(t.closeTime || '').slice(0, 16).replace('T', ' ')}</td>
                  <td className="py-2 px-3 font-mono font-semibold">{t.symbol}</td>
                  <td className="py-2 px-3">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded',
                      t.type === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    )}>{t.type}</span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{t.lots.toFixed(2)}</td>
                  <td className={cn('py-2 px-3 text-right font-mono', t.pips >= 0 ? 'profit-positive' : 'profit-negative')}>
                    {t.pips >= 0 ? '+' : ''}{t.pips.toFixed(1)}
                  </td>
                  <td className={cn('py-2 px-3 text-right font-mono font-semibold', t.profit >= 0 ? 'profit-positive' : 'profit-negative')}>
                    {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-muted-foreground">{tradeDurationLabel(t)}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={cn('text-[10px] uppercase font-mono px-2 py-0.5 rounded',
                      isCopy ? 'bg-accent/15 text-accent' : 'bg-secondary/50 text-muted-foreground'
                    )}>
                      {isCopy ? 'COPIER' : 'MANUAL'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded bg-secondary/40 hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >Previous</button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded bg-secondary/40 hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
