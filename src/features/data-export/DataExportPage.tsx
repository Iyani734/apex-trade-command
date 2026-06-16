import { useMemo, useRef, useState } from 'react';
import { Download, FileJson, FileSpreadsheet, Database, Upload, UploadCloud } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type DataSet = 'history' | 'positions' | 'journal' | 'accounts' | 'all';

/**
 * Generic row type — any object with string keys.
 */
export type ExportRow = Record<string, unknown>;

/**
 * Provide the data you want to make exportable. Every dataset is optional —
 * any that you omit will just show 0 in the counters. `accountLabel` is
 * used in the export filename.
 */
export interface DataExportPageProps {
  history?: ExportRow[];
  positions?: ExportRow[];
  journal?: ExportRow[];
  accounts?: ExportRow[];
  accountLabel?: string;
  /**
   * Called with the parsed rows from a CSV / JSON drop or browse.
   * Return synchronously or as a promise. If omitted, imports are no-ops.
   */
  onImportJournal?: (rows: ExportRow[], filename: string) => void | Promise<void>;
  /**
   * Optional: pick a key to filter by date when the user uses From / To.
   * Defaults to `closeTime` then `openTime` then `date`.
   */
  dateKey?: string;
}

function toCSV(rows: ExportRow[]): string {
  if (!rows.length) return '';
  const headers = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set<string>()));
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const splitLine = (line: string) => {
    const out: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else {
        if (c === ',') { out.push(cur); cur = ''; }
        else if (c === '"') q = true;
        else cur += c;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = splitLine(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = splitLine(l);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DataExportPage({
  history = [],
  positions = [],
  journal = [],
  accounts = [],
  accountLabel = 'account',
  onImportJournal,
  dateKey,
}: DataExportPageProps = {}) {
  const [dataset, setDataset] = useState<DataSet>('history');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const pickDate = (r: ExportRow): string | undefined => {
    if (dateKey) return r[dateKey] as string | undefined;
    return (r.closeTime ?? r.openTime ?? r.date) as string | undefined;
  };

  const datasets = useMemo(() => {
    const inRange = (iso?: string) => {
      if (!iso) return true;
      const t = new Date(iso).getTime();
      if (Number.isNaN(t)) return true;
      if (from && t < new Date(from).getTime()) return false;
      if (to && t > new Date(to).getTime() + 86400000) return false;
      return true;
    };
    return {
      history: history.filter((h) => inRange(pickDate(h))),
      positions: positions.filter((p) => inRange(pickDate(p))),
      journal: journal.filter((j) => inRange(pickDate(j))),
      accounts,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, positions, journal, accounts, from, to, dateKey]);

  const counts = {
    history: datasets.history.length,
    positions: datasets.positions.length,
    journal: datasets.journal.length,
    accounts: datasets.accounts.length,
  };

  const handleExport = () => {
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const prefix = `${accountLabel}-${ts}`;
    const writeSet = (name: string, rows: ExportRow[]) => {
      if (!rows.length) { toast.warning(`No ${name} rows to export.`); return false; }
      if (format === 'csv') download(`${prefix}-${name}.csv`, toCSV(rows), 'text/csv');
      else download(`${prefix}-${name}.json`, JSON.stringify(rows, null, 2), 'application/json');
      return true;
    };
    let any = false;
    if (dataset === 'all') {
      if (format === 'json') {
        const bundle = { exportedAt: new Date().toISOString(), accountLabel, ...datasets };
        download(`${prefix}-bundle.json`, JSON.stringify(bundle, null, 2), 'application/json');
        any = true;
      } else {
        any = writeSet('history', datasets.history) || any;
        any = writeSet('positions', datasets.positions) || any;
        any = writeSet('journal', datasets.journal) || any;
        any = writeSet('accounts', datasets.accounts) || any;
      }
    } else {
      any = writeSet(dataset, datasets[dataset]);
    }
    if (any) toast.success('Export ready — check your downloads.');
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      let rows: unknown;
      if (file.name.toLowerCase().endsWith('.csv')) {
        rows = parseCSV(text);
      } else {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : (parsed.journal ?? parsed.rows ?? parsed.data);
      }
      if (!Array.isArray(rows)) throw new Error('No array found in file.');
      if (onImportJournal) {
        await onImportJournal(rows as ExportRow[], file.name);
        toast.success(`Imported ${rows.length} rows from ${file.name}.`);
      } else {
        toast.warning(`Parsed ${rows.length} rows but no import handler is connected.`);
      }
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach((f) => handleFile(f));
  };

  return (
    <div className="w-full min-h-screen space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Database className="w-7 h-7 text-primary" /> Data &amp; Export
        </h1>
        <p className="text-sm text-muted-foreground">
          Download trade history, open positions, your journal, and account snapshots for backup,
          tax filing, or analysis in Excel / Python.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Closed trades" value={counts.history} />
        <StatCard label="Open positions" value={counts.positions} />
        <StatCard label="Journal entries" value={counts.journal} />
        <StatCard label="Accounts" value={counts.accounts} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Download className="w-4 h-4" /> Export</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Dataset</Label>
              <Select value={dataset} onValueChange={(v) => setDataset(v as DataSet)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="history">Closed Trades</SelectItem>
                  <SelectItem value="positions">Open Positions</SelectItem>
                  <SelectItem value="journal">Journal Entries</SelectItem>
                  <SelectItem value="accounts">Accounts</SelectItem>
                  <SelectItem value="all">Everything (bundle)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as 'csv' | 'json')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Excel / Sheets)</SelectItem>
                  <SelectItem value="json">JSON (developers)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={handleExport} className="gap-2">
              {format === 'csv' ? <FileSpreadsheet className="w-4 h-4" /> : <FileJson className="w-4 h-4" />}
              Download
            </Button>
            <Button variant="outline" onClick={() => { setFrom(''); setTo(''); }}>Clear dates</Button>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Upload className="w-4 h-4" /> Import Journal</h2>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInput.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
              dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border/60 hover:border-primary/50 hover:bg-secondary/30'
            )}
          >
            <UploadCloud className={cn('w-12 h-12 mx-auto mb-3', dragOver ? 'text-primary' : 'text-muted-foreground')} />
            <p className="font-semibold mb-1">{dragOver ? 'Drop file to import' : 'Drag & drop a file here'}</p>
            <p className="text-sm text-muted-foreground">or click to browse — supports <code>.json</code> and <code>.csv</code></p>
            <input
              ref={fileInput}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              multiple
              className="hidden"
              onChange={(e) => {
                Array.from(e.target.files ?? []).forEach((f) => handleFile(f));
                e.target.value = '';
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Existing entries are preserved; imported rows are appended.
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-2 flex items-center gap-2"><Download className="w-4 h-4" /> Tips</h2>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>Use the <strong>bundle</strong> export monthly as a full backup.</li>
          <li>CSV opens directly in Excel, Google Sheets, Notion, and Power BI.</li>
          <li>Dates are stored in ISO 8601 UTC — convert in your spreadsheet if needed.</li>
        </ul>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-mono font-bold mt-1">{value}</div>
    </Card>
  );
}
