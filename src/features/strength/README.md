# Currency Strength Meter

Independent page showing relative strength of the 8 major currencies.

## Files
- `CurrencyStrengthPage.tsx`

## Install
1. Copy `src/features/strength/` to your project.
2. Add a route:

```tsx
import CurrencyStrengthPage from '@/features/strength/CurrencyStrengthPage';
<Route path="/strength" element={<CurrencyStrengthPage />} />
```

## Wiring real data
By default the page uses a synthetic deterministic model. Pass a `strengths` prop to override:

```tsx
<CurrencyStrengthPage strengths={{ USD: 78, EUR: 42, GBP: 55, JPY: 22, AUD: 65, NZD: 60, CAD: 50, CHF: 38 }} />
```

A common live source is to compute each currency's strength from cross-rates: for currency X, average the % change of all pairs involving X (inverted when X is the quote currency), then normalize to 0–100.
