import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Copy, Trash2, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, type ShareExpiry, type ShareLinkRecord } from '@/services/api';
import { shareLinks } from '@/lib/shareLinks';

interface Props {
  accountId: string;
  accountAlias: string;
  open: boolean;
  onClose: () => void;
}

export function ShareLinkDialog({ accountId, accountAlias, open, onClose }: Props) {
  const [expiry, setExpiry] = useState<ShareExpiry>('7d');
  const [items, setItems] = useState<ShareLinkRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

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

  if (!open) return null;

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await api.share.create({ accountId, expiry, label: accountAlias });
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
    <div className="fixed inset-0 z-[10000] bg-background/80 backdrop-blur-sm flex items-start justify-center p-4 pt-6 sm:pt-8" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-border/60">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" /> Share dashboard
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Anyone with this read-only link can view analytics, calendar data and open trades for{' '}
              <span className="text-foreground font-mono">{accountAlias}</span>.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close share dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-auto">
          <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs text-primary">
            Links are stored on the server, so they work in other browsers until they expire or you revoke them.
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1.5">Expiry</label>
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value as ShareExpiry)}
                className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm border border-border/50 focus:outline-none focus:border-primary/50"
              >
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
                <option value="never">Never expires</option>
              </select>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Create link
            </button>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Existing links ({items.length})</h4>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading links
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center rounded-lg bg-secondary/20">No links yet.</p>
            ) : (
              <div className="space-y-2">
                {items.map((l) => {
                  const expired = l.expiresAt && new Date(l.expiresAt).getTime() <= Date.now();
                  return (
                    <div key={l.token} className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg border border-border/30">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs truncate">{shareLinks.buildUrl(l.token)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {expired ? (
                            <span className="text-destructive">Expired</span>
                          ) : l.expiresAt ? (
                            `Expires ${new Date(l.expiresAt).toLocaleString()}`
                          ) : (
                            'Never expires'
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCopy(l.token)}
                        disabled={!!expired}
                        title="Copy link"
                        className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRevoke(l.token)}
                        title="Revoke link"
                        className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
