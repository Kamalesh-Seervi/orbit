import { ensureSignedIn } from './firebase';
import {
  findAndClaim,
  joinQueue,
  leaveQueue,
  watchQueue,
  type MatchResult,
} from './matchmaking';
import { startCaller, startCallee, type RtcSession } from './webrtc';
import { blockPeer } from './block';
import { getCoarseLocation, haversineKm } from './geo';
import { pickIcebreaker } from './icebreakers';
import { generateReconnectCode, rendezvous } from './reconnect';
import { SilenceWatcher } from './silence';
import { FilterPipeline } from './filters';
import { useStore } from '../state/store';
import type { DataMessage, PeerMeta } from './types';

// --- module-level mutable session state (kept out of the store to avoid renders)
let session: RtcSession | null = null;
let queueUnsub: (() => void) | null = null;
let rescanTimer: ReturnType<typeof setInterval> | null = null;
let searchElapsed = 0;
let searching = false;
let peerUid: string | null = null;
let silence: SilenceWatcher | null = null;
let matchInProgress = false;
let reconnectHandle: { cancel: () => void } | null = null;
let pipeline: FilterPipeline | null = null;
let connectTimer: ReturnType<typeof setTimeout> | null = null;

/** How long to wait for the media connection before giving up and re-matching. */
const CONNECT_TIMEOUT_MS = 25000;

const s = () => useStore.getState();

function buildMeta(): PeerMeta {
  const { prefs, myLoc } = s();
  return {
    displayName: prefs.displayName.trim() || 'Someone',
    gender: prefs.gender,
    interests: prefs.interests,
    loc: myLoc,
    lang: prefs.lang,
  };
}

/** Acquire the camera + microphone, routed through the filter pipeline. */
export async function acquireMedia(): Promise<MediaStream | null> {
  if (pipeline && s().localStream) return s().localStream;
  try {
    const raw = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    pipeline = new FilterPipeline(raw);
    pipeline.setName(s().prefs.displayName);
    pipeline.setFilter(s().filter);
    const output = pipeline.output;
    s().setLocalStream(output);
    applyTrackToggles(output);
    return output;
  } catch {
    return null;
  }
}

function applyTrackToggles(stream: MediaStream): void {
  const { micOn, cameraOn } = s();
  stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
  pipeline?.setCameraOn(cameraOn);
}

/** One-time boot: anonymous sign-in + geolocation, then move to the lobby. */
export async function boot(): Promise<void> {
  try {
    const uid = await ensureSignedIn();
    s().setUid(uid);
    s().setPhase('lobby');
    // Location is optional and requested lazily; prefetch quietly if allowed.
    void getCoarseLocation().then((loc) => loc && s().setMyLoc(loc));
  } catch (err) {
    s().setError((err as Error).message || 'Could not connect.');
  }
}

/** Enter the matchmaking queue and start looking for a partner. */
export async function startSearch(): Promise<void> {
  const uid = s().uid;
  if (!uid) return;
  const stream = await acquireMedia();
  if (!stream) {
    s().setError('Camera and microphone access is required to start.');
    return;
  }

  // Pick up location if it was granted after boot (e.g. from the OS prompt).
  if (!s().myLoc) {
    const loc = await getCoarseLocation();
    if (loc) s().setMyLoc(loc);
  }

  s().resetForNextCall();
  s().setPhase('searching');
  searching = true;
  searchElapsed = 0;

  try {
    await joinQueue(uid, s().prefs, s().myLoc);
    queueUnsub = watchQueue(uid, (result) => void beginCall(result));

    // Try to grab someone already waiting; then keep rescanning to break the
    // "two people waiting at once" stalemate.
    await attemptClaim();
    rescanTimer = setInterval(() => void attemptClaim().catch(() => {}), 3000);
  } catch (err) {
    searching = false;
    stopRescan();
    if (queueUnsub) {
      queueUnsub();
      queueUnsub = null;
    }
    await leaveQueue(uid).catch(() => {});
    s().setError(describeMatchError(err));
  }
}

/** Turns raw Firestore errors into actionable, human-readable guidance. */
function describeMatchError(err: unknown): string {
  const code = (err as { code?: string }).code ?? '';
  const message = (err as Error).message ?? '';
  if (code.includes('permission-denied') || message.includes('Missing or insufficient permissions')) {
    return 'Firestore blocked the connection. Deploy the security rules from firestore.rules in the Firebase console (Firestore → Rules), then try again.';
  }
  if (code.includes('failed-precondition') || message.includes('requires an index')) {
    return 'Firestore needs a moment to build an index. Wait a minute and try again.';
  }
  if (code.includes('unavailable')) {
    return 'Could not reach Firestore. Check your connection and that Firestore is enabled for this project.';
  }
  return message || 'Could not start matchmaking.';
}

