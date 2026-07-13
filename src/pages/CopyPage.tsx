import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTradingStore } from '@/store/tradingStore';
import { userPrefs } from '@/lib/userPrefs';
import { ArrowRight, Check, X, Plus, Trash2, RefreshCw, Pencil, PlayCircle, PauseCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { EditPairModal, type EditablePair } from '@/components/copy/EditPairModal';
import { confirmDialog } from '@/components/ConfirmDialog';

interface PairLatency {
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  last_ms: number;
  count: number;
}

interface Pair {
  masterAccountId: string;
  slaveAccountId: string;
  lotMultiplier?: number;
  copySL?: boolean;
  copyTP?: boolean;
  active?: boolean;
  createdAt?: string;
  latency?: PairLatency | null;
}

function normalizePair(raw: any): Pair {
  const config = raw?.config || {};
  return {
    masterAccountId: String(raw?.masterAccountId ?? raw?.master ?? config.masterAccountId ?? config.master_account ?? ''),
    slaveAccountId: String(raw?.slaveAccountId ?? raw?.slave ?? ''),
    lotMultiplier: Number(raw?.lotMultiplier ?? raw?.lot_multiplier ?? config.lotMultiplier ?? config.lot_multiplier ?? 1),
    copySL: Boolean(raw?.copySL ?? raw?.copy_sl ?? config.copySL ?? config.copy_sl ?? true),
    copyTP: Boolean(raw?.copyTP ?? raw?.copy_tp ?? config.copyTP ?? config.copy_tp ?? true),
    active: raw?.active ?? config.active ?? true,
    createdAt: raw?.createdAt ?? raw?.created_at,
    latency: raw?.latency ?? null,
  };
}

function LatencyBadge({ latency }: { latency?: PairLatency | null }) {
  if (!latency || !latency.count) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> No data
      </span>
    );
  }
  const avg = latency.avg_ms;
  const tone = avg < 200 ? 'bg-success/15 text-success' : avg < 500 ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive';
  const label = avg < 200 ? 'Fast' : avg < 500 ? 'Normal' : 'Slow';
  const dot = avg < 200 ? 'bg-success' : avg < 500 ? 'bg-warning' : 'bg-destructive';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono ${tone}`}
      title={`avg ${avg}ms · last ${latency.last_ms}ms · min ${latency.min_ms}ms · max ${latency.max_ms}ms`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} /> {label} · {avg}ms
    </span>
  );
}

export default function CopyPage() {
  const accounts = useTradingStore((s) => s.accounts);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [masterId, setMasterId] = useState('');
  const [slaveIds, setSlaveIds] = useState<string[]>([]);
  const [lotMult, setLotMult] = useState(1);
  const [copySL, setCopySL] = useState(true);
  const [copyTP, setCopyTP] = useState(true);
  const [editing, setEditing] = useState<EditablePair | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [latencyMap, setLatencyMap] = useState<Record<string, PairLatency>>({});

  const owned = userPrefs.getOwned();
  const myAccounts = accounts.filter((a) => owned.includes(a.id));
  const pairsByMaster = pairs.reduce<Record<string, Pair[]>>((grouped, pair) => {
    if (!grouped[pair.masterAccountId]) grouped[pair.masterAccountId] = [];
    grouped[pair.masterAccountId].push(pair);
    return grouped;
  }, {});
  const activeSlaveIds = new Set(pairs.map((pair) => pair.slaveAccountId));
  const selectedSlaveCount = slaveIds.length;

  const loadPairs = async () => {
    setLoading(true);
    try {
      const res = await api.copy.getPairs();
      setPairs(((res?.pairs as any[]) || []).map(normalizePair).filter((pair) => pair.masterAccountId && pair.slaveAccountId));
    } catch (e: any) {
      toast.error(`Failed to load pairs: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadLatency = async () => {
    try {
      const res = await api.copy.latency();
      const map: Record<string, PairLatency> = {};
      Object.entries(res?.latency || {}).forEach(([slaveId, l]: [string, any]) => {
        map[slaveId] = { avg_ms: l.avg_ms, min_ms: l.min_ms, max_ms: l.max_ms, last_ms: l.last_ms, count: l.samples ?? l.count ?? 0 };
      });
      setLatencyMap(map);
    } catch { /* silent — endpoint may not exist on older servers */ }
  };

  useEffect(() => {
    loadPairs();
    loadLatency();
    const t = setInterval(loadLatency, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setSlaveIds((current) => current.filter((id) => id !== masterId));
  }, [masterId]);

  const toggleSlave = (accountId: string) => {
    setSlaveIds((current) => (
      current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId]
    ));
  };

  const handleCreate = async () => {
    if (!masterId || selectedSlaveCount === 0) return toast.error('Pick one master and at least one slave account');
    if (slaveIds.includes(masterId)) return toast.error('Master and slave must be different');
    setCreating(true);
    try {
      await api.copy.createPair({ masterAccountId: masterId, slaveAccountIds: slaveIds, lotMultiplier: lotMult, copySL, copyTP });
      // Auto-resume selected slaves so they start copying immediately.
      await Promise.all(slaveIds.map((id) => api.commands.resume(id).catch(() => undefined)));
      toast.success(`${selectedSlaveCount} slave account${selectedSlaveCount === 1 ? '' : 's'} connected to master`);
      setMasterId('');
      setSlaveIds([]);
      await loadPairs();
    } catch (e: any) {
      toast.error(`Create failed: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (slaveAccountId: string) => {
    const ok = await confirmDialog({
      title: 'Remove this copy pair?',
      description: 'The slave account will go back to STANDALONE mode and stop copying.',
      destructive: true,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      await api.copy.deletePair(slaveAccountId);
      toast.success('Pair removed');
      await loadPairs();
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    }
  };

  const handleSwap = async (pair: Pair) => {
    const ok = await confirmDialog({
      title: 'Swap master ↔ slave?',
      description: `${pair.slaveAccountId} will become the master and ${pair.masterAccountId} will follow.`,
      confirmLabel: 'Swap',
    });
    if (!ok) return;
    try {
      await api.copy.deletePair(pair.slaveAccountId);
      await api.copy.createPair({
        masterAccountId: pair.slaveAccountId,
        slaveAccountId: pair.masterAccountId,
        lotMultiplier: pair.lotMultiplier ?? 1,
        copySL: pair.copySL ?? true,
        copyTP: pair.copyTP ?? true,
      });
      try { await api.commands.resume(pair.masterAccountId); } catch { /* ignore */ }
      toast.success('Roles swapped');
      await loadPairs();
    } catch (e: any) {
      toast.error(`Swap failed: ${e.message}`);
    }
  };

  const handleEditSave = async (updates: Omit<EditablePair, 'slaveAccountId'>) => {
    if (!editing) return;
    setBusyId(editing.slaveAccountId);
    try {
      await api.copy.updatePair(editing.slaveAccountId, updates);
      if (updates.active) {
        try { await api.commands.resume(editing.slaveAccountId); } catch { /* ignore */ }
      }
      toast.success('Pair updated');
      setEditing(null);
      await loadPairs();
    } catch (e: any) {
      toast.error(`Update failed: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (pair: Pair) => {
    setBusyId(pair.slaveAccountId);
    try {
      const next = !(pair.active ?? true);
      await api.copy.updatePair(pair.slaveAccountId, { active: next });
      if (next) {
        try { await api.commands.resume(pair.slaveAccountId); } catch { /* ignore */ }
        toast.success('Pair activated — slave resumed');
      } else {
        toast.success('Pair paused');
      }
      await loadPairs();
    } catch (e: any) {
      toast.error(`Toggle failed: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handlePropagateCloseAll = async (pair: Pair) => {
    const ok = await confirmDialog({
      title: 'Close ALL trades on both accounts?',
      description: `This sends close-all to master ${pair.masterAccountId} AND slave ${pair.slaveAccountId}. Open positions cannot be reopened automatically.`,
      destructive: true,
      confirmLabel: 'Close all',
    });
    if (!ok) return;
    setBusyId(pair.slaveAccountId);
    try {
      await api.commands.closeAll(pair.masterAccountId);
      await api.commands.closeAll(pair.slaveAccountId);
      toast.success('Close-all propagated to master and slave');
    } catch (e: any) {
      toast.error(`Propagate failed: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Copy Trading</h1>
          <p className="text-sm text-muted-foreground">Connect your own accounts as master/slave pairs · slaves auto-resume when active</p>
        </div>
        <button onClick={loadPairs} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/70 text-sm transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </motion.div>


      {/* My accounts */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Your Accounts</h3>
        {myAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No connected accounts yet — connect one from the Connect page.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {myAccounts.map((a) => (
              <div key={a.id} className="bg-secondary/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{a.alias}</span>
                  <div className={`w-2 h-2 rounded-full ${a.status === 'ONLINE' ? 'bg-success' : 'bg-destructive'}`} />
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">{a.id} • {a.broker}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create new pair */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Copy Group
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Master Account</label>
            <select value={masterId} onChange={(e) => setMasterId(e.target.value)} className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm border border-border/50 focus:outline-none focus:border-primary/50">
              <option value="">— Select master —</option>
              {myAccounts.map((a) => (<option key={a.id} value={a.id}>{a.alias} ({a.id})</option>))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Slave Accounts</label>
            <select
              multiple
              value={slaveIds}
              onChange={(e) => setSlaveIds(Array.from(e.target.selectedOptions, (option) => option.value).filter(Boolean))}
              className="hidden"
            >
              <option value="">— Select slave —</option>
              {myAccounts.filter((a) => a.id !== masterId).map((a) => (<option key={a.id} value={a.id}>{a.alias} ({a.id})</option>))}
            </select>
            <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-border/50 bg-secondary/20 p-2 sm:grid-cols-2">
              {myAccounts.filter((a) => a.id !== masterId).map((a) => {
                const selected = slaveIds.includes(a.id);
                const linked = activeSlaveIds.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleSlave(a.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? 'border-primary bg-primary/15 text-foreground'
                        : 'border-border/40 bg-background/30 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{a.alias}</span>
                      <span className={`h-2 w-2 rounded-full ${selected ? 'bg-primary' : a.status === 'ONLINE' ? 'bg-success' : 'bg-muted-foreground'}`} />
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">{a.id}</div>
                    {linked && <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-primary">Already linked</div>}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedSlaveCount} selected. One master can control many slave accounts.
            </p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Lot Multiplier</label>
            <input type="number" step="0.01" value={lotMult} onChange={(e) => setLotMult(Number(e.target.value))} className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm font-mono border border-border/50 focus:outline-none focus:border-primary/50" />
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={copySL} onChange={(e) => setCopySL(e.target.checked)} /> Copy SL
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={copyTP} onChange={(e) => setCopyTP(e.target.checked)} /> Copy TP
            </label>
          </div>
        </div>
        <button onClick={handleCreate} disabled={creating || !masterId || selectedSlaveCount === 0} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
          {creating ? 'Creating...' : `Create ${selectedSlaveCount || ''} Slave Link${selectedSlaveCount === 1 ? '' : 's'}`}
        </button>
      </div>

      {/* Existing pairs */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Slave Links ({pairs.length})</h3>
        {pairs.length === 0 && (
          <div className="glass-card p-12 text-center text-sm text-muted-foreground">No copy pairs configured yet.</div>
        )}
        {Object.entries(pairsByMaster).length > 0 && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Object.entries(pairsByMaster).map(([masterAccountId, group]) => {
              const master = accounts.find((a) => a.id === masterAccountId);
              return (
                <div key={masterAccountId} className="glass-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Master group</p>
                      <p className="mt-1 font-semibold">{master?.alias || masterAccountId}</p>
                      <p className="font-mono text-xs text-muted-foreground">{masterAccountId}</p>
                    </div>
                    <div className="rounded-lg bg-primary/15 px-3 py-2 text-right">
                      <p className="font-mono text-lg font-bold text-primary">{group.length}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">slaves</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.map((pair) => {
                      const slave = accounts.find((a) => a.id === pair.slaveAccountId);
                      return (
                        <span key={pair.slaveAccountId} className="rounded-full border border-border/50 bg-secondary/30 px-3 py-1 text-xs">
                          {slave?.alias || pair.slaveAccountId}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
         {pairs.map((pair) => {
          const master = accounts.find((a) => a.id === pair.masterAccountId);
          const slave = accounts.find((a) => a.id === pair.slaveAccountId);
          const isActive = pair.active ?? true;
          const busy = busyId === pair.slaveAccountId;
          return (
             <motion.div key={`${pair.masterAccountId}-${pair.slaveAccountId}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className={`px-3 py-1 rounded-lg text-xs font-bold ${isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {isActive ? 'ACTIVE' : 'PAUSED'}
                </div>
                <LatencyBadge latency={pair.latency ?? latencyMap[pair.slaveAccountId]} />
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                  <button onClick={() => handleToggleActive(pair)} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-secondary hover:bg-secondary/70 transition-colors disabled:opacity-50">
                    {isActive ? <><PauseCircle className="w-3.5 h-3.5" /> Pause</> : <><PlayCircle className="w-3.5 h-3.5" /> Resume</>}
                  </button>
                  <button
                    onClick={() => setEditing({
                      slaveAccountId: pair.slaveAccountId,
                      lotMultiplier: pair.lotMultiplier ?? 1,
                      copySL: pair.copySL ?? true,
                      copyTP: pair.copyTP ?? true,
                      active: pair.active ?? true,
                    })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-secondary hover:bg-secondary/70 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => handleSwap(pair)} className="px-3 py-1.5 rounded-lg text-xs bg-secondary hover:bg-secondary/70 transition-colors">
                    Swap roles
                  </button>
                  <button onClick={() => handlePropagateCloseAll(pair)} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors disabled:opacity-50">
                    <ShieldAlert className="w-3.5 h-3.5" /> Close all
                  </button>
                  <button onClick={() => handleDelete(pair.slaveAccountId)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="bg-secondary/30 rounded-lg p-4 flex-1 min-w-[200px]">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Master</p>
                  <p className="font-semibold">{master?.alias || pair.masterAccountId}</p>
                  <p className="text-xs text-muted-foreground font-mono">{pair.masterAccountId}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="bg-secondary/30 rounded-lg p-4 flex-1 min-w-[200px]">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Slave</p>
                  <p className="font-semibold">{slave?.alias || pair.slaveAccountId}</p>
                  <p className="text-xs text-muted-foreground font-mono">{pair.slaveAccountId}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-5 pt-5 border-t border-border/30">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Lot Multiplier</p>
                  <p className="font-mono font-semibold mt-1">{pair.lotMultiplier ?? 1}x</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Copy SL</p>
                  <div className="mt-1">{pair.copySL ? <Check className="w-4 h-4 text-success" /> : <X className="w-4 h-4 text-destructive" />}</div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Copy TP</p>
                  <div className="mt-1">{pair.copyTP ? <Check className="w-4 h-4 text-success" /> : <X className="w-4 h-4 text-destructive" />}</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <EditPairModal
        open={!!editing}
        initial={editing}
        onClose={() => setEditing(null)}
        onSave={handleEditSave}
      />
    </div>
  );
}
