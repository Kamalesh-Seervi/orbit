import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from './state/store';
import { boot } from './lib/callController';
import { isFirebaseConfigured } from './lib/firebase';
import { SetupNotice } from './components/SetupNotice';
import { Lobby } from './components/Lobby';
import { Searching } from './components/Searching';
import { CallScreen } from './components/CallScreen';
import { ErrorScreen } from './components/ErrorScreen';

export default function App() {
  const phase = useStore((s) => s.phase);

  useEffect(() => {
    if (isFirebaseConfigured) void boot();
  }, []);

  return (
    <>
      <div className="aurora" />
      {!isFirebaseConfigured ? (
        <SetupNotice />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={screenKey(phase)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="h-full"
          >
            {phase === 'boot' && <BootScreen />}
            {phase === 'lobby' && <Lobby />}
            {phase === 'searching' && <Searching />}
            {(phase === 'connecting' || phase === 'in-call') && <CallScreen />}
            {phase === 'error' && <ErrorScreen />}
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
}

/** Group connecting + in-call so the call screen doesn't remount on connect. */
function screenKey(phase: string): string {
  if (phase === 'connecting' || phase === 'in-call') return 'call';
  return phase;
}

function BootScreen() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-14 w-14">
          <span className="absolute inset-0 animate-[pulse-ring_2s_ease-in-out_infinite] rounded-full bg-brand/40" />
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-brand to-brand-2" />
        </div>
        <p className="text-sm text-white/60">Warming up the orbit…</p>
      </div>
    </div>
  );
}
