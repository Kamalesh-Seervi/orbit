import { create } from 'zustand';
import type {
  ChatMessage,
  CoarseLocation,
  FloatingEmoji,
  PeerMeta,
  Phase,
  Preferences,
} from '../lib/types';

const PREFS_KEY = 'orbit:prefs';

function loadPrefs(): Preferences {
  const fallback: Preferences = {
    displayName: '',
    gender: 'male',
    target: 'female',
    interests: [],
    lang: navigator.language?.slice(0, 2) || 'en',
  };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return fallback;
  }
}

export interface AppState {
  phase: Phase;
  uid: string | null;
  prefs: Preferences;

  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  cameraOn: boolean;
  filter: string;

  peerMeta: PeerMeta | null;
  myLoc: CoarseLocation | null;
  distanceKm: number | null;
  connectionState: RTCPeerConnectionState;

  messages: ChatMessage[];
  unreadCount: number;
  chatOpen: boolean;
  peerTyping: boolean;
  emojis: FloatingEmoji[];

  captionsEnabled: boolean;
  remoteCaption: string | null;

  icebreaker: string | null;
  reconnectCode: string | null;
  error: string | null;

  // --- actions ---
  setPhase: (p: Phase) => void;
  setUid: (uid: string) => void;
  savePrefs: (p: Preferences) => void;
  setLocalStream: (s: MediaStream | null) => void;
  setRemoteStream: (s: MediaStream | null) => void;
  setMic: (on: boolean) => void;
  setCamera: (on: boolean) => void;
  setFilter: (id: string) => void;
  setPeerMeta: (m: PeerMeta | null) => void;
  setMyLoc: (l: CoarseLocation | null) => void;
  setDistance: (km: number | null) => void;
  setConnectionState: (s: RTCPeerConnectionState) => void;
  addMessage: (m: ChatMessage) => void;
  setChatOpen: (open: boolean) => void;
  setPeerTyping: (on: boolean) => void;
  addEmoji: (e: FloatingEmoji) => void;
  removeEmoji: (id: string) => void;
  setCaptionsEnabled: (on: boolean) => void;
  setRemoteCaption: (text: string | null) => void;
  setIcebreaker: (text: string | null) => void;
  setReconnectCode: (code: string | null) => void;
  setError: (msg: string | null) => void;
  resetForNextCall: () => void;
}

export const useStore = create<AppState>((set) => ({
  phase: 'boot',
  uid: null,
  prefs: loadPrefs(),

  localStream: null,
  remoteStream: null,
  micOn: true,
  cameraOn: true,
  filter: 'none',

  peerMeta: null,
  myLoc: null,
  distanceKm: null,
  connectionState: 'new',

  messages: [],
  unreadCount: 0,
  chatOpen: false,
  peerTyping: false,
  emojis: [],

  captionsEnabled: false,
  remoteCaption: null,

  icebreaker: null,
  reconnectCode: null,
  error: null,

  setPhase: (phase) => set({ phase }),
  setUid: (uid) => set({ uid }),
  savePrefs: (prefs) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
    set({ prefs });
  },
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  setMic: (micOn) => set({ micOn }),
  setCamera: (cameraOn) => set({ cameraOn }),
  setFilter: (filter) => set({ filter }),
  setPeerMeta: (peerMeta) => set({ peerMeta }),
  setMyLoc: (myLoc) => set({ myLoc }),
  setDistance: (distanceKm) => set({ distanceKm }),
  setConnectionState: (connectionState) => set({ connectionState }),
  addMessage: (m) =>
    set((s) => ({
      messages: [...s.messages, m],
      unreadCount: m.mine || s.chatOpen ? s.unreadCount : s.unreadCount + 1,
    })),
  setChatOpen: (chatOpen) =>
    set((s) => ({ chatOpen, unreadCount: chatOpen ? 0 : s.unreadCount })),
  setPeerTyping: (peerTyping) => set({ peerTyping }),
  addEmoji: (e) => set((s) => ({ emojis: [...s.emojis, e] })),
  removeEmoji: (id) => set((s) => ({ emojis: s.emojis.filter((e) => e.id !== id) })),
  setCaptionsEnabled: (captionsEnabled) => set({ captionsEnabled }),
  setRemoteCaption: (remoteCaption) => set({ remoteCaption }),
  setIcebreaker: (icebreaker) => set({ icebreaker }),
  setReconnectCode: (reconnectCode) => set({ reconnectCode }),
  setError: (error) => set({ error, phase: error ? 'error' : 'lobby' }),
  resetForNextCall: () =>
    set({
      remoteStream: null,
      peerMeta: null,
      distanceKm: null,
      connectionState: 'new',
      messages: [],
      unreadCount: 0,
      chatOpen: false,
      peerTyping: false,
      emojis: [],
      remoteCaption: null,
      icebreaker: null,
      reconnectCode: null,
    }),
}));
