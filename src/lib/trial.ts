export const PRODUCT_LICENSE_MODE = 'free' as const;
export const FREE_TRIAL_DAYS = 30;
export const FREE_TRIAL_GRACE_DAYS = 3;
export const FREE_TRIAL_WARNING_DAYS = 5;
export const FREE_EA_URL = 'https://www.mql5.com/en/market/product/111375';
export const PAID_EA_URL = 'https://www.mql5.com/en/market/product/182969';

export const TRIAL_DEVICE_ID_KEY = 'forexAnalyzerPro.trialDeviceId.v1';
export const TRIAL_DEVICE_LOCK_KEY = 'forexAnalyzerPro.trialDeviceLock.v1';
export const TRIAL_WARNING_PREFIX = 'forexAnalyzerPro.trialWarning.v1';

export type TrialLicenseStatus = 'active' | 'warning' | 'grace' | 'expired' | 'paid' | 'device_blocked' | 'unconfigured';

export interface TrialLicense {
  productMode: string;
  planMode: string;
  status: TrialLicenseStatus;
  paid: boolean;
  hasFullAccess: boolean;
  dashboardOnly: boolean;
  deviceBlocked: boolean;
  shouldWarn: boolean;
  trialDays: number;
  graceDays: number;
  warningDays: number;
  trialStartedAt: string;
  trialEndsAt: string;
  graceEndsAt: string;
  paidUntil: string | null;
  warningStartsAt: string;
  daysUntilTrialEnds: number;
  daysUntilAccessEnds: number;
  freeEaUrl: string;
  paidEaUrl: string;
  migrationRequired?: boolean;
  message?: string | null;
}

export interface TrialDeviceLock {
  userId: string;
  email: string;
  createdAt: string;
}

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function safeRandomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateTrialDeviceId() {
  if (!hasStorage()) return '';
  const existing = window.localStorage.getItem(TRIAL_DEVICE_ID_KEY);
  if (existing) return existing;
  const next = safeRandomId();
  window.localStorage.setItem(TRIAL_DEVICE_ID_KEY, next);
  return next;
}

export function readTrialDeviceLock(): TrialDeviceLock | null {
  if (!hasStorage()) return null;
  const raw = window.localStorage.getItem(TRIAL_DEVICE_LOCK_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TrialDeviceLock;
  } catch {
    window.localStorage.removeItem(TRIAL_DEVICE_LOCK_KEY);
    return null;
  }
}

export function bindTrialDeviceToUser(user: { id: string; email?: string | null }) {
  if (!hasStorage()) return { blocked: false, lock: null as TrialDeviceLock | null };
  const existing = readTrialDeviceLock();
  const email = user.email || '';

  if (existing && existing.userId && existing.userId !== user.id) {
    return { blocked: true, lock: existing };
  }

  const next: TrialDeviceLock = existing || {
    userId: user.id,
    email,
    createdAt: new Date().toISOString(),
  };

  if (!existing || existing.email !== email) {
    window.localStorage.setItem(TRIAL_DEVICE_LOCK_KEY, JSON.stringify({ ...next, email }));
  }

  return { blocked: false, lock: { ...next, email } };
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTrialWarningStorageKey(userId: string) {
  return `${TRIAL_WARNING_PREFIX}.${userId}`;
}

export function createDeviceBlockedLicense(message?: string): TrialLicense {
  const now = new Date();
  const trialEnds = new Date(now.getTime() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const graceEnds = new Date(now.getTime() + (FREE_TRIAL_DAYS + FREE_TRIAL_GRACE_DAYS) * 24 * 60 * 60 * 1000);

  return {
    productMode: PRODUCT_LICENSE_MODE,
    planMode: PRODUCT_LICENSE_MODE,
    status: 'device_blocked',
    paid: false,
    hasFullAccess: false,
    dashboardOnly: true,
    deviceBlocked: true,
    shouldWarn: true,
    trialDays: FREE_TRIAL_DAYS,
    graceDays: FREE_TRIAL_GRACE_DAYS,
    warningDays: FREE_TRIAL_WARNING_DAYS,
    trialStartedAt: now.toISOString(),
    trialEndsAt: trialEnds.toISOString(),
    graceEndsAt: graceEnds.toISOString(),
    paidUntil: null,
    warningStartsAt: now.toISOString(),
    daysUntilTrialEnds: 0,
    daysUntilAccessEnds: 0,
    freeEaUrl: FREE_EA_URL,
    paidEaUrl: PAID_EA_URL,
    message: message || 'This browser is already linked to another ForexAnalyzer Pro trial account.',
  };
}
