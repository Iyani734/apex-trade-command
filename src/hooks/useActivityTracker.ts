import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '@/services/api';
import { useAuth } from '@/lib/auth';

const lastSentAt = new Map<string, number>();
const MIN_REPEAT_MS = 10 * 60_000;

export function useActivityTracker() {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const pagePath = `${location.pathname}${location.search || ''}`;
    const key = `${user.id}:${pagePath}`;
    const now = Date.now();
    const previous = lastSentAt.get(key) || 0;
    if (now - previous < MIN_REPEAT_MS) return;
    lastSentAt.set(key, now);

    const timer = window.setTimeout(() => {
      void api.activity.pageView({
        pagePath,
        pageTitle: document.title,
        referrer: document.referrer,
        metadata: {
          hash: location.hash || '',
          width: window.innerWidth,
          height: window.innerHeight,
        },
      }).catch((error) => {
        console.warn('[Activity] Page view was not recorded', error);
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [location.hash, location.pathname, location.search, user?.id]);
}
