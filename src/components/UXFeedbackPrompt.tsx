import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

const SESSION_KEY = 'forexAnalyzer.feedback.sessionId';
const FIRST_SEEN_KEY = 'forexAnalyzer.feedback.firstSeenAt';
const DONE_KEY = 'forexAnalyzer.feedback.completedAt';
const DISMISSED_KEY = 'forexAnalyzer.feedback.dismissedAt';
const MIN_TIME_MS = 60_000;
const MIN_SITE_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const ASK_AGAIN_DONE_MS = 14 * 24 * 60 * 60 * 1000;
const ASK_AGAIN_DISMISSED_MS = 3 * 24 * 60 * 60 * 1000;

const goals = [
  'Track live trades',
  'Analyze strategy performance',
  'Use calendar and journal',
  'Manage copy trading',
  'Just exploring',
];

const getSessionId = () => {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return `session_${Date.now()}`;
  }
};

const readMs = (key: string) => {
  try {
    return Number(localStorage.getItem(key) || 0);
  } catch {
    return 0;
  }
};

const readOrCreateFirstSeen = (now: number) => {
  try {
    const existing = Number(localStorage.getItem(FIRST_SEEN_KEY) || 0);
    if (existing > 0) return existing;
    localStorage.setItem(FIRST_SEEN_KEY, String(now));
    return now;
  } catch {
    return now;
  }
};

export function UXFeedbackPrompt() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [goal, setGoal] = useState('');
  const [friction, setFriction] = useState('');
  const [missing, setMissing] = useState('');
  const [extra, setExtra] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const sessionId = useMemo(getSessionId, []);

  useEffect(() => {
    const now = Date.now();
    const firstSeenAt = readOrCreateFirstSeen(now);
    if (now - firstSeenAt < MIN_SITE_AGE_MS) return;

    const completedAt = readMs(DONE_KEY);
    const dismissedAt = readMs(DISMISSED_KEY);
    if (completedAt && now - completedAt < ASK_AGAIN_DONE_MS) return;
    if (dismissedAt && now - dismissedAt < ASK_AGAIN_DISMISSED_MS) return;

    let activeMs = 0;
    let lastTick = Date.now();
    const timer = window.setInterval(() => {
      const tick = Date.now();
      if (document.visibilityState === 'visible') activeMs += tick - lastTick;
      lastTick = tick;
      if (activeMs >= MIN_TIME_MS) {
        window.clearInterval(timer);
        setOpen(true);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setOpen(false);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.feedback.submit({
        score: score || undefined,
        sessionId,
        pagePath: `${window.location.pathname}${window.location.search}`,
        responses: {
          goal,
          friction,
          missing,
          extra,
        },
      });
      try {
        localStorage.setItem(DONE_KEY, String(Date.now()));
      } catch {
        // ignore
      }
      setOpen(false);
    } catch {
      dismiss();
    } finally {
      setSubmitting(false);
    }
  };

  const canContinue =
    (step === 0 && score !== null) ||
    (step === 1 && goal) ||
    step >= 2;

  if (!open) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] sm:left-auto sm:right-5 sm:w-[26rem]">
      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Help us improve
            </p>
            <h2 className="mt-1 text-lg font-bold">
              {step === 0 && 'How likely are you to recommend ForexAnalyzer Pro?'}
              {step === 1 && 'What brought you here today?'}
              {step === 2 && 'What felt confusing or slow?'}
              {step === 3 && 'What should we improve next?'}
              {step === 4 && 'Anything else we should know?'}
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close feedback prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          {step === 0 && (
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScore(value)}
                  className={cn(
                    'rounded-lg border px-0 py-2 text-sm font-bold transition-colors',
                    score === value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-secondary/30 hover:bg-secondary',
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-2">
              {goals.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setGoal(item)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    goal === item
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-secondary/20 hover:bg-secondary/40',
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <textarea
              value={friction}
              onChange={(event) => setFriction(event.target.value)}
              placeholder="Example: chart spacing, mobile layout, account setup, EA key..."
              className="min-h-28 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              maxLength={800}
            />
          )}

          {step === 3 && (
            <textarea
              value={missing}
              onChange={(event) => setMissing(event.target.value)}
              placeholder="Tell us the feature or improvement that would make this more useful."
              className="min-h-28 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              maxLength={800}
            />
          )}

          {step === 4 && (
            <textarea
              value={extra}
              onChange={(event) => setExtra(event.target.value)}
              placeholder="Optional notes..."
              className="min-h-28 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              maxLength={800}
            />
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className={cn('h-2 w-2 rounded-full', i === step ? 'bg-primary' : 'bg-muted')}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((current) => current - 1)}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Back
              </button>
            )}
            <button
              type="button"
              disabled={!canContinue || submitting}
              onClick={() => (step === 4 ? void submit() : setStep((current) => current + 1))}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {step === 4 ? (submitting ? 'Sending...' : 'Send') : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
