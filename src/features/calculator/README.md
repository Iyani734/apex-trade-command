# Trading Calculators (self-contained)

Drop this entire `calculator/` folder into any React + Vite + Tailwind + shadcn project.

## Files
- `CalculatorPage.tsx` — main page (route component) with 7 tabbed calculators

## Calculators included
1. **Position Size** — lots from balance × risk% / (stop pips × pip value)
2. **Pip Value** — value per pip for any size
3. **Profit / Loss** — gross + net (commission, swap)
4. **Risk : Reward** — ratio, expectancy, breakeven win rate
5. **Margin** — required margin & free margin
6. **Compounding** — projection table (up to 500 trades)
7. **SL by $** — stop-loss distance from max-loss dollar amount

Symbol presets included for major FX, Gold/Silver, BTC/ETH, US30/NAS100/SPX500, USOIL.

## Dependencies
- `lucide-react`
- shadcn UI: `card`, `input`, `label`, `button`, `select`, `tabs`

No data store, no API, no `localStorage`. Pure UI + math.

## Install (1 step)

Add a route:

```tsx
import CalculatorPage from '@/features/calculator/CalculatorPage';
// ...
<Route path="/calculator" element={<CalculatorPage />} />
```

Sidebar link (optional):

```tsx
import { Calculator } from 'lucide-react';
{ title: 'Calculator', url: '/calculator', icon: Calculator }
```

## Pre-fill from an active account (optional)

If your app has a current account, pass it in to pre-fill Balance, Equity,
and Leverage fields:

```tsx
<CalculatorPage activeAccount={{ balance: 10000, equity: 9850, leverage: 100 }} />
```

The prop is fully optional — without it, fields default to sensible values.

## Customizing symbols

Edit the `PRESETS` object at the top of `CalculatorPage.tsx`. Each preset
needs `pipSize`, `pipValuePerLot`, `contractSize`, and a display `label`.
