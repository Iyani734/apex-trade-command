import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { userPrefs } from '@/lib/userPrefs';
import { mockMode } from '@/hooks/useMockData';
import { getStoredReferralCode, storeReferralCode, type ReferralSummary, type SupportAgent } from '@/services/api';
import {
  bindTrialDeviceToUser,
  createDeviceBlockedLicense,
  getOrCreateTrialDeviceId,
  PAID_EA_URL,
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
        ? `This browser is already linked to ${localDevice.lock.email}. Use that account or upgrade to a paid license.`
        : 'This browser is already linked to another ForexAnalyzer Pro trial account.';
      setLicense(createDeviceBlockedLicense(message));
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
      setDeviceBlocked(Boolean(data.license?.deviceBlocked));
      setSupportAgent(data.supportAgent || null);
      setReferral(data.referral || null);
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    },
    signInWithEmailMagicLink: async (email: string) => {
      mockMode.setEnabled(false);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
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
  if (!isDemo && deviceBlocked) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-6 text-center shadow-xl">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-primary">Device trial locked</p>
          <h1 className="mt-3 text-2xl font-bold">Use the original trial account</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {license?.message || 'This browser is already linked to another ForexAnalyzer Pro trial account.'}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href={license?.paidEaUrl || PAID_EA_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Get paid version
            </a>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg border border-border/60 px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary/60"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!isDemo && license?.dashboardOnly && location.pathname !== '/dashboard') {
    return <Navigate to="/dashboard" replace state={{ trialLocked: true }} />;
  }
  return <>{children}</>;
}
