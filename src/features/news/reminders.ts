import type { NewsEvent, Reminder } from './types';

const LS_REMINDERS = 'news.reminders.v1';
const LS_WATCHLIST = 'news.watchlist.v1';

// ---------- Persistence ----------
export function loadReminders(): Reminder[] {
  try { return JSON.parse(localStorage.getItem(LS_REMINDERS) || '[]'); } catch { return []; }
}
export function saveReminders(list: Reminder[]) {
  localStorage.setItem(LS_REMINDERS, JSON.stringify(list));
}
export function loadWatchlist(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_WATCHLIST) || '[]'); } catch { return []; }
}
export function saveWatchlist(ids: string[]) {
  localStorage.setItem(LS_WATCHLIST, JSON.stringify(ids));
}

// ---------- Notifications ----------
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return Notification.permission;
  return await Notification.requestPermission();
}

function notify(title: string, body: string) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.svg' });
    }
  } catch {/* ignore */}
}

// ---------- Scheduler ----------
/**
 * Polls every 30s; fires browser notification + custom DOM event
 * `news:reminder` when an event is within its reminder window.
 * Returns a cleanup function.
 */
export function startReminderScheduler(getEvents: () => NewsEvent[]): () => void {
  const fired = new Set<string>();

  const tick = () => {
    const reminders = loadReminders();
    if (!reminders.length) return;
    const events = getEvents();
    const now = Date.now();
    for (const r of reminders) {
      const ev = events.find((e) => e.id === r.eventId);
      if (!ev) continue;
      const eventTime = +new Date(ev.date);
      const triggerAt = eventTime - r.minutesBefore * 60_000;
      const key = `${r.eventId}:${r.minutesBefore}`;
      if (fired.has(key)) continue;
      if (now >= triggerAt && now < eventTime + 60_000) {
        fired.add(key);
        const body = `${ev.country} • ${ev.title} in ${r.minutesBefore} min`;
        notify('📅 Market News Reminder', body);
        window.dispatchEvent(new CustomEvent('news:reminder', { detail: { event: ev, reminder: r } }));
      }
    }
  };

  tick();
  const id = window.setInterval(tick, 30_000);
  return () => window.clearInterval(id);
}
