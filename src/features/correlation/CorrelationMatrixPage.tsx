import { useMemo, useState } from 'react';
import { GitBranch } from 'lucide-react';

/**
 * Cross-pair correlation heatmap. Independent module.
 * Pass `matrix` to use real data; otherwise uses realistic baseline correlations.
 */
const PAIRS = [
  'EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD',
  'USDJPY', 'USDCHF', 'USDCAD',
  'EURJPY', 'GBPJPY', 'XAUUSD',
] as const;
type Pair = typeof PAIRS[number];

// Realistic long-term baseline correlations (-1..1)
const BASELINE: Record<Pair, Record<Pair, number>> = (() => {
  const base: Record<string, Record<string, number>> = {};
  const seed: Record<Pair, Record<Pair, number>> = {
    EURUSD: { EURUSD: 1,    GBPUSD: 0.85, AUDUSD: 0.72, NZDUSD: 0.68, USDJPY: -0.42, USDCHF: -0.92, USDCAD: -0.55, EURJPY: 0.55, GBPJPY: 0.38, XAUUSD: 0.45 },
    GBPUSD: { EURUSD: 0.85, GBPUSD: 1,    AUDUSD: 0.65, NZDUSD: 0.60, USDJPY: -0.30, USDCHF: -0.78, USDCAD: -0.50, EURJPY: 0.42, GBPJPY: 0.55, XAUUSD: 0.35 },
    AUDUSD: { EURUSD: 0.72, GBPUSD: 0.65, AUDUSD: 1,    NZDUSD: 0.88, USDJPY: -0.25, USDCHF: -0.65, USDCAD: -0.62, EURJPY: 0.48, GBPJPY: 0.45, XAUUSD: 0.62 },
    NZDUSD: { EURUSD: 0.68, GBPUSD: 0.60, AUDUSD: 0.88, NZDUSD: 1,    USDJPY: -0.22, USDCHF: -0.60, USDCAD: -0.55, EURJPY: 0.45, GBPJPY: 0.42, XAUUSD: 0.58 },
    USDJPY: { EURUSD: -0.42, GBPUSD: -0.30, AUDUSD: -0.25, NZDUSD: -0.22, USDJPY: 1, USDCHF: 0.55, USDCAD: 0.40, EURJPY: 0.60, GBPJPY: 0.72, XAUUSD: -0.30 },
    USDCHF: { EURUSD: -0.92, GBPUSD: -0.78, AUDUSD: -0.65, NZDUSD: -0.60, USDJPY: 0.55, USDCHF: 1, USDCAD: 0.52, EURJPY: -0.30, GBPJPY: -0.15, XAUUSD: -0.70 },
    USDCAD: { EURUSD: -0.55, GBPUSD: -0.50, AUDUSD: -0.62, NZDUSD: -0.55, USDJPY: 0.40, USDCHF: 0.52, USDCAD: 1, EURJPY: -0.20, GBPJPY: -0.10, XAUUSD: -0.40 },
    EURJPY: { EURUSD: 0.55, GBPUSD: 0.42, AUDUSD: 0.48, NZDUSD: 0.45, USDJPY: 0.60, USDCHF: -0.30, USDCAD: -0.20, EURJPY: 1, GBPJPY: 0.85, XAUUSD: 0.18 },
    GBPJPY: { EURUSD: 0.38, GBPUSD: 0.55, AUDUSD: 0.45, NZDUSD: 0.42, USDJPY: 0.72, USDCHF: -0.15, USDCAD: -0.10, EURJPY: 0.85, GBPJPY: 1, XAUUSD: 0.12 },
    XAUUSD: { EURUSD: 0.45, GBPUSD: 0.35, AUDUSD: 0.62, NZDUSD: 0.58, USDJPY: -0.30, USDCHF: -0.70, USDCAD: -0.40, EURJPY: 0.18, GBPJPY: 0.12, XAUUSD: 1 },
  };
  return seed;
})();

function cellColor(v: number): { bg: string; text: string } {
  // Strong positive → success green, negative → destructive red, near-zero → muted
  const abs = Math.abs(v);
  if (v > 0) {
    if (abs > 0.7) return { bg: 'hsl(145 70% 45% / 0.85)', text: 'hsl(228 40% 6%)' };
    if (abs > 0.4) return { bg: 'hsl(145 70% 45% / 0.55)', text: 'hsl(210 40% 95%)' };
    if (abs > 0.2) return { bg: 'hsl(145 70% 45% / 0.25)', text: 'hsl(210 40% 90%)' };
    return { bg: 'hsl(225 25% 16%)', text: 'hsl(215 20% 65%)' };
  } else {
    if (abs > 0.7) return { bg: 'hsl(0 72% 55% / 0.85)', text: 'hsl(210 40% 98%)' };
    if (abs > 0.4) return { bg: 'hsl(0 72% 55% / 0.55)', text: 'hsl(210 40% 95%)' };
    if (abs > 0.2) return { bg: 'hsl(0 72% 55% / 0.25)', text: 'hsl(210 40% 90%)' };
    return { bg: 'hsl(225 25% 16%)', text: 'hsl(215 20% 65%)' };
  }
}

