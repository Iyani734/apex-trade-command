import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useTradingStore } from '@/store/tradingStore';
import { ChevronDown, Pencil, Check, Share2, X, LogIn, LogOut, User as UserIcon, Clock, Gift, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ShareLinkDialog } from '@/components/share/ShareLinkDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { userPrefs } from '@/lib/userPrefs';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { ReferralInviteCard } from '@/components/ReferralInviteCard';
import { api, type TradingStreak } from '@/services/api';

const HEADER_BROKER_CYCLE_MS = 10_000; // rotate every 10 seconds
const HEADER_BROKERS = [
  {
    id: 'icmarkets',
    name: 'IC Markets',
    href: 'https://www.icmarkets.com/global/en/?camp=82798',
    src: '/icmarkets2.png',
    imageClassName: 'h-14 sm:h-16',
  },
  {
    id: 'exness',
    name: 'Exness',
    href: 'https://one.exnessonelink.com/a/fhc3i952hn',
    src: '/exness5.jpg',
    imageClassName: 'h-12 sm:h-14',
  },
] as const;

function HeaderBrokerSpot() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = window.setInterval(() => {
      // Fade out, swap, fade in
      setVisible(false);
      const swap = window.setTimeout(() => {
        setIndex((i) => (i + 1) % HEADER_BROKERS.length);
        setVisible(true);
      }, 400);
      return () => window.clearTimeout(swap);
    }, HEADER_BROKER_CYCLE_MS);
    return () => window.clearInterval(cycle);
  }, []);

  const broker = HEADER_BROKERS[index];

  return (
    <div className="hidden min-w-0 flex-1 items-center justify-center gap-3 px-2 self-stretch lg:flex">
      <span className="shrink-0 text-sm font-extrabold uppercase tracking-[0.18em] text-white">
        Powered by
      </span>
      <a
        href={broker.href}
        target="_blank"
        rel="noreferrer"
        title={broker.name}
        className="group flex self-stretch items-center overflow-hidden rounded-md px-2 transition-colors hover:bg-secondary/40"
      >
        <img
          key={broker.id}
          src={broker.src}
          alt={broker.name}
          referrerPolicy="no-referrer"
          style={{ transition: 'opacity 0.4s ease', opacity: visible ? 1 : 0 }}
          className="h-10 min-w-0 max-w-[240px] object-contain drop-shadow py-1"
        />
      </a>
    </div>
  );
}

/*
 * Top broker advert is intentionally parked for now.
 * Keep this block for later when the header placement is re-enabled.
const BROKER_ADS = [
  {
    id: 'icmarkets',
    href: 'https://icmarkets.com/?camp=82798',
    alt: 'IC Markets',
    banners: [
      {
        src: 'https://promo.icmarkets.com/Logos/2021/400x110/BAN_ICM_green_400x110.png',
        alt: 'IC Markets',
      },
    ],
  },
  {
    id: 'exness',
    href: 'https://one.exnessonelink.com/intl/en/a/fhc3i952hn',
    alt: 'Exness',
    banners: [
      {
        src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_GLOBAL_GOOGLE_C1_PRODUCTSUP_C2_T1_INSTANTW_SMOOTHEST_T2_PERFORMANCE_D-3-13_STATIC_980x250.jpg',
        alt: 'Exness instant withdrawals',
      },
      {
        src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_Take_Control_970x250px.png',
        alt: 'Exness take control',
      },
      {
        src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_Take_control_980x250.png',
        alt: 'Exness take control',
      },
      {
        src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_Choose_Better_Forex_Conditions_v2728x90px.png',
        alt: 'Exness better forex conditions',
      },
      {
        src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_Trade_Gold_v2_728x90px.png',
        alt: 'Exness trade gold',
      },
      {
        src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_GLOBAL_GOOGLE_C1_PRODUCTSUP_C2_T1_INSTANTW_SMOOTHEST_T2_PERFORMANCE_D-3-13_STATIC_320x100.jpg',
        alt: 'Exness instant withdrawals',
      },
      {
        src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_GLOBAL_GOOGLE_C1_PRODUCTSUP_C2_T1_INSTANTW_SMOOTHEST_T2_PERFORMANCE_D-3-13_STATIC_320x50.jpg',
        alt: 'Exness instant withdrawals',
      },
      {
        src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_Choose_Better_Forex_Conditions_v2320x50px.png',
        alt: 'Exness better forex conditions',
      },
      {
        src: 'https://d3dpet1g0ty5ed.cloudfront.net/EN_Trade_Gold_v2_320x50px.png',
        alt: 'Exness trade gold',
      },
    ],
  },
] as const;

const BROKER_AD_REFRESH_MS = 4 * 60 * 60 * 1000;

function pickSessionBrokerAd() {
  try {
    const raw = sessionStorage.getItem('tvp.sessionBrokerAd');
    let parsed: { id?: string; expiresAt?: number } | null = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw) as { id?: string; expiresAt?: number };
      } catch {
        parsed = { id: raw, expiresAt: 0 };
      }
    }
    const existing = BROKER_ADS.find((ad) => ad.id === parsed?.id);
    if (existing && (parsed?.expiresAt || 0) > Date.now()) return existing;

    const next = BROKER_ADS[Math.floor(Math.random() * BROKER_ADS.length)];
    sessionStorage.setItem('tvp.sessionBrokerAd', JSON.stringify({
      id: next.id,
      expiresAt: Date.now() + BROKER_AD_REFRESH_MS,
    }));
    return next;
  } catch {
    return BROKER_ADS[Math.floor(Math.random() * BROKER_ADS.length)];
  }
}
*/

