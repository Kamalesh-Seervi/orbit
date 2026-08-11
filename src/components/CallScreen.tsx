import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Loader2 } from 'lucide-react';
import { useStore } from '../state/store';
import { VideoView } from './VideoView';
import { ControlBar } from './ControlBar';
import { LiveChatMessages, ChatComposer } from './LiveChat';
import { Captions } from './Captions';
import { EmojiLayer } from './EmojiLayer';
import { DistanceBadge } from './DistanceBadge';
import { IcebreakerToast } from './IcebreakerToast';
import { ReconnectDialog } from './ReconnectDialog';

/** Blur-to-reveal duration for a freshly connected partner. */
const REVEAL_SECONDS = 45;

export function CallScreen() {
  const phase = useStore((s) => s.phase);
  const localStream = useStore((s) => s.localStream);
  const remoteStream = useStore((s) => s.remoteStream);
  const chatOpen = useStore((s) => s.chatOpen);
  const connecting = phase === 'connecting';

  return (
    <div className="relative h-full overflow-hidden">
      {/* Remote video */}
      <RemoteStage stream={remoteStream} connecting={connecting} />

      <EmojiLayer />
      <Captions />

      {/* Top overlay: partner info stacked above the icebreaker (no overlap) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
        <div className="pointer-events-auto self-start">
          <DistanceBadge />
        </div>
        <div className="pointer-events-auto flex justify-center">
          <IcebreakerToast />
        </div>
      </div>

      {/* Bottom overlay: live chat + self-view sit above the controls/composer,
          in a flex column so nothing ever overlaps regardless of height. */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 p-3 pb-4">
        <div className="pointer-events-none flex items-end justify-between gap-3">
          <LiveChatMessages />
          <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-black/50 shadow-xl sm:h-40 sm:w-28">
            <VideoView stream={localStream} muted mirror className="h-full w-full object-cover" />
            <span className="absolute bottom-1 left-2 text-[10px] font-medium text-white/70">
              You
            </span>
          </div>
        </div>

        {chatOpen ? (
          <ChatComposer />
        ) : (
          <div className="pointer-events-none flex justify-center">
            <ControlBar />
          </div>
        )}
      </div>

      <ReconnectDialog />
    </div>
  );
}

function RemoteStage({
  stream,
  connecting,
}: {
  stream: MediaStream | null;
  connecting: boolean;
}) {
  const [instant, setInstant] = useState(false);
  const [done, setDone] = useState(false);

  // Reset the reveal each time a new partner connects.
  useEffect(() => {
    setInstant(false);
    setDone(false);
  }, [stream]);

  const showReveal = stream && !done;

  return (
    <div className="absolute inset-0 bg-black">
      <motion.div
        key={stream?.id ?? 'none'}
        className="h-full w-full"
        initial={{ filter: 'blur(20px)' }}
        animate={{ filter: 'blur(0px)' }}
        transition={{ duration: instant ? 0.5 : REVEAL_SECONDS, ease: 'linear' }}
        onAnimationComplete={() => setDone(true)}
      >
        <VideoView stream={stream} className="h-full w-full object-cover" />
      </motion.div>

      {connecting && (
        <div className="absolute inset-0 grid place-items-center bg-ink/70">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-brand" />
            <p className="text-sm text-white/70">Connecting you…</p>
          </div>
        </div>
      )}

      {showReveal && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setInstant(true)}
          className="glass absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full px-3 py-2 text-xs"
        >
          <Eye size={14} /> Reveal now
        </motion.button>
      )}
    </div>
  );
}