async function attemptClaim(): Promise<void> {
  const uid = s().uid;
  if (!uid || !searching || matchInProgress) return;
  searchElapsed += 3;
  // Prefer shared interests early; relax to anyone-compatible after ~9s.
  const preferInterests = searchElapsed < 9 && s().prefs.interests.length > 0;
  const result = await findAndClaim(uid, s().prefs, preferInterests);
  if (result) void beginCall(result);
}

async function beginCall(result: MatchResult): Promise<void> {
  if (matchInProgress || !searching) return;
  matchInProgress = true;
  searching = false;
  stopRescan();
  if (queueUnsub) {
    queueUnsub();
    queueUnsub = null;
  }
  const uid = s().uid!;
  await leaveQueue(uid);

  peerUid = result.peerUid;
  s().setPhase('connecting');
  const stream = s().localStream!;
  startConnectWatchdog();

  const callbacks = {
    onRemoteStream: (stream: MediaStream) => s().setRemoteStream(stream),
    onData: handleData,
    onChannelOpen: () => {
      session?.send({ t: 'meta', meta: buildMeta() });
      onConnected();
    },
    onStateChange: (state: RTCPeerConnectionState) => {
      s().setConnectionState(state);
      if (state === 'connected') onConnected();
      if (state === 'failed' || state === 'closed') handlePeerGone();
    },
  };

  try {
    session =
      result.role === 'caller'
        ? await startCaller(result.roomId, stream, callbacks)
        : await startCallee(result.roomId, stream, callbacks);
  } catch {
    matchInProgress = false;
    handlePeerGone();
  }
}

let connectedOnce = false;
function onConnected(): void {
  if (connectedOnce) return;
  connectedOnce = true;
  matchInProgress = false;
  clearConnectWatchdog();
  s().setPhase('in-call');
  s().setIcebreaker(pickIcebreaker());

  // Silence-triggered icebreakers.
  const local = s().localStream;
  const remote = s().remoteStream;
  if (local && remote) {
    silence = new SilenceWatcher([local, remote], () => {
      s().setIcebreaker(pickIcebreaker(s().icebreaker ?? undefined));
    });
    silence.start();
  }
}

function handleData(msg: DataMessage): void {
  switch (msg.t) {
    case 'chat':
      s().addMessage({ id: msg.id, text: msg.text, mine: false, at: msg.at });
      s().setPeerTyping(false);
      break;
    case 'emoji':
      s().addEmoji({ id: msg.id, emoji: msg.emoji, mine: false, x: 20 + Math.random() * 60 });
      break;
    case 'typing':
      s().setPeerTyping(msg.on);
      break;
    case 'meta':
      applyPeerMeta(msg.meta);
      break;
    case 'caption':
      if (msg.final) void showRemoteCaption(msg.text, msg.lang);
      break;
    case 'bye':
      handlePeerGone();
      break;
  }
}

function applyPeerMeta(meta: PeerMeta): void {
  s().setPeerMeta(meta);
  const mine = s().myLoc;
  if (mine && meta.loc) {
    s().setDistance(haversineKm(mine, meta.loc));
  }
}

async function showRemoteCaption(text: string, fromLang: string): Promise<void> {
  const myLang = s().prefs.lang;
  let out = text;
  if (fromLang !== myLang) {
    try {
      const { translateText } = await import('./speech');
      out = await translateText(text, fromLang, myLang);
    } catch {
      /* fall back to original text */
    }
  }
  s().setRemoteCaption(out);
  window.clearTimeout((showRemoteCaption as unknown as { _t?: number })._t);
  (showRemoteCaption as unknown as { _t?: number })._t = window.setTimeout(
    () => s().setRemoteCaption(null),
    4000,
  );
}

/** Peer left (skip/stop/disconnect) — spin back into the queue automatically. */
function handlePeerGone(): void {
  if (!connectedOnce && !matchInProgress && s().phase === 'lobby') return;
  void teardownSession(false).then(() => {
    if (s().phase === 'lobby') return;
    void startSearch();
  });
}

async function teardownSession(sayBye: boolean): Promise<void> {
  connectedOnce = false;
  matchInProgress = false;
  peerUid = null;
  clearConnectWatchdog();
  silence?.stop();
  silence = null;
  stopCaptions();
  if (sayBye) session?.send({ t: 'bye' });
  const closing = session;
  session = null;
  await closing?.close().catch(() => {});
  s().setRemoteStream(null);
}

/**
 * If a match can't establish a media connection within the timeout (common on
 * very restrictive networks), automatically skip to a new partner instead of
 * leaving the user stuck on "Connecting…".
 */
function startConnectWatchdog(): void {
  clearConnectWatchdog();
  connectTimer = setTimeout(() => {
    if (!connectedOnce) void next();
  }, CONNECT_TIMEOUT_MS);
}

function clearConnectWatchdog(): void {
  if (connectTimer) {
    clearTimeout(connectTimer);
    connectTimer = null;
  }
}

