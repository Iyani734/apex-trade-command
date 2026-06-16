import DataExportPage from '@/features/data-export/DataExportPage';
import { useTradingStore } from '@/store/tradingStore';

export default function DataExportRoute() {
  const { history, positions, journal, accounts, activeAccountId } = useTradingStore();
  const active = accounts.find((a) => a.id === activeAccountId);
  return (
    <DataExportPage
      history={history as unknown as Record<string, unknown>[]}
      positions={positions as unknown as Record<string, unknown>[]}
      journal={journal as unknown as Record<string, unknown>[]}
      accounts={accounts as unknown as Record<string, unknown>[]}
      accountLabel={`forexanalyzer-${active?.alias ?? 'account'}`}
      onImportJournal={(rows) =>
        useTradingStore.setState((s) => ({ journal: [...s.journal, ...(rows as never[])] }))
      }
    />
  );
}
