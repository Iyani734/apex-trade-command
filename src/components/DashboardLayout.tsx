import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ExternalLink, LifeBuoy, Lock } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { TopBar } from '@/components/TopBar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { applyAccountsInit, useWebSocket } from '@/hooks/useWebSocket';
import { useMockData, mockMode } from '@/hooks/useMockData';
import { JournalPromptModal } from '@/components/JournalPromptModal';
import { TrialNotice } from '@/components/TrialNotice';
import { UXFeedbackPrompt } from '@/components/UXFeedbackPrompt';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { useAuth } from '@/lib/auth';
import { api } from '@/services/api';
import { useTradingStore } from '@/store/tradingStore';
import { PAID_EA_URL } from '@/lib/trial';

const isExpiredTrialOpenPath = (pathname: string) =>
  pathname === '/dashboard' ||
  pathname === '/pricing' ||
  pathname === '/connect' ||
  pathname === '/accounts' ||
  pathname === '/settings' ||
  pathname.startsWith('/support');

function LockedFeatureNotice() {
  const { license } = useAuth();
  const location = useLocation();
  const featureName = location.pathname
    .replace(/^\/+/, '')
    .split('/')[0]
    .replace(/-/g, ' ') || 'this page';

  return (
    <div className="mx-auto flex min-h-[calc(100svh-7rem)] w-full max-w-3xl items-center justify-center px-2 py-8">
      <div className="w-full rounded-2xl border border-primary/25 bg-card p-6 shadow-2xl sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-mono uppercase tracking-[0.22em] text-primary">Paid access required</p>
            <h1 className="mt-3 text-2xl font-bold text-foreground">Upgrade to access {featureName}</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Your free trial has ended. Dashboard, Accounts, Settings, Pricing, and Support stay open so you can reconnect with the paid EA, upgrade your plan, or ask us to help you finish setup.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <a
                href={license?.paidEaUrl || PAID_EA_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Get paid EA
                <ExternalLink className="h-4 w-4" />
              </a>
              <Link
                to="/connect"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-secondary/50 px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                Connect paid version
              </Link>
              <Link
                to="/support"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/35 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-100 hover:bg-sky-400/15"
              >
                <LifeBuoy className="h-4 w-4" />
                Get help
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveDataLoader() {
  useWebSocket();
  const { user, loading } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (loading || !userId) return;
    let disposed = false;
    const timer = window.setTimeout(() => {
      if (disposed || useTradingStore.getState().accounts.length > 0) return;
      api.accounts.list()
        .then((snapshot) => {
          if (!disposed) applyAccountsInit(snapshot);
        })
        .catch((error) => {
          console.warn('[Accounts] Could not restore saved accounts', error);
        });
    }, 1200);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [loading, userId]);

  return null;
}
function MockDataLoader() {
  useMockData();
  return null;
}

export default function DashboardLayout() {
  const isMock = mockMode.isEnabled();
  const { license } = useAuth();
  const location = useLocation();
  const lockedByTrial = !isMock && Boolean(license?.dashboardOnly && !isExpiredTrialOpenPath(location.pathname));
  useActivityTracker();

  return (
    <SidebarProvider>
      <div className="flex h-svh min-h-svh w-full overflow-hidden">
        {isMock ? <MockDataLoader /> : <LiveDataLoader />}
        <AppSidebar />
        <div className="flex h-svh min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6">
            {lockedByTrial ? <LockedFeatureNotice /> : <Outlet />}
          </main>
        </div>
        <JournalPromptModal />
        <TrialNotice />
        <UXFeedbackPrompt />
      </div>
    </SidebarProvider>
  );
}
