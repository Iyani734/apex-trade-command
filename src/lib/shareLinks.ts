import type { ShareExpiry, ShareLinkRecord } from '@/services/api';

export type ShareLink = ShareLinkRecord;
export type { ShareExpiry };

export const shareLinks = {
  buildUrl(token: string): string {
    return `${window.location.origin}/share/${token}`;
  },
};
