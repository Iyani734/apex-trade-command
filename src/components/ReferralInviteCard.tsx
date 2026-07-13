import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Gift, RefreshCw, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api, type ReferralSummary } from '@/services/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function ReferralInviteCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [referralsOpen, setReferralsOpen] = useState(false);
  const referrals = summary?.referrals || [];
  const referralCount = referrals.length;

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
    <div className="overflow-hidden rounded-2xl border border-sky-300/30 bg-gradient-to-br from-sky-950 via-blue-950 to-slate-950 shadow-2xl shadow-sky-950/50">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3 pr-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-200 ring-1 ring-cyan-200/20">
            <Gift className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex rounded-full bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              Referral bonus
            </div>
            <h2 className="text-lg font-bold leading-tight text-white">
              Invite traders and earn free premium time
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-sky-100/80">
              Every successful signup through your link adds {summary?.bonusDays || 7} free days to your ForexAnalyzer Pro access.
            </p>
          </div>
        </div>

        {user ? (
          <div className="space-y-3">
            <div className="grid min-w-0 gap-2 rounded-xl border border-cyan-200/20 bg-slate-950/35 p-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <span className="min-w-0 truncate px-1 font-mono text-xs text-sky-100/75">
                {summary?.link || 'Creating your invite link...'}
              </span>
              <Button
                size="sm"
                onClick={copyInvite}
                disabled={!summary?.link}
                className="w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200 sm:w-auto"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => void load()}
                disabled={loading}
                title="Refresh referrals"
                className="hidden text-sky-100 hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-cyan-200/15 bg-white/10 p-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-sky-100/60">
                    <Users className="h-3.5 w-3.5 text-cyan-200" />
                    Referrals
                  </div>
                  <div className="mt-1 text-2xl font-bold text-white">{referralCount}</div>
                </div>
                <div className="rounded-xl border border-cyan-200/15 bg-white/10 p-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-sky-100/60">Earned</div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    {referralCount * (summary?.bonusDays || 7)}
                    <span className="ml-1 text-sm font-semibold text-sky-100/60">days</span>
                  </div>
                </div>
              </div>

              {referralCount > 0 && (
                <button
                  type="button"
                  onClick={() => setReferralsOpen((open) => !open)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-300/20 sm:w-auto"
                >
                  {referralsOpen ? 'Hide referrals' : 'View referrals'}
                  {referralsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        ) : (
          <Button onClick={() => navigate('/login')} className="w-full bg-cyan-300 text-slate-950 hover:bg-cyan-200">
            Sign in to get invite link
          </Button>
        )}

        {user && referralCount > 0 && referralsOpen ? (
          <div className="grid max-h-44 gap-2 overflow-y-auto border-t border-cyan-200/15 pt-3 sm:grid-cols-2">
            {referrals.map((referral) => (
              <div key={referral.id} className="rounded-lg bg-white/10 p-3">
                <p className="truncate text-sm font-semibold text-white">
                  {referral.referredUser?.name || referral.referredUser?.email || 'New trader'}
                </p>
                <p className="mt-1 text-xs text-sky-100/70">
                  +{referral.awardedDays} days - {new Date(referral.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
