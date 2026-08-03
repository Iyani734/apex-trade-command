import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  Database,
  Eye,
  Flame,
  MessageSquareText,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, type AdminAccountInsight, type AdminInsightsResponse, type AdminUserInsight, type FeedbackResponse } from '@/services/api';
import { cn } from '@/lib/utils';

const money = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);
};

const compactNumber = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
};

const pct = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0%';
  return `${n.toFixed(1)}%`;
};

const shortDate = (value?: string | null) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const environmentClass = (value: string) => {
  if (value === 'live') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300';
  if (value === 'demo') return 'border-sky-400/40 bg-sky-500/10 text-sky-300';
  return 'border-slate-400/30 bg-slate-500/10 text-slate-300';
};

type AccountEnvironmentFilter = 'all' | 'live' | 'demo' | 'unknown';

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = 'cyan',
}: {
  title: string;
  value: string | number;
  detail?: string;
  icon: typeof Activity;
  tone?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
}) {
  const tones = {
    cyan: 'from-cyan-500/18 to-sky-500/5 text-cyan-300 border-cyan-400/20',
    emerald: 'from-emerald-500/18 to-teal-500/5 text-emerald-300 border-emerald-400/20',
    amber: 'from-amber-500/18 to-orange-500/5 text-amber-300 border-amber-400/20',
    rose: 'from-rose-500/18 to-red-500/5 text-rose-300 border-rose-400/20',
    violet: 'from-violet-500/18 to-fuchsia-500/5 text-violet-300 border-violet-400/20',
  };

  return (
    <div className={cn('min-w-0 rounded-xl border bg-gradient-to-br p-3 shadow-sm sm:p-4', tones[tone])}>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 min-w-0 truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">{value}</p>
      {detail ? <p className="mt-1 min-w-0 truncate text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function AccountStrip({ account }: { account: AdminAccountInsight }) {
  const initialDepositLabel = account.initialDepositSource === 'ea' ? 'First deposit' : 'Est. start';
  const initialDepositValue = account.initialDeposit ?? account.estimatedInitialDeposit;

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border/50 bg-background/45 p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-base font-semibold">{account.accountName || account.accountId}</p>
            <Badge variant="outline" className={cn('uppercase', environmentClass(account.environment))}>
              {account.environment || 'unknown'}
            </Badge>
            <Badge variant="secondary" className="uppercase">{account.role || 'standalone'}</Badge>
            <Badge variant="outline" className={account.online ? 'border-emerald-400/40 text-emerald-300' : 'border-rose-400/40 text-rose-300'}>
              {account.online ? 'Online' : 'Offline'}
            </Badge>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {account.accountId} - {account.broker || 'Unknown broker'}{account.server ? ` - ${account.server}` : ''}
          </p>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2 text-sm sm:grid-cols-3 xl:grid-cols-6 lg:min-w-[48rem]">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{initialDepositLabel}</p>
            <p className="font-mono font-semibold">{money(initialDepositValue)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Total deposits</p>
            <p className="font-mono font-semibold">{money(account.totalDeposits)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Balance</p>
            <p className="font-mono font-semibold">{money(account.balance)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Equity</p>
            <p className="font-mono font-semibold">{money(account.equity)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Running P/L</p>
            <p className={cn('font-mono font-semibold', Number(account.runningProfit) >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
              {money(account.runningProfit)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Trades</p>
            <p className="font-mono font-semibold">{account.openTrades} open / {account.closedTrades} closed</p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-7">
        <div className="rounded-lg bg-secondary/20 p-3">
          <p className="text-xs text-muted-foreground">Win rate</p>
          <p className="font-semibold">{pct(account.winRate)}</p>
        </div>
        <div className="rounded-lg bg-secondary/20 p-3">
          <p className="text-xs text-muted-foreground">Profit factor</p>
          <p className="font-semibold">{compactNumber(account.profitFactor)}</p>
        </div>
        <div className="rounded-lg bg-secondary/20 p-3">
          <p className="text-xs text-muted-foreground">Max drawdown</p>
          <p className="font-semibold">{pct(account.maxDrawdown)}</p>
        </div>
        <div className="rounded-lg bg-secondary/20 p-3">
          <p className="text-xs text-muted-foreground">Realized P/L</p>
          <p className={cn('truncate font-semibold', Number(account.realizedProfit) >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
            {money(account.realizedProfit)}
          </p>
        </div>
        <div className="rounded-lg bg-secondary/20 p-3">
          <p className="text-xs text-muted-foreground">Withdrawals</p>
          <p className="truncate font-semibold">{money(account.totalWithdrawals)}</p>
        </div>
        <div className="rounded-lg bg-secondary/20 p-3">
          <p className="text-xs text-muted-foreground">Best symbol</p>
          <p className="truncate font-semibold">{account.bestSymbol?.symbol || 'No data'}</p>
        </div>
        <div className="rounded-lg bg-secondary/20 p-3">
          <p className="text-xs text-muted-foreground">Last seen</p>
          <p className="font-semibold">{shortDate(account.lastSeenAt)}</p>
        </div>
      </div>
    </div>
  );
}

function FeedbackRow({ item }: { item: FeedbackResponse }) {
  const note = String(item.responses?.friction || item.responses?.missing || item.responses?.goal || 'No written note');
  return (
    <div className="rounded-xl border border-border/45 bg-background/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{item.name || item.email || 'Visitor'}</p>
          <p className="truncate text-xs text-muted-foreground">{item.pagePath || 'Unknown page'} - {shortDate(item.createdAt)}</p>
        </div>
        {item.score ? (
          <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300">
            {item.score}/10
          </span>
        ) : null}
      </div>
      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

function valueAsNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function withRecomputedMetrics(insights: AdminInsightsResponse): AdminInsightsResponse {
  const accounts = insights.accounts || [];
  const liveAccounts = accounts.filter((account) => account.environment === 'live');
  const demoAccounts = accounts.filter((account) => account.environment === 'demo');
  return {
    ...insights,
    metrics: {
      ...insights.metrics,
      connectedAccounts: accounts.length,
      liveAccounts: liveAccounts.length,
      demoAccounts: demoAccounts.length,
      onlineAccounts: accounts.filter((account) => account.online).length,
      totalTrackedBalance: accounts.reduce((sum, account) => sum + valueAsNumber(account.balance), 0),
      totalTrackedEquity: accounts.reduce((sum, account) => sum + valueAsNumber(account.equity), 0),
      liveTrackedBalance: liveAccounts.reduce((sum, account) => sum + valueAsNumber(account.balance), 0),
      demoTrackedBalance: demoAccounts.reduce((sum, account) => sum + valueAsNumber(account.balance), 0),
      liveTrackedEquity: liveAccounts.reduce((sum, account) => sum + valueAsNumber(account.equity), 0),
      demoTrackedEquity: demoAccounts.reduce((sum, account) => sum + valueAsNumber(account.equity), 0),
    },
  };
}

function updateUserAccountList(user: AdminUserInsight, account: AdminAccountInsight): AdminUserInsight {
  const accounts = user.accounts.slice();
  const idx = accounts.findIndex((row) => row.accountId === account.accountId);
  if (idx >= 0) accounts[idx] = { ...accounts[idx], ...account };
  else accounts.unshift(account);
  return {
    ...user,
    accounts,
    accountCount: accounts.length,
    totalBalance: accounts.reduce((sum, row) => sum + valueAsNumber(row.balance), 0),
    totalEquity: accounts.reduce((sum, row) => sum + valueAsNumber(row.equity), 0),
  };
}

function applyLiveAccountUpdate(
  current: AdminInsightsResponse | null,
  account: AdminAccountInsight & { userId?: string; userName?: string; userEmail?: string },
  userId?: string,
): AdminInsightsResponse | null {
  if (!current || !account?.accountId) return current;
  const accountOwnerId = userId || account.userId || '';
  const accounts = current.accounts.slice();
  const idx = accounts.findIndex((row) => row.accountId === account.accountId);
  if (idx >= 0) accounts[idx] = { ...accounts[idx], ...account };
  else accounts.unshift(account);

  const users = current.users.map((user) => (
    accountOwnerId && user.userId === accountOwnerId
      ? updateUserAccountList(user, account)
      : user
  ));

  return withRecomputedMetrics({
    ...current,
    generatedAt: new Date().toISOString(),
    accounts,
    users,
  });
}

function applyLiveAccountDelete(
  current: AdminInsightsResponse | null,
  accountId?: string,
  userId?: string,
): AdminInsightsResponse | null {
  if (!current || !accountId) return current;
  const accounts = current.accounts.filter((account) => account.accountId !== accountId);
  const users = current.users.map((user) => {
    if (userId && user.userId !== userId) return user;
    const nextAccounts = user.accounts.filter((account) => account.accountId !== accountId);
    return {
      ...user,
      accounts: nextAccounts,
      accountCount: nextAccounts.length,
      totalBalance: nextAccounts.reduce((sum, row) => sum + valueAsNumber(row.balance), 0),
      totalEquity: nextAccounts.reduce((sum, row) => sum + valueAsNumber(row.equity), 0),
    };
  });

  return withRecomputedMetrics({
    ...current,
    generatedAt: new Date().toISOString(),
    accounts,
    users,
  });
}

export function AdminInsightsPanel() {
  const [insights, setInsights] = useState<AdminInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [accountEnvironment, setAccountEnvironment] = useState<AccountEnvironmentFilter>('all');
  const [error, setError] = useState('');

  const load = async (refresh = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.support.admin.insights(refresh);
      setInsights(res);
      setSelectedUserId((current) => current || res.users[0]?.userId || '');
    } catch (err: any) {
      setError(err?.message || 'Could not load admin insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.eventName === 'ADMIN_ACCOUNT_DELETED') {
        setInsights((current) => applyLiveAccountDelete(current, detail.accountId, detail.userId));
        return;
      }
      if (detail.account) {
        setInsights((current) => applyLiveAccountUpdate(current, detail.account, detail.userId));
      }
    };
    window.addEventListener('fap:admin-insights-updated', handler);
    return () => window.removeEventListener('fap:admin-insights-updated', handler);
  }, []);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = insights?.users || [];
    if (!needle) return rows;
    return rows.filter((user) => [
      user.name,
      user.email,
      user.userId,
      user.mostUsedPage,
      ...user.accounts.map((account) => `${account.accountId} ${account.broker} ${account.accountName}`),
    ].join(' ').toLowerCase().includes(needle));
  }, [insights?.users, query]);

  const selectedUser: AdminUserInsight | null = useMemo(() => {
    if (!insights?.users.length) return null;
    return insights.users.find((user) => user.userId === selectedUserId) || filteredUsers[0] || insights.users[0];
  }, [filteredUsers, insights?.users, selectedUserId]);

  const accountEnvironmentCounts = useMemo(() => {
    const rows = insights?.accounts || [];
    return {
      all: rows.length,
      live: rows.filter((account) => account.environment === 'live').length,
      demo: rows.filter((account) => account.environment === 'demo').length,
      unknown: rows.filter((account) => !['live', 'demo'].includes(account.environment)).length,
    };
  }, [insights?.accounts]);

  const filteredAccounts = useMemo(() => {
    const rows = insights?.accounts || [];
    if (accountEnvironment === 'all') return rows;
    if (accountEnvironment === 'unknown') {
      return rows.filter((account) => !['live', 'demo'].includes(account.environment));
    }
    return rows.filter((account) => account.environment === accountEnvironment);
  }, [accountEnvironment, insights?.accounts]);

  const maxPageViews = Math.max(1, ...(insights?.pageUsage || []).map((page) => page.views));

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-3 shadow-xl shadow-black/10 backdrop-blur sm:space-y-5 sm:p-4 md:p-5">
      <div className="min-w-0 rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/18 via-background/70 to-emerald-500/10 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">Admin command center</p>
            <h2 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">Customer, account, and usage intelligence</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              See who opened the system today, which pages get used most, and inspect each trader account with live/demo status, balance, equity, performance, tickets, and feedback.
            </p>
          </div>
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => void load(true)} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh insights
          </Button>
        </div>
        {error ? (
          <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
        {!error && insights?.warnings?.length ? (
          <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            Some reporting data is still warming up: {insights.warnings.slice(0, 2).join(' | ')}
          </div>
        ) : null}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Open tickets"
          value={insights?.metrics.openTickets || 0}
          detail={`${insights?.metrics.urgentTickets || 0} urgent / ${insights?.metrics.solvedTickets || 0} solved`}
          icon={AlertTriangle}
          tone="amber"
        />
        <MetricCard title="Opened today" value={insights?.metrics.usersOpenedToday || 0} detail={`${insights?.metrics.pageViewsToday || 0} page views`} icon={Eye} tone="cyan" />
        <MetricCard title="Connected accounts" value={insights?.metrics.connectedAccounts || 0} detail={`${insights?.metrics.onlineAccounts || 0} online now`} icon={Database} tone="emerald" />
        <MetricCard
          title="Tracked balance"
          value={money(insights?.metrics.totalTrackedBalance)}
          detail={`Live ${money(insights?.metrics.liveTrackedBalance)} / Demo ${money(insights?.metrics.demoTrackedBalance)}`}
          icon={Wallet}
          tone="violet"
        />
      </div>

      <Tabs defaultValue="users" className="w-full min-w-0 space-y-4">
        <TabsList className="h-auto w-full max-w-full justify-start overflow-x-auto bg-secondary/30 p-1">
          <TabsTrigger value="users" className="shrink-0">Users</TabsTrigger>
          <TabsTrigger value="accounts" className="shrink-0">Accounts</TabsTrigger>
          <TabsTrigger value="pages" className="shrink-0">Page usage</TabsTrigger>
          <TabsTrigger value="feedback" className="shrink-0">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="grid min-w-0 gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
            <div className="min-w-0 overflow-hidden rounded-2xl border border-border/50 bg-background/35">
              <div className="border-b border-border/50 p-3">
                <div className="relative min-w-0">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users, email, account..." className="min-w-0 pl-9" />
                </div>
              </div>
              <div className="max-h-[52svh] overflow-y-auto overflow-x-hidden p-2 sm:max-h-[34rem]">
                {loading && !insights ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Loading user intelligence...</div>
                ) : null}
                {filteredUsers.map((user) => (
                  <button
                    key={user.userId}
                    onClick={() => setSelectedUserId(user.userId)}
                    className={cn(
                      'mb-2 w-full min-w-0 overflow-hidden rounded-xl border p-3 text-left transition hover:bg-secondary/35',
                      user.userId === selectedUser?.userId ? 'border-sky-400/50 bg-sky-500/10' : 'border-border/40 bg-secondary/10',
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email || user.userId}</p>
                      </div>
                      <Badge variant="outline" className="w-fit max-w-full shrink-0 capitalize">{user.licenseStatus}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                      <span className="min-w-0 truncate">{user.accountCount} account{user.accountCount === 1 ? '' : 's'}</span>
                      <span className="min-w-0 truncate">{user.pageViewsToday} views</span>
                      <span className="min-w-0 truncate">{user.streak?.currentStreak || 0} day streak</span>
                      <span className="min-w-0 truncate">{shortDate(user.lastSeenAt)}</span>
                    </div>
                  </button>
                ))}
                {!loading && filteredUsers.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No matching users found.</div>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-2xl border border-border/50 bg-background/35 p-3 sm:p-4">
              {selectedUser ? (
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="min-w-0 truncate text-lg font-bold sm:text-xl">{selectedUser.name}</h3>
                        <Badge variant="outline" className="capitalize">{selectedUser.licenseStatus}</Badge>
                        <Badge variant="secondary">{selectedUser.planMode}</Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{selectedUser.email || selectedUser.userId}</p>
                    </div>
                    <div className="grid min-w-0 grid-cols-1 gap-2 text-sm sm:grid-cols-2 xl:grid-cols-5">
                      <div className="rounded-lg bg-secondary/20 p-3">
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="font-semibold">{money(selectedUser.totalBalance)}</p>
                      </div>
                      <div className="rounded-lg bg-secondary/20 p-3">
                        <p className="text-xs text-muted-foreground">Equity</p>
                        <p className="font-semibold">{money(selectedUser.totalEquity)}</p>
                      </div>
                      <div className="rounded-lg bg-secondary/20 p-3">
                        <p className="text-xs text-muted-foreground">Page views</p>
                        <p className="font-semibold">{selectedUser.pageViewsToday}</p>
                      </div>
                      <div className="rounded-lg bg-secondary/20 p-3">
                        <p className="text-xs text-muted-foreground">Streak</p>
                        <p className="flex items-center gap-1 font-semibold">
                          <Flame className={cn('h-4 w-4', selectedUser.streak?.active ? 'fill-orange-400 text-orange-300' : 'text-muted-foreground')} />
                          {selectedUser.streak?.currentStreak || 0}d
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary/20 p-3">
                        <p className="text-xs text-muted-foreground">Tickets</p>
                        <p className="font-semibold">{selectedUser.openTickets + selectedUser.pendingTickets}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-border/40 bg-secondary/10 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-sky-300" /> Last activity</div>
                      <p className="mt-2 text-sm text-muted-foreground">{shortDate(selectedUser.lastSeenAt)}</p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-secondary/10 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold"><BarChart3 className="h-4 w-4 text-emerald-300" /> Most used page</div>
                      <p className="mt-2 truncate text-sm text-muted-foreground">{selectedUser.mostUsedPage || 'No page activity yet'}</p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-secondary/10 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold"><MessageSquareText className="h-4 w-4 text-amber-300" /> Feedback</div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {selectedUser.feedbackCount} response{selectedUser.feedbackCount === 1 ? '' : 's'}
                        {selectedUser.latestFeedbackScore ? ` - latest ${selectedUser.latestFeedbackScore}/10` : ''}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-secondary/10 p-3 md:col-span-3">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Flame className={cn('h-4 w-4', selectedUser.streak?.active ? 'fill-orange-400 text-orange-300' : 'text-muted-foreground')} />
                        Trading streak
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground break-words">
                        Current {selectedUser.streak?.currentStreak || 0} day{(selectedUser.streak?.currentStreak || 0) === 1 ? '' : 's'} -
                        Longest {selectedUser.streak?.longestStreak || 0} -
                        Restores left {selectedUser.streak?.restoresRemaining ?? 0} -
                        Timezone {selectedUser.streak?.timezone || 'Not detected yet'}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-3">
                    <h4 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Linked accounts</h4>
                    {selectedUser.accounts.length ? selectedUser.accounts.map((account) => (
                      <AccountStrip key={account.accountId} account={account} />
                    )) : (
                      <div className="rounded-xl border border-border/45 bg-secondary/10 p-8 text-center text-sm text-muted-foreground">
                        This user has not connected a trading account yet.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
                  Select a user to inspect account performance.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="accounts" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'live', 'demo', 'unknown'] as AccountEnvironmentFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAccountEnvironment(value)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                  accountEnvironment === value
                    ? 'border-sky-300/60 bg-sky-400/15 text-sky-100'
                    : 'border-border/50 bg-secondary/20 text-muted-foreground hover:bg-secondary/40',
                )}
              >
                {value === 'all' ? 'All accounts' : value === 'live' ? 'Real' : value} ({accountEnvironmentCounts[value]})
              </button>
            ))}
          </div>

          {filteredAccounts.map((account) => (
            <AccountStrip key={`${account.userId}-${account.accountId}`} account={account} />
          ))}
          {!loading && insights && filteredAccounts.length === 0 ? (
            <div className="rounded-xl border border-border/45 bg-secondary/10 p-8 text-center text-sm text-muted-foreground">
              No {accountEnvironment === 'all' ? 'connected' : accountEnvironment} accounts have been recorded yet.
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="pages" className="min-w-0 space-y-4">
          <div className="grid min-w-0 gap-3 md:grid-cols-3">
            <MetricCard title="Page views today" value={insights?.metrics.pageViewsToday || 0} detail="Signed-in dashboard usage" icon={Eye} tone="cyan" />
            <MetricCard title="Active last hour" value={insights?.metrics.activeLastHour || 0} detail="Unique signed-in users" icon={Activity} tone="emerald" />
            <MetricCard title="Most used page" value={insights?.metrics.mostUsedPage || 'None'} detail="Highest traffic today" icon={TrendingUp} tone="violet" />
          </div>
          <div className="min-w-0 overflow-hidden rounded-2xl border border-border/50 bg-background/35 p-3 sm:p-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Most used pages today</h3>
            <div className="mt-4 space-y-3">
              {(insights?.pageUsage || []).map((page) => (
                <div key={page.path}>
                  <div className="mb-1 flex items-center justify-between gap-4 text-sm">
                    <span className="truncate font-medium">{page.path}</span>
                    <span className="font-mono text-muted-foreground">{page.views}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary/40">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300" style={{ width: `${Math.max(6, (page.views / maxPageViews) * 100)}%` }} />
                  </div>
                </div>
              ))}
              {!loading && insights && insights.pageUsage.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No page activity has been recorded today.</div>
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="min-w-0 space-y-4">
          <div className="grid min-w-0 gap-3 md:grid-cols-3">
            <MetricCard title="Responses" value={insights?.metrics.feedbackCount || 0} detail="Collected product feedback" icon={MessageSquareText} tone="amber" />
            <MetricCard title="Average score" value={insights?.metrics.averageFeedbackScore ? `${insights.metrics.averageFeedbackScore.toFixed(1)}/10` : 'No score'} detail="Recent satisfaction" icon={ShieldCheck} tone="emerald" />
            <MetricCard title="Total users" value={insights?.metrics.totalUsers || 0} detail="Profiles known to the system" icon={Users} tone="violet" />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {(insights?.recentFeedback || []).map((item) => (
              <FeedbackRow key={item.id} item={item} />
            ))}
          </div>
          {!loading && insights && insights.recentFeedback.length === 0 ? (
            <div className="rounded-xl border border-border/45 bg-secondary/10 p-8 text-center text-sm text-muted-foreground">
              No feedback responses yet.
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
