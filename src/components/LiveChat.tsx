import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Send } from 'lucide-react';
import { useStore } from '../state/store';
import { sendChat, sendTyping } from '../lib/callController';

/**
 * Instagram-Live-style message stream. Recent messages float translucently over
 * the video (bottom-left), newest at the bottom, older ones fading out the top.
 * The video is never covered — chat and video are visible together.
 */
export function LiveChatMessages() {
  const messages = useStore((s) => s.messages);
  const peerTyping = useStore((s) => s.peerTyping);
  const peerName = useStore((s) => s.peerMeta?.displayName ?? 'Stranger');
  const recent = messages.slice(-7);

  return (
    <div className="pointer-events-none flex max-h-[38vh] min-w-0 flex-1 flex-col justify-end gap-1 overflow-hidden [mask-image:linear-gradient(to_top,black_65%,transparent)]">
      <AnimatePresence initial={false}>
        {recent.map((m) => (
          <motion.div
            key={m.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="w-fit max-w-[92%] rounded-2xl bg-black/45 px-3 py-1.5 text-sm leading-snug backdrop-blur-sm"
          >
            <span className={`mr-1.5 font-semibold ${m.mine ? 'text-brand' : 'text-accent'}`}>
              {m.mine ? 'You' : peerName}
            </span>
            <span className="break-words text-white/95">{m.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
      {peerTyping && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-fit rounded-2xl bg-black/40 px-3 py-1.5 text-xs text-white/60 backdrop-blur-sm"
        >
          {peerName} is typing…
        </motion.div>
      )}
    </div>
  );
}

/**
 * Bottom message bar shown while chatting. It replaces the control bar (like IG
 * Live) so the input is never cramped or overlapping other controls.
 */
export function ChatComposer() {
  const setChatOpen = useStore((s) => s.setChatOpen);
  const [text, setText] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendChat(text);
    setText('');
  };

  return (
    <motion.form
      onSubmit={submit}
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 24, opacity: 0 }}
      className="pointer-events-auto flex items-center gap-2"
    >
      <button
        type="button"
        onClick={() => setChatOpen(false)}
        aria-label="Close chat"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 backdrop-blur"
      >
        <ChevronDown size={18} />
      </button>
      <input
        autoFocus
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          sendTyping();
        }}
        placeholder="Message…"
        className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/50 px-4 py-3 text-sm outline-none backdrop-blur focus:border-brand/60"
      />
      <button
        type="submit"
        aria-label="Send"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2"
      >
        <Send size={18} />
      </button>
    </motion.form>
  );
}
