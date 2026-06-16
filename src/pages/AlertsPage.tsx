import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Plus, Pencil, Trash2, History, Power } from 'lucide-react';
import { toast } from 'sonner';
import { useTradingStore } from '@/store/tradingStore';
import { alertsStore, type Alert, type TriggeredAlert } from '@/lib/alerts';
import { api } from '@/services/api';
import { AlertFormModal } from '@/components/alerts/AlertFormModal';
import { confirmDialog } from '@/components/ConfirmDialog';

export default function AlertsPage() {
  const accounts = useTradingStore((s) => s.accounts);
  const activeId = useTradingStore((s) => s.activeAccountId);
  const triggered = useTradingStore((s) => s.triggeredAlerts);
  const setTriggered = useTradingStore((s) => s.setTriggeredAlerts);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [editing, setEditing] = useState<Alert | null>(null);
  const [open, setOpen] = useState(false);

  // hydrate from local + server on account change
  useEffect(() => {
    if (!activeId) return;
    const local = alertsStore.list(activeId);
    setAlerts(local);
    api.alerts.list(activeId)
      .then((res: any) => {
        const remote = (res?.alerts || []) as Alert[];
        if (Array.isArray(remote) && remote.length) {
          setAlerts(remote);
          alertsStore.saveAll(activeId, remote);
        }
      })
      .catch(() => { /* server may not have endpoint yet — fall back to local */ });
  }, [activeId]);

  // hydrate triggered history
  useEffect(() => {
    setTriggered(alertsStore.triggered());
  }, [setTriggered]);

  const persist = async (next: Alert[]) => {
    if (!activeId) return;
    setAlerts(next);
    alertsStore.saveAll(activeId, next);
    try {
      await api.alerts.saveAll(activeId, next);
    } catch (e: any) {
      toast.error(`Failed to sync alerts to server: ${e.message}`);
    }
  };

  const handleSave = async (a: Alert) => {
    const exists = alerts.some((x) => x.id === a.id);
    const next = exists ? alerts.map((x) => (x.id === a.id ? a : x)) : [a, ...alerts];
    await persist(next);
    toast.success(exists ? 'Alert updated' : 'Alert created');
    setOpen(false);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: 'Delete this alert?',
      description: 'It will be removed from your active alerts. Triggered history is kept.',
      destructive: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await persist(alerts.filter((x) => x.id !== id));
    toast.success('Alert deleted');
  };

  // Auto-remove one-shot alerts whenever a new one fires
  const lastSeenTriggerRef = useRef<string | null>(null);
  useEffect(() => {
    if (!triggered.length || !activeId) return;
    const latest = triggered[0] as TriggeredAlert;
    const sig = `${latest.alertId}-${latest.triggeredAt}`;
    if (sig === lastSeenTriggerRef.current) return;
    lastSeenTriggerRef.current = sig;
    if (latest.accountId !== activeId) return;
    setAlerts((prev) => {
      const target = prev.find((a) => a.id === latest.alertId);
      if (!target || !target.triggerOnce) return prev;
      const next = prev.filter((a) => a.id !== latest.alertId);
      alertsStore.saveAll(activeId, next);
      api.alerts.saveAll(activeId, next).catch(() => { /* server may sync later */ });
      return next;
    });
  }, [triggered, activeId]);

  const handleToggle = async (id: string) => {
    await persist(alerts.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)));
  };

  const accountAlerts = useMemo(() => alerts, [alerts]);
  const accountTriggered = useMemo(
    () => triggered.filter((t) => !activeId || t.accountId === activeId),
    [triggered, activeId]
  );

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> Price Alerts
          </h1>
          <p className="text-sm text-muted-foreground">
            Unlimited alerts per account · synced to your EA in real time
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          disabled={!activeId}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> New Alert
        </button>
      </motion.div>

      {!activeId && (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          Select an account from the top bar to manage alerts.
        </div>
      )}

      {activeId && (
        <>
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">
              Active Alerts ({accountAlerts.length})
            </h3>
            {accountAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No alerts yet. Click "New Alert" to create one.
              </p>
            ) : (
              <div className="space-y-2">
                {accountAlerts.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                    <button
                      onClick={() => handleToggle(a.id)}
                      title={a.enabled ? 'Disable' : 'Enable'}
                      className={`w-2 h-2 rounded-full ${a.enabled ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{a.symbol}</span>
                        <span className="text-xs text-muted-foreground">touches</span>
                        <span className="font-mono text-sm text-primary">{Number(a.value).toFixed(5)}</span>
                        {a.triggerOnce && (
                          <span className="text-[9px] uppercase bg-accent/20 text-accent px-1.5 py-0.5 rounded">once</span>
                        )}
                      </div>
                      {a.note && <p className="text-xs text-muted-foreground mt-0.5">{a.note}</p>}
                    </div>
                    <button onClick={() => handleToggle(a.id)} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Toggle">
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditing(a); setOpen(true); }} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4" /> Triggered History ({accountTriggered.length})
              </h3>
              {accountTriggered.length > 0 && (
                <button
                  onClick={() => { alertsStore.clearTriggered(); setTriggered([]); }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {accountTriggered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No alerts have triggered yet.</p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-auto">
                {accountTriggered.map((t, i) => {
                  const acc = accounts.find((a) => a.id === t.accountId);
                  return (
                    <div key={`${t.alertId}-${i}`} className="flex items-center gap-3 p-2 hover:bg-secondary/20 rounded text-sm">
                      <Bell className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                      <span className="font-mono font-semibold w-20">{t.symbol}</span>
                      <span className="text-xs text-muted-foreground flex-1">
                        touched {String(t.value)} · price {t.price}
                      </span>
                      {acc && <span className="text-[10px] text-muted-foreground/70">{acc.alias}</span>}
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {new Date(t.triggeredAt).toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <AlertFormModal
        open={open}
        initial={editing}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSave={handleSave}
      />
    </div>
  );
}
