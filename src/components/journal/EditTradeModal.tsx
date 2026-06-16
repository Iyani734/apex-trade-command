import { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { JournalEntry } from '@/store/tradingStore';
import { userPrefs } from '@/lib/userPrefs';

const DEFAULT_EMOTIONS = ['Confident', 'Calm', 'Patient', 'Anxious', 'FOMO', 'Revenge', 'Greedy'];
const DEFAULT_SETUPS = ['A+', 'A', 'B', 'C', 'D', 'E', 'F'];

interface Props {
  entry: JournalEntry | null;
  onClose: () => void;
  onSave: (id: string, updates: Partial<JournalEntry>) => void;
}

/**
 * Single-page edit form for a journal entry — replaces the multi-step
 * promptDialog chain. Captures strategy, setup, confidence, emotion,
 * reason and notes all at once.
 */
export function EditTradeModal({ entry, onClose, onSave }: Props) {
  const [strategies, setStrategies] = useState<string[]>(userPrefs.getStrategies());
  const [strategy, setStrategy] = useState('');
  const [newStrategy, setNewStrategy] = useState('');
  const [setup, setSetup] = useState('');
  const [confidence, setConfidence] = useState<number>(3);
  const [emotion, setEmotion] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!entry) return;
    setStrategies(userPrefs.getStrategies());
    setStrategy(entry.strategy || '');
    setNewStrategy('');
    setSetup(entry.setup || '');
    setConfidence(entry.confidence || 3);
    setEmotion(entry.emotion && entry.emotion !== '—' ? entry.emotion : '');
    setReason(entry.reason && entry.reason !== '—' ? entry.reason : '');
    setNotes(entry.notes || '');
  }, [entry?.id]);

  if (!entry) return null;

  const handleSave = () => {
    const finalStrategy = strategy || newStrategy.trim();
    if (!finalStrategy) {
      toast.error('Please pick or enter a strategy');
      return;
    }
    if (newStrategy.trim()) userPrefs.addStrategy(newStrategy.trim());
    onSave(entry.id, {
      strategy: finalStrategy,
      setup: setup || undefined,
      confidence,
      emotion: emotion || '—',
      reason: reason.trim() || '—',
      notes: notes.trim() || undefined,
    });
    toast.success('Entry updated');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-xl max-h-[92vh] overflow-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between sticky top-0 bg-card/95 backdrop-blur-md -mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-border/30 z-10">
          <div>
            <h2 className="text-lg font-bold">Edit Trade</h2>
            <p className="text-xs text-muted-foreground font-mono">
              {entry.symbol} · {entry.type} · #{entry.ticket}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Strategy</label>
          {strategies.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {strategies.map((s) => (
                <button
                  key={s}
                  onClick={() => { setStrategy(s); setNewStrategy(''); }}
                  className={chipClass(strategy === s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={newStrategy}
              onChange={(e) => { setNewStrategy(e.target.value); setStrategy(''); }}
              placeholder={strategies.length === 0 ? 'Enter strategy (e.g. ICT OB, Breakout)' : 'Or add a new one'}
              className="flex-1 bg-secondary/50 rounded-lg px-3 py-2 text-sm border border-border/50 focus:outline-none focus:border-primary/50"
            />
            <button
              onClick={() => {
                if (newStrategy.trim()) {
                  userPrefs.addStrategy(newStrategy.trim());
                  setStrategies(userPrefs.getStrategies());
                  setStrategy(newStrategy.trim());
                  setNewStrategy('');
                }
              }}
              className="px-3 rounded-lg bg-secondary hover:bg-secondary/70 text-muted-foreground"
              title="Save strategy for reuse"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Setup grade</label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_SETUPS.map((s) => (
              <button
                key={s}
                onClick={() => setSetup(setup === s ? '' : s)}
                className={chipClass(setup === s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Confidence (1-5)</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setConfidence(n)}
                className={chipClass(confidence === n) + ' min-w-9 justify-center'}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Emotion</label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_EMOTIONS.map((e) => (
              <button
                key={e}
                onClick={() => setEmotion(emotion === e ? '' : e)}
                className={chipClass(emotion === e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Reason / Setup notes</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="What did you see? Why this trade?"
            className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm border border-border/50 focus:outline-none focus:border-primary/50"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any extra context, mental state, lessons learned…"
            className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm border border-border/50 focus:outline-none focus:border-primary/50"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 sticky bottom-0 bg-card/95 backdrop-blur-md -mx-6 -mb-6 px-6 pb-6 pt-4 border-t border-border/30">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function chipClass(active: boolean) {
  return `px-3 py-1 rounded-lg text-xs border transition-colors ${
    active
      ? 'bg-primary/20 text-primary border-primary/40'
      : 'bg-secondary/50 text-muted-foreground border-border/50 hover:border-border'
  }`;
}
