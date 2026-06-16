import { create } from 'zustand';
import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PromptOpts {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  type?: 'text' | 'number';
  confirmLabel?: string;
}

interface PromptState {
  open: boolean;
  opts: PromptOpts;
  resolve?: (v: string | null) => void;
  show: (opts: PromptOpts) => Promise<string | null>;
  close: (v: string | null) => void;
}

const useStore = create<PromptState>((set, get) => ({
  open: false,
  opts: { title: '' },
  show: (opts) => new Promise<string | null>((resolve) => set({ open: true, opts, resolve })),
  close: (v) => {
    get().resolve?.(v);
    set({ open: false, resolve: undefined });
  },
}));

export const promptDialog = (opts: PromptOpts) => useStore.getState().show(opts);

export function PromptDialogHost() {
  const { open, opts, close } = useStore();
  const [val, setVal] = useState('');
  useEffect(() => {
    if (open) setVal(opts.defaultValue ?? '');
  }, [open, opts.defaultValue]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(null); }}>
      <DialogContent className="glass-card border-border/40">
        <DialogHeader>
          <DialogTitle>{opts.title}</DialogTitle>
          {opts.description && <DialogDescription>{opts.description}</DialogDescription>}
        </DialogHeader>
        <Input
          autoFocus
          type={opts.type || 'text'}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={opts.placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter') close(val); }}
          className="font-mono"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => close(null)}>Cancel</Button>
          <Button onClick={() => close(val)}>{opts.confirmLabel || 'OK'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
