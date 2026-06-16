// Local user preferences (no auth, single-user local app)
const KEYS = {
  nicknames: 'tvp.nicknames',          // { [accountId]: alias }
  ownedAccounts: 'tvp.ownedAccounts',  // string[]
  strategies: 'tvp.strategies',         // string[]
  journal: 'tvp.journal',               // JournalEntry[]
  seenTickets: 'tvp.seenTickets',       // { [accountId]: number[] } — to detect NEW positions
  user: 'tvp.user',                     // { name, nickname, email, avatar }
  activeAccount: 'tvp.activeAccount',   // string — last selected account id
};

export interface LocalUser {
  name: string;
  nickname: string;
  email: string;
  avatar?: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function readJournal() {
  const entries = read<any[]>(KEYS.journal, []);
  const seenIds = new Set<string>();
  let changed = false;

  const normalized = entries.map((entry, index) => {
    const fallbackId = `journal-${entry?.accountId || 'acct'}-${entry?.ticket || index}`;
    const baseId = typeof entry?.id === 'string' && entry.id.trim() ? entry.id : fallbackId;
    let nextId = baseId;
    let suffix = 1;

    while (seenIds.has(nextId)) {
      nextId = `${baseId}-${suffix++}`;
      changed = true;
    }

    seenIds.add(nextId);
    if (nextId !== entry?.id) changed = true;

    return { ...entry, id: nextId };
  });

  if (changed) write(KEYS.journal, normalized);
  return normalized;
}

export const userPrefs = {
  // Nicknames
  getNicknames: () => read<Record<string, string>>(KEYS.nicknames, {}),
  setNickname: (accountId: string, alias: string) => {
    const all = userPrefs.getNicknames();
    all[accountId] = alias;
    write(KEYS.nicknames, all);
  },
  getNickname: (accountId: string) => userPrefs.getNicknames()[accountId],

  // Owned accounts (for copy-trading "my accounts" view)
  getOwned: () => read<string[]>(KEYS.ownedAccounts, []),
  addOwned: (id: string) => {
    const cur = userPrefs.getOwned();
    if (!cur.includes(id)) write(KEYS.ownedAccounts, [...cur, id]);
  },
  removeOwned: (id: string) => write(KEYS.ownedAccounts, userPrefs.getOwned().filter((x) => x !== id)),

  // User-defined strategies
  getStrategies: () => read<string[]>(KEYS.strategies, []),
  addStrategy: (s: string) => {
    const cur = userPrefs.getStrategies();
    if (s && !cur.includes(s)) write(KEYS.strategies, [...cur, s]);
  },
  removeStrategy: (s: string) => write(KEYS.strategies, userPrefs.getStrategies().filter((x) => x !== s)),

  // Journal (frontend-only persistence)
  getJournal: () => readJournal(),
  addJournal: (entry: any) => write(KEYS.journal, [entry, ...readJournal()]),
  updateJournal: (id: string, patch: any) =>
    write(KEYS.journal, readJournal().map((j) => (j.id === id ? { ...j, ...patch } : j))),
  deleteJournal: (id: string) =>
    write(KEYS.journal, readJournal().filter((j) => j.id !== id)),

  // Seen tickets (to detect newly opened positions per account)
  getSeen: (accountId: string) => read<Record<string, number[]>>(KEYS.seenTickets, {})[accountId] || [],
  setSeen: (accountId: string, tickets: number[]) => {
    const all = read<Record<string, number[]>>(KEYS.seenTickets, {});
    all[accountId] = tickets;
    write(KEYS.seenTickets, all);
  },

  // Local user (mock auth)
  getUser: (): LocalUser | null => read<LocalUser | null>(KEYS.user, null),
  setUser: (user: LocalUser) => write(KEYS.user, user),
  clearUser: () => { try { localStorage.removeItem(KEYS.user); } catch { /* ignore */ } },

  // Active account (so refresh keeps the same account selected)
  getActiveAccount: (): string | null => {
    try { return localStorage.getItem(KEYS.activeAccount); } catch { return null; }
  },
  setActiveAccount: (id: string | null) => {
    try {
      if (id) localStorage.setItem(KEYS.activeAccount, id);
      else localStorage.removeItem(KEYS.activeAccount);
    } catch { /* ignore */ }
  },
};
