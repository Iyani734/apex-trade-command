import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, CheckCircle2, Star, StarOff, RefreshCw, ExternalLink, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { fetchNews } from './api';
import type { NewsEvent, Impact, Reminder } from './types';
import {
  loadReminders, saveReminders, loadWatchlist, saveWatchlist,
  requestNotificationPermission, startReminderScheduler,
} from './reminders';

const ALL_CURRENCIES = ['USD','EUR','GBP','JPY','AUD','NZD','CAD','CHF','CNY'];
const IMPACTS: Impact[] = ['High','Medium','Low','Holiday'];

const impactColor: Record<Impact, string> = {
  High: 'bg-red-500/20 text-red-400 border-red-500/40',
  Medium: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  Low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  Holiday: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
};

function groupByDay(events: NewsEvent[]) {
  const map = new Map<string, NewsEvent[]>();
  for (const ev of events) {
    const key = new Date(ev.date).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return Array.from(map.entries());
}

export default function NewsPage() {
  const [events, setEvents] = useState<NewsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currencies, setCurrencies] = useState<string[]>(ALL_CURRENCIES);
  const [impacts, setImpacts] = useState<Impact[]>(['High','Medium']);
  const [scope, setScope] = useState<'all'|'today'|'tomorrow'|'week'|'watch'>('week');
  const [watchlist, setWatchlist] = useState<string[]>(loadWatchlist());
  const [reminders, setReminders] = useState<Reminder[]>(loadReminders());
  const [alertsEnabled, setAlertsEnabled] = useState(
    () => typeof Notification !== 'undefined' && Notification.permission === 'granted',
  );

  const load = async () => {
    setLoading(true);
    const data = await fetchNews();
    setEvents(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Reminder scheduler
  useEffect(() => {
    const cleanup = startReminderScheduler(() => events);
    const onFire = (e: Event) => {
      const detail = (e as CustomEvent).detail as { event: NewsEvent; reminder: Reminder };
      toast.info(`📅 ${detail.event.country} • ${detail.event.title}`, {
        description: `Starts in ${detail.reminder.minutesBefore} min`,
      });
    };
    window.addEventListener('news:reminder', onFire);
    return () => { cleanup(); window.removeEventListener('news:reminder', onFire); };
  }, [events]);

  const toggleWatch = (id: string) => {
    const next = watchlist.includes(id) ? watchlist.filter(x => x !== id) : [...watchlist, id];
    setWatchlist(next); saveWatchlist(next);
  };

  const setReminder = async (ev: NewsEvent, minutes: number) => {
    const perm = await requestNotificationPermission();
    setAlertsEnabled(perm === 'granted');
    if (perm !== 'granted') {
      toast.warning('Browser notifications blocked — in-app alerts will still fire.');
    }
    const next = reminders.filter(r => r.eventId !== ev.id).concat({
      eventId: ev.id, minutesBefore: minutes, createdAt: Date.now(),
    });
    setReminders(next); saveReminders(next);
    toast.success(`Reminder set: ${minutes} min before ${ev.title}`);
  };

  const clearReminder = (id: string) => {
    const next = reminders.filter(r => r.eventId !== id);
    setReminders(next); saveReminders(next);
    toast.success('Reminder cleared');
  };

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 86_400_000;
    const endOfTomorrow = startOfToday + 2 * 86_400_000;
    const endOfWeek = startOfToday + 7 * 86_400_000;
    const q = search.trim().toLowerCase();

    return events.filter((ev) => {
      if (!currencies.includes(ev.country) && ev.country !== 'ALL') return false;
      if (!impacts.includes(ev.impact)) return false;
      if (q && !ev.title.toLowerCase().includes(q) && !ev.country.toLowerCase().includes(q)) return false;
      const t = +new Date(ev.date);
      if (scope === 'today' && (t < startOfToday || t >= endOfToday)) return false;
      if (scope === 'tomorrow' && (t < endOfToday || t >= endOfTomorrow)) return false;
      if (scope === 'week' && (t < startOfToday || t >= endOfWeek)) return false;
      if (scope === 'watch' && !watchlist.includes(ev.id)) return false;
      return true;
    });
  }, [events, currencies, impacts, search, scope, watchlist]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  const reminderFor = (id: string) => reminders.find(r => r.eventId === id);

  return (
    <div className="w-full min-h-screen space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Market News</h1>
          <p className="text-sm text-muted-foreground">
            Economic calendar with filters, watchlist, and reminders.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const p = await requestNotificationPermission();
              setAlertsEnabled(p === 'granted');
              if (p === 'granted') {
                toast.success('Alerts enabled for news reminders');
              } else {
                toast.warning(`Notifications: ${p}. In-app reminders can still fire while the site is open.`);
              }
            }}
            className={alertsEnabled ? 'border-success/40 bg-success/10 text-success hover:bg-success/15' : undefined}
          >
            {alertsEnabled ? (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            ) : (
              <Bell className="h-4 w-4 mr-2" />
            )}
            {alertsEnabled ? 'Alerts enabled' : 'Enable Alerts'}
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search event or currency..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={scope} onValueChange={(v: typeof scope) => setScope(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="tomorrow">Tomorrow</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="watch">⭐ Watchlist</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {currencies.length}/{ALL_CURRENCIES.length} Currencies
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="grid grid-cols-3 gap-2">
                {ALL_CURRENCIES.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currencies.includes(c)}
                      onChange={(e) => setCurrencies(
                        e.target.checked ? [...currencies, c] : currencies.filter(x => x !== c),
                      )}
                    />
                    {c}
                  </label>
                ))}
              </div>
              <div className="flex justify-between mt-3 text-xs">
                <button className="text-primary" onClick={() => setCurrencies(ALL_CURRENCIES)}>All</button>
                <button className="text-muted-foreground" onClick={() => setCurrencies([])}>None</button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex gap-1">
            {IMPACTS.map((imp) => {
              const active = impacts.includes(imp);
              return (
                <button
                  key={imp}
                  onClick={() => setImpacts(active ? impacts.filter(x => x !== imp) : [...impacts, imp])}
                  className={`px-2 py-1 rounded-md text-xs border transition ${
                    active ? impactColor[imp] : 'border-border text-muted-foreground opacity-50'
                  }`}
                >
                  {imp}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Showing <span className="text-foreground font-mono">{filtered.length}</span> of {events.length} events
          {reminders.length > 0 && ` • ${reminders.length} reminder(s) active`}
        </p>
      </Card>

      {/* Events grouped by day */}
      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading…</Card>
      ) : grouped.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No events match your filters.</Card>
      ) : (
        grouped.map(([day, items]) => (
          <div key={day} className="space-y-2">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
              {new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </h3>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left p-2 w-20">Time</th>
                    <th className="text-left p-2 w-16">Cur</th>
                    <th className="text-left p-2 w-20">Impact</th>
                    <th className="text-left p-2">Event</th>
                    <th className="text-right p-2 w-20">Forecast</th>
                    <th className="text-right p-2 w-20">Previous</th>
                    <th className="text-right p-2 w-20">Actual</th>
                    <th className="text-right p-2 w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((ev) => {
                    const rem = reminderFor(ev.id);
                    const watched = watchlist.includes(ev.id);
                    return (
                      <tr key={ev.id} className="border-t border-border/40 hover:bg-muted/20">
                        <td className="p-2 font-mono text-xs">
                          {new Date(ev.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-2"><Badge variant="outline">{ev.country}</Badge></td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-xs border ${impactColor[ev.impact]}`}>
                            {ev.impact}
                          </span>
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <span>{ev.title}</span>
                            {ev.url && (
                              <a href={ev.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-right font-mono text-xs">{ev.forecast || '—'}</td>
                        <td className="p-2 text-right font-mono text-xs">{ev.previous || '—'}</td>
                        <td className="p-2 text-right font-mono text-xs font-bold">{ev.actual || '—'}</td>
                        <td className="p-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => toggleWatch(ev.id)}
                              title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
                            >
                              {watched ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> : <StarOff className="h-4 w-4" />}
                            </Button>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7" title="Set reminder">
                                  {rem ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48">
                                <p className="text-xs text-muted-foreground mb-2">Notify me before:</p>
                                <div className="grid grid-cols-2 gap-1">
                                  {[5, 15, 30, 60].map(m => (
                                    <Button
                                      key={m}
                                      size="sm"
                                      variant={rem?.minutesBefore === m ? 'default' : 'outline'}
                                      onClick={() => setReminder(ev, m)}
                                    >
                                      {m} min
                                    </Button>
                                  ))}
                                </div>
                                {rem && (
                                  <Button
                                    size="sm" variant="ghost" className="w-full mt-2 text-destructive"
                                    onClick={() => clearReminder(ev.id)}
                                  >
                                    Clear
                                  </Button>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        ))
      )}
    </div>
  );
}
