# Session Indicator (Forex Market Hours)

Drop-in header widget showing which forex sessions are currently open, time-to-open/close, and a derived volatility expectation.

## Files
- `SessionIndicator.tsx` — self-contained component (uses `@/components/ui/popover` from shadcn).

## Install in any codebase
1. Copy `src/features/sessions/` into your project.
2. Ensure shadcn `popover` is installed: `npx shadcn-ui@latest add popover`.
3. Mount it in your top bar:

```tsx
import { SessionIndicator } from '@/features/sessions/SessionIndicator';

<header>
  {/* ...other header content... */}
  <SessionIndicator />
</header>
```

## How volatility is computed
- Each session has a base volatility 2–5.
- Open sessions' base values are summed.
- +3 bonus during the London / New York overlap (12:00–16:00 UTC).
- Score → label: Quiet · Moderate · Active · High · Explosive.

To replace with real-data volatility (e.g., ATR-derived), edit the `volatilityLabel` call site in `SessionIndicator.tsx`.
