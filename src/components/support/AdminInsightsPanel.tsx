import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  Database,
  Eye,
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
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0.00';
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
    <div className={cn('rounded-xl border bg-gradient-to-br p-4 shadow-sm', tones[tone])}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function AccountStrip({ account }: { account: AdminAccountInsight }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/45 p-4">
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
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[34rem]">
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
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5">
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

export function AdminInsightsPanel() {
  const [insights, setInsights] = useState<AdminInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.support.admin.insights();
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

  const maxPageViews = Math.max(1, ...(insights?.pageUsage || []).map((page) => page.views));

  return (
    <div className="space-y-5 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-xl shadow-black/10 backdrop-blur md:p-5">
      <div className="rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/18 via-background/70 to-emerald-500/10 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">Admin command center</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">Customer, account, and usage intelligence</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              See who opened the system today, which pages get used most, and inspect each trader account with live/demo status, balance, equity, performance, tickets, and feedback.
            </p>
          </div>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Opened today" value={insights?.metrics.usersOpenedToday || 0} detail={`${insights?.metrics.pageViewsToday || 0} page views`} icon={Eye} tone="cyan" />
        <MetricCard title="Connected accounts" value={insights?.metrics.connectedAccounts || 0} detail={`${insights?.metrics.onlineAccounts || 0} online now`} icon={Database} tone="emerald" />
        <MetricCard title="Tracked equity" value={money(insights?.metrics.totalTrackedEquity)} detail={`${insights?.metrics.liveAccounts || 0} live / ${insights?.metrics.demoAccounts || 0} demo`} icon={Wallet} tone="violet" />
        <MetricCard title="Support pressure" value={insights?.metrics.openTickets || 0} detail={`${insights?.metrics.urgentTickets || 0} urgent tickets`} icon={AlertTriangle} tone="amber" />
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="max-w-full justify-start overflow-x-auto bg-secondary/30">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="pages">Page usage</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
            <div className="rounded-2xl border border-border/50 bg-background/35">
              <div className="border-b border-border/50 p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users, email, account..." className="pl-9" />
                </div>
              </div>
              <div className="max-h-[34rem] overflow-y-auto p-2">
                {loading && !insights ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Loading user intelligence...</div>
                ) : null}
                {filteredUsers.map((user) => (
                  <button
                    key={user.userId}
                    onClick={() => setSelectedUserId(user.userId)}
                    className={cn(
                      'mb-2 w-full rounded-xl border p-3 text-left transition hover:bg-secondary/35',
                      user.userId === selectedUser?.userId ? 'border-sky-400/50 bg-sky-500/10' : 'border-border/40 bg-secondary/10',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email || user.userId}</p>
                      </div>
                      <Badge variant="outline" className="capitalize">{user.licenseStatus}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <span>{user.accountCount} account{user.accountCount === 1 ? '' : 's'}</span>
                      <span>{user.pageViewsToday} views</span>
                      <span>{shortDate(user.lastSeenAt)}</span>
                    </div>
                  </button>
                ))}
                {!loading && filteredUsers.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No matching users found.</div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-background/35 p-4">
              {selectedUser ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold">{selectedUser.name}</h3>
                        <Badge variant="outline" className="capitalize">{selectedUser.licenseStatus}</Badge>
                        <Badge variant="secondary">{selectedUser.planMode}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedUser.email || selectedUser.userId}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
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
                        <p className="text-xs text-muted-foreground">Tickets</p>
                        <p className="font-semibold">{selectedUser.openTickets + selectedUser.pendingTickets}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
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
                  </div>

                  <div className="space-y-3">
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

        <TabsContent value="accounts" className="space-y-3">
          {(insights?.accounts || []).map((account) => (
            <AccountStrip key={`${account.userId}-${account.accountId}`} account={account} />
          ))}
          {!loading && insights && insights.accounts.length === 0 ? (
            <div className="rounded-xl border border-border/45 bg-secondary/10 p-8 text-center text-sm text-muted-foreground">
              No connected accounts have been recorded yet.
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="pages" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard title="Page views today" value={insights?.metrics.pageViewsToday || 0} detail="Signed-in dashboard usage" icon={Eye} tone="cyan" />
            <MetricCard title="Active last hour" value={insights?.metrics.activeLastHour || 0} detail="Unique signed-in users" icon={Activity} tone="emerald" />
            <MetricCard title="Most used page" value={insights?.metrics.mostUsedPage || 'None'} detail="Highest traffic today" icon={TrendingUp} tone="violet" />
          </div>
          <div className="rounded-2xl border border-border/50 bg-background/35 p-4">
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

        <TabsContent value="feedback" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
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
