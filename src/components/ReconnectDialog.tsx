import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Check, KeyRound, X } from 'lucide-react';
import { useStore } from '../state/store';

/** Shows a freshly-created reconnect code to share with the current partner. */
export function ReconnectDialog() {
  const code = useStore((s) => s.reconnectCode);
  const setReconnectCode = useStore((s) => s.setReconnectCode);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can read it manually */
    }
  };

  return (
    <AnimatePresence>
      {code && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-6"
        >
          <motion.div
            initial={{ scale: 0.92, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 10 }}
            className="glass w-full max-w-sm rounded-3xl p-6 text-center"
          >
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-brand/20 text-brand">
              <KeyRound size={20} />
            </div>
            <h2 className="mb-1 text-lg font-semibold">Reconnect code</h2>
            <p className="mb-4 text-sm text-white/60">
              Share this with your partner. Either of you can enter it on the home
              screen later to find each other again. It expires in 10 minutes and is
              never stored.
            </p>
            <button
              onClick={() => void copy()}
              className="mb-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-4 text-2xl font-semibold tracking-[0.3em]"
            >
              {code}
              {copied ? <Check size={18} className="text-accent" /> : <Copy size={18} />}
            </button>
            <button
              onClick={() => setReconnectCode(null)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5 text-sm hover:bg-white/15"
            >
              <X size={15} /> Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
