import { useState, useRef, useEffect } from 'react';
import { Check, GitCompare, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Account } from '@/store/tradingStore';

interface Props {
  accounts: Account[];
  selected: string[]; // account IDs to compare against
  primaryId: string | null;
  onChange: (ids: string[]) => void;
}

export function AccountComparePicker({ accounts, selected, primaryId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const others = accounts.filter((a) => a.id !== primaryId);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors',
          selected.length
            ? 'bg-accent/15 text-accent border border-accent/30'
            : 'bg-secondary/40 text-muted-foreground hover:text-foreground border border-transparent'
        )}
      >
        <GitCompare className="w-3 h-3" />
        Compare {selected.length > 0 && `(${selected.length})`}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 z-50 rounded-lg border border-border/60 bg-popover shadow-2xl p-2">
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Overlay other accounts
          </div>
          {others.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">No other accounts</div>
          )}
          {others.map((a) => (
            <button
              key={a.id}
              onClick={() => toggle(a.id)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-secondary/50 transition-colors text-left"
            >
              <div className={cn(
                'w-4 h-4 rounded border flex items-center justify-center',
                selected.includes(a.id) ? 'bg-accent border-accent' : 'border-border'
              )}>
                {selected.includes(a.id) && <Check className="w-3 h-3 text-accent-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{a.alias}</div>
                <div className="text-[10px] font-mono text-muted-foreground">{a.id} • {a.broker}</div>
              </div>
              <div className={cn('w-2 h-2 rounded-full', a.status === 'ONLINE' ? 'bg-success' : 'bg-destructive')} />
            </button>
          ))}
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full mt-1 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground rounded hover:bg-secondary/50"
            >
              Clear comparison
            </button>
          )}
        </div>
      )}
    </div>
  );
}
