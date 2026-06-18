import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Globe2 } from 'lucide-react';

/**
 * Trading session indicator — drop-in widget for the header.
 * Self-contained; uses UTC math so it works on any machine.
 *
 * Sessions (UTC hours, 24h):
 *  - Sydney : 22 → 07
 *  - Tokyo  : 00 → 09
 *  - London : 07 → 16
 *  - New York: 12 → 21
 */
export type SessionId = 'Sydney' | 'Tokyo' | 'London' | 'New York';

interface SessionDef {
  id: SessionId;
  openUtc: number;
  closeUtc: number;
  flag: string;
  /** Baseline volatility 1-5 when only this session is open */
  baseVol: number;
  city: string;
}

const SESSIONS: SessionDef[] = [
  { id: 'Sydney',   openUtc: 22, closeUtc: 7,  flag: '🇦🇺', baseVol: 2, city: 'Sydney' },
  { id: 'Tokyo',    openUtc: 0,  closeUtc: 9,  flag: '🇯🇵', baseVol: 3, city: 'Tokyo' },
  { id: 'London',   openUtc: 7,  closeUtc: 16, flag: '🇬🇧', baseVol: 5, city: 'London' },
  { id: 'New York', openUtc: 12, closeUtc: 21, flag: '🇺🇸', baseVol: 5, city: 'New York' },
];

function inSession(s: SessionDef, hourUtc: number) {
  if (s.openUtc < s.closeUtc) return hourUtc >= s.openUtc && hourUtc < s.closeUtc;
  return hourUtc >= s.openUtc || hourUtc < s.closeUtc;
}

function hoursUntil(targetUtc: number, nowH: number, nowM: number) {
  let diff = targetUtc - (nowH + nowM / 60);
  if (diff <= 0) diff += 24;
  const h = Math.floor(diff);
  const m = Math.round((diff - h) * 60);
  return { h, m };
}

function volatilityLabel(score: number) {
  if (score >= 8) return { label: 'Explosive', color: 'text-destructive', bar: 'bg-destructive' };
  if (score >= 6) return { label: 'High',      color: 'text-warning',     bar: 'bg-warning' };
  if (score >= 4) return { label: 'Active',    color: 'text-primary',     bar: 'bg-primary' };
  if (score >= 2) return { label: 'Moderate',  color: 'text-accent',      bar: 'bg-accent' };
  return            { label: 'Quiet',     color: 'text-muted-foreground', bar: 'bg-muted-foreground' };
}

export function SessionIndicator() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const hUtc = now.getUTCHours();
  const mUtc = now.getUTCMinutes();
  const open = SESSIONS.filter((s) => inSession(s, hUtc));

  // Volatility score:
  //  + sum of baseVols of open sessions
  //  + +3 bonus when London & NY overlap (12-16 UTC)
  let vol = open.reduce((a, s) => a + s.baseVol, 0);
  const overlap = open.find((s) => s.id === 'London') && open.find((s) => s.id === 'New York');
  if (overlap) vol += 3;
  const volMeta = volatilityLabel(vol);

  const primary = open[0];
  const label = open.length === 0 ? 'Closed' : open.map((s) => s.id).join(' + ');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          title="Forex session status"
        >
          <Globe2 className="w-3.5 h-3.5 text-primary" />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
            <span className={`text-[10px] font-mono ${volMeta.color}`}>● {volMeta.label}</span>
          </div>
          {primary && <span className="text-base leading-none">{primary.flag}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-card border-border">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-widest">Market Sessions</div>
              <div className="text-lg font-semibold">{label}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground uppercase">UTC</div>
              <div className="font-mono text-sm">
                {String(hUtc).padStart(2, '0')}:{String(mUtc).padStart(2, '0')}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-muted-foreground">Volatility expectation</span>
              <span className={`font-semibold ${volMeta.color}`}>{volMeta.label}</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className={`h-full ${volMeta.bar}`} style={{ width: `${Math.min(100, (vol / 13) * 100)}%` }} />
            </div>
            {overlap && (
              <div className="mt-2 text-[11px] text-warning">
                ⚡ London / New York overlap — peak liquidity window
              </div>
            )}
          </div>
        </div>

        <div className="p-3 space-y-2">
          {SESSIONS.map((s) => {
            const isOpen = inSession(s, hUtc);
            const target = isOpen ? s.closeUtc : s.openUtc;
            const t = hoursUntil(target, hUtc, mUtc);
            return (
              <div key={s.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-secondary/40">
                <span className="text-xl">{s.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {s.city}
                    {isOpen ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/20 text-success uppercase tracking-wider">Open</span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">Closed</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {String(s.openUtc).padStart(2, '0')}:00 – {String(s.closeUtc).padStart(2, '0')}:00 UTC
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase text-muted-foreground tracking-wider">
                    {isOpen ? 'Closes in' : 'Opens in'}
                  </div>
                  <div className="text-xs font-mono">{t.h}h {t.m}m</div>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default SessionIndicator;
