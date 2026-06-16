import type { NewsEvent, Impact } from './types';

/**
 * ForexFactory weekly JSON feed (mirrored by faireconomy.media — free, no key).
 * Returns the current week's economic calendar.
 *
 * If the feed is unreachable (CORS / offline), we fall back to a small mock set
 * so the UI is never empty during development.
 */
const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

interface FFItem {
  title: string;
  country: string;
  date: string;       // ISO
  impact: string;     // "High" | "Medium" | "Low" | "Holiday"
  forecast?: string;
  previous?: string;
  actual?: string;
  url?: string;
}

function hashId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function normalize(raw: FFItem): NewsEvent {
  const impact = (['High', 'Medium', 'Low', 'Holiday'].includes(raw.impact)
    ? raw.impact
    : 'Low') as Impact;
  return {
    id: hashId(`${raw.country}|${raw.title}|${raw.date}`),
    title: raw.title,
    country: raw.country?.toUpperCase() || 'ALL',
    date: raw.date,
    impact,
    forecast: raw.forecast || undefined,
    previous: raw.previous || undefined,
    actual: raw.actual || undefined,
    url: raw.url,
  };
}

export async function fetchNews(): Promise<NewsEvent[]> {
  try {
    const res = await fetch(FF_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: FFItem[] = await res.json();
    return data.map(normalize).sort((a, b) => +new Date(a.date) - +new Date(b.date));
  } catch (err) {
    console.warn('[news] feed unreachable, using mock data:', err);
    return mockEvents();
  }
}

function mockEvents(): NewsEvent[] {
  const now = new Date();
  const mk = (offsetHours: number, country: string, title: string, impact: Impact, extras: Partial<NewsEvent> = {}): NewsEvent => {
    const d = new Date(now.getTime() + offsetHours * 3600_000);
    return {
      id: hashId(`${country}|${title}|${d.toISOString()}`),
      title,
      country,
      date: d.toISOString(),
      impact,
      ...extras,
    };
  };
  return [
    mk(1, 'USD', 'Non-Farm Employment Change', 'High', { forecast: '180K', previous: '150K' }),
    mk(2, 'USD', 'Unemployment Rate', 'High', { forecast: '4.1%', previous: '4.2%' }),
    mk(3, 'EUR', 'ECB Press Conference', 'High'),
    mk(5, 'GBP', 'BOE Gov Bailey Speaks', 'Medium'),
    mk(8, 'JPY', 'Core Machinery Orders m/m', 'Low', { forecast: '0.8%', previous: '-1.9%' }),
    mk(24, 'USD', 'CPI m/m', 'High', { forecast: '0.3%', previous: '0.2%' }),
    mk(26, 'CAD', 'BOC Rate Statement', 'High'),
    mk(48, 'AUD', 'Cash Rate', 'High', { forecast: '4.35%', previous: '4.35%' }),
    mk(50, 'CHF', 'SNB Chairman Schlegel Speaks', 'Medium'),
    mk(72, 'NZD', 'GDP q/q', 'High', { forecast: '0.4%', previous: '-0.2%' }),
  ];
}
