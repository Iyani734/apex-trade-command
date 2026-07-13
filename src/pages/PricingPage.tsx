import { motion } from 'framer-motion';
import { Check, ExternalLink, Gift } from 'lucide-react';
import { FREE_EA_URL, PAID_EA_URL } from '@/lib/trial';
import { useAuth } from '@/lib/auth';

const CONTACT_EMAIL = 'ianchomba734@gmail.com';
const MQL5_RENT_1M = 'https://www.mql5.com/en/accounting/buy/market/182969?period=4&source=Unknown&cartId=ec9aed0000000000be96546a';
const MQL5_RENT_3M = 'https://www.mql5.com/en/accounting/buy/market/182969?period=3&source=Unknown&cartId=ec9aed0000000000be96546a';
const MQL5_RENT_6M = 'https://www.mql5.com/en/accounting/buy/market/182969?period=2&source=Unknown&cartId=ec9aed0000000000be96546a';
const MQL5_RENT_1Y = 'https://www.mql5.com/en/accounting/buy/market/182969?period=1&source=Unknown&cartId=ec9aed0000000000be96546a';

const plans = [
  { name: 'Free Trial', price: '$0', period: '1 month', href: FREE_EA_URL, accountLimit: 1, accent: true },
  { name: 'Monthly', price: '$30', period: '1 month', href: MQL5_RENT_1M, accountLimit: 5 },
  { name: 'Quarterly', price: '$35', period: '3 months', href: MQL5_RENT_3M, accountLimit: 5, savings: 'You save 61%' },
  { name: 'Half Year', price: '$60', period: '6 months', href: MQL5_RENT_6M, accountLimit: 5, savings: 'You save 67%' },
  { name: 'Annual', price: '$100', period: '1 year', href: MQL5_RENT_1Y, accountLimit: 5, savings: 'You save 73%' },
];

export default function PricingPage() {
  const { user, license } = useAuth();
  const isFreeCurrent =
    !!user &&
    !!license &&
    !license.paid &&
    !license.deviceBlocked &&
    license.status !== 'expired';
  const currentFreeDays = license
    ? Math.max(0, license.daysUntilAccessEnds ?? license.daysUntilTrialEnds ?? 0)
    : 0;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold tracking-tight">Pricing</h1>
        <p className="text-sm text-muted-foreground">Choose a ForexAnalyzer Pro plan and continue securely through MQL5.</p>
      </motion.div>

      {user && license && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card flex flex-col gap-3 border border-primary/30 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Current plan</p>
            <h2 className="mt-1 text-lg font-bold">
              {license.paid ? 'Paid ForexAnalyzer Pro' : 'Free Trial'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {license.paid
                ? 'Your paid product has full access enabled.'
                : `${currentFreeDays} day${currentFreeDays === 1 ? '' : 's'} remaining before access is limited.`}
            </p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Account limit: {license.accountLimit || (license.paid ? license.paidAccountLimit : license.freeAccountLimit) || 'standard'} connected account{(license.accountLimit || 1) === 1 ? '' : 's'}.
            </p>
          </div>
          <a
            href={license.paidEaUrl || PAID_EA_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {license.paid ? 'Open paid product' : 'Upgrade on MQL5'}
            <ExternalLink className="h-4 w-4" />
          </a>
        </motion.div>
      )}

      {/* Ads disabled for now.
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-primary/30 bg-primary/10 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="font-semibold text-primary">Recommended broker bonus</h2>
            <p className="text-sm text-muted-foreground max-w-3xl">
              Open an account with one of our recommended brokers and get 3 months free premium. After creating the broker account, contact us directly by email or through MQL5 so we can activate the bonus.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <a href={`mailto:${CONTACT_EMAIL}`} className="px-3 py-1.5 rounded-lg bg-background/60 border border-border/50 hover:border-primary/50 transition-colors">
                {CONTACT_EMAIL}
              </a>
              <a
                href="https://www.mql5.com/en/users/65614798/"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-background/60 border border-border/50 hover:border-primary/50 transition-colors inline-flex items-center gap-1.5"
              >
                MQL5 profile <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </motion.div>
      */}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {plans.map((plan, index) => {
          const currentPlan = plan.name === 'Free Trial' && isFreeCurrent;
          return (
          <motion.a
            key={plan.name}
            href={plan.href}
            target="_blank"
            rel="noreferrer"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className={`glass-card p-5 border transition-colors hover:border-primary/60 ${currentPlan || plan.accent ? 'border-primary/40' : 'border-border/50'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{plan.period}</p>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="mt-5">
              <span className="text-3xl font-mono font-bold">{plan.price}</span>
            </div>
            {'savings' in plan && plan.savings && (
              <div className="mt-3 inline-flex rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                {plan.savings}
              </div>
            )}
            {currentPlan && (
              <div className="mt-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                Current plan - {currentFreeDays} day{currentFreeDays === 1 ? '' : 's'} remaining
              </div>
            )}
            <div className="mt-5 space-y-2 text-sm text-muted-foreground">
              {[
                `${plan.accountLimit} connected account${plan.accountLimit === 1 ? '' : 's'}`,
                'Live dashboard',
                'Trade analytics',
                'Calendar and journal',
                'Copy-trading controls',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg bg-primary text-primary-foreground text-center py-2 text-sm font-semibold">
              {currentPlan ? 'Current plan' : plan.accent ? 'Start trial' : 'Subscribe'}
            </div>
          </motion.a>
        )})}
      </div>
    </div>
  );
}
