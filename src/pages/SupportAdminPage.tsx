import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Inbox, LifeBuoy, RefreshCw, Send, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api, type SupportCategory, type SupportMessage, type SupportPriority, type SupportStatus, type SupportTicket } from '@/services/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { AdminInsightsPanel } from '@/components/support/AdminInsightsPanel';

type FilterStatus = SupportStatus | 'all';
type FilterPriority = SupportPriority | 'all';
type FilterCategory = SupportCategory | 'all';

const categoryLabels: Record<SupportCategory, string> = {
  account_connection: 'Account connection',
  ea_api_key: 'EA API key',
  billing: 'Billing / subscription',
  trade_data: 'Trade data issue',
  copy_trading: 'Copy trading',
  alerts: 'Alerts',
  general: 'General question',
};

const priorityLabels: Record<SupportPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  urgent: 'Urgent',
};

const statusLabels: Record<SupportStatus, string> = {
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

const statusClass: Record<SupportStatus, string> = {
  open: 'bg-success/10 text-success border-success/30',
  pending: 'bg-warning/10 text-warning border-warning/30',
  resolved: 'bg-primary/10 text-primary border-primary/30',
  closed: 'bg-muted text-muted-foreground border-border',
};

const formatTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export default function SupportAdminPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTicketId = searchParams.get('ticketId');
  const { user, supportAgent, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [status, setStatus] = useState<FilterStatus>('all');
  const [priority, setPriority] = useState<FilterPriority>('all');
  const [category, setCategory] = useState<FilterCategory>('all');
  const [agentName, setAgentName] = useState('');
  const [reply, setReply] = useState('');
  const [replyStatus, setReplyStatus] = useState<SupportStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const ticketStats = useMemo(() => ({
    total: tickets.length,
    active: tickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'pending').length,
    urgent: tickets.filter((ticket) => ticket.priority === 'urgent').length,
    resolved: tickets.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed').length,
  }), [tickets]);

  const loadTickets = useCallback(async (quiet = false) => {
    if (!supportAgent) return;
    try {
      if (!quiet) setLoading(true);
      setAccessDenied(false);
      const res = await api.support.admin.listTickets({ status, priority, category });
      setAgentName(res.agent.displayName);
      setTickets(res.tickets);
      setSelectedId((current) => {
        if (current && res.tickets.some((ticket) => ticket.id === current)) return current;
        if (requestedTicketId && res.tickets.some((ticket) => ticket.id === requestedTicketId)) return requestedTicketId;
        return null;
      });
    } catch (error: any) {
      if (String(error?.message || '').includes('403')) {
        setAccessDenied(true);
        navigate('/support', { replace: true });
      }
      else toast.error(error?.message || 'Could not load support tickets');
    } finally {
      setLoading(false);
    }
  }, [category, navigate, priority, requestedTicketId, status, supportAgent]);

  const loadThread = useCallback(async (id: string, quiet = false) => {
    if (!supportAgent) return;
    try {
      if (!quiet) setThreadLoading(true);
      const res = await api.support.admin.getTicket(id);
      setAgentName(res.agent.displayName);
      setActiveTicket(res.ticket);
      setMessages(res.messages);
      setReplyStatus(res.ticket.status === 'resolved' || res.ticket.status === 'closed' ? res.ticket.status : 'pending');
      setTickets((current) => current.map((ticket) => (ticket.id === res.ticket.id ? res.ticket : ticket)));
    } catch (error: any) {
      toast.error(error?.message || 'Could not load support conversation');
    } finally {
      setThreadLoading(false);
    }
  }, [supportAgent]);

  useEffect(() => {
    if (!authLoading && (!user || !supportAgent)) {
      navigate('/support', { replace: true });
      return;
    }
  }, [authLoading, navigate, supportAgent, user]);

  useEffect(() => {
    if (authLoading || !supportAgent) return;
    void loadTickets();
    const timer = window.setInterval(() => void loadTickets(true), 120000);
    return () => window.clearInterval(timer);
  }, [authLoading, loadTickets, supportAgent]);

  useEffect(() => {
    if (authLoading || !supportAgent) return;
    if (!selectedId) {
      setActiveTicket(null);
      setMessages([]);
      return;
    }
    void loadThread(selectedId);
    const timer = window.setInterval(() => void loadThread(selectedId, true), 60000);
    return () => window.clearInterval(timer);
  }, [authLoading, loadThread, selectedId, supportAgent]);

  useEffect(() => {
    if (authLoading || !supportAgent) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ ticketId?: string }>).detail || {};
      void loadTickets(true);
      if (selectedId && (!detail.ticketId || detail.ticketId === selectedId)) {
        void loadThread(selectedId, true);
      }
    };
    window.addEventListener('fap:support-updated', handler);
    return () => window.removeEventListener('fap:support-updated', handler);
  }, [authLoading, loadTickets, loadThread, selectedId, supportAgent]);

  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeTicket || !reply.trim()) return;
    setSending(true);
    try {
      const res = await api.support.admin.sendMessage(activeTicket.id, reply, replyStatus);
      setReply('');
      setActiveTicket(res.ticket);
      setMessages((current) => [...current, res.message]);
      setTickets((current) => current.map((ticket) => (ticket.id === res.ticket.id ? res.ticket : ticket)));
      toast.success('Reply sent');
    } catch (error: any) {
      toast.error(error?.message || 'Could not send reply');
    } finally {
      setSending(false);
    }
  };

  const updateTicket = async (patch: {
    status?: SupportStatus;
    priority?: SupportPriority;
    category?: SupportCategory;
    assignToMe?: boolean;
    clearAssignee?: boolean;
  }) => {
    if (!activeTicket) return;
    try {
      const res = await api.support.admin.updateTicket(activeTicket.id, patch);
      setActiveTicket(res.ticket);
      setTickets((current) => current.map((ticket) => (ticket.id === res.ticket.id ? res.ticket : ticket)));
      toast.success('Ticket updated');
    } catch (error: any) {
      toast.error(error?.message || 'Could not update ticket');
    }
  };

  if (accessDenied) {
    return (
      <div className="glass-card mx-auto max-w-2xl p-8 text-center">
        <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Support Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page is only available to accounts listed in the support agents table.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/18 via-background/75 to-violet-500/10 p-5 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-400/15 text-sky-300">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">Support operations</p>
                <h1 className="text-2xl font-bold tracking-tight">Admin Support Desk</h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {agentName ? `Signed in as ${agentName}` : 'Support workspace'} - inspect customers, accounts, activity, and tickets from one place.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[34rem]">
            <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
              <Users className="mb-2 h-4 w-4 text-amber-300" />
              <p className="text-2xl font-bold">{ticketStats.active}</p>
              <p className="text-xs text-muted-foreground">Open tickets</p>
            </div>
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3">
              <Inbox className="mb-2 h-4 w-4 text-cyan-300" />
              <p className="text-2xl font-bold">{ticketStats.total}</p>
              <p className="text-xs text-muted-foreground">Tickets total</p>
            </div>
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
              <AlertTriangle className="mb-2 h-4 w-4 text-rose-300" />
              <p className="text-2xl font-bold">{ticketStats.urgent}</p>
              <p className="text-xs text-muted-foreground">Urgent</p>
            </div>
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
              <CheckCircle2 className="mb-2 h-4 w-4 text-emerald-300" />
              <p className="text-2xl font-bold">{ticketStats.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="secondary" onClick={() => loadTickets()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh tickets
          </Button>
        </div>
      </div>

      <AdminInsightsPanel />

      <div className="glass-card grid gap-3 p-4 md:grid-cols-3">
        <Select value={status} onValueChange={(value) => setStatus(value as FilterStatus)}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(statusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(value) => setPriority(value as FilterPriority)}>
          <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.entries(priorityLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(value) => setCategory(value as FilterCategory)}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 xl:grid-cols-[27rem_minmax(0,1fr)]">
        <div className="glass-card overflow-hidden">
          <div className="border-b border-border/40 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Tickets</h2>
          </div>
          <div className="max-h-[68vh] overflow-y-auto p-2">
            {loading && tickets.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading tickets...</div>
            )}
            {!loading && tickets.length === 0 && (
              <div className="p-8 text-center">
                <LifeBuoy className="mx-auto mb-3 h-8 w-8 text-primary" />
                <p className="font-semibold">No tickets match these filters</p>
              </div>
            )}
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                  onClick={() => {
                    setSelectedId(ticket.id);
                    setSearchParams({ ticketId: ticket.id });
                  }}
                className={cn(
                  'mb-2 w-full rounded-lg border p-3 text-left transition-colors hover:bg-secondary/30',
                  ticket.id === selectedId ? 'border-primary/60 bg-primary/10' : 'border-border/40 bg-secondary/10',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{ticket.subject}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {ticket.customer?.name || ticket.customer?.email || ticket.userId}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn('shrink-0 capitalize', statusClass[ticket.status])}>
                    {ticket.status}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{ticket.accountId || categoryLabels[ticket.category]}</span>
                  <span>{formatTime(ticket.lastMessageAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card flex min-h-[36rem] flex-col overflow-hidden">
          {activeTicket ? (
            <>
              <div className="border-b border-border/40 p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold">{activeTicket.subject}</h2>
                      <Badge variant="outline" className={cn('capitalize', statusClass[activeTicket.status])}>
                        {activeTicket.status}
                      </Badge>
                      <Badge variant="secondary">{priorityLabels[activeTicket.priority]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeTicket.customer?.name || 'Trader'} - {activeTicket.customer?.email || activeTicket.userId}
                    </p>
                    {activeTicket.accountId && (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">Account: {activeTicket.accountId}</p>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:w-[28rem]">
                    <Select value={activeTicket.status} onValueChange={(value) => updateTicket({ status: value as SupportStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={activeTicket.priority} onValueChange={(value) => updateTicket({ priority: value as SupportPriority })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(priorityLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="secondary" onClick={() => updateTicket({ assignToMe: true })}>
                      Assign to me
                    </Button>
                    <Button variant="secondary" onClick={() => updateTicket({ clearAssignee: true })}>
                      Clear assignee
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {threadLoading && messages.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">Loading conversation...</div>
                )}
                {messages.map((message) => {
                  const isAgent = message.senderRole === 'agent';
                  return (
                    <div key={message.id} className={cn('flex', isAgent ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[92%] rounded-xl border px-4 py-3 md:max-w-[72%]',
                          isAgent
                            ? 'border-primary/30 bg-primary/10'
                            : 'border-border/40 bg-secondary/30',
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-4 text-[11px] uppercase tracking-widest text-muted-foreground">
                          <span>{isAgent ? 'Support' : 'Customer'}</span>
                          <span>{formatTime(message.createdAt)}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={sendReply} className="border-t border-border/40 p-4">
                <div className="mb-3 max-w-xs">
                  <Select value={replyStatus} onValueChange={(value) => setReplyStatus(value as SupportStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Reply and mark pending</SelectItem>
                      <SelectItem value="open">Reply and keep open</SelectItem>
                      <SelectItem value="resolved">Reply and mark resolved</SelectItem>
                      <SelectItem value="closed">Reply and close</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2 md:flex-row">
                  <Textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Write support reply..."
                    className="min-h-24 flex-1"
                    maxLength={8000}
                  />
                  <Button type="submit" disabled={sending || !reply.trim()} className="md:self-end">
                    <Send className="h-4 w-4" />
                    Send Reply
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <LifeBuoy className="mb-3 h-10 w-10 text-primary" />
              <h2 className="text-lg font-semibold">Select a ticket</h2>
              <p className="mt-1 text-sm text-muted-foreground">Customer details and replies will appear here.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
