import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircleQuestion, X, Send } from 'lucide-react';
import { useStore } from '../state/store';
import { dismissIcebreaker, sendChat } from '../lib/callController';

/** A gentle conversation-starter surfaced on connect and during lulls. */
export function IcebreakerToast() {
  const icebreaker = useStore((s) => s.icebreaker);

  return (
    <AnimatePresence>
      {icebreaker && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="glass flex items-center gap-3 rounded-2xl px-4 py-2.5"
        >
          <MessageCircleQuestion size={18} className="shrink-0 text-accent" />
          <span className="text-sm">{icebreaker}</span>
          <div className="ml-1 flex items-center gap-1">
            <button
              title="Send as message"
              onClick={() => {
                sendChat(icebreaker);
                dismissIcebreaker();
              }}
              className="grid h-7 w-7 place-items-center rounded-full bg-brand/30 text-brand hover:bg-brand/50"
            >
              <Send size={13} />
            </button>
            <button
              onClick={dismissIcebreaker}
              className="grid h-7 w-7 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            >
              <X size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
