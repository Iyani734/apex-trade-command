# Correlation Matrix

Cross-pair correlation heatmap with built-in overexposure warnings.

## Files
- `CorrelationMatrixPage.tsx`

## Install
1. Copy `src/features/correlation/`.
2. Add a route: `<Route path="/correlation" element={<CorrelationMatrixPage />} />`.

## Real data
Pass a `matrix` (and optionally `openPairs` for live overexposure alerts):

```tsx
<CorrelationMatrixPage
  matrix={liveCorrelations}
  openPairs={['EURUSD', 'GBPUSD']}
/>
```

`matrix` is `Record<Pair, Record<Pair, number>>` with values in `[-1, 1]`. Compute it from a rolling-window Pearson correlation of returns (60-bar H1 is a common default).
