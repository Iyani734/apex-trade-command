import { useEffect, useState } from 'react';
import { Target, Flame, Shield, Award, TrendingUp, AlertTriangle } from 'lucide-react';

/**
 * Trading Plan & Goals Tracker — independent module.
 * Persists to localStorage under `tvp.tradingPlan` so it works without a backend.
 */
const STORAGE_KEY = 'tvp.tradingPlan.v1';

interface Plan {
  monthlyTargetPct: number;
  weeklyTargetPct: number;
  maxDailyLossPct: number;
  maxTradesPerDay: number;
  rules: string[];
  currentBalance: number;
  startBalance: number;
  weekPnl: number;
  monthPnl: number;
  todayPnl: number;
  tradesToday: number;
  winStreak: number;
  lossStreak: number;
  rulesFollowedPct: number; // 0-100 self-scored
}

const DEFAULT_PLAN: Plan = {
  monthlyTargetPct: 8,
  weeklyTargetPct: 2,
  maxDailyLossPct: 3,
  maxTradesPerDay: 5,
  rules: [
    'Wait for confirmation before entry',
    'Always set SL before TP',
    'Never trade during red-folder news',
    'No revenge trades after a loss',
  ],
  currentBalance: 10000,
  startBalance: 10000,
  weekPnl: 0,
  monthPnl: 0,
  todayPnl: 0,
  tradesToday: 0,
  winStreak: 0,
  lossStreak: 0,
  rulesFollowedPct: 100,
};

export interface TradingPlanPageProps {
  initial?: Partial<Plan>;
  onChange?: (p: Plan) => void;
}

