# Data & Export (self-contained)

Drop this entire `data-export/` folder into any React + Vite + Tailwind + shadcn project.

## Files
- `DataExportPage.tsx` — main page (route component)

## Features
- CSV + JSON export for any 4 datasets (closed trades / open positions / journal / accounts)
- "Everything (bundle)" export as a single JSON file with all sets
- Date range filter (From / To) applied to every set
- Drag & drop or click-to-browse file import (`.csv` and `.json`, multi-file)
- Filename prefixed with your account label + ISO timestamp

## Dependencies
- `lucide-react`, `sonner`
- shadcn UI: `card`, `button`, `label`, `input`, `select`
- Utility: `@/lib/utils` `cn()` helper (shadcn default)

No data store, no API, no `localStorage`. Pure component — you pass the data in,
you handle the import callback.

## Install (1 step)

Add a route:

```tsx
import DataExportPage from '@/features/data-export/DataExportPage';
// ...
<Route path="/data" element={<DataExportPage />} />
```

Sidebar link (optional):

```tsx
import { Database } from 'lucide-react';
{ title: 'Data & Export', url: '/data', icon: Database }
```

## Wiring it to your data

All props are optional, but to actually export anything you'll want to pass at
least one dataset. Example with a Zustand store:

```tsx
import DataExportPage from '@/features/data-export/DataExportPage';
import { useTradingStore } from '@/store/tradingStore';

export default function DataRoute() {
  const { history, positions, journal, accounts, activeAccountId } = useTradingStore();
  const active = accounts.find((a) => a.id === activeAccountId);

  return (
    <DataExportPage
      history={history}
      positions={positions}
      journal={journal}
      accounts={accounts}
      accountLabel={active?.alias ?? 'account'}
      onImportJournal={(rows) =>
        useTradingStore.setState((s) => ({ journal: [...s.journal, ...rows] as never[] }))
      }
    />
  );
}
```

## Props

| Prop              | Type                                                  | Default          | Purpose                                            |
| ----------------- | ----------------------------------------------------- | ---------------- | -------------------------------------------------- |
| `history`         | `ExportRow[]`                                         | `[]`             | Closed trades                                      |
| `positions`       | `ExportRow[]`                                         | `[]`             | Open positions                                     |
| `journal`         | `ExportRow[]`                                         | `[]`             | Journal entries                                    |
| `accounts`        | `ExportRow[]`                                         | `[]`             | Account snapshots                                  |
| `accountLabel`    | `string`                                              | `'account'`      | Used in download filenames                         |
| `onImportJournal` | `(rows, filename) => void \| Promise<void>`           | no-op (warning)  | Called with parsed rows from drag/drop or browse   |
| `dateKey`         | `string`                                              | auto-detected    | Property name used for From/To filtering           |

`ExportRow` is `Record<string, unknown>` — any plain object works.

Auto-detected date keys: `closeTime`, then `openTime`, then `date`.
