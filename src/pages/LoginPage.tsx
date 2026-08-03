import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, ArrowRight, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { mockMode } from '@/hooks/useMockData';
import { readTrialDeviceLock } from '@/lib/trial';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, signInWithGoogle, signInWithEmailMagicLink } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [deviceLock] = useState(() => readTrialDeviceLock());
  const lockedEmail = deviceLock?.email?.trim().toLowerCase() || '';
  const [email, setEmail] = useState(() => lockedEmail);
  const [magicLinkSentTo, setMagicLinkSentTo] = useState('');

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [loading, navigate, user]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      mockMode.setEnabled(false);
      await signInWithGoogle();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
      setSigningIn(false);
    }
  };

  const handleEmailSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error('Enter your email address first.');
      return;
    }
    if (lockedEmail && normalizedEmail !== lockedEmail) {
      toast.error(`This device is linked to ${lockedEmail}. Use that email to continue.`);
      return;
    }

    setSendingMagicLink(true);
    setMagicLinkSentTo('');
    try {
      await signInWithEmailMagicLink(normalizedEmail);
      setMagicLinkSentTo(normalizedEmail);
      toast.success('Magic link sent. Check your email to continue.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not send the magic link. Please try again.');
    } finally {
      setSendingMagicLink(false);
    }
  };

  const handleExploreDemo = () => {
    mockMode.setEnabled(true);
    navigate('/dashboard');
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Blurred decorative dashboard preview behind the login card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 select-none"
        style={{ filter: 'blur(8px)', opacity: 0.7, transform: 'scale(1.02)' }}
      >
        <FakeDashboardBackdrop />
      </div>
      {/* Color glow + dim overlay so the card pops */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 30% 20%, hsl(var(--primary) / 0.18), transparent 60%),' +
            'radial-gradient(50% 45% at 80% 80%, hsl(var(--accent) / 0.18), transparent 60%),' +
            'linear-gradient(to bottom, hsl(var(--background) / 0.55), hsl(var(--background) / 0.85))',
        }}
      />

      {/* Login card */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <div
            className="rounded-2xl border border-border shadow-[0_30px_80px_-15px_hsl(var(--primary)/0.45)] overflow-hidden"
            style={{ backgroundColor: 'hsl(var(--card))' }}
          >
            {/* Header */}
            <div className="px-6 sm:px-8 pt-7 pb-5 border-b border-border/60 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4 ring-1 ring-primary/30">
                <TrendingUp className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">ForexAnalyzer Pro</h1>
              <p className="text-muted-foreground mt-1.5 text-sm">
                {lockedEmail ? 'This device is linked to one trial email' : 'Sign in securely with Google or an email magic link'}
              </p>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-8 space-y-5">
              {lockedEmail ? (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-muted-foreground">
                  This browser is already linked to <span className="font-mono font-semibold text-amber-100">{lockedEmail}</span>. For security, continue with an email magic link to that address.
                </div>
              ) : (
                <>
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={loading || signingIn}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition disabled:opacity-60"
                  >
                    {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    Continue with Google
                  </button>
                  <div className="relative flex items-center py-1">
                    <div className="h-px flex-1 bg-border/70" />
                    <span className="px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      or
                    </span>
                    <div className="h-px flex-1 bg-border/70" />
                  </div>
                </>
              )}
              <form onSubmit={handleEmailSignIn} className="space-y-3">
                <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Email magic link
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  readOnly={Boolean(lockedEmail)}
                  disabled={loading || signingIn || sendingMagicLink}
                  className="w-full rounded-lg border border-border bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={loading || signingIn || sendingMagicLink}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-secondary/70 text-foreground font-semibold hover:bg-secondary transition disabled:opacity-60"
                >
                  {sendingMagicLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  {lockedEmail ? 'Send magic link to original email' : 'Send magic link'}
                </button>
                {magicLinkSentTo ? (
                  <p className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-xs leading-relaxed text-primary">
                    Check {magicLinkSentTo} for your secure login link. You can close this page after opening the email.
                  </p>
                ) : null}
              </form>
              <button
                onClick={handleExploreDemo}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-secondary/60 text-foreground font-semibold hover:bg-secondary transition"
              >
                <Eye className="w-4 h-4" />
                Explore the dashboard first
              </button>
              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                Each signed-in account sees only the MetaTrader accounts linked to that user.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function handleLogout() {
  void supabase.auth.signOut();
}

/**
 * Purely visual mock of the Analytics page (KPI grid, equity curve area,
 * bar charts, scatter) used as a blurred backdrop for the login card.
 * Non-interactive (pointer-events disabled on the wrapper).
 */
function FakeDashboardBackdrop() {
  // Smooth equity curve points
  const equity = [10, 14, 12, 18, 22, 19, 26, 30, 28, 34, 38, 36, 44, 48, 52, 58, 62, 60, 68, 74, 78, 84, 88, 95];
  const sessionBars = [55, 78, 92, 64];
  const symbolBars = [82, 67, 54, 41, 33, 24];
  const weekdayBars = [45, 70, 58, 88, 72];

  return (
    <div className="w-full h-full p-6 lg:p-10 grid grid-cols-12 gap-4">
      {/* Sidebar mock */}
      <div className="hidden md:flex col-span-2 rounded-2xl bg-card/70 border border-border/40 flex-col gap-3 p-4">
        <div className="h-6 w-28 rounded bg-primary/30" />
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-4 rounded bg-secondary/60" />
        ))}
      </div>

      {/* Main analytics mock */}
      <div className="col-span-12 md:col-span-10 flex flex-col gap-4">
        {/* Filter row */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-40 rounded-lg bg-card/70 border border-border/40" />
          <div className="h-8 w-32 rounded-lg bg-card/70 border border-border/40" />
          <div className="h-8 w-24 rounded-lg bg-primary/30 ml-auto" />
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { v: 'bg-success/50', w: 'w-28' },
            { v: 'bg-primary/50', w: 'w-24' },
            { v: 'bg-accent/50', w: 'w-20' },
            { v: 'bg-warning/50', w: 'w-24' },
          ].map((k, i) => (
            <div key={i} className="rounded-xl bg-card/70 border border-border/40 p-4">
              <div className="h-3 w-20 rounded bg-muted/60 mb-3" />
              <div className={`h-7 ${k.w} rounded ${k.v}`} />
              <div className="h-2 w-16 rounded bg-success/40 mt-3" />
            </div>
          ))}
        </div>

        {/* Equity curve area chart */}
        <div className="rounded-2xl bg-card/70 border border-border/40 p-5 h-48 relative overflow-hidden">
          <div className="h-3 w-32 rounded bg-muted/60 mb-2" />
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-32">
            <defs>
              <linearGradient id="lpGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`M0,${40 - equity[0] * 0.4} ${equity
                .map((v, i) => `L${(i / (equity.length - 1)) * 100},${40 - v * 0.4}`)
                .join(' ')} L100,40 L0,40 Z`}
              fill="url(#lpGrad)"
            />
            <path
              d={`M0,${40 - equity[0] * 0.4} ${equity
                .map((v, i) => `L${(i / (equity.length - 1)) * 100},${40 - v * 0.4}`)
                .join(' ')}`}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="0.6"
            />
          </svg>
        </div>

        {/* Two-column bar charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-card/70 border border-border/40 p-5 h-44 flex items-end gap-3">
            {sessionBars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md bg-gradient-to-t from-accent/70 to-primary/70"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="rounded-2xl bg-card/70 border border-border/40 p-5 h-44 flex items-end gap-2">
            {symbolBars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md bg-gradient-to-t from-primary/70 to-accent/70"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* Weekday bars */}
        <div className="rounded-2xl bg-card/70 border border-border/40 p-5 h-32 flex items-end gap-3">
          {weekdayBars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md bg-gradient-to-t from-success/70 to-primary/60"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
