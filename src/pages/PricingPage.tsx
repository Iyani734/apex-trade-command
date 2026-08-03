import { motion } from 'framer-motion';
import { Check, ExternalLink, Gift, LifeBuoy, Share2, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FREE_EA_URL, PAID_EA_URL } from '@/lib/trial';
import { useAuth } from '@/lib/auth';

const MQL5_RENT_1M = 'https://www.mql5.com/en/accounting/buy/market/182969?period=4&source=Unknown&cartId=ec9aed0000000000be96546a';
const MQL5_RENT_3M = 'https://www.mql5.com/en/accounting/buy/market/182969?period=3&source=Unknown&cartId=ec9aed0000000000be96546a';
const MQL5_RENT_6M = 'https://www.mql5.com/en/accounting/buy/market/182969?period=2&source=Unknown&cartId=ec9aed0000000000be96546a';
const MQL5_RENT_1Y = 'https://www.mql5.com/en/accounting/buy/market/182969?period=1&source=Unknown&cartId=ec9aed0000000000be96546a';
const EXNESS_BROKER_URL = 'https://one.exnessonelink.com/a/fhc3i952hn';
const ICMARKETS_BROKER_URL = 'https://www.icmarkets.com/global/en/?camp=82798';
const SUPPORT_URL = '/support';

const plans = [
  { name: 'Free Trial', price: '$0', period: '1 month', href: FREE_EA_URL, accountLimit: 3, accent: true },
  { name: 'Monthly', price: '$30', period: '1 month', href: MQL5_RENT_1M, accountLimit: 5 },
  { name: 'Quarterly', price: '$60', period: '3 months', href: MQL5_RENT_3M, accountLimit: 5, savings: '3 months rent' },
  { name: 'Half Year', price: '$100', period: '6 months', href: MQL5_RENT_6M, accountLimit: 5, savings: '6 months rent' },
  { name: 'Annual', price: '$180', period: '1 year', href: MQL5_RENT_1Y, accountLimit: 5, savings: '1 year rent' },
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
                : license.dashboardOnly
                  ? 'Your free trial has ended. You can still use dashboard, pricing, support, and Connect Account while you upgrade.'
                  : `${currentFreeDays} day${currentFreeDays === 1 ? '' : 's'} remaining before trading tools are locked.`}
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

      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-5">
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
            className={`glass-card flex h-full min-h-[25rem] flex-col p-5 border transition-colors hover:border-primary/60 ${currentPlan || plan.accent ? 'border-primary/40' : 'border-border/50'}`}
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
            <div className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
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
            <div className="mt-5 rounded-lg bg-primary py-2 text-center text-sm font-semibold text-primary-foreground">
              {currentPlan ? 'Current plan' : plan.accent ? 'Start trial' : 'Subscribe'}
            </div>
          </motion.a>
        )})}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/15 via-sky-500/10 to-background p-5 shadow-xl shadow-black/10"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <Gift className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Premium reward options</p>
              <h2 className="mt-2 text-xl font-bold tracking-tight">Earn extra premium time without paying first</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Register with a recommended broker, review our product, or invite other traders. When you qualify, open a support ticket and we will apply the premium bonus to your ForexAnalyzer Pro account.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <RewardTile icon={Gift} title="Broker account" body="Register, fund, and start trading with our recommended broker to claim up to 1 year free premium." />
                <RewardTile icon={Star} title="Product review" body="Review ForexAnalyzer Pro after using it and claim 2 weeks free premium." />
                <RewardTile icon={Share2} title="Invite traders" body="Invite another trader who joins successfully and claim 1 week free premium." />
              </div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:w-[30rem]">
            <a
              href={EXNESS_BROKER_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-yellow-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-yellow-950/20 transition-colors hover:bg-yellow-300"
            >
              Exness
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href={ICMARKETS_BROKER_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-950/20 transition-colors hover:bg-emerald-400"
            >
              IC Markets
              <ExternalLink className="h-4 w-4" />
            </a>
            <Link
              to={SUPPORT_URL}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-sky-950/20 transition-colors hover:bg-sky-400"
            >
              Support
              <LifeBuoy className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function RewardTile({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Gift;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-background/35 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}
