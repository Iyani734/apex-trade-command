import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTradingStore } from '@/store/tradingStore';
import { Link2, Settings, Trash2, RefreshCw } from 'lucide-react';
import { confirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { commandsStore } from '@/lib/commandsStore';
import { userPrefs } from '@/lib/userPrefs';
import { useAuth } from '@/lib/auth';

export default function AccountsPage() {
  const accounts = useTradingStore((s) => s.accounts);
  const activeId = useTradingStore((s) => s.activeAccountId);
  const setActive = useTradingStore((s) => s.setActiveAccount);
  const setAccounts = useTradingStore((s) => s.setAccounts);
  const { license } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const freeAccountLimit = license?.freeAccountLimit || 3;
  const needsPaidForNextAccount = Boolean(!license?.paid && accounts.length >= freeAccountLimit);
  const connectLabel = needsPaidForNextAccount ? 'Connect Paid Version' : 'Connect Account';

  const handleSettings = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActive(id);
    navigate('/settings');
  };

  const handleRefresh = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setBusy(`refresh-${id}`);
    try {
      await api.accounts.dashboard(id);
      toast.success('Account refreshed');
    } catch (err: any) {
      toast.error(`Refresh failed: ${err?.message || 'unknown'}`);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, alias: string) => {
    e.stopPropagation();
    const ok = await confirmDialog({
      title: `Remove ${alias}?`,
      description: 'This unregisters the account from the server and clears its local command history. Cannot be undone.',
      destructive: true,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    setBusy(`del-${id}`);
    try {
      await api.accounts.delete(id);
      commandsStore.drop(id);
      userPrefs.removeOwned(id);
      const remaining = accounts.filter((a) => a.id !== id);
      setAccounts(remaining);
      if (activeId === id && remaining.length) setActive(remaining[0].id);
      toast.success(`${alias} removed`);
    } catch (err: any) {
      toast.error(`Delete failed: ${err?.message || 'unknown'}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage your connected MetaTrader accounts</p>
        </div>
        <Link
          to="/connect"
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20"
        >
          <Link2 className="h-4 w-4" />
          {connectLabel}
        </Link>
      </motion.div>

      {needsPaidForNextAccount && (
        <div className="rounded-xl border border-sky-400/30 bg-sky-400/10 p-4 text-sm leading-6 text-muted-foreground">
          You have reached the free limit of {freeAccountLimit} accounts. To add another account, connect it with the paid EA. If the paid EA connects successfully, this profile is upgraded automatically.
        </div>
      )}

      {accounts.length === 0 && (
        <div className="glass-card p-12 text-center text-muted-foreground text-sm">
          No accounts connected yet. Open the Connect page and follow the EA setup steps.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc, i) => (
          <motion.div
            key={acc.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`glass-card-hover p-5 cursor-pointer ${acc.id === activeId ? 'glow-border' : ''}`}
            onClick={() => setActive(acc.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold">{acc.alias}</h3>
                <p className="text-xs text-muted-foreground font-mono">{acc.id}</p>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${acc.status === 'ONLINE' ? 'bg-success animate-pulse-glow' : 'bg-destructive'}`} />
                <span className="text-[10px] font-mono text-muted-foreground">{acc.status}</span>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Broker</span>
                <span>{acc.broker}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform</span>
                <span className="font-mono">{acc.platform}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  acc.role === 'MASTER' ? 'bg-primary/10 text-primary' :
                  acc.role === 'SLAVE' ? 'bg-accent/10 text-accent' :
                  'bg-secondary text-muted-foreground'
                }`}>{acc.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance</span>
                <span className="font-mono font-semibold">${acc.balance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Leverage</span>
                <span className="font-mono">{acc.leverage}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/30">
              {acc.id === activeId && <span className="text-[10px] text-primary font-mono font-bold">● ACTIVE</span>}
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={(e) => handleSettings(e, acc.id)}
                  title="Open account settings"
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => handleRefresh(e, acc.id)}
                  disabled={busy === `refresh-${acc.id}`}
                  title="Refresh from server"
                  className="p-1.5 rounded hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${busy === `refresh-${acc.id}` ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={(e) => handleDelete(e, acc.id, acc.alias)}
                  disabled={busy === `del-${acc.id}`}
                  title="Remove account"
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
