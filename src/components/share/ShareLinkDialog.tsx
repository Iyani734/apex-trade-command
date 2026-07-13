import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  CalendarDays,
  Check,
  Copy,
  History,
  LineChart,
  Loader2,
  Lock,
  PieChart,
  Share2,
  ShieldCheck,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, type ShareExpiry, type ShareLinkRecord, type ShareSection } from '@/services/api';
import { shareLinks } from '@/lib/shareLinks';

interface Props {
  accountId: string;
  accountAlias: string;
  open: boolean;
  onClose: () => void;
}

const SHARE_OPTIONS: Array<{
  id: ShareSection;
  title: string;
  description: string;
  icon: typeof LineChart;
}> = [
  {
    id: 'overview',
    title: 'Account overview',
    description: 'Balance, equity, win rate, profit factor, and current status.',
    icon: WalletCards,
  },
  {
    id: 'analytics',
    title: 'Analytics charts',
    description: 'Equity curve and session performance charts.',
    icon: LineChart,
  },
  {
    id: 'risk_metrics',
    title: 'Risk metrics',
    description: 'Drawdown, margin, account type, leverage, exposure, and risk health.',
    icon: ShieldCheck,
  },
  {
    id: 'trade_breakdown',
    title: 'Trade analytics',
    description: 'Symbol performance, session results, win rate, average win/loss, and trade behavior.',
    icon: PieChart,
  },
  {
    id: 'calendar',
    title: 'Trading calendar',
    description: 'Daily closed-trade heatmap and month view.',
    icon: CalendarDays,
  },
  {
    id: 'open_positions',
    title: 'Open positions',
    description: 'Current symbols, type, lots, prices, and running PnL.',
    icon: BarChart3,
  },
  {
    id: 'closed_trades',
    title: 'Recent closed trades',
    description: 'Latest closed trade results from the shared snapshot.',
    icon: History,
  },
];

const DEFAULT_SECTIONS = SHARE_OPTIONS.map((option) => option.id);

export function ShareLinkDialog({ accountId, accountAlias, open, onClose }: Props) {
  const [expiry, setExpiry] = useState<ShareExpiry>('7d');
  const [sections, setSections] = useState<ShareSection[]>(DEFAULT_SECTIONS);
  const [items, setItems] = useState<ShareLinkRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const selectedCount = sections.length;
  const allSelected = selectedCount === SHARE_OPTIONS.length;

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.share.list(accountId);
      setItems(res.links);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not load share links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open, accountId]);

  const selectedSummary = useMemo(
    () => SHARE_OPTIONS.filter((option) => sections.includes(option.id)).map((option) => option.title).join(', '),
    [sections],
  );

  if (!open) return null;

  const toggleSection = (id: ShareSection) => {
    setSections((current) => {
      if (current.includes(id)) {
        const next = current.filter((item) => item !== id);
        return next.length ? next : current;
      }
      return [...current, id];
    });
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await api.share.create({
        accountId,
        expiry,
        label: accountAlias,
        sections,
      });
      setItems((current) => [res.link, ...current]);
      await navigator.clipboard.writeText(shareLinks.buildUrl(res.link.token)).catch(() => {});
      toast.success('Share link created and copied');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not create share link');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (token: string) => {
    await navigator.clipboard.writeText(shareLinks.buildUrl(token)).catch(() => {});
    toast.success('Link copied');
  };

  const handleRevoke = async (token: string) => {
    if (!confirm('Revoke this link? It will stop working immediately.')) return;
    try {
      await api.share.revoke(token);
      setItems((current) => current.filter((l) => l.token !== token));
      toast.success('Share link revoked');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not revoke share link');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-md sm:p-5" onClick={onClose}>
      <div
        className="flex max-h-[calc(100svh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-cyan-300/30 bg-gradient-to-br from-sky-950 via-blue-950 to-slate-950 shadow-2xl shadow-sky-950/60 sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-cyan-200/15 p-4 sm:gap-4 sm:p-6">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cyan-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100">
              <Share2 className="h-3.5 w-3.5" />
              Private share builder
            </div>
            <h3 className="break-words text-xl font-bold leading-tight text-white sm:text-2xl">Share {accountAlias}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-sky-100/75">
              Create a read-only performance link and choose exactly what the receiver can see. New links are private by default and only work for people who have the URL.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-sky-100/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close share dialog"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="grid min-h-0 gap-4 overflow-y-auto p-3 sm:p-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-200/15 bg-white/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-100">Choose shared sections</h4>
                  <p className="mt-1 text-xs text-sky-100/60">{selectedCount} selected</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSections(allSelected ? ['overview', 'analytics', 'calendar'] : DEFAULT_SECTIONS)}
                  className="rounded-lg border border-cyan-200/20 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10"
                >
                  {allSelected ? 'Use essentials' : 'Select all'}
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SHARE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = sections.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleSection(option.id)}
                      className={`min-h-36 rounded-xl border p-3 text-left transition-colors ${
                        selected
                          ? 'border-cyan-300/50 bg-cyan-300/15 text-white'
                          : 'border-cyan-200/10 bg-slate-950/25 text-sky-100/70 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-100">
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                          selected ? 'border-cyan-200 bg-cyan-200 text-slate-950' : 'border-cyan-200/25'
                        }`}>
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </div>
                      <div className="mt-3 break-words text-base font-semibold leading-snug">{option.title}</div>
                      <p className="mt-1 text-xs leading-5 text-sky-100/65">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-cyan-200/15 bg-slate-950/35 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-sky-100/60">Link expiry</label>
                <select
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value as ShareExpiry)}
                  className="w-full rounded-xl border border-cyan-200/15 bg-slate-950/60 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/60"
                >
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="never">Never expires</option>
                </select>
              </div>
              <button
                onClick={handleCreate}
                disabled={creating || selectedCount === 0}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                Create and copy link
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-200/15 bg-white/10 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-100">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Privacy</h4>
                  <p className="mt-1 text-sm leading-6 text-sky-100/70">
                    Your account remains private. This creates a controlled read-only link, not a public profile.
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-cyan-200/15 bg-slate-950/35 p-3 text-xs leading-5 text-sky-100/65">
                <span className="font-semibold text-cyan-100">Shared now:</span> {selectedSummary || 'Nothing selected'}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-200/15 bg-white/10 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-100">Existing links</h4>
                <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100">{items.length}</span>
              </div>
              {loading ? (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-950/30 py-8 text-sm text-sky-100/60">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading links
                </div>
              ) : items.length === 0 ? (
                <p className="rounded-xl bg-slate-950/30 px-3 py-8 text-center text-sm text-sky-100/60">No links yet.</p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {items.map((link) => {
                    const expired = link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now();
                    return (
                      <div key={link.token} className="rounded-xl border border-cyan-200/10 bg-slate-950/35 p-3">
                        <div className="min-w-0 truncate font-mono text-xs text-sky-100/75">{shareLinks.buildUrl(link.token)}</div>
                        <div className="mt-1 text-[11px] text-sky-100/45">
                          {expired ? 'Expired' : link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleString()}` : 'Never expires'}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleCopy(link.token)}
                            disabled={!!expired}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/20 disabled:opacity-40"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </button>
                          <button
                            onClick={() => handleRevoke(link.token)}
                            className="inline-flex items-center justify-center rounded-lg bg-red-500/10 px-3 py-2 text-red-200 hover:bg-red-500/20"
                            title="Revoke link"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
