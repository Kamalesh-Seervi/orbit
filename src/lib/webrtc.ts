import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { requireDb } from './firebase';
import type { DataMessage } from './types';

/**
 * ICE configuration: Google STUN for direct connections, plus free public TURN
 * relays (OpenRelay by Metered). TURN relays the media over TCP/TLS on port 443,
 * which is what lets peers connect through strict/corporate firewalls and
 * symmetric NATs where STUN-only fails.
 *
 * The OpenRelay credentials are public and shared, so they can be rate-limited
 * or occasionally unavailable. For production, run your own TURN server (coturn)
 * or use a paid provider and swap the entries below.
 */
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
      ],
    },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 4,
};

export interface RtcCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onData: (msg: DataMessage) => void;
  onChannelOpen: () => void;
  onStateChange: (state: RTCPeerConnectionState) => void;
}

export interface RtcSession {
  pc: RTCPeerConnection;
  /** Sends a structured message over the data channel if it is open. */
  send: (msg: DataMessage) => void;
  /** Tears down listeners, tracks, the peer connection and room documents. */
  close: () => Promise<void>;
}

function serialize(candidate: RTCIceCandidate): Record<string, unknown> {
  return candidate.toJSON() as unknown as Record<string, unknown>;
}

/** Wires a data channel to the callback and returns a send() helper. */
function bindChannel(dc: RTCDataChannel, cbs: RtcCallbacks): (m: DataMessage) => void {
  dc.onopen = () => cbs.onChannelOpen();
  dc.onmessage = (e) => {
    try {
      cbs.onData(JSON.parse(e.data as string) as DataMessage);
    } catch {
      /* ignore malformed frames */
    }
  };
  return (msg: DataMessage) => {
    if (dc.readyState === 'open') dc.send(JSON.stringify(msg));
  };
}

/** Shared plumbing for tracks, ICE buffering and connection state. */
function preparePeer(
  pc: RTCPeerConnection,
  localStream: MediaStream,
  cbs: RtcCallbacks,
) {
  const remoteStream = new MediaStream();
  cbs.onRemoteStream(remoteStream);

  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  pc.ontrack = (event) => {
    for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
      if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
        remoteStream.addTrack(track);
      }
    }
  };

  pc.onconnectionstatechange = () => cbs.onStateChange(pc.connectionState);

  // Redundant signal: some browsers (notably Safari) surface progress through
  // iceConnectionState more reliably than connectionState. Map the meaningful
  // states so the app can react to connect/fail without waiting on both.
  pc.oniceconnectionstatechange = () => {
    const ice = pc.iceConnectionState;
    if (ice === 'connected' || ice === 'completed') cbs.onStateChange('connected');
    else if (ice === 'failed') cbs.onStateChange('failed');
  };

  // Buffer remote ICE candidates that arrive before the remote description.
  const pending: RTCIceCandidateInit[] = [];
  let remoteReady = false;
  const flush = async () => {
    remoteReady = true;
    while (pending.length) {
      await pc.addIceCandidate(new RTCIceCandidate(pending.shift()!)).catch(() => {});
    }
  };
  const addRemoteCandidate = async (init: RTCIceCandidateInit) => {
    if (remoteReady && pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(init)).catch(() => {});
    } else {
      pending.push(init);
    }
  };

  return { remoteStream, flush, addRemoteCandidate };
}

/** Deletes the room document and its candidate subcollections (best effort). */
async function deleteRoom(roomId: string): Promise<void> {
  const db = requireDb();
  const roomRef = doc(db, 'rooms', roomId);
  try {
    for (const sub of ['callerCandidates', 'calleeCandidates']) {
      const docs = await getDocs(collection(roomRef, sub));
      await Promise.all(docs.docs.map((d) => deleteDoc(d.ref)));
    }
    await deleteDoc(roomRef);
  } catch {
    /* offline or already gone — TTL will reap it */
  }
}

/** Creates the offer side of the connection. */
export async function startCaller(
  roomId: string,
  localStream: MediaStream,
  cbs: RtcCallbacks,
): Promise<RtcSession> {
  const db = requireDb();
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const { flush, addRemoteCandidate } = preparePeer(pc, localStream, cbs);

  const dc = pc.createDataChannel('orbit', { ordered: true });
  const send = bindChannel(dc, cbs);

  const roomRef = doc(db, 'rooms', roomId);
  const callerCandidates = collection(roomRef, 'callerCandidates');
  const calleeCandidates = collection(roomRef, 'calleeCandidates');

  pc.onicecandidate = (e) => {
    if (e.candidate) void addDoc(callerCandidates, serialize(e.candidate));
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await setDoc(roomRef, {
    offer: { type: offer.type, sdp: offer.sdp },
    createdAt: Date.now(),
    expireAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  const unsubRoom = onSnapshot(roomRef, async (snap) => {
    const data = snap.data();
    if (data?.answer && !pc.currentRemoteDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      await flush();
    }
  });

  const unsubCandidates = onSnapshot(calleeCandidates, (snap) => {
    snap.docChanges().forEach((c) => {
      if (c.type === 'added') void addRemoteCandidate(c.doc.data() as RTCIceCandidateInit);
    });
  });

  return {
    pc,
    send,
    close: async () => {
      unsubRoom();
      unsubCandidates();
      teardownPeer(pc, dc);
      await deleteRoom(roomId);
    },
  };
}

/** Creates the answer side of the connection. */
export async function startCallee(
  roomId: string,
  localStream: MediaStream,
  cbs: RtcCallbacks,
): Promise<RtcSession> {
  const db = requireDb();
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const { flush, addRemoteCandidate } = preparePeer(pc, localStream, cbs);

  let send: (m: DataMessage) => void = () => {};
  pc.ondatachannel = (e) => {
    send = bindChannel(e.channel, cbs);
  };

  const roomRef = doc(db, 'rooms', roomId);
  const callerCandidates = collection(roomRef, 'callerCandidates');
  const calleeCandidates = collection(roomRef, 'calleeCandidates');

  pc.onicecandidate = (e) => {
    if (e.candidate) void addDoc(calleeCandidates, serialize(e.candidate));
  };

  // The room document may not exist the instant we are notified, so wait for
  // the caller's offer to appear before answering.
  let answered = false;
  const unsubRoom = onSnapshot(roomRef, async (snap) => {
    const data = snap.data();
    if (!data?.offer || answered) return;
    answered = true;
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    await flush();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await updateDoc(roomRef, {
      answer: { type: answer.type, sdp: answer.sdp },
    });
  });

  const unsubCandidates = onSnapshot(callerCandidates, (snap) => {
    snap.docChanges().forEach((c) => {
      if (c.type === 'added') void addRemoteCandidate(c.doc.data() as RTCIceCandidateInit);
    });
  });

  return {
    pc,
    send: (m) => send(m),
    close: async () => {
      unsubRoom();
      unsubCandidates();
      teardownPeer(pc);
      await deleteRoom(roomId);
    },
  };
}

// Closes the peer connection. Note: local stream tracks are intentionally left
// running — they are owned by the call controller and reused for the next chat.
function teardownPeer(pc: RTCPeerConnection, dc?: RTCDataChannel): void {
  try {
    dc?.close();
  } catch {
    /* noop */
  }
  pc.onicecandidate = null;
  pc.ontrack = null;
  pc.onconnectionstatechange = null;
  pc.oniceconnectionstatechange = null;
  pc.ondatachannel = null;
  try {
    pc.close();
  } catch {
    /* noop */
  }
}

export type { Unsubscribe };
