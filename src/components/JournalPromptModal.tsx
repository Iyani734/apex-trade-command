import { useEffect, useMemo, useState } from 'react';
import { useTradingStore } from '@/store/tradingStore';
import { userPrefs } from '@/lib/userPrefs';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_EMOTIONS = ['Confident', 'Calm', 'Patient', 'Anxious', 'FOMO', 'Revenge', 'Greedy'];
const DEFAULT_SETUPS = ['A+', 'A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Modal that appears when the EA reports a NEW manually-opened position.
 * Captures strategy, setup, confidence, emotion, reason, and a free-form note.
 */
export function JournalPromptModal() {
  const prompts = useTradingStore((s) => s.journalPrompts);
  const shift = useTradingStore((s) => s.shiftJournalPrompt);
  const addJournalEntry = useTradingStore((s) => s.addJournalEntry);
  const journal = useTradingStore((s) => s.journal);
  const updateJournalEntry = useTradingStore((s) => s.updateJournalEntry);

  const current = prompts[0];
  const [strategies, setStrategies] = useState<string[]>(userPrefs.getStrategies());
  const [strategy, setStrategy] = useState('');
  const [newStrategy, setNewStrategy] = useState('');
  const [setup, setSetup] = useState('');
  const [confidence, setConfidence] = useState<number>(3);
  const [emotion, setEmotion] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceOverride, setSourceOverride] = useState<'manual' | 'copier'>('manual');

  useEffect(() => {
    if (current) {
      setStrategy('');
      setNewStrategy('');
      setSetup('');
      setConfidence(3);
      setEmotion('');
      setReason('');
      setNotes('');
      setSourceOverride('manual');
      setStrategies(userPrefs.getStrategies());
    }
  }, [current?.position.ticket]);

  const finalStrategy = useMemo(() => strategy || newStrategy.trim(), [strategy, newStrategy]);

  if (!current) return null;
  const { position, accountId } = current;

  const handleSave = () => {
    if (!finalStrategy) {
      toast.error('Please pick or enter a strategy');
      return;
    }
    if (newStrategy.trim()) userPrefs.addStrategy(newStrategy.trim());

    // If autoRecord already created a stub journal entry for this ticket,
    // update it in place so we never produce a duplicate row.
    const existing = journal.find((j) => j.ticket === position.ticket && j.accountId === accountId);
    const payload = {
      strategy: finalStrategy,
      setup: setup || undefined,
      confidence,
      reason: reason.trim() || '—',
      emotion: emotion || '—',
      notes: notes.trim() || undefined,
      source: sourceOverride,
    };

    if (existing) {
      updateJournalEntry(existing.id, payload);
    } else {
      addJournalEntry({
        id: `manual-${accountId}-${position.ticket}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        accountId,
        ticket: position.ticket,
        symbol: position.symbol,
        type: position.type,
        openTime: position.openTime || new Date().toISOString(),
        status: 'open',
        emotion: emotion || '—',
        reason: reason.trim() || '—',
        strategy: finalStrategy,
        setup: setup || undefined,
        confidence,
        notes: notes.trim() || undefined,
        source: sourceOverride,
        entrySnapshot: {
          lots: position.lots,
          openPrice: position.openPrice,
          sl: position.sl,
          tp: position.tp,
        },
      });
    }
    toast.success(`Trade #${position.ticket} journaled`);
    shift();
  };

  const handleSkip = () => {
    toast('Skipped — you can add it later in Journal');
    shift();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-xl max-h-[92vh] overflow-auto p-6 space-y-4">
        <div className="flex items-start justify-between sticky top-0 bg-card/95 backdrop-blur-md -mx-6 -mt-6 px-6 pt-6 pb-4 border-b border-border/30 z-10">
          <div>
            <h2 className="text-lg font-bold">New Trade Detected</h2>
            <p className="text-xs text-muted-foreground">Journal it now while it's fresh</p>
          </div>
          <button onClick={handleSkip} className="p-1 rounded hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-secondary/30 text-sm">
          <Mini label="Symbol" value={position.symbol} mono bold />
          <Mini label="Type / Lots" value={
            <span className="font-mono">
              <span className={position.type === 'BUY' ? 'text-success' : 'text-destructive'}>{position.type}</span>{' '}
              {position.lots.toFixed(2)}
            </span>
          } />
          <Mini label="Open" value={String(position.openPrice)} mono />
          <Mini label="Ticket" value={`#${position.ticket}`} mono />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Source</label>
          <div className="flex gap-2">
            {(['manual', 'copier'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSourceOverride(s)}
                className={chipClass(sourceOverride === s)}
              >
                {s === 'manual' ? 'Manual' : 'Copier'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Strategy</label>
          {strategies.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {strategies.map((s) => (
                <button key={s} onClick={() => { setStrategy(s); setNewStrategy(''); }} className={chipClass(strategy === s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={newStrategy}
              onChange={(e) => { setNewStrategy(e.target.value); setStrategy(''); }}
              placeholder={strategies.length === 0 ? 'Enter your strategy (e.g. ICT OB, Breakout)' : 'Or add a new one'}
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
              <button key={s} onClick={() => setSetup(setup === s ? '' : s)} className={chipClass(setup === s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Confidence (1-5)</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setConfidence(n)} className={chipClass(confidence === n) + ' min-w-9 justify-center'}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Emotion</label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_EMOTIONS.map((e) => (
              <button key={e} onClick={() => setEmotion(e)} className={chipClass(emotion === e)}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Reason / Setup</label>
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
            placeholder="Any extra context, screenshots reference, mental state…"
            className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm border border-border/50 focus:outline-none focus:border-primary/50"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 sticky bottom-0 bg-card/95 backdrop-blur-md -mx-6 -mb-6 px-6 pb-6 pt-4 border-t border-border/30">
          <button
            onClick={handleSkip}
            className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Save Entry
          </button>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, mono, bold }: { label: string; value: React.ReactNode; mono?: boolean; bold?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`${mono ? 'font-mono' : ''} ${bold ? 'font-semibold' : ''}`}>{value}</div>
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
