import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { userPrefs } from '@/lib/userPrefs';
import { mockMode } from '@/hooks/useMockData';
import { clearStoredReferralCode, getBrowserTimeZone, getStoredReferralCode, storeReferralCode, type ReferralSummary, type SupportAgent } from '@/services/api';
import {
  bindTrialDeviceToUser,
  createDeviceBlockedLicense,
  getOrCreateTrialDeviceId,
  getTrialBrowserFingerprint,
  rememberTrialDeviceEmail,
  type TrialLicense,
} from '@/lib/trial';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.forexanalyzerpro.com/api';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  license: TrialLicense | null;
  licenseLoading: boolean;
  deviceBlocked: boolean;
  supportAgent: SupportAgent | null;
  referral: (Omit<ReferralSummary, 'referrals'> & { accepted?: unknown }) | null;
  refreshLicense: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmailMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function syncLocalUser(user: User | null) {
  if (!user) {
    userPrefs.clearUser();
    return;
  }

  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    'Trader';
  const nickname =
    user.user_metadata?.given_name ||
    String(name).split(' ')[0] ||
    'Trader';

  userPrefs.setUser({
    name,
    nickname,
    email: user.email || '',
    avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [license, setLicense] = useState<TrialLicense | null>(null);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [deviceBlocked, setDeviceBlocked] = useState(false);
  const [supportAgent, setSupportAgent] = useState<SupportAgent | null>(null);
  const [referral, setReferral] = useState<AuthContextValue['referral']>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('ref') || params.get('invite') || params.get('referral');
    if (code) storeReferralCode(code);
  }, []);

  const loadLicenseForSession = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setLicense(null);
      setDeviceBlocked(false);
      setSupportAgent(null);
      setReferral(null);
      setLicenseLoading(false);
      return;
    }

    setLicenseLoading(true);
    const localDevice = bindTrialDeviceToUser({
      id: nextSession.user.id,
      email: nextSession.user.email,
    });

    if (localDevice.blocked) {
      const message = localDevice.lock?.email
        ? `This browser is already linked to ${localDevice.lock.email}. Please sign in with that email using the email magic link.`
        : 'This device is already linked to another ForexAnalyzer Pro trial account.';
      setLicense(createDeviceBlockedLicense(message, localDevice.lock?.email || null));
      setDeviceBlocked(true);
      setSupportAgent(null);
      setReferral(null);
      setLicenseLoading(false);
      return;
    }

    try {
      const deviceId = getOrCreateTrialDeviceId();
      const headers = new Headers({
        Authorization: `Bearer ${nextSession.access_token}`,
      });
      if (deviceId) headers.set('x-fap-device-id', deviceId);
      const browserFingerprint = getTrialBrowserFingerprint();
      if (browserFingerprint) headers.set('x-fap-device-fingerprint', browserFingerprint);
      const timezone = getBrowserTimeZone();
      if (timezone) headers.set('x-fap-timezone', timezone);
      const referralCode = getStoredReferralCode();
      if (referralCode) headers.set('x-fap-referral-code', referralCode);

      const res = await fetch(`${API_BASE}/auth/me`, { headers });
      if (!res.ok) throw new Error(`License request failed: ${res.status}`);
      const data = await res.json() as {
        license?: TrialLicense;
        supportAgent?: SupportAgent | null;
        referral?: AuthContextValue['referral'];
      };
      setLicense(data.license || null);
      if (data.license?.deviceBlocked && data.license.deviceLockEmail) {
        rememberTrialDeviceEmail(data.license.deviceLockEmail);
      }
      setDeviceBlocked(Boolean(data.license?.deviceBlocked));
      setSupportAgent(data.supportAgent || null);
      setReferral(data.referral || null);
      if (data.referral?.accepted) clearStoredReferralCode();
    } catch (error) {
      console.warn('[Auth] Could not load license status', error);
      setLicense(null);
      setDeviceBlocked(false);
      setSupportAgent(null);
      setReferral(null);
    } finally {
      setLicenseLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const nextSession = data.session;
      setSession(nextSession);
      syncLocalUser(nextSession?.user ?? null);
      await loadLicenseForSession(nextSession);
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      syncLocalUser(nextSession?.user ?? null);
      void loadLicenseForSession(nextSession).finally(() => setLoading(false));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadLicenseForSession]);

  const refreshLicense = useCallback(async () => {
    await loadLicenseForSession(session);
  }, [loadLicenseForSession, session]);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    loading,
    license,
    licenseLoading,
    deviceBlocked,
    supportAgent,
    referral,
    refreshLicense,
    signInWithGoogle: async () => {
      mockMode.setEnabled(false);
      const redirectUrl = new URL('/dashboard', window.location.origin);
      const referralCode = getStoredReferralCode();
      if (referralCode) redirectUrl.searchParams.set('ref', referralCode);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl.toString(),
        },
      });
      if (error) throw error;
    },
    signInWithEmailMagicLink: async (email: string) => {
      mockMode.setEnabled(false);
      const redirectUrl = new URL('/dashboard', window.location.origin);
      const referralCode = getStoredReferralCode();
      if (referralCode) redirectUrl.searchParams.set('ref', referralCode);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl.toString(),
        },
      });
      if (error) throw error;
    },
    signOut: async () => {
      await supabase.auth.signOut();
      userPrefs.clearUser();
      setSession(null);
      setLicense(null);
      setDeviceBlocked(false);
      setSupportAgent(null);
      setReferral(null);
      mockMode.setEnabled(true);
    },
  }), [deviceBlocked, license, licenseLoading, loading, referral, refreshLicense, session, supportAgent]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

const isDeviceBlockRecoveryPath = (pathname: string) =>
  pathname === '/login';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, license, deviceBlocked, signOut } = useAuth();
  const location = useLocation();
  const isDemo = mockMode.isEnabled();

  if (loading && !isDemo) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!user && !isDemo) {
    mockMode.setEnabled(true);
  }
  if (!isDemo && deviceBlocked && !isDeviceBlockRecoveryPath(location.pathname)) {
    const lockedEmail = license?.deviceLockEmail || '';
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-6 text-center shadow-xl">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-primary">Device trial locked</p>
          <h1 className="mt-3 text-2xl font-bold">Use the original trial account</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {license?.message || 'This device or MetaTrader account is already linked to another ForexAnalyzer Pro trial account.'}
          </p>
          {lockedEmail ? (
            <div className="mt-4 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 font-mono text-sm text-primary">
              {lockedEmail}
            </div>
          ) : null}
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                void signOut().finally(() => {
                  window.location.href = '/login';
                });
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Send magic link to original email
            </button>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
