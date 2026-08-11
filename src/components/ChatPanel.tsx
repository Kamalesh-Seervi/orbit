import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, X } from 'lucide-react';
import { useStore } from '../state/store';
import { sendChat, sendTyping } from '../lib/callController';

export function ChatPanel() {
  const open = useStore((s) => s.chatOpen);
  const setChatOpen = useStore((s) => s.setChatOpen);
  const messages = useStore((s) => s.messages);
  const peerTyping = useStore((s) => s.peerTyping);
  const peerName = useStore((s) => s.peerMeta?.displayName ?? 'Stranger');
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerTyping, open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendChat(text);
    setText('');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: '100%', opacity: 0.5 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.5 }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className="glass absolute inset-y-0 right-0 z-20 flex w-full flex-col sm:w-80"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-sm font-medium">Chat</span>
            <button onClick={() => setChatOpen(false)} className="text-white/50 hover:text-white">
              <X size={18} />
            </button>
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto p-4 scroll-thin">
            {messages.length === 0 && (
              <p className="mt-6 text-center text-sm text-white/40">
                Say hi to {peerName} 👋
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.mine
                      ? 'rounded-br-sm bg-gradient-to-br from-brand to-brand-2'
                      : 'rounded-bl-sm bg-white/10'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {peerTyping && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-2xl bg-white/10 px-3 py-2.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-white/60"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={submit} className="flex items-center gap-2 border-t border-white/10 p-3">
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                sendTyping();
              }}
              placeholder="Message…"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-brand/60"
            />
            <button
              type="submit"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-2"
            >
              <Send size={16} />
            </button>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