export interface CorrelationMatrixPageProps {
  matrix?: Record<Pair, Record<Pair, number>>;
  openPairs?: Pair[]; // user's currently-open positions for overexposure warning
}

export function CorrelationMatrixPage({ matrix, openPairs = [] }: CorrelationMatrixPageProps) {
  const m = matrix ?? BASELINE;
  const [hover, setHover] = useState<{ a: Pair; b: Pair } | null>(null);

  const warnings = useMemo(() => {
    const out: { a: Pair; b: Pair; v: number }[] = [];
    for (let i = 0; i < openPairs.length; i++) {
      for (let j = i + 1; j < openPairs.length; j++) {
        const v = m[openPairs[i]]?.[openPairs[j]];
        if (v != null && Math.abs(v) > 0.7) out.push({ a: openPairs[i], b: openPairs[j], v });
      }
    }
    return out;
  }, [m, openPairs]);

  return (
    <div className="w-full min-h-screen bg-background text-foreground">
      <div className="px-6 py-6 border-b border-border/50">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-primary" /> Correlation Matrix
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Avoid overexposure — two pairs with correlation above 0.7 are essentially the same trade.
        </p>
      </div>

      {warnings.length > 0 && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/40">
          <div className="text-sm font-semibold text-destructive mb-2">⚠ Overexposure detected in open positions</div>
          <div className="space-y-1 text-xs">
            {warnings.map((w) => (
              <div key={w.a + w.b} className="font-mono">
                {w.a} ↔ {w.b}: <span className="font-bold">{w.v.toFixed(2)}</span> — these move together
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="rounded-xl border border-border/50 bg-card p-4 overflow-auto">
          <table className="w-full text-xs border-separate" style={{ borderSpacing: 2 }}>
            <thead>
              <tr>
                <th className="text-left p-2"></th>
                {PAIRS.map((p) => (
                  <th key={p} className="font-mono text-[10px] text-muted-foreground p-2 rotate-[-30deg] origin-left whitespace-nowrap">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PAIRS.map((a) => (
                <tr key={a}>
                  <td className="font-mono text-[10px] text-muted-foreground p-2 text-right">{a}</td>
                  {PAIRS.map((b) => {
                    const v = m[a]?.[b] ?? 0;
                    const c = cellColor(v);
                    const isHover = hover && ((hover.a === a && hover.b === b) || (hover.a === b && hover.b === a));
                    return (
                      <td
                        key={b}
                        onMouseEnter={() => setHover({ a, b })}
                        onMouseLeave={() => setHover(null)}
                        className={`text-center font-mono cursor-pointer rounded transition-all ${isHover ? 'ring-2 ring-primary' : ''}`}
                        style={{ backgroundColor: c.bg, color: c.text, width: 56, height: 36 }}
                        title={`${a} vs ${b}: ${v.toFixed(2)}`}
                      >
                        {v.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/50 bg-card p-5">
            <h3 className="text-sm font-semibold mb-3">Legend</h3>
            <div className="space-y-2 text-xs">
              <LegendRow color="hsl(145 70% 45% / 0.85)" label="Strong positive (> 0.7) — same trade" />
              <LegendRow color="hsl(145 70% 45% / 0.55)" label="Moderate positive (0.4–0.7)" />
              <LegendRow color="hsl(225 25% 16%)"        label="Weak / no correlation (–0.2 to 0.2)" textLight />
              <LegendRow color="hsl(0 72% 55% / 0.55)"   label="Moderate negative (–0.4 to –0.7)" />
              <LegendRow color="hsl(0 72% 55% / 0.85)"   label="Strong negative (< –0.7) — opposite trade" />
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-5">
            <h3 className="text-sm font-semibold mb-3">Trading rules</h3>
            <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
              <li>Long EURUSD + long GBPUSD = double position size on USD short.</li>
              <li>Long EURUSD + long USDCHF = the trades fight each other.</li>
              <li>If two open positions show |corr| &gt; 0.7, treat them as one position for risk.</li>
              <li>Re-check correlation weekly — relationships drift during regime changes.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendRow({ color, label, textLight }: { color: string; label: string; textLight?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-5 rounded" style={{ backgroundColor: color }} />
      <span className={textLight ? 'text-muted-foreground' : ''}>{label}</span>
    </div>
  );
}

export default CorrelationMatrixPage;
