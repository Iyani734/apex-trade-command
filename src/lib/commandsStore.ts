import type { Command } from '@/store/tradingStore';

const KEY = 'tvp.commandsHistory.v2'; // v2: scoped by account
const MAX_PER_ACCOUNT = 500;

type Bucket = Record<string, Command[]>;

function readAll(): Bucket {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Bucket) : {};
  } catch {
    return {};
  }
}
function writeAll(b: Bucket) {
  try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* ignore */ }
}

export const commandsStore = {
  /** Load commands for a single account. */
  load(accountId: string | null): Command[] {
    if (!accountId) return [];
    return readAll()[accountId] || [];
  },
  save(accountId: string, cmds: Command[]) {
    if (!accountId) return;
    const all = readAll();
    all[accountId] = cmds.slice(0, MAX_PER_ACCOUNT);
    writeAll(all);
  },
  add(accountId: string, cmd: Command) {
    if (!accountId) return;
    const cur = commandsStore.load(accountId);
    commandsStore.save(accountId, [cmd, ...cur]);
  },
  update(accountId: string, id: string, patch: Partial<Command>) {
    if (!accountId) return;
    const next = commandsStore.load(accountId).map((c) => (c.id === id ? { ...c, ...patch } : c));
    commandsStore.save(accountId, next);
  },
  remove(accountId: string, id: string) {
    if (!accountId) return;
    commandsStore.save(accountId, commandsStore.load(accountId).filter((c) => c.id !== id));
  },
  clear(accountId: string) {
    if (!accountId) return;
    const all = readAll();
    delete all[accountId];
    writeAll(all);
  },
  /** Drop the entire bucket for an account that's been removed. */
  drop(accountId: string) {
    commandsStore.clear(accountId);
  },
};
