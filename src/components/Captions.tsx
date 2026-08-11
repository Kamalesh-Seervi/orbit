import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../state/store';

/** Displays the partner's translated live caption over the video. */
export function Captions() {
  const caption = useStore((s) => s.remoteCaption);
  const enabled = useStore((s) => s.captionsEnabled);
  if (!enabled) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center px-6">
      <AnimatePresence>
        {caption && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="max-w-2xl rounded-xl bg-black/70 px-4 py-2 text-center text-lg font-medium backdrop-blur"
          >
            {caption}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