function formatUsage(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function useTotalUsageTime(scope: string) {
  const key = `tvp.totalUsageMs.${scope || 'guest'}`;
  const read = () => {
    try { return Number(localStorage.getItem(key) || 0); } catch { return 0; }
  };
  const elapsedRef = useRef(read());
  const lastTickRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(elapsedRef.current);

  useEffect(() => {
    elapsedRef.current = read();
    setElapsed(elapsedRef.current);
    lastTickRef.current = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      elapsedRef.current += now - lastTickRef.current;
      lastTickRef.current = now;
      setElapsed(elapsedRef.current);
      try { localStorage.setItem(key, String(Math.round(elapsedRef.current))); } catch { /* ignore */ }
    }, 1000);
    return () => {
      window.clearInterval(timer);
      try { localStorage.setItem(key, String(Math.round(elapsedRef.current))); } catch { /* ignore */ }
    };
  }, [key]);

  return formatUsage(elapsed);
}

function UserAvatar({ user, size = 'sm' }: { user: ReturnType<typeof userPrefs.getUser>; size?: 'sm' | 'md' }) {
  const className = size === 'md' ? 'w-10 h-10 text-sm' : 'w-7 h-7 text-xs';
  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt=""
        referrerPolicy="no-referrer"
        className={`${className} rounded-full object-cover border border-border/50`}
      />
    );
  }
  return (
    <div className={`${className} rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold`}>
      {user?.nickname.charAt(0).toUpperCase()}
    </div>
  );
}

