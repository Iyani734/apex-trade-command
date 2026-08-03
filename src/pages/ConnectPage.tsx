import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link2, Server, CheckCircle, ArrowRight, Loader2, KeyRound, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { userPrefs } from '@/lib/userPrefs';
import { useTradingStore } from '@/store/tradingStore';
import { useAuth } from '@/lib/auth';
import { PAID_EA_URL } from '@/lib/trial';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.forexanalyzerpro.com/api';
const WEBREQUEST_URL = API_BASE.replace(/\/api\/?$/, '');

export default function ConnectPage() {
  const { license } = useAuth();
  const accounts = useTradingStore((s) => s.accounts);
  const setActiveAccount = useTradingStore((s) => s.setActiveAccount);
  const [accountId, setAccountId] = useState('');
  const [role, setRole] = useState<'STANDALONE' | 'MASTER' | 'SLAVE'>('STANDALONE');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectedAccountId, setConnectedAccountId] = useState('');
  const [eaKeyPrefix, setEaKeyPrefix] = useState<string | null>(null);
  const [newEaKey, setNewEaKey] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const freeAccountLimit = license?.freeAccountLimit || 3;
  const needsPaidForNextAccount = Boolean(!license?.paid && accounts.length >= freeAccountLimit);
  const pageTitle = needsPaidForNextAccount ? 'Connect Paid Version' : 'Connect Account';

  useEffect(() => {
    api.auth.me()
      .then((res) => setEaKeyPrefix(res.eaKey?.key_prefix || null))
      .catch(() => setEaKeyPrefix(null));
  }, []);

  const rotateEaKey = async () => {
    setKeyLoading(true);
    try {
      const result = await api.auth.rotateEaKey();
      setNewEaKey(result.apiKey);
      setEaKeyPrefix(result.keyPrefix);
      toast.success('New EA key generated');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not generate EA key');
    } finally {
      setKeyLoading(false);
    }
  };

  const handleConnect = async () => {
    const cleanAccountId = accountId.trim();
    if (!cleanAccountId) {
      toast.error('Please enter an Account ID');
      return;
    }

    setConnecting(true);

    try {
      await api.health();
      await api.accounts.register({
        accountId: cleanAccountId,
        config: {
          alias: cleanAccountId,
          role,
        },
      });

      // Mark as one of "my accounts" for copy-trading filtering.
      userPrefs.addOwned(cleanAccountId);
      setActiveAccount(cleanAccountId);

      setConnectedAccountId(cleanAccountId);
      setConnected(true);
      toast.success(`Account ${cleanAccountId} connected successfully!`);
    } catch (err: unknown) {
      console.error('[Connect] Failed:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Connection failed: ${message}`);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Link2 className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">{pageTitle}</h1>
        <p className="text-muted-foreground mt-3 text-base">
          {needsPaidForNextAccount
            ? `Your free plan already has ${accounts.length} connected account${accounts.length === 1 ? '' : 's'}. Add the next account with the paid EA so the system can unlock paid access automatically.`
            : 'Link your MetaTrader account to ForexAnalyzer Pro using the EA.'}
        </p>
      </motion.div>

      {!connected ? (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-8 space-y-6 text-base">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
            <div className="flex items-start gap-3">
              <Server className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <div className="font-semibold text-primary">EA connection</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Use your personal EA key in MetaTrader so ForexAnalyzer Pro can receive fast live account updates.
                </p>
                {license?.accountLimit ? (
                  <p className="mt-2 text-xs font-medium text-primary">
                    Your current plan allows {license.accountLimit} connected account{license.accountLimit === 1 ? '' : 's'}. You currently have {accounts.length}.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {license?.dashboardOnly && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
              <div className="font-semibold text-amber-200">Trial ended - setup access is still open</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                You can still generate or rotate your EA key and register the account here. Live EA updates and trading tools unlock again after the paid EA validates your purchase.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href="/pricing" className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                  View paid plans
                </a>
                <a href="/support" className="rounded-lg border border-border/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary/60">
                  Get setup help
                </a>
              </div>
            </div>
          )}

          <div className="space-y-3 mb-8">
            {[
              'Install the EA on MT5 and allow Algo Trading',
              `Whitelist ${WEBREQUEST_URL} in Tools > Options > Expert Advisors > Allow WebRequest`,
              'Paste your personal EA API key into the EA inputs',
              'Register or claim the account below',
            ].map((step, i) => (
              <div key={step} className="flex items-center gap-3 text-base">
                <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-sm font-mono text-muted-foreground">{i + 1}</div>
                <span className="text-muted-foreground leading-relaxed">{step}</span>
              </div>
            ))}
          </div>

          {needsPaidForNextAccount && (
            <div className="rounded-xl border border-sky-400/30 bg-sky-400/10 p-4">
              <div className="font-semibold text-sky-100">Use the paid EA for the next account</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Keep the EA key below, attach the paid ForexAnalyzer Pro EA to the new MetaTrader account, and let it connect. If the EA is the paid build, your profile becomes paid and the account stays connected. If it is the free EA, the server rejects it because the free plan is limited to {freeAccountLimit} accounts.
              </p>
              <a
                href={license?.paidEaUrl || PAID_EA_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Open paid product
              </a>
            </div>
          )}

          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <div className="text-base font-medium">Personal EA API key</div>
            </div>
            <p className="text-sm text-muted-foreground">
              Put this key into the EAApiKey input in MetaTrader. It stays active until you rotate it and is stored securely in the database as a hash.
            </p>
            {eaKeyPrefix && !newEaKey && (
              <div className="text-xs font-mono text-muted-foreground">Active key: {eaKeyPrefix}</div>
            )}
            {newEaKey && (
              <div className="space-y-2">
                <div className="rounded-md bg-background/70 border border-border/50 p-2 font-mono text-xs break-all">
                  {newEaKey}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(newEaKey);
                    toast.success('EA key copied');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Copy className="w-3 h-3" /> Copy key
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={rotateEaKey}
              disabled={keyLoading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-60"
            >
              {keyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
              {eaKeyPrefix ? 'Rotate EA key' : 'Generate EA key'}
            </button>
          </div>

          {!needsPaidForNextAccount && (
            <>
              <div>
                <label className="text-base text-muted-foreground block mb-2">Account ID</label>
                <input
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="e.g. 10047832"
                  className="w-full bg-secondary/50 rounded-lg px-4 py-3 text-foreground border border-border/50 font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              <div>
                <label className="text-base text-muted-foreground block mb-2">Account Role</label>
                <div className="flex flex-wrap gap-3">
                  {(['STANDALONE', 'MASTER', 'SLAVE'] as const).map((accountRole) => (
                    <button
                      key={accountRole}
                      type="button"
                      onClick={() => setRole(accountRole)}
                      className={`px-4 py-2 rounded-lg text-base font-mono transition-colors ${role === accountRole ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary/50 text-muted-foreground border border-border/50 hover:border-border'}`}
                    >
                      {accountRole}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleConnect} disabled={connecting} className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold transition-all hover:bg-primary/90 disabled:opacity-50">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                {connecting ? 'Connecting...' : 'Connect Account'}
                {!connecting && <ArrowRight className="w-4 h-4" />}
              </button>
            </>
          )}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-8 text-center">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-xl font-bold">Account Connected!</h2>
          <p className="text-muted-foreground mt-2">
            Account <span className="font-mono text-primary">{connectedAccountId}</span> is now linked as <span className="font-mono">{role}</span>
          </p>
          <a href="/dashboard" className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-lg bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors">
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      )}
    </div>
  );
}
