import { useEffect } from 'react';
import { useTradingStore } from '@/store/tradingStore';
import { userPrefs } from '@/lib/userPrefs';
import {
  mockAccounts, mockPositions, mockHistory, mockAnalytics,
  mockEAStatus, mockCopyConfigs, mockJournal,
} from '@/services/mockData';

const KEY = 'tvp.mockMode';
const SEED_KEY = 'tvp.mockJournalSeeded.v2';

export const mockMode = {
  isEnabled: () => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  },
  setEnabled: (on: boolean) => {
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
  },
};

/**
 * Loads the demo data set. Only invoked when the user explicitly turns
 * Mock Mode ON from Settings — never by default.
 */
export function useMockData() {
  useEffect(() => {
    const s = useTradingStore.getState();
    s.setAccounts(mockAccounts);
    s.setActiveAccount(mockAccounts[0].id);
    s.setSnapshot(mockAccounts[0].id, {
      positions: mockPositions,
      history: mockHistory,
      analytics: mockAnalytics,
      eaStatus: mockEAStatus,
    });
    s.setCopyConfigs(mockCopyConfigs);
    s.setWsConnected(true);

    // Seed rich journal entries once — preserves user edits afterwards.
    try {
      if (localStorage.getItem(SEED_KEY) !== '1') {
        const existing = userPrefs.getJournal();
        const existingIds = new Set(existing.map((e: any) => e.id));
        const fresh = mockJournal.filter((m) => !existingIds.has(m.id));
        if (fresh.length) {
          fresh.forEach((entry) => userPrefs.addJournal(entry));
          ['ICT OB', 'Breakout', 'Smart Money', 'Impulse'].forEach((st) => userPrefs.addStrategy(st));
          useTradingStore.setState({ journal: userPrefs.getJournal() });
        }
        localStorage.setItem(SEED_KEY, '1');
      }
    } catch { /* ignore */ }
  }, []);
}