/** Skip the current partner and find a new one. */
export async function next(): Promise<void> {
  await teardownSession(true);
  s().resetForNextCall();
  await startSearch();
}

/** Report the current partner (block for the session) then skip. */
export async function report(): Promise<void> {
  if (peerUid) blockPeer(peerUid);
  await next();
}

/** Leave entirely and return to the lobby. */
export async function stop(): Promise<void> {
  searching = false;
  stopRescan();
  reconnectHandle?.cancel();
  reconnectHandle = null;
  if (queueUnsub) {
    queueUnsub();
    queueUnsub = null;
  }
  const uid = s().uid;
  if (uid) await leaveQueue(uid);
  await teardownSession(true);
  s().resetForNextCall();
  s().setPhase('lobby');
}

function stopRescan(): void {
  if (rescanTimer) {
    clearInterval(rescanTimer);
    rescanTimer = null;
  }
}

// --- in-call controls -------------------------------------------------------

export function toggleMic(): void {
  const on = !s().micOn;
  s().setMic(on);
  s().localStream?.getAudioTracks().forEach((t) => (t.enabled = on));
}

export function toggleCamera(): void {
  const on = !s().cameraOn;
  s().setCamera(on);
  pipeline?.setCameraOn(on);
}

/** Change the active video filter (privacy blur, pixelate, colour grades). */
export function setFilter(id: string): void {
  s().setFilter(id);
  pipeline?.setFilter(id);
}

export function sendChat(text: string): void {
  const trimmed = text.trim();
  if (!trimmed || !session) return;
  const id = crypto.randomUUID();
  const at = Date.now();
  s().addMessage({ id, text: trimmed, mine: true, at });
  session.send({ t: 'chat', id, text: trimmed, at });
}

export function sendEmoji(emoji: string): void {
  if (!session) return;
  const id = crypto.randomUUID();
  s().addEmoji({ id, emoji, mine: true, x: 20 + Math.random() * 60 });
  session.send({ t: 'emoji', id, emoji, at: Date.now() });
}

let typingTimer: ReturnType<typeof setTimeout> | null = null;
export function sendTyping(): void {
  if (!session) return;
  session.send({ t: 'typing', on: true });
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => session?.send({ t: 'typing', on: false }), 1500);
}

/** Sends a final caption transcript to the peer for translation/display. */
export function sendCaption(text: string, lang: string): void {
  session?.send({ t: 'caption', text, lang, final: true });
}

let recognizer: import('./speech').CaptionRecognizer | null = null;

/** Turns live captions (local speech recognition) on or off. */
export async function toggleCaptions(): Promise<void> {
  const on = !s().captionsEnabled;
  s().setCaptionsEnabled(on);
  if (on) {
    const { CaptionRecognizer, isSpeechSupported } = await import('./speech');
    if (!isSpeechSupported()) {
      s().setCaptionsEnabled(false);
      return;
    }
    recognizer = new CaptionRecognizer(s().prefs.lang, (text) =>
      sendCaption(text, s().prefs.lang),
    );
    recognizer.start();
  } else {
    recognizer?.stop();
    recognizer = null;
  }
}

export function stopCaptions(): void {
  recognizer?.stop();
  recognizer = null;
  s().setCaptionsEnabled(false);
}

export function dismissIcebreaker(): void {
  s().setIcebreaker(null);
}

/**
 * Reconnect with a partner using a shared code. First party in becomes the
 * host and waits; the second joins directly. Rejects on a bad/expired code or
 * if nobody joins within the timeout.
 */
export async function startWithCode(code: string): Promise<void> {
  const uid = s().uid;
  if (!uid) throw new Error('Not ready yet — try again.');
  const stream = await acquireMedia();
  if (!stream) throw new Error('Camera and microphone access is required.');

  s().resetForNextCall();
  s().setPhase('searching');
  searching = true;
  matchInProgress = false;
  searchElapsed = 0;

  const handle = rendezvous(uid, code.trim());
  reconnectHandle = handle;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('No one joined with that code.')), 90000),
  );
  try {
    const result = await Promise.race([handle.promise, timeout]);
    reconnectHandle = null;
    await beginCall(result);
  } catch (err) {
    reconnectHandle = null;
    searching = false;
    s().setPhase('lobby');
    throw err instanceof Error ? err : new Error('Could not reconnect.');
  }
}

/** Creates a reconnect code, shows it locally, and shares it with the peer. */
export function saveReconnectCode(): string {
  const code = generateReconnectCode();
  s().setReconnectCode(code);
  if (session) {
    sendChat(`Let's reconnect later — our code is ${code}`);
  }
  return code;
}

// Best-effort cleanup if the tab is closed mid-call.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    try {
      session?.send({ t: 'bye' });
    } catch {
      /* noop */
    }
    const uid = s().uid;
    if (uid) void leaveQueue(uid);
  });
}
