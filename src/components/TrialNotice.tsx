import { useEffect, useMemo, useState } from 'react';
import { Clock, ExternalLink, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getLocalDateKey, getTrialWarningStorageKey, PAID_EA_URL } from '@/lib/trial';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const formatDate = (value?: string | null) => {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
};

const RECOMMENDED_BROKER_URL = 'https://one.exnessonelink.com/a/fhc3i952hn';
const BROKER_BONUS_TEXT = 'You can also open an account with our recommended broker and contact support to claim 3 months free premium.';

export function TrialNotice() {
  const { user, license } = useAuth();
  const [open, setOpen] = useState(false);

  const shouldShow = Boolean(
    user &&
      license &&
      !license.paid &&
      (license.shouldWarn || license.dashboardOnly || license.migrationRequired),
  );

  useEffect(() => {
    if (!user?.id || !license || !shouldShow) {
      setOpen(false);
      return;
    }

    const key = getTrialWarningStorageKey(user.id);
    const today = getLocalDateKey();
    const lastShown = window.localStorage.getItem(key);

    if (lastShown !== today) {
      window.localStorage.setItem(key, today);
      setOpen(true);
    }
  }, [license, shouldShow, user?.id]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('forexAnalyzer:trialNoticeVisibility', {
      detail: { open },
    }));
    return () => {
      window.dispatchEvent(new CustomEvent('forexAnalyzer:trialNoticeVisibility', {
        detail: { open: false },
      }));
    };
  }, [open]);

  const content = useMemo(() => {
    if (!license) return null;

    if (license.migrationRequired) {
      return {
        icon: Lock,
        title: 'Trial setup needs one database update',
        body: license.message || 'Run the latest Supabase schema so ForexAnalyzer Pro can save trial dates and license status.',
        note: 'Dashboard access stays limited until the trial table is installed.',
      };
    }

    if (license.dashboardOnly) {
      return {
        icon: Lock,
        title: 'Your free trial has ended',
        body: `Your ${license.trialDays}-day trial plus ${license.graceDays} extra days has finished. Upgrade on MQL5 to unlock trading tools, journal, alerts, analytics, copy trading, and account actions again. ${BROKER_BONUS_TEXT}`,
        note: 'Dashboard, pricing, support, and Connect Account stay open so you can upgrade, rotate your EA key, or ask us for help.',
      };
    }

    return {
      icon: Clock,
      title: 'Your free trial is almost over',
      body: `Your ${license.trialDays}-day free trial ends on ${formatDate(license.trialEndsAt)}. We added ${license.graceDays} extra days, so full access remains until ${formatDate(license.graceEndsAt)}. ${BROKER_BONUS_TEXT}`,
      note: `${license.daysUntilAccessEnds} day${license.daysUntilAccessEnds === 1 ? '' : 's'} left before trading tools lock. Dashboard, pricing, support, and Connect Account will remain available.`,
    };
  }, [license]);

  if (!license || !content) return null;

  const Icon = content.icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md border-primary/30 bg-card">
        <DialogHeader className="text-left">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <DialogTitle className="text-xl">{content.title}</DialogTitle>
          <DialogDescription className="text-sm leading-6">
            {content.body}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border/60 bg-secondary/40 p-3 text-sm text-muted-foreground">
          {content.note}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Button variant="outline" asChild>
            <a href={RECOMMENDED_BROKER_URL} target="_blank" rel="noreferrer">
              Broker bonus
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button asChild>
            <a href={license.paidEaUrl || PAID_EA_URL} target="_blank" rel="noreferrer">
              Get paid version
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
