# Orbit

A polished, Omegle-style **random video chat** — no sign-up, nothing stored.
Two strangers are paired at random and connect **peer-to-peer** over WebRTC.
Matchmaking + signaling run **serverlessly on Firebase**, so the whole thing can
be hosted as a static site on GitHub Pages.

## Highlights

- 🎥 **P2P video/audio** (WebRTC, Google STUN) with mute + camera toggle
- ⚧ **Gender-aware matching** — pick who you are and who you want to meet
- 📍 **Distance reveal** — see roughly how far away (and where) your match is
- 🌫️ **Blur-to-reveal** — the partner's video sharpens as you chat (or reveal now)
- 💬 **Text chat** + ✋ **emoji reactions** over the P2P data channel
- 🧊 **Icebreakers** that appear on connect and when the conversation lulls
- 🏷️ **Interest tags** bias you toward more compatible matches
- 🪄 **Privacy filters** (blur / pixelate) + colour grades your partner actually sees
- 🗣️ **Live captions + on-device translation** (Chrome, best-effort)
- 🔑 **Reconnect codes** to find a good match again — transient, never stored
- 🚩 **Report & skip** with a session-local block list

> **Privacy by design:** there are no accounts and no chat history. The only
> data that ever touches Firebase is a handful of transient matchmaking /
> signaling documents that are deleted on disconnect and auto-expire via a TTL
> policy. Chat, captions and reactions travel directly peer-to-peer.

## 1. Prerequisites

- Node.js 18+
- A free Firebase project

## 2. Firebase setup (once)

1. Create a project at <https://console.firebase.google.com/>.
2. **Build → Firestore Database → Create database** (production mode).
3. **Build → Authentication → Sign-in method → enable _Anonymous_.**
4. **Project settings → General → Your apps → Web app** → copy the config.
5. Copy `.env.example` to `.env.local` and paste the values.
6. Deploy the security rules from [`firestore.rules`](./firestore.rules)
   (via the Firebase console **Firestore → Rules**, or the Firebase CLI).
7. **Recommended — TTL cleanup:** in **Firestore → TTL**, add a policy on the
   `expireAt` field for the `queue`, `rooms` and `reconnect` collections so any
   abandoned documents self-delete.

## 3. Run locally

```bash
npm install
npm run dev
```

Open the printed URL in **two** browser windows/profiles (or two devices) to
match with yourself. Camera, microphone and geolocation work on `localhost`
(a secure context) and over HTTPS in production.

## 4. Deploy to GitHub Pages

1. Push this repo to GitHub. The `base` in [`vite.config.ts`](./vite.config.ts)
   is set to `/connections/` — change it if your repo has a different name.
2. In **Settings → Secrets and variables → Actions**, add each `VITE_FIREBASE_*`
   value as a repository secret (same names as in `.env.example`).
3. In **Settings → Pages**, set the source to **GitHub Actions**.
4. Push to `main` — the workflow in
   [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) builds and
   publishes automatically.
5. In the Firebase console, add your `*.github.io` domain under
   **Authentication → Settings → Authorized domains**.

## Notes & limitations

- **STUN-only:** most home/mobile networks connect fine, but strict/symmetric
  NATs (some corporate networks) may fail because there is no TURN relay.
- **Gender is self-declared** and cannot be verified without accounts.
- **Captions/translation** rely on the Web Speech API + Chrome's built-in
  Translator and degrade gracefully elsewhere.
- **Moderation:** with no stored data, "report" skips and blocks the peer for
  your session only — there is no global banning.

## Tech

React + Vite + TypeScript · Tailwind CSS v4 · Framer Motion · Zustand ·
Firebase (Firestore + Anonymous Auth) · WebRTC.
