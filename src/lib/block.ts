/**
 * Session-scoped blocklist. When a user reports or skips someone, we avoid
 * re-matching that peer for the rest of the browser session. This lives only in
 * memory (and sessionStorage so it survives an accidental refresh) — nothing is
 * ever written to a server, consistent with the "no data" promise.
 */
const KEY = 'orbit:blocked';

function load(): Set<string> {
  try {
    const raw = sessionStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

const blocked = load();

function persist(): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...blocked]));
  } catch {
    /* storage may be unavailable in private mode — ignore */
  }
}

export function blockPeer(uid: string): void {
  blocked.add(uid);
  persist();
}

export function isBlocked(uid: string): boolean {
  return blocked.has(uid);
}

export function blockedList(): string[] {
  return [...blocked];
}
