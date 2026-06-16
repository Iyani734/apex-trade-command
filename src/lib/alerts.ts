// Alert definitions, persistence and server sync.
// Alerts are price-touch only: fire when bid/ask crosses the configured level
// in either direction. The frontend stores them in localStorage as the
// source-of-truth fallback and POSTs the FULL list to the server on every change.

export type AlertCondition = 'price_touch';

export interface Alert {
  id: string;
  symbol: string;
  condition: AlertCondition;
  value: number;
  enabled: boolean;
  note?: string;
  createdAt: string;
  /** When true, the alert is automatically deleted from the active list on first trigger. */
  triggerOnce: boolean;
}

export interface TriggeredAlert {
  alertId: string;
  accountId: string;
  symbol: string;
  condition: AlertCondition;
  value: number | string;
  price: number;
  triggeredAt: string;
  note?: string;
}

const KEY = (accountId: string) => `tvp.alerts.${accountId}`;
const TRIG_KEY = 'tvp.alerts.triggered';
const MAX_TRIG = 200;

export const alertsStore = {
  list(accountId: string): Alert[] {
    try {
      const raw = localStorage.getItem(KEY(accountId));
      const arr = raw ? (JSON.parse(raw) as Alert[]) : [];
      // Migrate legacy condition values to price_touch
      return arr.map((a) => ({ ...a, condition: 'price_touch', value: Number(a.value) }));
    } catch {
      return [];
    }
  },
  saveAll(accountId: string, alerts: Alert[]) {
    try { localStorage.setItem(KEY(accountId), JSON.stringify(alerts)); } catch { /* ignore */ }
  },
  triggered(): TriggeredAlert[] {
    try {
      const raw = localStorage.getItem(TRIG_KEY);
      return raw ? (JSON.parse(raw) as TriggeredAlert[]) : [];
    } catch {
      return [];
    }
  },
  pushTriggered(t: TriggeredAlert) {
    const cur = alertsStore.triggered();
    const next = [t, ...cur].slice(0, MAX_TRIG);
    try { localStorage.setItem(TRIG_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  },
  clearTriggered() {
    try { localStorage.removeItem(TRIG_KEY); } catch { /* ignore */ }
  },
};

export const CONDITION_LABEL: Record<AlertCondition, string> = {
  price_touch: 'Price touches',
};
