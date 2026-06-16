import { useMemo, useState } from 'react';
import { Calculator, TrendingUp, Coins, Percent } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTradingStore } from '@/store/tradingStore';

// Pip value per 1 standard lot (100k) in quote currency, then we convert via approx rates if needed.
// To keep this self-contained and dependency free we use common USD-quote pip values.
// User can override pip value manually.
const PRESETS: Record<string, { pipSize: number; pipValuePerLot: number; label: string }> = {
  'EURUSD':  { pipSize: 0.0001, pipValuePerLot: 10,    label: 'EUR/USD' },
  'GBPUSD':  { pipSize: 0.0001, pipValuePerLot: 10,    label: 'GBP/USD' },
  'AUDUSD':  { pipSize: 0.0001, pipValuePerLot: 10,    label: 'AUD/USD' },
  'NZDUSD':  { pipSize: 0.0001, pipValuePerLot: 10,    label: 'NZD/USD' },
  'USDJPY':  { pipSize: 0.01,   pipValuePerLot: 6.7,   label: 'USD/JPY (approx)' },
  'USDCAD':  { pipSize: 0.0001, pipValuePerLot: 7.3,   label: 'USD/CAD (approx)' },
  'USDCHF':  { pipSize: 0.0001, pipValuePerLot: 11,    label: 'USD/CHF (approx)' },
  'XAUUSD':  { pipSize: 0.1,    pipValuePerLot: 10,    label: 'Gold (XAU/USD)' },
  'XAGUSD':  { pipSize: 0.01,   pipValuePerLot: 50,    label: 'Silver (XAG/USD)' },
  'BTCUSD':  { pipSize: 1,      pipValuePerLot: 1,     label: 'Bitcoin (BTC/USD)' },
  'US30':    { pipSize: 1,      pipValuePerLot: 1,     label: 'Dow Jones (US30)' },
  'NAS100':  { pipSize: 1,      pipValuePerLot: 1,     label: 'Nasdaq (NAS100)' },
  'SPX500':  { pipSize: 0.1,    pipValuePerLot: 1,     label: 'S&P 500 (SPX500)' },
};

export default function CalculatorPage() {
  const activeAccount = useTradingStore((s) => s.accounts.find((a) => a.id === s.activeAccountId));
  const [balance, setBalance] = useState<number>(activeAccount?.balance ?? 10000);
  const [riskPct, setRiskPct] = useState<number>(1);
  const [symbol, setSymbol] = useState<string>('EURUSD');
  const [stopPips, setStopPips] = useState<number>(20);
  const [rrRatio, setRrRatio] = useState<number>(2);
  const [pipValueOverride, setPipValueOverride] = useState<string>('');

  const preset = PRESETS[symbol] ?? PRESETS['EURUSD'];
  const pipValuePerLot = pipValueOverride ? Number(pipValueOverride) || preset.pipValuePerLot : preset.pipValuePerLot;

  const calc = useMemo(() => {
    const riskAmount = (balance * riskPct) / 100;
    const lots = stopPips > 0 && pipValuePerLot > 0
      ? riskAmount / (stopPips * pipValuePerLot)
      : 0;
    const micro = lots * 100; // micro lots
    const units = lots * 100000;
    const targetPips = stopPips * rrRatio;
    const potentialProfit = targetPips * pipValuePerLot * lots;
    return {
      riskAmount,
      lots,
      micro,
      units,
      targetPips,
      potentialProfit,
    };
  }, [balance, riskPct, stopPips, pipValuePerLot, rrRatio]);

  const useAccount = () => {
    if (activeAccount) setBalance(activeAccount.balance);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="w-6 h-6 text-primary" /> Position Size Calculator
        </h1>
        <p className="text-sm text-muted-foreground">Size every trade by risk %, not by guesswork.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Coins className="w-4 h-4" /> Inputs</h2>

          <div>
            <Label>Account Balance ($)</Label>
            <div className="flex gap-2 mt-1">
              <Input type="number" value={balance} onChange={(e) => setBalance(Number(e.target.value))} />
              {activeAccount && (
                <Button type="button" variant="outline" onClick={useAccount}>Use active</Button>
              )}
            </div>
          </div>

          <div>
            <Label>Risk per Trade (%)</Label>
            <Input type="number" step="0.1" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} />
          </div>

          <div>
            <Label>Symbol</Label>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRESETS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Stop Loss (pips)</Label>
            <Input type="number" value={stopPips} onChange={(e) => setStopPips(Number(e.target.value))} />
          </div>

          <div>
            <Label>Risk:Reward ratio</Label>
            <Input type="number" step="0.1" value={rrRatio} onChange={(e) => setRrRatio(Number(e.target.value))} />
          </div>

          <div>
            <Label>Pip Value per 1.0 lot (override, optional)</Label>
            <Input
              type="number"
              placeholder={`Default ${pipValuePerLot.toFixed(2)} USD`}
              value={pipValueOverride}
              onChange={(e) => setPipValueOverride(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Override if your broker quotes in a different currency. Defaults assume USD account.
            </p>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Result</h2>
          <Stat label="Risk Amount" value={`$${calc.riskAmount.toFixed(2)}`} accent />
          <Stat label="Position Size (lots)" value={calc.lots.toFixed(2)} big />
          <Stat label="Micro lots" value={calc.micro.toFixed(0)} />
          <Stat label="Units" value={calc.units.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
          <div className="border-t border-border/50 pt-3 space-y-3">
            <Stat label={`Target (${rrRatio}R)`} value={`${calc.targetPips.toFixed(1)} pips`} />
            <Stat label="Potential Profit" value={`$${calc.potentialProfit.toFixed(2)}`} accent />
          </div>
          <div className="text-[11px] text-muted-foreground flex items-start gap-1 pt-2">
            <Percent className="w-3 h-3 mt-0.5" />
            <span>Formula: Lots = (Balance × Risk%) ÷ (StopPips × PipValuePerLot)</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, big }: { label: string; value: string; accent?: boolean; big?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={[
        'font-mono font-semibold',
        big ? 'text-2xl' : 'text-base',
        accent ? 'text-primary' : 'text-foreground',
      ].join(' ')}>{value}</span>
    </div>
  );
}
