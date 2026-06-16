import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Clock, Copy, Zap, RefreshCw, Save, RotateCcw, AlertTriangle, Lock, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { toast } from 'sonner';
import { api, type EASettings } from '@/services/api';
import { useTradingStore } from '@/store/tradingStore';

type FieldType = 'number' | 'toggle' | 'text' | 'select';
interface FieldDef {
  key: keyof EASettings;
  label: string;
  type: FieldType;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

// v5.1.0: Identity (EARole / MasterAccountId) is now derived from copy pairs and is NOT editable here.
// IncludeHistory & MaxHistoryDays are locked ON in EA — removed from form.
// EnablePriceAlerts is locked ON in EA — shown as read-only indicator below.
const SECTIONS: { title: string; icon: any; fields: FieldDef[] }[] = [
  {
    title: 'Copy Trading',
    icon: Copy,
    fields: [
      { key: 'LotMultiplier', label: 'Lot multiplier', type: 'number', min: 0.01, step: 0.01 },
      { key: 'UseFixedLot', label: 'Use fixed lot', type: 'toggle' },
      { key: 'FixedLotSize', label: 'Fixed lot size', type: 'number', min: 0.01, step: 0.01 },
      { key: 'CopyStopLoss', label: 'Copy stop loss', type: 'toggle' },
      { key: 'CopyTakeProfit', label: 'Copy take profit', type: 'toggle' },
    ],
  },
  {
    title: 'Risk Management',
    icon: Shield,
    fields: [
      { key: 'EnableRiskManager', label: 'Enable risk manager', type: 'toggle' },
      { key: 'MaxLotSize', label: 'Max lot size', type: 'number', min: 0.01, step: 0.01 },
      { key: 'MaxOpenTrades', label: 'Max open trades', type: 'number', min: 1, step: 1 },
      { key: 'MaxDrawdownPct', label: 'Max drawdown %', type: 'number', min: 0, max: 100, step: 0.5 },
      { key: 'MaxDailyLossPct', label: 'Max daily loss %', type: 'number', min: 0, max: 100, step: 0.5 },
      { key: 'EquityProtectionPct', label: 'Equity protection %', type: 'number', min: 0, max: 100, step: 0.5 },
      { key: 'AutoResumeDaily', label: 'Auto-resume daily', type: 'toggle' },
    ],
  },
  {
    title: 'Session Filters',
    icon: Clock,
    fields: [
      { key: 'FilterBySession', label: 'Filter by session', type: 'toggle' },
      { key: 'TradeAsia', label: 'Trade Asia', type: 'toggle' },
      { key: 'TradeLondon', label: 'Trade London', type: 'toggle' },
      { key: 'TradeNewYork', label: 'Trade New York', type: 'toggle' },
      { key: 'TradeOverlap', label: 'Trade Overlap', type: 'toggle' },
    ],
  },
  {
    title: 'Execution & Alerts',
    icon: Zap,
    fields: [
      { key: 'SlippagePoints', label: 'Slippage (points)', type: 'number', min: 0, step: 1 },
      { key: 'MagicNumberBase', label: 'Magic number base', type: 'number', min: 0, step: 1 },
      { key: 'EnablePushNotifications', label: 'MT5 push notifications', type: 'toggle' },
      { key: 'EnablePCAlerts', label: 'PC pop-up alerts', type: 'toggle' },
    ],
  },
];

const ADVANCED_FIELDS: FieldDef[] = [
  { key: 'LivePushIntervalMs', label: 'Live push (ms)', type: 'number', min: 50, step: 10, hint: 'Internal' },
  { key: 'StatusPushIntervalMs', label: 'Status push (ms)', type: 'number', min: 500, step: 100, hint: 'Internal' },
  { key: 'StaticPushIntervalMs', label: 'Static push (ms)', type: 'number', min: 1000, step: 500, hint: 'Internal' },
  { key: 'CommandPollMs', label: 'Command poll (ms)', type: 'number', min: 50, step: 10, hint: 'Internal' },
  { key: 'MaxRetries', label: 'Max retries', type: 'number', min: 0, step: 1, hint: 'Internal' },
  { key: 'RetryDelayMs', label: 'Retry delay (ms)', type: 'number', min: 0, step: 50, hint: 'Internal' },
  { key: 'AlertReloadMs', label: 'Alert reload (ms)', type: 'number', min: 500, step: 100, hint: 'Internal' },
];

export function EASettingsPanel() {
  const accounts = useTradingStore((s) => s.accounts);
  const activeAccountId = useTradingStore((s) => s.activeAccountId);

  const [defaults, setDefaults] = useState<EASettings | null>(null);
  const [settings, setSettings] = useState<EASettings>({});
  const [original, setOriginal] = useState<EASettings>({});
  const [isDefault, setIsDefault] = useState(false);
  const [lastFetch, setLastFetch] = useState<number | undefined>();
  const [savedAt, setSavedAt] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load defaults once
  useEffect(() => {
    api.settings.defaults()
      .then((r) => setDefaults(r.settings))
      .catch(() => { /* server may not yet expose endpoint */ });
  }, []);

  // Load per-account settings whenever active account changes
  const loadSettings = async (id: string) => {
    setLoading(true);
    try {
      const r = await api.settings.get(id);
      setSettings(r.settings || {});
      setOriginal(r.settings || {});
      setIsDefault(!!r.isDefault);
      setLastFetch(r.lastSettingsFetch);
      setSavedAt(r.savedAt);
    } catch (e: any) {
      toast.error('Failed to load EA settings', { description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeAccountId) return;
    loadSettings(activeAccountId);
  }, [activeAccountId]);

  // Refresh on live SETTINGS_UPDATED for this account
  useEffect(() => {
    const onUpdated = (e: Event) => {
      const ce = e as CustomEvent<{ accountId: string; settings: EASettings }>;
      if (ce.detail?.accountId !== activeAccountId) return;
      if (ce.detail.settings) {
        setSettings(ce.detail.settings);
        setOriginal(ce.detail.settings);
        setSavedAt(Date.now());
      }
    };
    const onReloaded = (e: Event) => {
      const ce = e as CustomEvent<{ accountId: string; success: boolean }>;
      if (ce.detail?.accountId !== activeAccountId) return;
      setLastFetch(Date.now());
    };
    window.addEventListener('tvp:settings-updated', onUpdated);
    window.addEventListener('tvp:settings-reloaded', onReloaded);
    return () => {
      window.removeEventListener('tvp:settings-updated', onUpdated);
      window.removeEventListener('tvp:settings-reloaded', onReloaded);
    };
  }, [activeAccountId]);

  const isDirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(original), [settings, original]);

  const handleChange = (key: keyof EASettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!activeAccountId) return;
    setSaving(true);
    try {
      // Strip locked / removed fields client-side as well (server also strips them, but keep payload clean).
      const payload: Partial<EASettings> = { ...settings };
      delete (payload as any).IncludeHistory;
      delete (payload as any).MaxHistoryDays;
      delete (payload as any).EARole;
      delete (payload as any).MasterAccountId;
      delete (payload as any).EnablePriceAlerts;
      const r = await api.settings.save(activeAccountId, payload);
      setSettings(r.settings || settings);
      setOriginal(r.settings || settings);
      setSavedAt(Date.now());
      setIsDefault(false);
      toast.success('Settings queued for EA', { description: 'EA will reload within ~100 ms' });
    } catch (e: any) {
      toast.error('Save failed', { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!activeAccountId) return;
    if (!confirm('Reset this account to factory defaults? The per-account override file will be deleted.')) return;
    setSaving(true);
    try {
      const r = await api.settings.reset(activeAccountId);
      setSettings(r.settings || {});
      setOriginal(r.settings || {});
      setIsDefault(true);
      toast.success('Reset to defaults', { description: 'EA is reloading…' });
    } catch (e: any) {
      toast.error('Reset failed', { description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => setSettings(original);

  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const fmtTime = (t?: number) => (t ? new Date(t).toLocaleTimeString() : '—');
  const role = (settings.EARole as string) || 'STANDALONE';
  const masterId = settings.MasterAccountId || '';

  if (!activeAccountId) {
    return (
      <div className="glass-card p-6 text-sm text-muted-foreground">
        Select an account to view its EA settings.
      </div>
    );
  }

  const renderField = (f: FieldDef) => {
    const val = (settings[f.key] ?? defaults?.[f.key]) as any;
    return (
      <div key={String(f.key)} className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm">{f.label}</div>
          {f.hint && <div className="text-[11px] text-muted-foreground">{f.hint}</div>}
        </div>
        {f.type === 'toggle' ? (
          <button
            onClick={() => handleChange(f.key, !val)}
            className={`shrink-0 w-10 h-5 rounded-full transition-colors relative ${val ? 'bg-primary' : 'bg-secondary'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-foreground absolute top-0.5 transition-all ${val ? 'left-5' : 'left-0.5'}`} />
          </button>
        ) : f.type === 'select' ? (
          <select
            value={val ?? ''}
            onChange={(e) => handleChange(f.key, e.target.value)}
            className="bg-secondary/50 rounded-lg px-3 py-1.5 text-sm border border-border/50 focus:outline-none focus:border-primary/50"
          >
            {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : f.type === 'number' ? (
          <input
            type="number"
            min={f.min}
            max={f.max}
            step={f.step}
            value={val ?? ''}
            onChange={(e) => handleChange(f.key, e.target.value === '' ? undefined : Number(e.target.value))}
            className="w-28 text-right bg-secondary/50 rounded-lg px-3 py-1.5 text-sm font-mono border border-border/50 text-foreground focus:outline-none focus:border-primary/50"
          />
        ) : (
          <input
            type="text"
            value={val ?? ''}
            onChange={(e) => handleChange(f.key, e.target.value)}
            className="w-40 bg-secondary/50 rounded-lg px-3 py-1.5 text-sm font-mono border border-border/50 text-foreground focus:outline-none focus:border-primary/50"
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">EA Remote Configuration</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
                v5.1.0
              </span>
              {isDefault && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
                  using defaults
                </span>
              )}
              {isDirty && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                  unsaved
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeAccount?.alias || activeAccountId} • last EA fetch {fmtTime(lastFetch)} • saved {fmtTime(savedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => loadSettings(activeAccountId)}
              disabled={loading || saving}
              className="px-3 py-2 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              onClick={handleRevert}
              disabled={!isDirty || saving}
              className="px-3 py-2 rounded-lg bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 inline-flex items-center gap-1.5 disabled:opacity-30"
            >
              Discard
            </button>
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-3 py-2 rounded-lg border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save & push to EA'}
            </button>
          </div>
        </div>
        {!defaults && (
          <div className="mt-3 flex items-start gap-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg p-3">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Default settings are still loading.
              Saved account settings remain available once this account is connected.
            </span>
          </div>
        )}
      </motion.div>

      {/* Locked / server-managed indicators */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <Lock className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">Locked in EA v5.1.0</h3>
            <p className="text-xs text-muted-foreground">These values are enforced by the EA and cannot be changed.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/40">
            <span>EA Role</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">{role}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/40">
            <span>Master Account</span>
            <span className="font-mono text-xs text-muted-foreground">{masterId || '—'}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/40">
            <span>Trade history</span>
            <span className="text-xs text-success">Always ON · unlimited</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/40">
            <span>Price alerts</span>
            <span className="text-xs text-success">Always ON</span>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Role and Master Account are derived from the <strong>Copy Pairs</strong> page. Add or remove a pair there to change them.</span>
        </div>
      </motion.div>

      {/* Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {SECTIONS.map((section, si) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: si * 0.04 }}
            className="glass-card p-4 sm:p-6"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <section.icon className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold">{section.title}</h3>
            </div>
            <div className="space-y-4">
              {section.fields.map(renderField)}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Advanced — operator-only timing & retry */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 sm:p-6">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold">Advanced — Internal Timing</h3>
              <p className="text-xs text-muted-foreground">Operator-only. Changes take effect within the next poll cycle.</p>
            </div>
          </div>
          {showAdvanced ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showAdvanced && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {ADVANCED_FIELDS.map(renderField)}
          </div>
        )}
      </motion.div>
    </div>
  );
}
