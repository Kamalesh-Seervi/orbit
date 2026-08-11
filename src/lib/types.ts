/** Self-declared gender. Unverifiable by design (no accounts, no data). */
export type Gender = 'male' | 'female' | 'nonbinary';

/** Who a user wants to be matched with. */
export type Target = 'male' | 'female' | 'anyone';

export interface Preferences {
  displayName: string;
  gender: Gender;
  target: Target;
  interests: string[];
  /** BCP-47 language tag used for caption translation, e.g. "en", "es". */
  lang: string;
}

/** Coarse, privacy-reduced location shared with a match for distance reveal. */
export interface CoarseLocation {
  lat: number;
  lng: number;
  /** Human-friendly coarse label, e.g. "Berlin, DE" when available. */
  label?: string;
}

/** A document in the `queue` collection while a user waits to be matched. */
export interface QueueDoc {
  uid: string;
  gender: Gender;
  target: Target;
  interests: string[];
  loc: CoarseLocation | null;
  lang: string;
  displayName: string;
  status: 'waiting' | 'matched';
  roomId?: string;
  /** Set to the peer's uid + 'caller'/'callee' once matched. */
  role?: PeerRole;
  blocked: string[];
  createdAt: number;
  /** TTL field — Firestore auto-deletes the doc after this timestamp. */
  expireAt: Date;
}

export type PeerRole = 'caller' | 'callee';

/** Metadata each peer publishes into the room for the other to read. */
export interface PeerMeta {
  displayName: string;
  gender: Gender;
  interests: string[];
  loc: CoarseLocation | null;
  lang: string;
}

/** High-level phase of the app, drives which screen is shown. */
export type Phase =
  | 'boot' // signing in / loading
  | 'lobby' // choosing preferences + granting permissions
  | 'searching' // in the queue, looking for a match
  | 'connecting' // matched, negotiating WebRTC
  | 'in-call' // connected to a peer
  | 'error';

/** Messages exchanged peer-to-peer over the WebRTC DataChannel. */
export type DataMessage =
  | { t: 'chat'; id: string; text: string; at: number }
  | { t: 'emoji'; id: string; emoji: string; at: number }
  | { t: 'caption'; text: string; lang: string; final: boolean }
  | { t: 'typing'; on: boolean }
  | { t: 'meta'; meta: PeerMeta }
  | { t: 'bye' };

export interface ChatMessage {
  id: string;
  text: string;
  mine: boolean;
  at: number;
}

export interface FloatingEmoji {
  id: string;
  emoji: string;
  mine: boolean;
  x: number;
}