export function TradingPlanPage({ initial, onChange }: TradingPlanPageProps) {
  const [plan, setPlan] = useState<Plan>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_PLAN, ...JSON.parse(raw), ...initial };
    } catch { /* ignore */ }
    return { ...DEFAULT_PLAN, ...initial };
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(plan)); } catch { /* ignore */ }
    onChange?.(plan);
  }, [plan, onChange]);

  const update = (patch: Partial<Plan>) => setPlan((p) => ({ ...p, ...patch }));

  const monthlyTarget$ = (plan.startBalance * plan.monthlyTargetPct) / 100;
  const weeklyTarget$ = (plan.startBalance * plan.weeklyTargetPct) / 100;
  const maxDailyLoss$ = (plan.currentBalance * plan.maxDailyLossPct) / 100;

  const monthProg = Math.min(100, Math.max(0, (plan.monthPnl / monthlyTarget$) * 100));
  const weekProg = Math.min(100, Math.max(0, (plan.weekPnl / weeklyTarget$) * 100));
  const dailyLossUsed = Math.min(100, Math.max(0, (-plan.todayPnl / maxDailyLoss$) * 100));

  // Discipline score: blend of rules followed, daily loss buffer, and trade count compliance
  const tradesScore = plan.tradesToday <= plan.maxTradesPerDay ? 100 : Math.max(0, 100 - (plan.tradesToday - plan.maxTradesPerDay) * 20);
  const lossScore = Math.max(0, 100 - dailyLossUsed);
  const discipline = Math.round((plan.rulesFollowedPct * 0.5) + (lossScore * 0.3) + (tradesScore * 0.2));

  const grade =
    discipline >= 90 ? { letter: 'A+', color: 'text-success' } :
    discipline >= 75 ? { letter: 'A',  color: 'text-success' } :
    discipline >= 60 ? { letter: 'B',  color: 'text-primary' } :
    discipline >= 45 ? { letter: 'C',  color: 'text-warning' } :
                       { letter: 'F',  color: 'text-destructive' };

  return (
    <div className="w-full min-h-screen bg-background text-foreground">
      <div className="px-6 py-6 border-b border-border/50">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="w-6 h-6 text-primary" /> Trading Plan & Goals
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Set targets, enforce risk rules, track discipline.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 p-6">
        {/* Discipline score */}
        <div className="rounded-xl border border-border/50 bg-gradient-to-br from-primary/10 to-accent/5 p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest"><Award className="w-3.5 h-3.5" /> Discipline</div>
          <div className={`text-6xl font-bold mt-2 ${grade.color}`}>{grade.letter}</div>
          <div className="text-sm text-muted-foreground mt-1">{discipline} / 100</div>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest"><Flame className="w-3.5 h-3.5 text-warning" /> Win Streak</div>
          <div className="text-4xl font-bold mt-2 text-success">{plan.winStreak}</div>
          <input
            type="number"
            value={plan.winStreak}
            onChange={(e) => update({ winStreak: Number(e.target.value) })}
            className="mt-2 w-full bg-secondary/50 rounded px-2 py-1 text-xs"
          />
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest"><AlertTriangle className="w-3.5 h-3.5 text-destructive" /> Loss Streak</div>
          <div className="text-4xl font-bold mt-2 text-destructive">{plan.lossStreak}</div>
          <input
            type="number"
            value={plan.lossStreak}
            onChange={(e) => update({ lossStreak: Number(e.target.value) })}
            className="mt-2 w-full bg-secondary/50 rounded px-2 py-1 text-xs"
          />
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-widest"><TrendingUp className="w-3.5 h-3.5 text-primary" /> Balance</div>
          <input
            type="number"
            value={plan.currentBalance}
            onChange={(e) => update({ currentBalance: Number(e.target.value) })}
            className="mt-2 w-full bg-transparent text-2xl font-mono outline-none"
          />
          <div className="text-xs text-muted-foreground mt-1">Start ${plan.startBalance.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-6">
        <ProgressCard
          title="Monthly target"
          target={monthlyTarget$}
          actual={plan.monthPnl}
          pct={monthProg}
          targetPctLabel={`${plan.monthlyTargetPct}%`}
        />
        <ProgressCard
          title="Weekly target"
          target={weeklyTarget$}
          actual={plan.weekPnl}
          pct={weekProg}
          targetPctLabel={`${plan.weeklyTargetPct}%`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6">
        {/* Risk rules */}
        <div className="rounded-xl border border-border/50 bg-card p-5 lg:col-span-1">
          <div className="flex items-center gap-2 text-sm font-semibold mb-3">
            <Shield className="w-4 h-4 text-warning" /> Risk Limits
          </div>
          <NumberRow label="Monthly target %" value={plan.monthlyTargetPct} onChange={(v) => update({ monthlyTargetPct: v })} />
          <NumberRow label="Weekly target %"  value={plan.weeklyTargetPct}  onChange={(v) => update({ weeklyTargetPct: v })} />
          <NumberRow label="Max daily loss %" value={plan.maxDailyLossPct}  onChange={(v) => update({ maxDailyLossPct: v })} />
          <NumberRow label="Max trades/day"   value={plan.maxTradesPerDay}  onChange={(v) => update({ maxTradesPerDay: v })} />

          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-destructive font-semibold">Daily loss used</span>
              <span className="font-mono">{dailyLossUsed.toFixed(0)}%</span>
            </div>
            <div className="h-2 mt-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-destructive transition-all" style={{ width: `${dailyLossUsed}%` }} />
            </div>
            <div className="text-[10px] text-muted-foreground mt-2">
              Limit: ${maxDailyLoss$.toFixed(0)} · Today P&L: ${plan.todayPnl.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Today */}
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Today</h3>
          <NumberRow label="Today P&L ($)" value={plan.todayPnl} onChange={(v) => update({ todayPnl: v })} />
          <NumberRow label="Week P&L ($)"  value={plan.weekPnl}  onChange={(v) => update({ weekPnl: v })} />
          <NumberRow label="Month P&L ($)" value={plan.monthPnl} onChange={(v) => update({ monthPnl: v })} />
          <NumberRow label="Trades taken today" value={plan.tradesToday} onChange={(v) => update({ tradesToday: v })} />
          <div className="mt-3">
            <label className="text-xs text-muted-foreground">Rules followed today: {plan.rulesFollowedPct}%</label>
            <input
              type="range" min={0} max={100} value={plan.rulesFollowedPct}
              onChange={(e) => update({ rulesFollowedPct: Number(e.target.value) })}
              className="w-full mt-1"
            />
          </div>
        </div>

        {/* Rule checklist */}
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <h3 className="text-sm font-semibold mb-3">Personal Rules</h3>
          <div className="space-y-2">
            {plan.rules.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={r}
                  onChange={(e) => {
                    const next = [...plan.rules];
                    next[i] = e.target.value;
                    update({ rules: next });
                  }}
                  className="flex-1 bg-secondary/40 rounded px-2 py-1.5 text-xs"
                />
                <button
                  onClick={() => update({ rules: plan.rules.filter((_, idx) => idx !== i) })}
                  className="text-xs text-destructive hover:opacity-80"
                >✕</button>
              </div>
            ))}
            <button
              onClick={() => update({ rules: [...plan.rules, 'New rule'] })}
              className="w-full px-2 py-1.5 text-xs rounded bg-primary/10 text-primary hover:bg-primary/20"
            >+ Add rule</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 bg-secondary/40 rounded px-2 py-1 text-xs font-mono text-right"
      />
    </div>
  );
}

function ProgressCard({ title, target, actual, pct, targetPctLabel }: { title: string; target: number; actual: number; pct: number; targetPctLabel: string }) {
  const color = pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-primary' : 'bg-accent';
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{targetPctLabel}</span>
      </div>
      <div className="flex items-end justify-between mt-2">
        <div className="text-3xl font-mono">${actual.toFixed(0)}</div>
        <div className="text-xs text-muted-foreground">/ ${target.toFixed(0)}</div>
      </div>
      <div className="mt-3 h-3 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-muted-foreground mt-1">{pct.toFixed(0)}% of goal</div>
    </div>
  );
}

export default TradingPlanPage;