function StreakIndicator() {
  const { user } = useAuth();
  const [streak, setStreak] = useState<TradingStreak | null>(null);
  const [activeSessionMs, setActiveSessionMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const celebratedRef = useRef<string>('');
  const activeSessionMsRef = useRef(0);
  const activationSentRef = useRef<string>('');

  const applyStreakResult = (next: TradingStreak | null) => {
    setStreak(next);

    const milestone = next?.milestoneAchieved;
    if (milestone) {
      const key = `${user?.id}:${milestone.days}:${next.today}`;
      if (celebratedRef.current !== key) {
        celebratedRef.current = key;
        toast.success(milestone.title, {
          description: milestone.message,
          duration: 8000,
        });
      }
    } else if (next?.restored && next.restoresUsed) {
      toast.success('Streak restored', {
        description: `We used ${next.restoresUsed} restore${next.restoresUsed === 1 ? '' : 's'} to keep your trading streak alive.`,
      });
    } else if (next?.lost) {
      toast.warning('Streak restarted', {
        description: 'The monthly restore limit was used up, so a new consistency streak starts today.',
      });
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setStreak(null);
      setActiveSessionMs(0);
      activeSessionMsRef.current = 0;
      return;
    }

    let cancelled = false;
    activeSessionMsRef.current = 0;
    setActiveSessionMs(0);
    activationSentRef.current = '';
    setLoading(true);
    void api.streak.checkIn({
      pagePath: `${window.location.pathname}${window.location.search || ''}`,
      source: 'site_open',
      activeSessionMs: 0,
    })
      .then(({ streak: next }) => {
        if (cancelled) return;
        applyStreakResult(next);
      })
      .catch((error) => {
        console.warn('[Streak] Could not update streak', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !streak || streak.active || streak.marketPaused) return;

    const requiredMs = Math.max(1, Number(streak.requiredActiveMs || 3 * 60 * 1000));
    let lastTick = Date.now();
    let cancelled = false;

    const activate = () => {
      const key = `${user.id}:${streak.today}`;
      if (activationSentRef.current === key) return;
      activationSentRef.current = key;
      setLoading(true);
      void api.streak.checkIn({
        pagePath: `${window.location.pathname}${window.location.search || ''}`,
        source: 'engaged_session',
        activeSessionMs: activeSessionMsRef.current,
      })
        .then(({ streak: next }) => {
          if (!cancelled) applyStreakResult(next);
        })
        .catch((error) => {
          activationSentRef.current = '';
          console.warn('[Streak] Could not activate streak', error);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    const timer = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === 'visible') {
        activeSessionMsRef.current += now - lastTick;
        setActiveSessionMs(activeSessionMsRef.current);
      }
      lastTick = now;

      if (activeSessionMsRef.current >= requiredMs) activate();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [streak?.active, streak?.marketPaused, streak?.requiredActiveMs, streak?.today, user?.id]);

  if (!user?.id) return null;

  const active = Boolean(streak?.active);
  const marketPaused = Boolean(streak?.marketPaused);
  const current = streak?.currentStreak ?? 0;
  const restores = streak?.restoresRemaining ?? 0;
  const requiredMs = Math.max(1, Number(streak?.requiredActiveMs || 3 * 60 * 1000));
  const progressMs = Math.max(activeSessionMs, Number(streak?.activeSessionMs || 0));
  const remainingMs = Math.max(0, requiredMs - progressMs);
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  const title = marketPaused
    ? 'Markets are closed today, so your streak is paused.'
    : active
      ? `Streak active: ${current} trading day${current === 1 ? '' : 's'}. ${restores} restore${restores === 1 ? '' : 's'} left this month.`
      : `Stay active for ${remainingMinutes} more minute${remainingMinutes === 1 ? '' : 's'} to light today's streak. ${restores} restore${restores === 1 ? '' : 's'} left this month.`;

  return (
    <button
      type="button"
      title={title}
      onClick={() => {
        void api.streak.me().then(({ streak: next }) => setStreak(next)).catch(() => undefined);
      }}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
        active
          ? 'bg-orange-500/15 text-orange-200 ring-1 ring-orange-400/25'
          : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      <Flame className={`h-4 w-4 ${active ? 'fill-orange-300 text-orange-300 animate-pulse' : 'text-muted-foreground/70'}`} />
      <span className="font-mono">{loading && !streak ? '...' : current}</span>
      <span className="hidden xl:inline text-[10px] opacity-80">{active ? 'streak' : `${remainingMinutes}m`}</span>
    </button>
  );
}

export function TopBar() {
  const accounts = useTradingStore((s) => s.accounts);
  const activeId = useTradingStore((s) => s.activeAccountId);
  const eaStatus = useTradingStore((s) => s.eaStatus);
  const setActive = useTradingStore((s) => s.setActiveAccount);
  const renameAccount = useTradingStore((s) => s.renameAccount);
  const active = accounts.find((a) => a.id === activeId);
  const navigate = useNavigate();
  const { signOut, user: authUser } = useAuth();

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteAutoDismiss, setInviteAutoDismiss] = useState(false);
  const [trialNoticeOpen, setTrialNoticeOpen] = useState(false);
  const [user, setUser] = useState(() => userPrefs.getUser());
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const usageTime = useTotalUsageTime(user?.email || 'guest');
  const activeOnline = active?.status === 'ONLINE';
  const displayUser = authUser ? user : null;

  // Refresh local user when switcher closes (in case settings changed)
  useEffect(() => {
    if (!switcherOpen) setUser(authUser ? userPrefs.getUser() : null);
  }, [authUser, switcherOpen]);

  useEffect(() => {
    setUser(authUser ? userPrefs.getUser() : null);
  }, [authUser?.email, authUser?.id]);

  useEffect(() => {
    const onTrialNotice = (event: Event) => {
      setTrialNoticeOpen(Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open));
    };
    window.addEventListener('forexAnalyzer:trialNoticeVisibility', onTrialNotice);
    return () => window.removeEventListener('forexAnalyzer:trialNoticeVisibility', onTrialNotice);
  }, []);

  useEffect(() => {
    const userKey = authUser?.id || authUser?.email || '';
    if (!userKey) return;
    if (trialNoticeOpen) return;
    const storageKey = `forexAnalyzer.inviteAwarenessShown.${userKey}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, '1');
    } catch {
      // Session storage can be unavailable in private browsing; the popup still auto-dismisses.
    }

    setInviteAutoDismiss(true);
    setInviteOpen(true);
  }, [authUser?.email, authUser?.id, trialNoticeOpen]);

  useEffect(() => {
    if (!trialNoticeOpen || !inviteAutoDismiss) return;
    setInviteOpen(false);
    setInviteAutoDismiss(false);
  }, [inviteAutoDismiss, trialNoticeOpen]);

  useEffect(() => {
    if (!inviteOpen || !inviteAutoDismiss) return;
    const timer = window.setTimeout(() => {
      setInviteOpen(false);
      setInviteAutoDismiss(false);
    }, 20_000);
    return () => window.clearTimeout(timer);
  }, [inviteAutoDismiss, inviteOpen]);

  /*
   * Header broker advert rotation is disabled while ads are moved into the sidebar.
  useEffect(() => {
    const timer = window.setInterval(() => setBrokerAd(pickSessionBrokerAd()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setBannerIndex(0);
    if (brokerAd.banners.length < 2) return;
    const timer = window.setInterval(() => {
      setBannerIndex((current) => (current + 1) % brokerAd.banners.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [brokerAd]);
  */

  const startEdit = () => {
    setDraft(active?.alias || '');
    setEditing(true);
  };
  const saveEdit = () => {
    if (active && draft.trim()) renameAccount(active.id, draft.trim());
    setEditing(false);
  };

  const handleLogout = async () => {
    await signOut();
    userPrefs.clearUser();
    setUser(null);
    setUserMenuOpen(false);
    toast.success('Signed out');
    navigate('/dashboard');
  };

  return (
    <header className="sticky top-0 z-40 h-14 shrink-0 border-b border-border/50 flex flex-col px-2 sm:px-4 glass-card rounded-none border-x-0 border-t-0 overflow-hidden">
      <div className="w-full h-full flex items-center gap-2 sm:gap-4">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground shrink-0" />

        {/* Account switcher trigger */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-secondary">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                className="bg-transparent text-sm font-medium outline-none w-24 sm:w-32"
              />
              <button onClick={saveEdit} className="text-success hover:opacity-80">
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSwitcherOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors min-w-0 max-w-[48vw] sm:max-w-[42vw] lg:max-w-none"
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${activeOnline ? 'bg-success' : 'bg-destructive'}`} />
              <span className="text-sm font-medium truncate">{active?.alias || 'No Account'}</span>
              <span className="hidden md:inline text-xs text-muted-foreground font-mono">{active?.id}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            </button>
          )}

          {active && !editing && (
            <button
              onClick={startEdit}
              title="Rename account"
              className="hidden sm:inline-flex p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>

        <HeaderBrokerSpot />

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {active && (
          <button
            onClick={() => setShareOpen(true)}
            title="Share read-only dashboard"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/50 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        )}
        <StreakIndicator />
        <button
          onClick={() => {
            setInviteAutoDismiss(false);
            setInviteOpen(true);
          }}
          title="Invite traders"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium transition-colors"
        >
          <Gift className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Invite</span>
        </button>

        <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>Used:</span>
          <span className="font-mono text-foreground">{usageTime}</span>
        </div>

        {eaStatus && (
          <div className="hidden md:flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${activeOnline ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
            <span className="text-xs font-mono">
              {eaStatus.tradingPaused ? (
                <span className="text-warning">PAUSED</span>
              ) : activeOnline ? (
                <span className="text-success">ONLINE</span>
              ) : (
                <span className="text-destructive">OFFLINE</span>
              )}
            </span>
          </div>
        )}

        {/* User chip */}
        <div className="relative">
          {displayUser ? (
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2 pl-1 pr-2 sm:pr-3 py-1 rounded-full bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <UserAvatar user={displayUser} />
              <span className="hidden sm:inline text-xs font-medium max-w-[120px] truncate">{displayUser.nickname}</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
            >
              <LogIn className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sign in</span>
            </button>
          )}

          {displayUser && userMenuOpen && createPortal(
            <>
              <div
                className="fixed inset-0 z-[9998]"
                onClick={() => setUserMenuOpen(false)}
              />
              <div
                className="fixed right-3 sm:right-4 top-14 w-64 border border-border rounded-xl shadow-2xl p-3 z-[9999]"
                style={{ backgroundColor: 'hsl(225 30% 10%)', backdropFilter: 'none' }}
              >
                <div className="flex items-center gap-3 px-1 pb-3 border-b border-border/50">
                  <UserAvatar user={displayUser} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{displayUser.nickname}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{displayUser.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                  className="w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-secondary/50 text-sm"
                >
                  <UserIcon className="w-4 h-4 text-muted-foreground" /> Account settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-destructive/10 text-destructive text-sm"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            </>,
            document.body
          )}
        </div>
      </div>
      </div>

      {/*
      <a
        href={brokerAd.href}
        target="_blank"
        rel="noreferrer"
        className="group relative flex w-full flex-1 min-h-[132px] sm:min-h-[172px] lg:min-h-[232px] xl:min-h-[252px] items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-secondary/20 hover:border-primary/60 transition-colors"
        title={brokerAd.alt}
      >
        <div key={banner.src} className="flex h-full w-full animate-in fade-in slide-in-from-right-4 duration-700 items-center justify-center">
          <img
            src={banner.src}
            alt={banner.alt}
            referrerPolicy="no-referrer"
            className="max-h-[122px] sm:max-h-[162px] lg:max-h-[222px] xl:max-h-[242px] w-full max-w-[1080px] object-contain"
          />
        </div>
        {brokerAd.banners.length > 1 && (
          <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1.5">
            {brokerAd.banners.map((item, index) => (
              <span
                key={item.src}
                className={`h-1.5 rounded-full transition-all ${index === bannerIndex ? 'w-5 bg-primary' : 'w-1.5 bg-foreground/35'}`}
              />
            ))}
          </div>
        )}
      </a>
      */}

      {/* Centered account switcher modal */}
      <Dialog open={switcherOpen} onOpenChange={setSwitcherOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 bg-card border-border">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50">
            <DialogTitle className="text-base">Switch account</DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-auto p-3 space-y-1.5">
            {accounts.length === 0 && (
              <div className="px-3 py-10 text-sm text-muted-foreground text-center">
                No accounts connected yet.
                <button
                  onClick={() => { setSwitcherOpen(false); navigate('/connect'); }}
                  className="block mx-auto mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                >
                  Connect an account
                </button>
              </div>
            )}
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => { setActive(a.id); setSwitcherOpen(false); }}
                className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition-colors border ${
                  a.id === activeId
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'border-transparent hover:bg-secondary/60 hover:border-border/50'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${a.status === 'ONLINE' ? 'bg-success' : 'bg-destructive'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{a.alias}</div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    {a.id} • {a.broker} • {a.role}
                  </div>
                </div>
                <div className="text-xs sm:text-sm font-mono font-semibold text-right shrink-0">
                  ${a.balance.toLocaleString()}
                </div>
              </button>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between gap-2">
            <button
              onClick={() => { setSwitcherOpen(false); navigate('/connect'); }}
              className="text-xs text-primary hover:underline"
            >
              + Connect another account
            </button>
            <button
              onClick={() => setSwitcherOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 text-xs flex items-center gap-1.5"
            >
              <X className="w-3 h-3" /> Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {active && (
        <ShareLinkDialog
          accountId={active.id}
          accountAlias={active.alias}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
      {inviteOpen && createPortal(
        <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[9998] sm:left-auto sm:right-5 sm:w-[32rem] sm:max-w-[calc(100vw-2rem)]">
          <div className="pointer-events-auto relative">
            <button
              type="button"
              onClick={() => {
                setInviteOpen(false);
                setInviteAutoDismiss(false);
              }}
              aria-label="Close invite popup"
              className="absolute right-2.5 top-2.5 z-10 rounded-xl p-2 text-sky-100/80 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <ReferralInviteCard />
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
