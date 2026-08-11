import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Sparkles,
  ShieldCheck,
  MapPin,
  KeyRound,
  X,
} from 'lucide-react';
import { useStore } from '../state/store';
import {
  acquireMedia,
  startSearch,
  startWithCode,
  toggleCamera,
  toggleMic,
  setFilter,
} from '../lib/callController';
import { SUGGESTED_INTERESTS } from '../lib/icebreakers';
import { FILTERS } from '../lib/filters';
import { VideoView } from './VideoView';
import type { Gender, Target } from '../lib/types';

const LANGS: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ar', label: 'العربية' },
  { code: 'ru', label: 'Русский' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
];

export function Lobby() {
  const prefs = useStore((s) => s.prefs);
  const savePrefs = useStore((s) => s.savePrefs);
  const localStream = useStore((s) => s.localStream);
  const micOn = useStore((s) => s.micOn);
  const cameraOn = useStore((s) => s.cameraOn);
  const filter = useStore((s) => s.filter);
  const myLoc = useStore((s) => s.myLoc);

  const [permission, setPermission] = useState<'idle' | 'granted' | 'denied'>(
    localStream ? 'granted' : 'idle',
  );
  const [customInterest, setCustomInterest] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (permission === 'idle') {
      void acquireMedia().then((s) => setPermission(s ? 'granted' : 'denied'));
    }
  }, [permission]);

  const update = (patch: Partial<typeof prefs>) => savePrefs({ ...prefs, ...patch });

  const toggleInterest = (tag: string) => {
    const has = prefs.interests.includes(tag);
    const next = has
      ? prefs.interests.filter((t) => t !== tag)
      : prefs.interests.length < 6
        ? [...prefs.interests, tag]
        : prefs.interests;
    update({ interests: next });
  };

  const addCustom = () => {
    const tag = customInterest.trim().toLowerCase();
    if (tag && !prefs.interests.includes(tag) && prefs.interests.length < 6) {
      update({ interests: [...prefs.interests, tag] });
    }
    setCustomInterest('');
  };

  const start = () => {
    if (permission !== 'granted') {
      void acquireMedia().then((s) => setPermission(s ? 'granted' : 'denied'));
      return;
    }
    void startSearch();
  };

  const join = async () => {
    setCodeError(null);
    setJoining(true);
    try {
      await startWithCode(code);
    } catch (e) {
      setCodeError((e as Error).message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 shadow-lg shadow-brand/30">
            <Sparkles size={18} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Orbit</h1>
            <p className="text-xs text-white/50">Meet someone new, face to face.</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/60 sm:flex">
          <ShieldCheck size={14} className="text-accent" />
          No sign-up · nothing stored
        </div>
      </header>

      <div className="grid flex-1 gap-6 lg:grid-cols-2">
        {/* Preview */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40">
          <VideoView
            stream={localStream}
            muted
            mirror
            className="h-full w-full object-cover"
          />
          {permission !== 'granted' && (
            <div className="absolute inset-0 grid place-items-center bg-ink/80 p-6 text-center">
              <div>
                <Camera className="mx-auto mb-3 text-white/70" />
                <p className="mb-1 font-medium">
                  {permission === 'denied' ? 'Camera blocked' : 'Enable your camera'}
                </p>
                <p className="mb-4 max-w-xs text-sm text-white/50">
                  We never record or store anything — video is peer-to-peer only.
                </p>
                <button
                  onClick={() =>
                    void acquireMedia().then((s) =>
                      setPermission(s ? 'granted' : 'denied'),
                    )
                  }
                  className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
                >
                  Allow access
                </button>
              </div>
            </div>
          )}

          {permission === 'granted' && (
            <>
              <div className="absolute left-3 top-3 flex gap-2">
                <PreviewToggle on={micOn} onClick={toggleMic} On={Mic} Off={MicOff} />
                <PreviewToggle
                  on={cameraOn}
                  onClick={toggleCamera}
                  On={Camera}
                  Off={CameraOff}
                />
              </div>
              <div className="absolute inset-x-3 bottom-3 flex gap-1.5 overflow-x-auto pb-1 scroll-thin">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs backdrop-blur ${
                      filter === f.id
                        ? 'bg-white text-black'
                        : 'bg-black/40 text-white/80 hover:bg-black/60'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Form */}
        <div className="glass flex flex-col gap-5 rounded-3xl p-6">
          <Field label="Display name (optional)">
            <input
              value={prefs.displayName}
              maxLength={24}
              onChange={(e) => update({ displayName: e.target.value })}
              placeholder="Anonymous is fine"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-brand/60"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="I am">
              <Segmented<Gender>
                value={prefs.gender}
                onChange={(gender) => update({ gender })}
                options={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'nonbinary', label: 'Non-binary' },
                ]}
              />
            </Field>
            <Field label="Meet">
              <Segmented<Target>
                value={prefs.target}
                onChange={(target) => update({ target })}
                options={[
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                  { value: 'anyone', label: 'Anyone' },
                ]}
              />
            </Field>
          </div>

          <Field label={`Interests ${prefs.interests.length ? `(${prefs.interests.length}/6)` : ''}`}>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...prefs.interests, ...SUGGESTED_INTERESTS])].map((tag) => {
                const active = prefs.interests.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleInterest(tag)}
                    className={`rounded-full px-3 py-1.5 text-xs capitalize transition ${
                      active
                        ? 'bg-brand text-white'
                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustom()}
                placeholder="Add your own…"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs outline-none focus:border-brand/60"
              />
            </div>
          </Field>

          <Field label="Language (for live captions)">
            <select
              value={prefs.lang}
              onChange={(e) => update({ lang: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-brand/60"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code} className="bg-panel">
                  {l.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="mt-auto space-y-3">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <MapPin size={13} className={myLoc ? 'text-accent' : ''} />
              {myLoc
                ? `Location on — we'll show ${myLoc.label ? `${myLoc.label} · ` : ''}distance to your match`
                : 'Location off — distance reveal disabled'}
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={start}
              className="w-full rounded-2xl bg-gradient-to-br from-brand to-brand-2 py-3.5 text-base font-semibold shadow-lg shadow-brand/30"
            >
              Start meeting people
            </motion.button>

            {!showCode ? (
              <button
                onClick={() => setShowCode(true)}
                className="flex w-full items-center justify-center gap-1.5 text-xs text-white/50 hover:text-white/80"
              >
                <KeyRound size={13} /> Have a reconnect code?
              </button>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-white/60">Enter your shared code</span>
                  <button onClick={() => setShowCode(false)} className="text-white/40">
                    <X size={14} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="K7QP2M"
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm tracking-widest outline-none focus:border-brand/60"
                  />
                  <button
                    onClick={() => void join()}
                    disabled={joining || code.length < 4}
                    className="rounded-xl bg-white/10 px-4 text-sm disabled:opacity-40"
                  >
                    {joining ? '…' : 'Join'}
                  </button>
                </div>
                {codeError && <p className="mt-2 text-xs text-brand-2">{codeError}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
        {label}
      </span>
      {children}
    </label>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-1 rounded-xl bg-white/5 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg py-1.5 text-sm transition ${
            value === o.value ? 'bg-white text-black' : 'text-white/70 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PreviewToggle({
  on,
  onClick,
  On,
  Off,
}: {
  on: boolean;
  onClick: () => void;
  On: typeof Mic;
  Off: typeof MicOff;
}) {
  return (
    <button
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-full backdrop-blur ${
        on ? 'bg-black/40 text-white' : 'bg-brand-2 text-white'
      }`}
    >
      {on ? <On size={16} /> : <Off size={16} />}
    </button>
  );
}
