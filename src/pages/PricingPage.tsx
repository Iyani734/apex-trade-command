import { motion } from 'framer-motion';
import { Check, ExternalLink, Gift } from 'lucide-react';
import { FREE_EA_URL, PAID_EA_URL } from '@/lib/trial';

const CONTACT_EMAIL = 'ianchomba734@gmail.com';

const plans = [
  { name: 'Free Trial', price: '$0', period: '1 month', href: FREE_EA_URL, accent: true },
  { name: 'Monthly', price: '$30', period: '1 month', href: PAID_EA_URL },
  { name: 'Quarterly', price: '$45', period: '3 months', href: PAID_EA_URL },
  { name: 'Half Year', price: '$60', period: '6 months', href: PAID_EA_URL },
  { name: 'Annual', price: '$80', period: '1 year', href: PAID_EA_URL },
];

export default function PricingPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold tracking-tight">Pricing</h1>
        <p className="text-sm text-muted-foreground">Choose a ForexAnalyzer Pro plan and continue securely through MQL5.</p>
      </motion.div>

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
        {plans.map((plan, index) => (
          <motion.a
            key={plan.name}
            href={plan.href}
            target="_blank"
            rel="noreferrer"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className={`glass-card p-5 border transition-colors hover:border-primary/60 ${plan.accent ? 'border-primary/40' : 'border-border/50'}`}
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
            <div className="mt-5 space-y-2 text-sm text-muted-foreground">
              {['Live dashboard', 'Trade analytics', 'Calendar and journal', 'Copy-trading controls'].map((feature) => (
                <div key={feature} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg bg-primary text-primary-foreground text-center py-2 text-sm font-semibold">
              {plan.accent ? 'Start trial' : 'Subscribe'}
            </div>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
