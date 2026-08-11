import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { requireDb } from './firebase';
import { isBlocked, blockedList } from './block';
import type { CoarseLocation, PeerRole, Preferences, Target } from './types';

/** How long a stale queue entry lives before Firestore TTL removes it. */
const QUEUE_TTL_MS = 2 * 60 * 1000;
/** How many waiting candidates to consider per scan. */
const SCAN_LIMIT = 25;

export interface MatchResult {
  roomId: string;
  role: PeerRole;
  peerUid: string;
}

interface RawQueueDoc {
  uid: string;
  gender: string;
  target: Target;
  interests: string[];
  loc: CoarseLocation | null;
  lang: string;
  displayName: string;
  status: 'waiting' | 'matched';
  roomId?: string;
  role?: PeerRole;
  peer?: string;
  blocked?: string[];
  createdAt: number;
}

function queueRef(uid: string) {
  return doc(requireDb(), 'queue', uid);
}

/** Does each side's target accept the other's gender? */
function mutuallyCompatible(mine: Preferences, other: RawQueueDoc): boolean {
  const iAcceptThem =
    mine.target === 'anyone' || mine.target === other.gender;
  const theyAcceptMe =
    other.target === 'anyone' || other.target === mine.gender;
  return iAcceptThem && theyAcceptMe;
}

function interestOverlap(a: string[], b: string[]): number {
  const set = new Set(a);
  return b.reduce((n, tag) => (set.has(tag) ? n + 1 : n), 0);
}

/** Adds the user to the waiting pool. */
export async function joinQueue(
  uid: string,
  prefs: Preferences,
  loc: CoarseLocation | null,
): Promise<void> {
  await setDoc(queueRef(uid), {
    uid,
    gender: prefs.gender,
    target: prefs.target,
    interests: prefs.interests,
    loc,
    lang: prefs.lang,
    displayName: prefs.displayName,
    status: 'waiting',
    blocked: blockedList(),
    createdAt: Date.now(),
    expireAt: new Date(Date.now() + QUEUE_TTL_MS),
    _touch: serverTimestamp(),
  });
}

/** Removes the user from the pool (called on match, skip, or teardown). */
export async function leaveQueue(uid: string): Promise<void> {
  try {
    await deleteDoc(queueRef(uid));
  } catch {
    /* already gone / offline — TTL will reap it */
  }
}

/**
 * Scans the waiting pool for a compatible peer and atomically claims the best
 * candidate. On success the caller becomes the WebRTC "caller"; the claimed
 * peer is flipped to "matched" and will be notified through {@link watchQueue}.
 *
 * The claim runs in a transaction that touches BOTH documents, so two people
 * grabbing each other at the same instant can never create two rooms — exactly
 * one transaction commits and the other retries and backs off.
 */
export async function findAndClaim(
  uid: string,
  prefs: Preferences,
  preferInterests: boolean,
): Promise<MatchResult | null> {
  const db = requireDb();
  // Equality filter + limit only, so no composite index is required. We rank
  // the results (interest overlap, then age) on the client below.
  const snap = await getDocs(
    query(
      collection(db, 'queue'),
      where('status', '==', 'waiting'),
      limit(SCAN_LIMIT),
    ),
  );

  const now = Date.now();
  const candidates = snap.docs
    .map((d) => d.data() as RawQueueDoc)
    .filter((c) => c.uid !== uid)
    .filter((c) => !isBlocked(c.uid))
    .filter((c) => !(c.blocked ?? []).includes(uid))
    .filter((c) => now - c.createdAt < QUEUE_TTL_MS)
    .filter((c) => mutuallyCompatible(prefs, c));

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (preferInterests) {
      const diff =
        interestOverlap(prefs.interests, b.interests) -
        interestOverlap(prefs.interests, a.interests);
      if (diff !== 0) return diff;
    }
    return a.createdAt - b.createdAt;
  });

  for (const cand of candidates) {
    const roomId = doc(collection(db, 'rooms')).id;
    const claimed = await claim(uid, cand.uid, roomId);
    if (claimed === 'self-taken') return null; // someone grabbed us; watcher handles it
    if (claimed === 'ok') {
      return { roomId, role: 'caller', peerUid: cand.uid };
    }
    // 'cand-taken' -> try the next candidate
  }
  return null;
}

type ClaimOutcome = 'ok' | 'cand-taken' | 'self-taken';

async function claim(
  uid: string,
  candUid: string,
  roomId: string,
): Promise<ClaimOutcome> {
  const db = requireDb();
  const myRef = doc(db, 'queue', uid);
  const candRef = doc(db, 'queue', candUid);
  try {
    return await runTransaction(db, async (tx) => {
      const mySnap = await tx.get(myRef);
      const candSnap = await tx.get(candRef);
      if (!mySnap.exists() || mySnap.data().status !== 'waiting') {
        return 'self-taken';
      }
      if (!candSnap.exists() || candSnap.data().status !== 'waiting') {
        return 'cand-taken';
      }
      tx.update(candRef, {
        status: 'matched',
        roomId,
        role: 'callee' satisfies PeerRole,
        peer: uid,
      });
      tx.update(myRef, {
        status: 'matched',
        roomId,
        role: 'caller' satisfies PeerRole,
        peer: candUid,
      });
      return 'ok';
    });
  } catch {
    return 'cand-taken';
  }
}

/**
 * Watches the user's own queue document. Fires once the user is claimed by
 * someone else (they become the "callee"). The caller path is resolved by
 * {@link findAndClaim} directly, so this callback ignores the caller role.
 */
export function watchQueue(
  uid: string,
  onMatched: (result: MatchResult) => void,
): Unsubscribe {
  return onSnapshot(queueRef(uid), (snap) => {
    const data = snap.data() as RawQueueDoc | undefined;
    if (!data || data.status !== 'matched') return;
    if (data.role !== 'callee' || !data.roomId || !data.peer) return;
    onMatched({ roomId: data.roomId, role: 'callee', peerUid: data.peer });
  });
}
