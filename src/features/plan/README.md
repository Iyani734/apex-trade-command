# Trading Plan & Goals Tracker

Independent module — monthly/weekly targets, daily loss rules, streak counters, discipline grade.

## Files
- `TradingPlanPage.tsx`

## Install
1. Copy `src/features/plan/` to your project.
2. Add a route: `<Route path="/plan" element={<TradingPlanPage />} />`.

## Persistence
State persists to `localStorage` under the key `tvp.tradingPlan.v1`. To hook it into your store, pass `initial` and listen via `onChange`:

```tsx
<TradingPlanPage
  initial={{ currentBalance: account.balance, todayPnl: account.todayPnl }}
  onChange={(plan) => savePlan(plan)}
/>
```

## Discipline score formula
```
score = (rulesFollowedPct * 0.5) + (lossBufferScore * 0.3) + (tradesComplianceScore * 0.2)
```
Score → letter grade A+ / A / B / C / F.
