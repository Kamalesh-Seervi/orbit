import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * True only when the essential Firebase config values are present. When false,
 * the UI shows a friendly setup panel instead of crashing on a null database.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
}

export const auth = authInstance;
export const db = dbInstance;

/** Returns the Firestore instance, throwing if Firebase was never configured. */
export function requireDb(): Firestore {
  if (!dbInstance) throw new Error('Firebase is not configured.');
  return dbInstance;
}

/**
 * Signs the visitor in anonymously and resolves with their ephemeral uid.
 *
 * Anonymous auth is invisible to the user (there is no login screen). Its only
 * purpose is to give every browser a stable id for the duration of the session
 * so Firestore security rules can require `request.auth != null` and reject
 * anonymous abuse — no personal data is ever collected or stored.
 */
export function ensureSignedIn(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!authInstance) {
      reject(new Error('Firebase is not configured.'));
      return;
    }
    const unsub = onAuthStateChanged(
      authInstance,
      (user) => {
        if (user) {
          unsub();
          resolve(user.uid);
        }
      },
      reject,
    );
    signInAnonymously(authInstance).catch(reject);
  });
}
