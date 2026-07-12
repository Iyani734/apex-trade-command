import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LifeBuoy, MessageSquarePlus, RefreshCw, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api, type SupportCategory, type SupportMessage, type SupportPriority, type SupportTicket } from '@/services/api';
import { useTradingStore } from '@/store/tradingStore';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

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

const statusClass: Record<SupportTicket['status'], string> = {
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

export default function SupportPage() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const accounts = useTradingStore((s) => s.accounts);
  const activeAccountId = useTradingStore((s) => s.activeAccountId);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [reply, setReply] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<SupportCategory>('general');
  const [priority, setPriority] = useState<SupportPriority>('normal');
  const [accountId, setAccountId] = useState(activeAccountId || 'none');

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId),
    [accounts, accountId],
  );

  const loadTickets = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const res = await api.support.listTickets();
      setTickets(res.tickets);
      if (!ticketId && res.tickets.length > 0) {
        navigate(`/support/${res.tickets[0].id}`, { replace: true });
      }
    } catch (error: any) {
      toast.error(error?.message || 'Could not load support tickets');
    } finally {
      setLoading(false);
    }
  }, [navigate, ticketId]);

  const loadThread = useCallback(async (id: string, quiet = false) => {
    try {
      if (!quiet) setThreadLoading(true);
      const res = await api.support.getTicket(id);
      setActiveTicket(res.ticket);
      setMessages(res.messages);
      setTickets((current) => {
        const exists = current.some((ticket) => ticket.id === res.ticket.id);
        if (!exists) return [res.ticket, ...current];
        return current.map((ticket) => (ticket.id === res.ticket.id ? res.ticket : ticket));
      });
    } catch (error: any) {
      toast.error(error?.message || 'Could not load support conversation');
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void loadTickets();
    const timer = window.setInterval(() => void loadTickets(true), 15000);
    return () => window.clearInterval(timer);
  }, [loadTickets, user]);

  useEffect(() => {
    if (!user) return;
    if (!ticketId) {
      setActiveTicket(null);
      setMessages([]);
      return;
    }
    void loadThread(ticketId);
    const timer = window.setInterval(() => void loadThread(ticketId, true), 6000);
    return () => window.clearInterval(timer);
  }, [loadThread, ticketId, user]);

  const createTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !body.trim()) {
      toast.error('Add a subject and message first');
      return;
    }

    setSending(true);
    try {
      const res = await api.support.createTicket({
        subject,
        body,
        category,
        priority,
        accountId: accountId === 'none' ? undefined : accountId,
      });
      setTickets((current) => [res.ticket, ...current.filter((ticket) => ticket.id !== res.ticket.id)]);
      setActiveTicket(res.ticket);
      setMessages(res.messages);
      setSubject('');
      setBody('');
      setCategory('general');
      setPriority('normal');
      setAccountId(activeAccountId || 'none');
      setShowNewTicket(false);
      navigate(`/support/${res.ticket.id}`);
      toast.success('Support ticket created');
    } catch (error: any) {
      toast.error(error?.message || 'Could not create support ticket');
    } finally {
      setSending(false);
    }
  };

  const sendReply = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeTicket || !reply.trim()) return;
    setSending(true);
    try {
      const res = await api.support.sendMessage(activeTicket.id, reply);
      setReply('');
      setActiveTicket(res.ticket);
      setMessages((current) => [...current, res.message]);
      setTickets((current) => current.map((ticket) => (ticket.id === res.ticket.id ? res.ticket : ticket)));
    } catch (error: any) {
      toast.error(error?.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const toggleClosed = async () => {
    if (!activeTicket) return;
    const nextStatus = activeTicket.status === 'closed' ? 'open' : 'closed';
    try {
      const res = await api.support.updateStatus(activeTicket.id, nextStatus);
      setActiveTicket(res.ticket);
      setTickets((current) => current.map((ticket) => (ticket.id === res.ticket.id ? res.ticket : ticket)));
      toast.success(nextStatus === 'closed' ? 'Ticket closed' : 'Ticket reopened');
    } catch (error: any) {
      toast.error(error?.message || 'Could not update ticket');
    }
  };

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
        <div className="glass-card p-8 text-center">
          <LifeBuoy className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Sign in for support</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You can explore ForexAnalyzer Pro in demo mode, but support tickets need a signed-in account so we can reply to you privately.
          </p>
          <Button className="mt-6" onClick={() => navigate('/login')}>
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support</h1>
          <p className="text-sm text-muted-foreground">Talk to ForexAnalyzer Pro support from inside your account.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => loadTickets()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button onClick={() => setShowNewTicket((current) => !current)}>
            {showNewTicket ? <XCircle className="h-4 w-4" /> : <MessageSquarePlus className="h-4 w-4" />}
            {showNewTicket ? 'Cancel' : 'New Ticket'}
          </Button>
        </div>
      </div>

      {showNewTicket && (
        <form onSubmit={createTicket} className="glass-card space-y-4 p-4">
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div className="space-y-2">
              <Label htmlFor="support-subject">Subject</Label>
              <Input
                id="support-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Example: EA key is not connecting"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as SupportCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as SupportPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.alias} - {account.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-message">Message</Label>
            <Textarea
              id="support-message"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Tell us what happened, what you expected, and any error shown in MT5 or the dashboard."
              className="min-h-32"
              maxLength={8000}
            />
          </div>
          {selectedAccount && (
            <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-xs text-muted-foreground">
              Linked context: {selectedAccount.alias} / {selectedAccount.id} / {selectedAccount.broker}
            </div>
          )}
          <Button type="submit" disabled={sending}>
            <Send className="h-4 w-4" />
            Create Ticket
          </Button>
        </form>
      )}

      <div className="grid gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="glass-card overflow-hidden">
          <div className="border-b border-border/40 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Your tickets</h2>
          </div>
          <div className="max-h-[65vh] overflow-y-auto p-2">
            {loading && tickets.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading support tickets...</div>
            )}
            {!loading && tickets.length === 0 && (
              <div className="p-8 text-center">
                <LifeBuoy className="mx-auto mb-3 h-8 w-8 text-primary" />
                <p className="font-semibold">No support tickets yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Create a ticket when you need help.</p>
              </div>
            )}
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => navigate(`/support/${ticket.id}`)}
                className={cn(
                  'mb-2 w-full rounded-lg border p-3 text-left transition-colors hover:bg-secondary/30',
                  ticket.id === ticketId ? 'border-primary/60 bg-primary/10' : 'border-border/40 bg-secondary/10',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{ticket.subject}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{categoryLabels[ticket.category]}</p>
                  </div>
                  <Badge variant="outline" className={cn('shrink-0 capitalize', statusClass[ticket.status])}>
                    {ticket.status}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{ticket.accountId || 'No account'}</span>
                  <span>{formatTime(ticket.lastMessageAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card flex min-h-[32rem] flex-col overflow-hidden">
          {activeTicket ? (
            <>
              <div className="flex flex-col gap-3 border-b border-border/40 p-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold">{activeTicket.subject}</h2>
                    <Badge variant="outline" className={cn('capitalize', statusClass[activeTicket.status])}>
                      {activeTicket.status}
                    </Badge>
                    <Badge variant="secondary">{priorityLabels[activeTicket.priority]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {categoryLabels[activeTicket.category]}{activeTicket.accountId ? ` - ${activeTicket.accountId}` : ''}
                  </p>
                </div>
                <Button variant="secondary" onClick={toggleClosed}>
                  {activeTicket.status === 'closed' ? 'Reopen' : 'Close'}
                </Button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {threadLoading && messages.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">Loading conversation...</div>
                )}
                {messages.map((message) => {
                  const isAgent = message.senderRole === 'agent';
                  return (
                    <div key={message.id} className={cn('flex', isAgent ? 'justify-start' : 'justify-end')}>
                      <div
                        className={cn(
                          'max-w-[92%] rounded-xl border px-4 py-3 md:max-w-[72%]',
                          isAgent
                            ? 'border-primary/30 bg-primary/10'
                            : 'border-border/40 bg-secondary/30',
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-4 text-[11px] uppercase tracking-widest text-muted-foreground">
                          <span>{isAgent ? 'Support' : 'You'}</span>
                          <span>{formatTime(message.createdAt)}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={sendReply} className="border-t border-border/40 p-4">
                {activeTicket.status === 'closed' ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-secondary/20 p-4 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-muted-foreground">This ticket is closed. Reopen it to send another message.</p>
                    <Button type="button" onClick={toggleClosed}>Reopen Ticket</Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 md:flex-row">
                    <Textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder="Write your reply..."
                      className="min-h-24 flex-1"
                      maxLength={8000}
                    />
                    <Button type="submit" disabled={sending || !reply.trim()} className="md:self-end">
                      <Send className="h-4 w-4" />
                      Send
                    </Button>
                  </div>
                )}
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <LifeBuoy className="mb-3 h-10 w-10 text-primary" />
              <h2 className="text-lg font-semibold">Select or create a ticket</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your conversation with support will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
