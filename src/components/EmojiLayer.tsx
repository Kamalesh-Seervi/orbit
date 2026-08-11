import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../state/store';

/** Renders reaction emojis floating upward from either side of the screen. */
export function EmojiLayer() {
  const emojis = useStore((s) => s.emojis);
  const removeEmoji = useStore((s) => s.removeEmoji);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {emojis.map((e) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: -260, scale: [0.6, 1.2, 1, 1] }}
            transition={{ duration: 2.6, ease: 'easeOut' }}
            onAnimationComplete={() => removeEmoji(e.id)}
            style={{ left: `${e.x}%` }}
            className="absolute bottom-24 text-4xl"
          >
            {e.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
