import { useEffect, useState } from 'react';
import { Copy, Gift, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api, type ReferralSummary } from '@/services/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function ReferralInviteCard() {
  const { user, signInWithGoogle } = useAuth();
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setSummary(await api.referrals.me());
    } catch (error: any) {
      toast.error(error?.message || 'Could not load invite link');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const copyInvite = async () => {
    if (!summary?.link) return;
    try {
      await navigator.clipboard.writeText(summary.link);
      toast.success('Invite link copied');
    } catch {
      toast.error('Could not copy invite link');
    }
  };

  return (
    <div className="glass-card overflow-hidden p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Gift className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight">Invite traders. Earn free premium time.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every successful signup through your link adds {summary?.bonusDays || 7} free days to your ForexAnalyzer Pro access.
            </p>
          </div>
        </div>

        {user ? (
          <div className="flex flex-col gap-2 sm:min-w-[22rem]">
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2">
              <span className="truncate font-mono text-xs text-muted-foreground">
                {summary?.link || 'Creating your invite link...'}
              </span>
              <Button size="sm" variant="secondary" onClick={copyInvite} disabled={!summary?.link}>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
              <Button size="icon" variant="ghost" onClick={() => void load()} disabled={loading} title="Refresh referrals">
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span>
                {summary?.referrals.length || 0} successful referral{summary?.referrals.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        ) : (
          <Button onClick={() => void signInWithGoogle()} className="lg:self-center">
            Sign in to get invite link
          </Button>
        )}
      </div>

      {user && summary?.referrals?.length ? (
        <div className="mt-4 grid gap-2 border-t border-border/40 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {summary.referrals.slice(0, 6).map((referral) => (
            <div key={referral.id} className="rounded-lg bg-secondary/20 p-3">
              <p className="truncate text-sm font-semibold">
                {referral.referredUser?.name || referral.referredUser?.email || 'New trader'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                +{referral.awardedDays} days · {new Date(referral.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
