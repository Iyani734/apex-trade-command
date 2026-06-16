import { useMemo, useState } from 'react';
import { Calculator, Coins, TrendingUp, Percent, DollarSign, Layers, Sigma, Target, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

/**
 * Optional account context. Pass it in if your app has a live account so the
 * calculators can pre-fill balance / equity / leverage. Standalone usage works
 * without it — fields default to sensible numbers.
 */
export interface CalculatorAccount {
  balance?: number;
  equity?: number;
  leverage?: number | string;
}

interface CalculatorPageProps {
  activeAccount?: CalculatorAccount;
}

const PRESETS: Record<string, { pipSize: number; pipValuePerLot: number; contractSize: number; label: string }> = {
  EURUSD: { pipSize: 0.0001, pipValuePerLot: 10,   contractSize: 100000, label: 'EUR/USD' },
  GBPUSD: { pipSize: 0.0001, pipValuePerLot: 10,   contractSize: 100000, label: 'GBP/USD' },
  AUDUSD: { pipSize: 0.0001, pipValuePerLot: 10,   contractSize: 100000, label: 'AUD/USD' },
  NZDUSD: { pipSize: 0.0001, pipValuePerLot: 10,   contractSize: 100000, label: 'NZD/USD' },
  USDJPY: { pipSize: 0.01,   pipValuePerLot: 6.7,  contractSize: 100000, label: 'USD/JPY' },
  USDCAD: { pipSize: 0.0001, pipValuePerLot: 7.3,  contractSize: 100000, label: 'USD/CAD' },
  USDCHF: { pipSize: 0.0001, pipValuePerLot: 11,   contractSize: 100000, label: 'USD/CHF' },
  EURJPY: { pipSize: 0.01,   pipValuePerLot: 6.7,  contractSize: 100000, label: 'EUR/JPY' },
  GBPJPY: { pipSize: 0.01,   pipValuePerLot: 6.7,  contractSize: 100000, label: 'GBP/JPY' },
  XAUUSD: { pipSize: 0.1,    pipValuePerLot: 10,   contractSize: 100,    label: 'Gold (XAU/USD)' },
  XAGUSD: { pipSize: 0.01,   pipValuePerLot: 50,   contractSize: 5000,   label: 'Silver (XAG/USD)' },
  BTCUSD: { pipSize: 1,      pipValuePerLot: 1,    contractSize: 1,      label: 'Bitcoin (BTC/USD)' },
  ETHUSD: { pipSize: 0.1,    pipValuePerLot: 1,    contractSize: 1,      label: 'Ethereum (ETH/USD)' },
  US30:   { pipSize: 1,      pipValuePerLot: 1,    contractSize: 1,      label: 'Dow Jones (US30)' },
  NAS100: { pipSize: 1,      pipValuePerLot: 1,    contractSize: 1,      label: 'Nasdaq (NAS100)' },
  SPX500: { pipSize: 0.1,    pipValuePerLot: 1,    contractSize: 1,      label: 'S&P 500 (SPX500)' },
  USOIL:  { pipSize: 0.01,   pipValuePerLot: 10,   contractSize: 1000,   label: 'WTI Oil (USOIL)' },
};

export default function CalculatorPage({ activeAccount }: CalculatorPageProps = {}) {
  return (
    <div className="w-full min-h-screen space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Calculator className="w-7 h-7 text-primary" /> Trading Calculators
        </h1>
        <p className="text-sm text-muted-foreground">Pro-grade calculators for every aspect of trade planning.</p>
      </div>

      <Tabs defaultValue="position" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 h-auto w-full">
          <TabsTrigger value="position" className="gap-1"><Target className="w-3.5 h-3.5"/>Position</TabsTrigger>
          <TabsTrigger value="pip" className="gap-1"><Coins className="w-3.5 h-3.5"/>Pip Value</TabsTrigger>
          <TabsTrigger value="pnl" className="gap-1"><DollarSign className="w-3.5 h-3.5"/>P&amp;L</TabsTrigger>
          <TabsTrigger value="rr" className="gap-1"><TrendingUp className="w-3.5 h-3.5"/>R:R</TabsTrigger>
          <TabsTrigger value="margin" className="gap-1"><Layers className="w-3.5 h-3.5"/>Margin</TabsTrigger>
          <TabsTrigger value="compound" className="gap-1"><Sigma className="w-3.5 h-3.5"/>Compounding</TabsTrigger>
          <TabsTrigger value="sl" className="gap-1"><Wallet className="w-3.5 h-3.5"/>SL by $</TabsTrigger>
        </TabsList>

        <TabsContent value="position" className="mt-4"><PositionSize account={activeAccount} /></TabsContent>
        <TabsContent value="pip" className="mt-4"><PipValueCalc /></TabsContent>
        <TabsContent value="pnl" className="mt-4"><PnLCalc /></TabsContent>
        <TabsContent value="rr" className="mt-4"><RRCalc /></TabsContent>
        <TabsContent value="margin" className="mt-4"><MarginCalc account={activeAccount} /></TabsContent>
        <TabsContent value="compound" className="mt-4"><CompoundCalc /></TabsContent>
        <TabsContent value="sl" className="mt-4"><SLByDollarCalc /></TabsContent>
      </Tabs>
    </div>
  );
}

function SymbolSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent className="max-h-72">
        {Object.entries(PRESETS).map(([k, v]) => (
          <SelectItem key={k} value={k}>{v.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Stat({ label, value, accent, big }: { label: string; value: string; accent?: boolean; big?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/30 last:border-0 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={[
        'font-mono font-semibold',
        big ? 'text-2xl' : 'text-base',
        accent ? 'text-primary' : 'text-foreground',
      ].join(' ')}>{value}</span>
    </div>
  );
}

function Section({ title, icon, children, results }: { title: string; icon: React.ReactNode; children: React.ReactNode; results: React.ReactNode }) {
  return (
    <div className="grid lg:grid-cols-2 gap-6 w-full">
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">{icon} {title}</h2>
        {children}
      </Card>
      <Card className="p-5 space-y-1">
        <h2 className="font-semibold flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4" /> Result</h2>
        {results}
      </Card>
    </div>
  );
}

/* ---------------- Position size ---------------- */
function PositionSize({ account }: { account?: CalculatorAccount }) {
  const [balance, setBalance] = useState(account?.balance ?? 10000);
  const [riskPct, setRiskPct] = useState(1);
  const [symbol, setSymbol] = useState('EURUSD');
  const [stopPips, setStopPips] = useState(20);
  const [rr, setRr] = useState(2);
  const [override, setOverride] = useState('');
  const preset = PRESETS[symbol];
  const pipVal = override ? Number(override) || preset.pipValuePerLot : preset.pipValuePerLot;
  const r = useMemo(() => {
    const risk = (balance * riskPct) / 100;
    const lots = stopPips > 0 && pipVal > 0 ? risk / (stopPips * pipVal) : 0;
    return { risk, lots, micro: lots * 100, units: lots * preset.contractSize, target: stopPips * rr, profit: stopPips * rr * pipVal * lots };
  }, [balance, riskPct, stopPips, pipVal, rr, preset.contractSize]);

  return (
    <Section title="Position Size" icon={<Target className="w-4 h-4" />} results={
      <>
        <Stat label="Risk Amount" value={`$${r.risk.toFixed(2)}`} accent />
        <Stat label="Position Size (lots)" value={r.lots.toFixed(2)} big />
        <Stat label="Micro lots" value={r.micro.toFixed(0)} />
        <Stat label="Units" value={r.units.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
        <Stat label={`Target (${rr}R)`} value={`${r.target.toFixed(1)} pips`} />
        <Stat label="Potential Profit" value={`$${r.profit.toFixed(2)}`} accent />
        <p className="text-[11px] text-muted-foreground pt-2 flex gap-1"><Percent className="w-3 h-3 mt-0.5"/>Lots = (Balance × Risk%) ÷ (StopPips × PipValuePerLot)</p>
      </>
    }>
      <Field label="Account Balance ($)">
        <div className="flex gap-2">
          <Input type="number" value={balance} onChange={(e) => setBalance(Number(e.target.value))} />
          {account?.balance != null && <Button variant="outline" type="button" onClick={() => setBalance(account.balance!)}>Use active</Button>}
        </div>
      </Field>
      <Field label="Risk per Trade (%)"><Input type="number" step="0.1" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} /></Field>
      <Field label="Symbol"><SymbolSelect value={symbol} onChange={setSymbol} /></Field>
      <Field label="Stop Loss (pips)"><Input type="number" value={stopPips} onChange={(e) => setStopPips(Number(e.target.value))} /></Field>
      <Field label="Risk:Reward"><Input type="number" step="0.1" value={rr} onChange={(e) => setRr(Number(e.target.value))} /></Field>
      <Field label="Pip Value/lot override ($)"><Input type="number" placeholder={`Default ${pipVal.toFixed(2)}`} value={override} onChange={(e) => setOverride(e.target.value)} /></Field>
    </Section>
  );
}

/* ---------------- Pip value ---------------- */
function PipValueCalc() {
  const [symbol, setSymbol] = useState('EURUSD');
  const [lots, setLots] = useState(1);
  const preset = PRESETS[symbol];
  const pv = lots * preset.pipValuePerLot;
  return (
    <Section title="Pip Value" icon={<Coins className="w-4 h-4" />} results={
      <>
        <Stat label="Pip Value (total)" value={`$${pv.toFixed(2)}`} big accent />
        <Stat label="Per 1.0 lot" value={`$${preset.pipValuePerLot.toFixed(2)}`} />
        <Stat label="Per 0.1 lot" value={`$${(preset.pipValuePerLot * 0.1).toFixed(2)}`} />
        <Stat label="Per 0.01 lot" value={`$${(preset.pipValuePerLot * 0.01).toFixed(2)}`} />
        <Stat label="Pip size" value={preset.pipSize.toString()} />
        <Stat label="Contract size" value={preset.contractSize.toLocaleString()} />
      </>
    }>
      <Field label="Symbol"><SymbolSelect value={symbol} onChange={setSymbol} /></Field>
      <Field label="Lots"><Input type="number" step="0.01" value={lots} onChange={(e) => setLots(Number(e.target.value))} /></Field>
    </Section>
  );
}

/* ---------------- PnL ---------------- */
function PnLCalc() {
  const [symbol, setSymbol] = useState('EURUSD');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [lots, setLots] = useState(1);
  const [entry, setEntry] = useState(1.1);
  const [exit, setExit] = useState(1.105);
  const [commission, setCommission] = useState(0);
  const [swap, setSwap] = useState(0);
  const preset = PRESETS[symbol];
  const diff = side === 'BUY' ? exit - entry : entry - exit;
  const pips = diff / preset.pipSize;
  const gross = pips * preset.pipValuePerLot * lots;
  const net = gross - commission + swap;
  return (
    <Section title="Profit / Loss" icon={<DollarSign className="w-4 h-4" />} results={
      <>
        <Stat label="Pips" value={pips.toFixed(1)} />
        <Stat label="Gross P&L" value={`$${gross.toFixed(2)}`} />
        <Stat label="Commission" value={`-$${commission.toFixed(2)}`} />
        <Stat label="Swap" value={`$${swap.toFixed(2)}`} />
        <Stat label="Net P&L" value={`$${net.toFixed(2)}`} big accent />
      </>
    }>
      <Field label="Symbol"><SymbolSelect value={symbol} onChange={setSymbol} /></Field>
      <Field label="Side">
        <Select value={side} onValueChange={(v) => setSide(v as 'BUY'|'SELL')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="BUY">BUY</SelectItem><SelectItem value="SELL">SELL</SelectItem></SelectContent>
        </Select>
      </Field>
      <Field label="Lots"><Input type="number" step="0.01" value={lots} onChange={(e) => setLots(Number(e.target.value))} /></Field>
      <Field label="Entry Price"><Input type="number" step="0.00001" value={entry} onChange={(e) => setEntry(Number(e.target.value))} /></Field>
      <Field label="Exit Price"><Input type="number" step="0.00001" value={exit} onChange={(e) => setExit(Number(e.target.value))} /></Field>
      <Field label="Commission ($)"><Input type="number" value={commission} onChange={(e) => setCommission(Number(e.target.value))} /></Field>
      <Field label="Swap ($)"><Input type="number" value={swap} onChange={(e) => setSwap(Number(e.target.value))} /></Field>
    </Section>
  );
}

/* ---------------- Risk/Reward ---------------- */
function RRCalc() {
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [entry, setEntry] = useState(1.1);
  const [sl, setSl] = useState(1.095);
  const [tp, setTp] = useState(1.115);
  const [winRate, setWinRate] = useState(50);
  const risk = side === 'BUY' ? entry - sl : sl - entry;
  const reward = side === 'BUY' ? tp - entry : entry - tp;
  const rr = risk > 0 ? reward / risk : 0;
  const expectancy = (winRate / 100) * rr - (1 - winRate / 100);
  return (
    <Section title="Risk : Reward" icon={<TrendingUp className="w-4 h-4" />} results={
      <>
        <Stat label="Risk (price)" value={risk.toFixed(5)} />
        <Stat label="Reward (price)" value={reward.toFixed(5)} />
        <Stat label="R:R ratio" value={`1 : ${rr.toFixed(2)}`} big accent />
        <Stat label="Expectancy / trade (R)" value={expectancy.toFixed(2)} accent />
        <Stat label="Breakeven win rate" value={`${(100 / (1 + rr)).toFixed(1)}%`} />
      </>
    }>
      <Field label="Side">
        <Select value={side} onValueChange={(v) => setSide(v as 'BUY'|'SELL')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="BUY">BUY</SelectItem><SelectItem value="SELL">SELL</SelectItem></SelectContent>
        </Select>
      </Field>
      <Field label="Entry"><Input type="number" step="0.00001" value={entry} onChange={(e) => setEntry(Number(e.target.value))} /></Field>
      <Field label="Stop Loss"><Input type="number" step="0.00001" value={sl} onChange={(e) => setSl(Number(e.target.value))} /></Field>
      <Field label="Take Profit"><Input type="number" step="0.00001" value={tp} onChange={(e) => setTp(Number(e.target.value))} /></Field>
      <Field label="Win rate (%)"><Input type="number" value={winRate} onChange={(e) => setWinRate(Number(e.target.value))} /></Field>
    </Section>
  );
}

/* ---------------- Margin ---------------- */
function MarginCalc({ account }: { account?: CalculatorAccount }) {
  const [symbol, setSymbol] = useState('EURUSD');
  const [lots, setLots] = useState(1);
  const [price, setPrice] = useState(1.1);
  const defaultLev = account?.leverage
    ? Number(String(account.leverage).replace(/\D/g, '')) || 100
    : 100;
  const [leverage, setLeverage] = useState(defaultLev);
  const preset = PRESETS[symbol];
  const notional = lots * preset.contractSize * price;
  const margin = leverage > 0 ? notional / leverage : 0;
  const free = (account?.equity ?? 0) - margin;
  return (
    <Section title="Required Margin" icon={<Layers className="w-4 h-4" />} results={
      <>
        <Stat label="Notional Value" value={`$${notional.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
        <Stat label="Required Margin" value={`$${margin.toFixed(2)}`} big accent />
        <Stat label="Leverage" value={`1:${leverage}`} />
        {account?.equity != null && <Stat label="Free margin after trade" value={`$${free.toFixed(2)}`} accent={free > 0} />}
      </>
    }>
      <Field label="Symbol"><SymbolSelect value={symbol} onChange={setSymbol} /></Field>
      <Field label="Lots"><Input type="number" step="0.01" value={lots} onChange={(e) => setLots(Number(e.target.value))} /></Field>
      <Field label="Price"><Input type="number" step="0.00001" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></Field>
      <Field label="Leverage (1:X)"><Input type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} /></Field>
    </Section>
  );
}

/* ---------------- Compounding ---------------- */
function CompoundCalc() {
  const [start, setStart] = useState(1000);
  const [pct, setPct] = useState(2);
  const [periods, setPeriods] = useState(100);
  const rows = useMemo(() => {
    const out: { i: number; bal: number; gain: number }[] = [];
    let bal = start;
    for (let i = 1; i <= Math.min(periods, 500); i++) {
      const gain = (bal * pct) / 100;
      bal += gain;
      out.push({ i, bal, gain });
    }
    return out;
  }, [start, pct, periods]);
  const final = rows[rows.length - 1];
  return (
    <Section title="Compounding Projection" icon={<Sigma className="w-4 h-4" />} results={
      <>
        <Stat label="Starting balance" value={`$${start.toLocaleString()}`} />
        <Stat label="Per-trade gain" value={`${pct}%`} />
        <Stat label="Trades" value={periods.toString()} />
        <Stat label="Final balance" value={`$${final?.bal.toFixed(2) ?? '0.00'}`} big accent />
        <Stat label="Total profit" value={`$${((final?.bal ?? start) - start).toFixed(2)}`} accent />
        <div className="max-h-64 overflow-auto mt-3 border border-border/40 rounded">
          <table className="w-full text-xs font-mono">
            <thead className="bg-secondary/40 sticky top-0">
              <tr><th className="text-left p-2">#</th><th className="text-right p-2">Gain</th><th className="text-right p-2">Balance</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r) => (
                <tr key={r.i} className="border-t border-border/30">
                  <td className="p-2">{r.i}</td>
                  <td className="p-2 text-right text-success">+${r.gain.toFixed(2)}</td>
                  <td className="p-2 text-right">${r.bal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 50 && <p className="text-[11px] text-muted-foreground p-2">Showing first 50 of {rows.length} trades.</p>}
        </div>
      </>
    }>
      <Field label="Starting balance ($)"><Input type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} /></Field>
      <Field label="Profit per trade (%)"><Input type="number" step="0.1" value={pct} onChange={(e) => setPct(Number(e.target.value))} /></Field>
      <Field label="Number of trades"><Input type="number" value={periods} onChange={(e) => setPeriods(Number(e.target.value))} /></Field>
    </Section>
  );
}

/* ---------------- SL by Dollar ---------------- */
function SLByDollarCalc() {
  const [symbol, setSymbol] = useState('EURUSD');
  const [lots, setLots] = useState(0.1);
  const [maxLoss, setMaxLoss] = useState(50);
  const [entry, setEntry] = useState(1.1);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const preset = PRESETS[symbol];
  const pipVal = preset.pipValuePerLot * lots;
  const pips = pipVal > 0 ? maxLoss / pipVal : 0;
  const slPrice = side === 'BUY' ? entry - pips * preset.pipSize : entry + pips * preset.pipSize;
  return (
    <Section title="Stop Loss by Dollar" icon={<Wallet className="w-4 h-4" />} results={
      <>
        <Stat label="Pip value (this size)" value={`$${pipVal.toFixed(2)}`} />
        <Stat label="Stop distance" value={`${pips.toFixed(1)} pips`} big accent />
        <Stat label="Stop loss price" value={slPrice.toFixed(5)} accent />
      </>
    }>
      <Field label="Symbol"><SymbolSelect value={symbol} onChange={setSymbol} /></Field>
      <Field label="Side">
        <Select value={side} onValueChange={(v) => setSide(v as 'BUY'|'SELL')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="BUY">BUY</SelectItem><SelectItem value="SELL">SELL</SelectItem></SelectContent>
        </Select>
      </Field>
      <Field label="Lots"><Input type="number" step="0.01" value={lots} onChange={(e) => setLots(Number(e.target.value))} /></Field>
      <Field label="Entry price"><Input type="number" step="0.00001" value={entry} onChange={(e) => setEntry(Number(e.target.value))} /></Field>
      <Field label="Max loss ($)"><Input type="number" value={maxLoss} onChange={(e) => setMaxLoss(Number(e.target.value))} /></Field>
    </Section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
