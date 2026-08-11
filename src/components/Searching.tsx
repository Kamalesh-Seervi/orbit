import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useStore } from '../state/store';
import { stop } from '../lib/callController';
import { VideoView } from './VideoView';

const LINES = [
  'Scanning the orbit…',
  'Finding someone on your wavelength…',
  'Lining up a good match…',
  'Almost there…',
];

export function Searching() {
  const localStream = useStore((s) => s.localStream);
  const prefs = useStore((s) => s.prefs);
  const [line, setLine] = useState(0);
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setLine((l) => (l + 1) % LINES.length), 2600);
    const tick = setInterval(() => setWaited((w) => w + 1), 1000);
    return () => {
      clearInterval(id);
      clearInterval(tick);
    };
  }, []);

  return (
    <div className="relative h-full">
      <VideoView
        stream={localStream}
        muted
        mirror
        className="absolute inset-0 h-full w-full scale-105 object-cover opacity-30 blur-md"
      />
      <div className="relative flex h-full flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="relative grid h-28 w-28 place-items-center">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full border border-brand/50"
              animate={{ scale: [0.7, 1.6], opacity: [0.6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
            />
          ))}
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand to-brand-2 shadow-xl shadow-brand/40" />
        </div>

        <div>
          <motion.p
            key={line}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg font-medium"
          >
            {LINES[line]}
          </motion.p>
          <p className="mt-2 text-sm text-white/50">
            Looking for {prefs.target === 'anyone' ? 'anyone' : `someone ${prefs.target}`}
            {prefs.interests.length > 0 && ` into ${prefs.interests.slice(0, 3).join(', ')}`}
          </p>
          {waited >= 12 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mx-auto mt-3 max-w-xs text-xs text-white/40"
            >
              No one around yet. To test it yourself, open Orbit in a second
              window and set matching preferences (e.g. the opposite gender).
            </motion.p>
          )}
        </div>

        <button
          onClick={() => void stop()}
          className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm hover:bg-white/15"
        >
          <X size={16} /> Cancel
        </button>
      </div>
    </div>
  );
}
