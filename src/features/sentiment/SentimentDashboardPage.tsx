import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';

/**
 * Retail Sentiment Dashboard — independent module.
 * Pass `sentiment` to wire up real broker / COT data; otherwise uses a realistic synthetic snapshot.
 */
export interface PairSentiment {
  pair: string;
  longPct: number; // 0-100
  netPositions?: number;
  weeklyChange?: number;
}

const DEFAULT_SENTIMENT: PairSentiment[] = [
  { pair: 'EURUSD', longPct: 38, netPositions: -42_300, weeklyChange: -5.2 },
  { pair: 'GBPUSD', longPct: 62, netPositions: 18_100, weeklyChange: 3.1 },
  { pair: 'USDJPY', longPct: 24, netPositions: -68_400, weeklyChange: -8.5 },
  { pair: 'AUDUSD', longPct: 71, netPositions: 32_200, weeklyChange: 6.4 },
  { pair: 'USDCAD', longPct: 45, netPositions: -3_400, weeklyChange: -1.2 },
  { pair: 'USDCHF', longPct: 56, netPositions: 5_800, weeklyChange: 1.8 },
  { pair: 'NZDUSD', longPct: 78, netPositions: 21_400, weeklyChange: 9.1 },
  { pair: 'XAUUSD', longPct: 82, netPositions: 142_000, weeklyChange: 12.3 },
];

export interface SentimentDashboardPageProps {
  sentiment?: PairSentiment[];
}

export function SentimentDashboardPage({ sentiment = DEFAULT_SENTIMENT }: SentimentDashboardPageProps) {
  const [view, setView] = useState<'retail' | 'contrarian'>('contrarian');

  const sorted = useMemo(() => [...sentiment].sort((a, b) =>
    Math.abs(b.longPct - 50) - Math.abs(a.longPct - 50)
  ), [sentiment]);

  return (
    <div className="w-full min-h-screen bg-background text-foreground">
      <div className="px-6 py-6 border-b border-border/50 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Retail Sentiment
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The retail crowd is wrong at extremes. Use this to fade the herd.
          </p>
        </div>
        <div className="flex rounded-lg bg-secondary/40 p-1">
          <button
            onClick={() => setView('retail')}
            className={`px-3 py-1.5 text-xs rounded ${view === 'retail' ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
          >Retail view</button>
          <button
            onClick={() => setView('contrarian')}
            className={`px-3 py-1.5 text-xs rounded ${view === 'contrarian' ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
          >Contrarian signal</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-6">
        {sentiment.map((s) => <SentimentCard key={s.pair} s={s} contrarian={view === 'contrarian'} />)}
      </div>

      <div className="px-6 pb-10">
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-widest text-muted-foreground">Crowd extremes — strongest fade signals</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase tracking-wider">
              <tr className="border-b border-border/30">
                <th className="text-left py-2">Pair</th>
                <th className="text-right">Long %</th>
                <th className="text-right">Short %</th>
                <th className="text-right">Net</th>
                <th className="text-right">Weekly Δ</th>
                <th className="text-right">Contrarian</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const ext = Math.abs(s.longPct - 50);
                const signal = s.longPct > 65 ? 'SELL' : s.longPct < 35 ? 'BUY' : '—';
                const sigColor = signal === 'SELL' ? 'text-destructive' : signal === 'BUY' ? 'text-success' : 'text-muted-foreground';
                return (
                  <tr key={s.pair} className="border-b border-border/20 hover:bg-secondary/30">
                    <td className="py-2 font-mono">{s.pair}</td>
                    <td className="text-right font-mono text-success">{s.longPct}%</td>
                    <td className="text-right font-mono text-destructive">{100 - s.longPct}%</td>
                    <td className="text-right font-mono">{s.netPositions?.toLocaleString()}</td>
                    <td className={`text-right font-mono ${(s.weeklyChange ?? 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {(s.weeklyChange ?? 0) >= 0 ? '+' : ''}{s.weeklyChange?.toFixed(1)}%
                    </td>
                    <td className={`text-right font-bold ${sigColor}`}>
                      {signal} {ext > 25 && signal !== '—' && '⚡'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SentimentCard({ s, contrarian }: { s: PairSentiment; contrarian: boolean }) {
  const short = 100 - s.longPct;
  const ext = Math.abs(s.longPct - 50);
  const extreme = ext > 20;
  const fade = s.longPct > 50 ? 'SHORT' : 'LONG';

  return (
    <div className={`rounded-xl border bg-card p-5 ${extreme ? 'border-warning/40' : 'border-border/50'}`}>
      <div className="flex items-center justify-between">
        <span className="font-mono font-semibold">{s.pair}</span>
        {extreme && <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/20 text-warning uppercase tracking-wider">Extreme</span>}
      </div>
      <div className="mt-4 flex h-3 rounded-full overflow-hidden bg-secondary">
        <div className="bg-success transition-all" style={{ width: `${s.longPct}%` }} />
        <div className="bg-destructive transition-all" style={{ width: `${short}%` }} />
      </div>
      <div className="flex justify-between text-xs mt-1 font-mono">
        <span className="text-success">{s.longPct}% L</span>
        <span className="text-destructive">{short}% S</span>
      </div>
      {contrarian && (
        <div className={`mt-3 px-2 py-1.5 rounded text-xs font-semibold text-center ${
          fade === 'LONG' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
        }`}>
          Fade signal: {fade}
        </div>
      )}
      {s.weeklyChange != null && (
        <div className="mt-2 text-[10px] text-muted-foreground text-center font-mono">
          Weekly Δ {s.weeklyChange >= 0 ? '+' : ''}{s.weeklyChange.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

export default SentimentDashboardPage;
