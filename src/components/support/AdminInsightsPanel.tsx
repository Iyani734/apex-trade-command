import { useEffect, useMemo, useState } from 'react';
import { MessageSquareText, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, type AdminClientOverview, type FeedbackResponse } from '@/services/api';
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

export function AdminInsightsPanel() {
  const [users, setUsers] = useState<AdminClientOverview[]>([]);
  const [feedback, setFeedback] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const stats = useMemo(() => {
    const uniqueUsers = new Set(users.map((row) => row.user_id).filter(Boolean)).size;
    const accounts = users.filter((row) => row.account_id).length;
    const balance = users.reduce((sum, row) => sum + (Number(row.balance) || 0), 0);
    const recentFeedback = feedback.length;
    return { uniqueUsers, accounts, balance, recentFeedback };
  }, [feedback.length, users]);

  const load = async () => {
    setLoading(true);
    try {
      const [userRes, feedbackRes] = await Promise.all([
        api.support.admin.listUsers(),
        api.support.admin.listFeedback(),
      ]);
      setUsers(userRes.users || []);
      setFeedback(feedbackRes.feedback || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="glass-card space-y-4 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Admin Insights
          </h2>
          <p className="text-sm text-muted-foreground">
            Customer accounts, balances, trial status, and recent product feedback.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh insights
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Users</p>
          <p className="mt-1 text-2xl font-bold">{stats.uniqueUsers}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Accounts</p>
          <p className="mt-1 text-2xl font-bold">{stats.accounts}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Tracked Balance</p>
          <p className="mt-1 text-2xl font-bold">{money(stats.balance)}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Feedback</p>
          <p className="mt-1 text-2xl font-bold">{stats.recentFeedback}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-border/40 bg-background/30">
          <div className="flex items-center gap-2 border-b border-border/40 p-3">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Recent Customers</h3>
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {users.slice(0, 12).map((row, index) => (
              <div key={`${row.user_id}-${row.account_id || index}`} className="mb-2 rounded-md bg-secondary/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{row.full_name || row.nickname || row.email || row.user_id}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.email || 'No email'} · {row.license_status || 'trial'}</p>
                  </div>
                  <span className="shrink-0 rounded bg-primary/10 px-2 py-1 text-xs font-mono text-primary">
                    {money(row.balance)}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  {row.account_id || 'No MT account'} · {row.broker || 'Unknown broker'} · {shortDate(row.snapshot_updated_at)}
                </p>
              </div>
            ))}
            {!loading && users.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No customer rows yet.</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border/40 bg-background/30">
          <div className="flex items-center gap-2 border-b border-border/40 p-3">
            <MessageSquareText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Recent Feedback</h3>
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {feedback.slice(0, 12).map((item) => (
              <div key={item.id} className="mb-2 rounded-md bg-secondary/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.name || item.email || 'Guest visitor'}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.pagePath || 'Unknown page'} · {shortDate(item.createdAt)}</p>
                  </div>
                  {item.score ? (
                    <span className="shrink-0 rounded bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                      {item.score}/10
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {String(item.responses?.friction || item.responses?.missing || item.responses?.goal || 'No written note')}
                </p>
              </div>
            ))}
            {!loading && feedback.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No feedback responses yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
