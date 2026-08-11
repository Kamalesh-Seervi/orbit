import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { requireDb } from './firebase';
import type { MatchResult } from './matchmaking';

const RECONNECT_TTL_MS = 10 * 60 * 1000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

/** A short human-shareable code, e.g. "K7QP2M". */
export function generateReconnectCode(): string {
  let code = '';
  const rnd = crypto.getRandomValues(new Uint32Array(6));
  for (const n of rnd) code += ALPHABET[n % ALPHABET.length];
  return code;
}

interface ReconnectDoc {
  a?: string;
  b?: string;
  roomId: string;
  createdAt: number;
}

/**
 * Two people who share a code both call this. The first to arrive creates a
 * private room and waits (as caller); the second joins it (as callee). The doc
 * is transient and TTL-expires, so nothing persists after the reconnect.
 */
export function rendezvous(uid: string, code: string): {
  promise: Promise<MatchResult>;
  cancel: () => void;
} {
  const db = requireDb();
  const ref = doc(db, 'reconnect', code.toUpperCase());
  let unsub: (() => void) | null = null;
  let cancelled = false;

  const promise = (async (): Promise<MatchResult> => {
    const outcome = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        const roomId = doc(collection(db, 'rooms')).id;
        tx.set(ref, {
          a: uid,
          roomId,
          createdAt: Date.now(),
          expireAt: new Date(Date.now() + RECONNECT_TTL_MS),
        });
        return { self: 'a' as const, roomId, peer: undefined };
      }
      const data = snap.data() as ReconnectDoc;
      if (data.a === uid) return { self: 'a' as const, roomId: data.roomId, peer: data.b };
      if (data.b === uid) return { self: 'b' as const, roomId: data.roomId, peer: data.a };
      if (!data.b) {
        tx.update(ref, { b: uid });
        return { self: 'b' as const, roomId: data.roomId, peer: data.a };
      }
      throw new Error('That code is already in use.');
    });

    if (outcome.self === 'b') {
      return { roomId: outcome.roomId, role: 'callee', peerUid: outcome.peer! };
    }

    // We are the host (caller): wait for the other side to redeem the code.
    if (outcome.peer) {
      return { roomId: outcome.roomId, role: 'caller', peerUid: outcome.peer };
    }
    return new Promise<MatchResult>((resolve, reject) => {
      unsub = onSnapshot(ref, (snap) => {
        const data = snap.data() as ReconnectDoc | undefined;
        if (cancelled) return;
        if (data?.b) {
          unsub?.();
          resolve({ roomId: outcome.roomId, role: 'caller', peerUid: data.b });
        }
      }, reject);
    });
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
      unsub?.();
    },
  };
}
