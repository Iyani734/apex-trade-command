// Auto-computed gamification score for a closed trade (0-100).
// Goal: reward the trader for *good process*, not just lucky outcomes.
//
// Composite of four sub-scores (each 0-25):
//   - RR        : achieved risk/reward (was the reward worth the risk?)
//   - Rule      : did the trader follow their own rules (strategy + reason logged)?
//   - Timing    : trade duration vs symbol-typical hold (penalise both flips and bag-holds)
//   - Outcome   : net profit relative to typical trade size on this account
import type { JournalEntry } from '@/store/tradingStore';

export interface ScoreBreakdown {
  rr: number;       // 0-25
  rule: number;     // 0-25
  timing: number;   // 0-25
  outcome: number;  // 0-25
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Compute a 0-100 score for a closed trade.
 * `peerAvgAbsProfit` = the average |profit| across the trader's other closed
 * trades on the same account, so outcome scoring is account-relative.
 */
export function scoreTrade(entry: JournalEntry, peerAvgAbsProfit: number): {
  score: number;
  breakdown: ScoreBreakdown;
} {
  const profit = entry.profit ?? 0;
  const snap = entry.entrySnapshot;
  const exit = entry.exitSnapshot;

  // === RR (0-25) ===
  let rr = 12; // default = "neutral" if no SL/TP info
  if (snap && snap.sl > 0 && snap.openPrice > 0) {
    const risk = Math.abs(snap.openPrice - snap.sl);
    const reward = exit ? Math.abs(exit.closePrice - snap.openPrice) : 0;
    if (risk > 0 && reward > 0) {
      const ratio = profit > 0 ? reward / risk : -(reward / risk);
      // 1R = 12, 2R = 18, 3R+ = 25, -1R = 0
      rr = clamp(12 + ratio * 6, 0, 25);
    } else if (profit < 0) {
      rr = 4;
    }
  } else if (profit > 0) rr = 16;
  else if (profit < 0) rr = 6;

  // === Rule adherence (0-25) ===
  // Did the trader log enough context to call this a planned trade?
  let rule = 0;
  if (entry.strategy && entry.strategy !== '—') rule += 8;
  if (entry.reason && entry.reason.trim().length >= 8) rule += 8;
  if (entry.setup) rule += 5;
  if (entry.emotion && entry.emotion !== '—') rule += 4;
  rule = clamp(rule, 0, 25);

  // === Timing (0-25) ===
  // Penalise <60s flips and >7-day bag-holds; reward 5 min – 24 h holds.
  let timing = 12;
  if (exit?.durationMs) {
    const minutes = exit.durationMs / 60000;
    if (minutes < 1) timing = 6;             // panic flip
    else if (minutes < 5) timing = 14;
    else if (minutes <= 60 * 24) timing = 22; // sweet spot
    else if (minutes <= 60 * 24 * 7) timing = 16;
    else timing = 8;                          // bag-holding
  }

  // === Outcome (0-25) — account-relative ===
  let outcome = 12;
  if (peerAvgAbsProfit > 0) {
    const ratio = profit / peerAvgAbsProfit;       // -∞ … +∞
    outcome = clamp(12 + ratio * 6, 0, 25);
  } else {
    outcome = profit > 0 ? 18 : profit < 0 ? 6 : 12;
  }

  const total = Math.round(rr + rule + timing + outcome);
  return {
    score: clamp(total, 0, 100),
    breakdown: {
      rr: Math.round(rr),
      rule: Math.round(rule),
      timing: Math.round(timing),
      outcome: Math.round(outcome),
    },
  };
}

export const scoreGrade = (s: number): { label: string; tone: string } => {
  if (s >= 85) return { label: 'A+', tone: 'text-success' };
  if (s >= 75) return { label: 'A', tone: 'text-success' };
  if (s >= 65) return { label: 'B', tone: 'text-primary' };
  if (s >= 50) return { label: 'C', tone: 'text-warning' };
  if (s >= 35) return { label: 'D', tone: 'text-warning' };
  return { label: 'F', tone: 'text-destructive' };
};
