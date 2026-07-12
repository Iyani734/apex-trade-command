import { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';

/**
 * Currency Strength Meter — independent feature page.
 * Uses a deterministic synthetic model by default. To wire to real data,
 * pass `strengths` as a prop (8 currencies, 0-100 scale).
 */
const CCYS = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'] as const;
type Ccy = typeof CCYS[number];

const FLAGS: Record<Ccy, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
  AUD: '🇦🇺', NZD: '🇳🇿', CAD: '🇨🇦', CHF: '🇨🇭',
};

function syntheticStrengths(seed: number): Record<Ccy, number> {
  const out = {} as Record<Ccy, number>;
  CCYS.forEach((c, i) => {
    const v = Math.sin(seed * 0.0003 + i * 1.3) * 30 + 50 + Math.cos(seed * 0.0005 + i) * 15;
    out[c] = Math.max(5, Math.min(95, v));
  });
  return out;
}

function isForexMarketOpen(date = new Date()) {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();

  if (day === 0) return hour >= 22; // Sunday after the weekly open.
  if (day >= 1 && day <= 4) return true;
  if (day === 5) return hour < 22; // Friday before the weekly close.
  return false;
}

function previousForexCloseSeed(date = new Date()) {
  const close = new Date(date);
  const daysSinceFriday = (close.getUTCDay() + 2) % 7;
  close.setUTCDate(close.getUTCDate() - daysSinceFriday);
  close.setUTCHours(22, 0, 0, 0);
  if (close.getTime() > date.getTime()) close.setUTCDate(close.getUTCDate() - 7);
  return close.getTime();
}

function colorFor(v: number) {
  if (v >= 70) return { bar: 'bg-success', text: 'text-success', label: 'STRONG' };
  if (v >= 55) return { bar: 'bg-primary', text: 'text-primary', label: 'BULLISH' };
  if (v >= 45) return { bar: 'bg-muted-foreground', text: 'text-muted-foreground', label: 'NEUTRAL' };
  if (v >= 30) return { bar: 'bg-warning', text: 'text-warning', label: 'BEARISH' };
  return            { bar: 'bg-destructive', text: 'text-destructive', label: 'WEAK' };
}

export interface CurrencyStrengthPageProps {
  strengths?: Record<Ccy, number>;
  onRefresh?: () => void;
}

export function CurrencyStrengthPage({ strengths, onRefresh }: CurrencyStrengthPageProps) {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  const marketOpen = isForexMarketOpen(new Date(tick));
  const dataSeed = marketOpen ? tick : previousForexCloseSeed(new Date(tick));
  const data = useMemo(() => strengths ?? syntheticStrengths(dataSeed), [strengths, dataSeed]);
  const isSynthetic = !strengths;
  const sorted = [...CCYS].sort((a, b) => data[b] - data[a]);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const bestPair = `${strongest}${weakest === 'USD' ? 'USD' : weakest}`;

  return (
    <div className="w-full min-h-screen bg-background text-foreground">
      <div className="px-6 py-6 border-b border-border/50 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" /> Currency Strength Meter
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Relative strength of the 8 majors.</span>
            {isSynthetic && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                marketOpen
                  ? 'bg-success/15 text-success'
                  : 'bg-warning/15 text-warning'
              }`}>
                {marketOpen ? 'Market open' : 'Market closed - paused'}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => { setTick(Date.now()); onRefresh?.(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/70 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6">
        <div className="rounded-xl bg-gradient-to-br from-success/20 to-success/5 border border-success/30 p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-widest">Strongest</div>
          <div className="text-4xl mt-2">{FLAGS[strongest]} <span className="font-mono">{strongest}</span></div>
          <div className="text-success text-sm font-mono mt-2">{data[strongest].toFixed(1)} / 100</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-widest">Suggested Long</div>
          <div className="text-3xl mt-2 font-mono">{bestPair}</div>
          <div className="text-primary text-sm mt-2">Buy {strongest} · Sell {weakest}</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/5 border border-destructive/30 p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-widest">Weakest</div>
          <div className="text-4xl mt-2">{FLAGS[weakest]} <span className="font-mono">{weakest}</span></div>
          <div className="text-destructive text-sm font-mono mt-2">{data[weakest].toFixed(1)} / 100</div>
        </div>
      </div>

      <div className="px-6 pb-10">
        <div className="rounded-xl border border-border/50 bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">Strength Ranking</h2>
          <div className="space-y-3">
            {sorted.map((c, i) => {
              const v = data[c];
              const meta = colorFor(v);
              return (
                <div key={c} className="grid grid-cols-12 items-center gap-3">
                  <div className="col-span-1 text-xs text-muted-foreground font-mono">#{i + 1}</div>
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="text-2xl">{FLAGS[c]}</span>
                    <span className="font-mono font-semibold">{c}</span>
                  </div>
                  <div className="col-span-7">
                    <div className="h-3 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full ${meta.bar} transition-all duration-700`}
                        style={{ width: `${v}%` }}
                      />
                    </div>
                  </div>
                  <div className="col-span-1 text-right font-mono text-sm">{v.toFixed(1)}</div>
                  <div className={`col-span-1 text-right text-[10px] font-bold tracking-wider ${meta.text}`}>{meta.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/50 bg-card p-5">
            <h3 className="text-sm font-semibold mb-3">How to read it</h3>
            <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
              <li>Pair the <span className="text-success font-semibold">strongest</span> currency against the <span className="text-destructive font-semibold">weakest</span> for highest-momentum trades.</li>
              <li>Avoid trading two currencies that sit in the middle — chop is likely.</li>
              <li>Re-evaluate at the London open and the NY open; strength rotates intra-day.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-5">
            <h3 className="text-sm font-semibold mb-3">Today's pair picks</h3>
            <div className="space-y-2 text-sm">
              {[0, 1, 2].map((i) => {
                const a = sorted[i];
                const b = sorted[sorted.length - 1 - i];
                return (
                  <div key={a + b} className="flex items-center justify-between p-2 rounded-lg bg-secondary/40">
                    <span className="font-mono">{a}{b}</span>
                    <span className="text-xs text-success">+{(data[a] - data[b]).toFixed(1)} spread</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CurrencyStrengthPage;
