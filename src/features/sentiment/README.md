# Retail Sentiment Dashboard

COT-style retail positioning dashboard with contrarian fade signals.

## Files
- `SentimentDashboardPage.tsx`

## Install
1. Copy `src/features/sentiment/`.
2. Add a route: `<Route path="/sentiment" element={<SentimentDashboardPage />} />`.

## Real data
Pass a `sentiment` prop — array of `PairSentiment`:

```ts
type PairSentiment = {
  pair: string;
  longPct: number;        // 0..100
  netPositions?: number;  // optional COT net
  weeklyChange?: number;  // optional week-over-week % change
};
```

Common sources: IG Client Sentiment, Myfxbook Community Outlook, OANDA Order Book, weekly CFTC COT report.

## Contrarian rule
- `longPct > 65` → SELL signal
- `longPct < 35` → BUY signal
- `|longPct - 50| > 25` → ⚡ Extreme (highest-conviction fade)
