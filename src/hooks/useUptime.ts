import { useEffect, useState } from 'react';

/**
 * Real uptime — counts time since the EA was first reported online for the
 * active account. Resets when the EA goes offline.
 */
export function useUptime(connected: boolean, accountId: string | null): string {
  const [tick, setTick] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!accountId) {
      setStartedAt(null);
      return;
    }
    if (connected) {
      const key = `tvp.uptimeStart.${accountId}`;
      let saved = Number(localStorage.getItem(key) || 0);
      if (!saved) {
        saved = Date.now();
        localStorage.setItem(key, String(saved));
      }
      setStartedAt(saved);
    } else {
      if (accountId) localStorage.removeItem(`tvp.uptimeStart.${accountId}`);
      setStartedAt(null);
    }
  }, [connected, accountId]);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return '—';
  const ms = Date.now() - startedAt;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  // mark tick as used so linter doesn't complain
  void tick;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
