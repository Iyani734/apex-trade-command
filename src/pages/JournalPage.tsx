import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTradingStore, type JournalEntry } from '@/store/tradingStore';
import { userPrefs } from '@/lib/userPrefs';
import { Plus, Filter, Trash2, X, BookOpen, TrendingUp, TrendingDown, Target, Award, ArrowRight } from 'lucide-react';
import { confirmDialog } from '@/components/ConfirmDialog';
import { promptDialog } from '@/components/PromptDialog';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter';
import { TradeDetailDrawer } from '@/components/journal/TradeDetailDrawer';
import { StrategyDeepDive } from '@/components/journal/StrategyDeepDive';
import { EditTradeModal } from '@/components/journal/EditTradeModal';
import { scoreGrade } from '@/lib/tradeScore';
import type { DateRange } from '@/lib/analytics';

const DEFAULT_EMOTIONS = ['Confident', 'Calm', 'Patient', 'Anxious', 'FOMO', 'Revenge', 'Greedy'];
const DEFAULT_SETUPS = ['A+', 'A', 'B', 'C', 'D', 'E', 'F'];

export default function JournalPage() {
  const navigate = useNavigate();
  const allJournal = useTradingStore((s) => s.journal);
  const updateJournalEntry = useTradingStore((s) => s.updateJournalEntry);
  const deleteJournalEntry = useTradingStore((s) => s.deleteJournalEntry);
  const activeAccountId = useTradingStore((s) => s.activeAccountId);
  const accounts = useTradingStore((s) => s.accounts);
  const activeJournalAccountId = useMemo(
    () => accounts.find((account) => account.id === activeAccountId)?.id ?? null,
    [accounts, activeAccountId],
  );

  // Scope to a real active account so stale saved account IDs never leak old entries.
  const journal = useMemo(
    () => (activeJournalAccountId ? allJournal.filter((j) => j.accountId === activeJournalAccountId) : []),
    [allJournal, activeJournalAccountId],
  );

  const [filterStrategy, setFilterStrategy] = useState('');
  const [filterSetup, setFilterSetup] = useState('');
  const [filterEmotion, setFilterEmotion] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [strategies, setStrategies] = useState<string[]>(userPrefs.getStrategies());
  const [showStrategyMgr, setShowStrategyMgr] = useState(false);
  const [newStrategy, setNewStrategy] = useState('');
  const [perfRange, setPerfRange] = useState<DateRange>({ from: null, to: null });
  const [drawerEntry, setDrawerEntry] = useState<JournalEntry | null>(null);
  const [editEntry, setEditEntry] = useState<JournalEntry | null>(null);
  const [deepDive, setDeepDive] = useState<{ strategy: string; setup: string } | null>(null);

  // Date span derived from journal closeTimes for the date picker
  const minDate = useMemo<Date | null>(() => {
    const ts = journal
      .map((j) => Date.parse(j.closeTime || j.openTime || ''))
      .filter((n) => !isNaN(n) && n > 0);
    return ts.length ? new Date(Math.min(...ts)) : null;
  }, [journal]);

  const filtered = useMemo(() => journal.filter((j) => {
    if (filterStrategy && j.strategy !== filterStrategy) return false;
    if (filterSetup && j.setup !== filterSetup) return false;
    if (filterEmotion && j.emotion !== filterEmotion) return false;
    if (filterSource && j.source !== filterSource) return false;
    if (filterStatus && j.status !== filterStatus) return false;
    return true;
  }), [journal, filterStrategy, filterSetup, filterEmotion, filterSource, filterStatus]);

  // Strategy + Setup performance aggregation, with date filter
  const strategyPerf = useMemo(() => {
    const inRange = (j: JournalEntry) => {
      if (!perfRange.from && !perfRange.to) return true;
      const d = new Date(j.closeTime || j.openTime);
      if (perfRange.from && d < perfRange.from) return false;
      if (perfRange.to && d > perfRange.to) return false;
      return true;
    };
    const map = new Map<string, {
      key: string; strategy: string; setup: string;
      trades: number; wins: number; losses: number; profit: number; avgScore: number; scoreSum: number; scoreCount: number;
    }>();
    journal
      .filter((j) => j.status === 'closed' && j.strategy && inRange(j))
      .forEach((j) => {
        const setup = j.setup || '—';
        const key = `${j.strategy}|${setup}`;
        const cur = map.get(key) || {
          key, strategy: j.strategy, setup,
          trades: 0, wins: 0, losses: 0, profit: 0, avgScore: 0, scoreSum: 0, scoreCount: 0,
        };
        cur.trades += 1;
        const p = j.profit ?? 0;
        cur.profit += p;
        if (p > 0) cur.wins += 1; else if (p < 0) cur.losses += 1;
        if (j.score !== undefined) { cur.scoreSum += j.score; cur.scoreCount += 1; }
        map.set(key, cur);
      });
    return Array.from(map.values()).map((g) => ({
      ...g,
      avgScore: g.scoreCount ? g.scoreSum / g.scoreCount : 0,
    })).sort((a, b) => b.profit - a.profit);
  }, [journal, perfRange]);

  const handleDelete = async (entry: JournalEntry) => {
    const ok = await confirmDialog({
      title: 'Delete journal entry?',
      description: `${entry.symbol} ${entry.type} #${entry.ticket} — this cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) {
      deleteJournalEntry(entry.id);
      toast.success('Entry deleted');
    }
  };

  // Single-page edit form opens via setEditEntry — see EditTradeModal at bottom
  const handleEditSave = (id: string, updates: Partial<JournalEntry>) => {
    updateJournalEntry(id, updates);
    setStrategies(userPrefs.getStrategies());
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trade Journal</h1>
          <p className="text-sm text-muted-foreground">
            Every trade is auto-recorded — add strategy, setup, and emotion to improve over time
          </p>
        </div>
        <button
          onClick={() => setShowStrategyMgr(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Manage Strategies
        </button>
      </motion.div>

      <Tabs defaultValue="entries">
        <TabsList className="bg-secondary/30">
          <TabsTrigger value="entries">All Entries ({journal.length})</TabsTrigger>
          <TabsTrigger value="performance">Strategy Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="space-y-4 pt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select value={filterStrategy} onChange={(e) => setFilterStrategy(e.target.value)} className="bg-secondary/50 text-sm rounded-lg px-3 py-1.5 border border-border/50 text-foreground">
              <option value="">All Strategies</option>
              {strategies.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="Copy Trading">Copy Trading</option>
            </select>
            <select value={filterSetup} onChange={(e) => setFilterSetup(e.target.value)} className="bg-secondary/50 text-sm rounded-lg px-3 py-1.5 border border-border/50 text-foreground">
              <option value="">All Setups</option>
              {DEFAULT_SETUPS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterEmotion} onChange={(e) => setFilterEmotion(e.target.value)} className="bg-secondary/50 text-sm rounded-lg px-3 py-1.5 border border-border/50 text-foreground">
              <option value="">All Emotions</option>
              {DEFAULT_EMOTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="bg-secondary/50 text-sm rounded-lg px-3 py-1.5 border border-border/50 text-foreground">
              <option value="">All Sources</option>
              <option value="manual">Manual</option>
              <option value="copier">From Copier</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-secondary/50 text-sm rounded-lg px-3 py-1.5 border border-border/50 text-foreground">
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {!activeJournalAccountId && (
            <div className="glass-card p-12 text-center text-muted-foreground text-sm">
              Connect or select an account to see its journal entries.
            </div>
          )}

          {activeJournalAccountId && filtered.length === 0 && (
            <div className="glass-card p-12 text-center text-muted-foreground text-sm">
              No journal entries for this account yet. Open a trade — it'll be auto-recorded here.
            </div>
          )}

          {filtered.map((entry) => {
            const grade = entry.score !== undefined ? scoreGrade(entry.score) : null;
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card-hover p-5 transition-all cursor-pointer"
                onClick={() => setDrawerEntry(entry)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-mono font-semibold">{entry.symbol}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${entry.type === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {entry.type}
                      </span>
                      {entry.strategy ? (
                        <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">{entry.strategy}</span>
                      ) : (
                        <span className="text-[10px] uppercase font-mono bg-warning/10 text-warning px-2 py-0.5 rounded">No strategy</span>
                      )}
                      {entry.setup && (
                        <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded font-mono">{entry.setup}</span>
                      )}
                      {entry.confidence && (
                        <span className="text-[10px] uppercase font-mono text-muted-foreground">conf {entry.confidence}/5</span>
                      )}
                      {entry.emotion && entry.emotion !== '—' && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          ['Confident', 'Calm', 'Patient'].includes(entry.emotion) ? 'bg-success/10 text-success' :
                          ['FOMO', 'Revenge', 'Greedy'].includes(entry.emotion) ? 'bg-destructive/10 text-destructive' :
                          'bg-warning/10 text-warning'
                        }`}>
                          {entry.emotion}
                        </span>
                      )}
                      <span className={cn('text-[10px] uppercase font-mono px-2 py-0.5 rounded',
                        entry.source === 'copier' ? 'bg-accent/15 text-accent' : 'bg-secondary/50 text-muted-foreground'
                      )}>
                        {entry.source === 'copier' ? `COPIER${entry.copierFromAccount ? ` • ${entry.copierFromAccount}` : ''}` : 'MANUAL'}
                      </span>
                      <span className={`text-xs font-mono ${entry.status === 'open' ? 'text-primary' : 'text-muted-foreground'}`}>
                        {entry.status === 'open' ? '● OPEN' : '○ CLOSED'}
                      </span>
                      {grade && (
                        <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-secondary/40', grade.tone)}>
                          {grade.label} · {entry.score}
                        </span>
                      )}
                    </div>
                    <p className={cn('text-sm leading-relaxed', entry.reason ? 'text-foreground/80' : 'text-muted-foreground/60 italic')}>
                      {entry.reason || 'No reason logged yet — click to view details and add notes.'}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="font-mono">#{entry.ticket}</span>
                      <span>{new Date(entry.openTime).toLocaleString()}</span>
                      {entry.profit !== undefined && (
                        <span className={`font-mono font-semibold ${entry.profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                          {entry.profit >= 0 ? '+' : ''}${entry.profit.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEditEntry(entry)}
                      className="p-2 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(entry)}
                      className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4 pt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-muted-foreground">
              Closed trades grouped by <strong className="text-foreground">strategy</strong> and <strong className="text-foreground">setup</strong>.
              Click a card to drill into individual trades.
            </p>
            <DateRangeFilter range={perfRange} onChange={setPerfRange} minDate={minDate} />
          </div>

          {strategyPerf.length === 0 ? (
            <div className="glass-card p-12 text-center text-muted-foreground text-sm">
              No closed trades with a strategy in this date range yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {strategyPerf.map((s) => {
                const winRate = s.trades > 0 ? (s.wins / s.trades) * 100 : 0;
                const grade = s.avgScore ? scoreGrade(s.avgScore) : null;
                return (
                  <div
                    key={s.key}
                    className="glass-card p-5 cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => setDeepDive({ strategy: s.strategy, setup: s.setup })}
                  >
                    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                      <h3 className="font-semibold flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-accent" />
                        {s.strategy}
                        {s.setup !== '—' && (
                          <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded font-mono">{s.setup}</span>
                        )}
                      </h3>
                      <span className={cn('text-lg font-mono font-bold', s.profit >= 0 ? 'profit-positive' : 'profit-negative')}>
                        {s.profit >= 0 ? '+' : ''}${s.profit.toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <Stat icon={Target} label="Win Rate" value={`${winRate.toFixed(1)}%`} />
                      <Stat icon={TrendingUp} label="Wins" value={String(s.wins)} tone="success" />
                      <Stat icon={TrendingDown} label="Losses" value={String(s.losses)} tone="destructive" />
                      <Stat icon={Award} label="Avg Score" value={grade ? `${grade.label}` : '—'} tone={grade ? undefined : 'muted'} />
                    </div>
                    <div className="mt-3 text-[11px] text-muted-foreground text-center">
                      {s.trades} trade{s.trades !== 1 ? 's' : ''} · avg ${(s.profit / s.trades).toFixed(2)}/trade
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/journal/strategy/${encodeURIComponent(s.strategy)}/${encodeURIComponent(s.setup)}`);
                      }}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors"
                    >
                      View full strategy details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Trade list within strategy/setup */}
                    <div className="mt-4 pt-3 border-t border-border/30 space-y-1.5 max-h-48 overflow-auto">
                      {journal
                        .filter((j) => j.status === 'closed' && j.strategy === s.strategy && (j.setup || '—') === s.setup)
                        .slice(0, 30)
                        .map((j) => {
                          const g = j.score !== undefined ? scoreGrade(j.score) : null;
                          return (
                            <button
                              key={j.id}
                              onClick={(e) => { e.stopPropagation(); setDrawerEntry(j); }}
                              className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-secondary/40 transition-colors text-left"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono">{j.symbol}</span>
                                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded',
                                  j.type === 'BUY' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                                )}>{j.type}</span>
                                <span className="text-muted-foreground font-mono truncate">#{j.ticket}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {g && <span className={cn('font-mono text-[10px]', g.tone)}>{g.label}</span>}
                                <span className={cn('font-mono font-semibold', (j.profit ?? 0) >= 0 ? 'profit-positive' : 'profit-negative')}>
                                  {(j.profit ?? 0) >= 0 ? '+' : ''}${(j.profit ?? 0).toFixed(2)}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showStrategyMgr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Your Strategies</h2>
              <button onClick={() => setShowStrategyMgr(false)} className="p-1 rounded hover:bg-secondary text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-auto">
              {strategies.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No strategies yet. Add your first one below.
                </p>
              )}
              {strategies.map((s) => (
                <div key={s} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                  <span className="text-sm">{s}</span>
                  <button
                    onClick={async () => {
                      const ok = await confirmDialog({ title: `Remove "${s}"?`, description: 'Existing entries keep this tag.', destructive: true, confirmLabel: 'Remove' });
                      if (ok) {
                        userPrefs.removeStrategy(s);
                        setStrategies(userPrefs.getStrategies());
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newStrategy}
                onChange={(e) => setNewStrategy(e.target.value)}
                placeholder="e.g. ICT OB, Breakout, Smart Money"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newStrategy.trim()) {
                    userPrefs.addStrategy(newStrategy.trim());
                    setStrategies(userPrefs.getStrategies());
                    setNewStrategy('');
                  }
                }}
                className="flex-1 bg-secondary/50 rounded-lg px-3 py-2 text-sm border border-border/50 focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={() => {
                  if (newStrategy.trim()) {
                    userPrefs.addStrategy(newStrategy.trim());
                    setStrategies(userPrefs.getStrategies());
                    setNewStrategy('');
                  }
                }}
                className="px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      <TradeDetailDrawer entry={drawerEntry} onClose={() => setDrawerEntry(null)} />
      <EditTradeModal
        entry={editEntry}
        onClose={() => setEditEntry(null)}
        onSave={handleEditSave}
      />
      <StrategyDeepDive
        entries={journal}
        strategy={deepDive?.strategy ?? null}
        setup={deepDive?.setup ?? null}
        onClose={() => setDeepDive(null)}
        onSelectTrade={(j) => { setDeepDive(null); setDrawerEntry(j); }}
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: 'success' | 'destructive' | 'muted' }) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground">
        <Icon className={cn('w-3 h-3',
          tone === 'success' && 'text-success',
          tone === 'destructive' && 'text-destructive',
        )} />
        {label}
      </div>
      <p className={cn('text-base font-mono font-semibold mt-1',
        tone === 'success' && 'profit-positive',
        tone === 'destructive' && 'profit-negative',
        tone === 'muted' && 'text-muted-foreground',
      )}>{value}</p>
    </div>
  );
}
