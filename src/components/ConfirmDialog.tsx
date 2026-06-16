import { create } from 'zustand';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmOpts {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}
interface ConfirmState {
  open: boolean;
  opts: ConfirmOpts;
  resolve?: (v: boolean) => void;
  show: (opts: ConfirmOpts) => Promise<boolean>;
  close: (v: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  opts: { title: '' },
  show: (opts) =>
    new Promise<boolean>((resolve) => set({ open: true, opts, resolve })),
  close: (v) => {
    get().resolve?.(v);
    set({ open: false, resolve: undefined });
  },
}));

export const confirmDialog = (opts: ConfirmOpts) => useConfirmStore.getState().show(opts);

export function ConfirmDialogHost() {
  const { open, opts, close } = useConfirmStore();
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent className="glass-card border-border/40">
        <AlertDialogHeader>
          <AlertDialogTitle>{opts.title}</AlertDialogTitle>
          {opts.description && (
            <AlertDialogDescription>{opts.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {opts.cancelLabel || 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={opts.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {opts.confirmLabel || 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
