import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export interface EditablePair {
  slaveAccountId: string;
  lotMultiplier: number;
  copySL: boolean;
  copyTP: boolean;
  active: boolean;
}

interface Props {
  open: boolean;
  initial: EditablePair | null;
  onClose: () => void;
  onSave: (updates: Omit<EditablePair, 'slaveAccountId'>) => void;
}

export function EditPairModal({ open, initial, onClose, onSave }: Props) {
  const [lotMult, setLotMult] = useState(1);
  const [copySL, setCopySL] = useState(true);
  const [copyTP, setCopyTP] = useState(true);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (initial) {
      setLotMult(initial.lotMultiplier);
      setCopySL(initial.copySL);
      setCopyTP(initial.copyTP);
      setActive(initial.active);
    }
  }, [initial, open]);

  if (!open || !initial) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Edit Copy Pair</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Lot Multiplier</label>
            <input
              type="number" step="0.01" value={lotMult}
              onChange={(e) => setLotMult(Number(e.target.value))}
              className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm font-mono border border-border/50 focus:outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={copySL} onChange={(e) => setCopySL(e.target.checked)} /> Copy SL
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={copyTP} onChange={(e) => setCopyTP(e.target.checked)} /> Copy TP
            </label>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active (slave auto-resumes & propagates closes)
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm bg-secondary hover:bg-secondary/70 transition-colors">Cancel</button>
          <button
            onClick={() => onSave({ lotMultiplier: lotMult, copySL, copyTP, active })}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
