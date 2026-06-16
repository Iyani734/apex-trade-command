import { useEffect, useState } from 'react';
import { X, Bell } from 'lucide-react';
import type { Alert } from '@/lib/alerts';

interface Props {
  open: boolean;
  initial?: Alert | null;
  onClose: () => void;
  onSave: (a: Alert) => void;
}

/**
 * Simplified alert form: alerts ALWAYS fire when price touches the level
 * (above OR below). No condition picker — the EA decides direction by
 * comparing current price to value at create time.
 */
export function AlertFormModal({ open, initial, onClose, onSave }: Props) {
  const [symbol, setSymbol] = useState('');
  const [value, setValue] = useState<string>('');
  const [note, setNote] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [triggerOnce, setTriggerOnce] = useState(true);

  useEffect(() => {
    if (initial) {
      setSymbol(initial.symbol);
      setValue(String(initial.value));
      setNote(initial.note || '');
      setEnabled(initial.enabled);
      setTriggerOnce(initial.triggerOnce);
    } else {
      setSymbol(''); setValue(''); setNote(''); setEnabled(true); setTriggerOnce(true);
    }
  }, [initial, open]);

  if (!open) return null;

  const handleSave = () => {
    if (!symbol.trim() || value === '') return;
    const out: Alert = {
      id: initial?.id || crypto.randomUUID(),
      symbol: symbol.trim().toUpperCase(),
      condition: 'price_touch',
      value: Number(value),
      enabled,
      note: note.trim() || undefined,
      createdAt: initial?.createdAt || new Date().toISOString(),
      triggerOnce,
    };
    onSave(out);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="glass-card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            {initial ? 'Edit Alert' : 'New Price Alert'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Alert fires the moment price <span className="text-primary font-semibold">touches</span> the level — works whether price is moving up or down.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Symbol</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="EURUSD"
              className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm font-mono uppercase border border-border/50 focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Price level</label>
            <input
              type="number"
              step="0.00001"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="1.0850"
              className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm font-mono border border-border/50 focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Resistance break"
              className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm border border-border/50 focus:outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Enabled
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={triggerOnce} onChange={(e) => setTriggerOnce(e.target.checked)} />
              Delete after first trigger
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm bg-secondary hover:bg-secondary/70 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
