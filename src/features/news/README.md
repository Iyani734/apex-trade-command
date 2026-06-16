# News Feature (self-contained)

Drop this entire `news/` folder into any React + Vite + Tailwind + shadcn project.

## Files
- `NewsPage.tsx` — main page (route component)
- `api.ts` — fetches ForexFactory weekly JSON (free, no key). Falls back to mock data.
- `reminders.ts` — localStorage persistence + browser notifications + 30s scheduler
- `types.ts` — TypeScript types

## Dependencies (already in most shadcn projects)
- `lucide-react`, `sonner`
- shadcn UI: `button`, `input`, `badge`, `card`, `select`, `popover`

## Install (1 step)

Add a route:

```tsx
import NewsPage from '@/features/news/NewsPage';
// ...
<Route path="/news" element={<NewsPage />} />
```

And a sidebar link (optional):

```tsx
import { Newspaper } from 'lucide-react';
{ title: 'News', url: '/news', icon: Newspaper }
```

## Features
- ForexFactory-style economic calendar grouped by day
- Filter by currency (USD, EUR, GBP, JPY, AUD, NZD, CAD, CHF, CNY)
- Filter by impact (High / Medium / Low / Holiday)
- Filter by scope (Today / Tomorrow / This Week / All / ⭐ Watchlist)
- Search box
- ⭐ Star events to add to personal watchlist
- 🔔 Set reminders (5/15/30/60 min) — fires browser notification + in-app toast
- Auto-refresh data via "Refresh" button
- Persists watchlist + reminders to `localStorage`

## Data source
`https://nfs.faireconomy.media/ff_calendar_thisweek.json` — public mirror of the
ForexFactory weekly calendar. If CORS or network fails, mock data renders so the
UI is never empty.
