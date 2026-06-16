import { useState } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Calendar as CalIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DateRange } from '@/lib/analytics';

interface Props {
  range: DateRange;
  onChange: (r: DateRange) => void;
  minDate: Date | null; // first trade date
}

const PRESETS: { label: string; key: string; days: number | 'all' | 'ytd' }[] = [
  { label: 'All Time', key: 'all', days: 'all' },
  { label: '7 Days',   key: '7',   days: 7 },
  { label: '30 Days',  key: '30',  days: 30 },
  { label: '90 Days',  key: '90',  days: 90 },
  { label: 'This Year',key: 'ytd', days: 'ytd' },
];

export function DateRangeFilter({ range, onChange, minDate }: Props) {
  const [openFrom, setOpenFrom] = useState(false);
  const [openTo, setOpenTo] = useState(false);
  const [activeKey, setActiveKey] = useState<string>('all');

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setActiveKey(p.key);
    if (p.days === 'all') return onChange({ from: null, to: null });
    const to = new Date();
    let from: Date;
    if (p.days === 'ytd') from = new Date(to.getFullYear(), 0, 1);
    else { from = new Date(); from.setDate(from.getDate() - p.days); }
    if (minDate && from < minDate) from = minDate;
    onChange({ from, to });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex items-center gap-1 rounded-lg bg-secondary/40 p-1">
        {PRESETS.map((p) => {
          const isActive = activeKey === p.key;
          return (
            <button
              key={p.key}
              onClick={() => applyPreset(p)}
              className={cn(
                'relative px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider rounded transition-colors z-10',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="rangePill"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="absolute inset-0 rounded bg-primary/15 ring-1 ring-primary/30 -z-10"
                />
              )}
              {p.label}
            </button>
          );
        })}
      </div>

      <Popover open={openFrom} onOpenChange={setOpenFrom}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs font-mono">
            <CalIcon className="w-3 h-3 mr-1" />
            {range.from ? format(range.from, 'MMM dd, yyyy') : 'From'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={range.from || undefined}
            onSelect={(d) => { onChange({ ...range, from: d || null }); setOpenFrom(false); }}
            disabled={(d) => (minDate ? d < minDate : false) || d > new Date()}
            initialFocus
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>

      <Popover open={openTo} onOpenChange={setOpenTo}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs font-mono">
            <CalIcon className="w-3 h-3 mr-1" />
            {range.to ? format(range.to, 'MMM dd, yyyy') : 'To'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={range.to || undefined}
            onSelect={(d) => { onChange({ ...range, to: d || null }); setOpenTo(false); }}
            disabled={(d) => (range.from ? d < range.from : false) || d > new Date()}
            initialFocus
            className={cn('p-3 pointer-events-auto')}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
