import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  SkipForward,
  PhoneOff,
  MessageSquare,
  Smile,
  Wand2,
  Captions as CaptionsIcon,
  MoreHorizontal,
  Flag,
  KeyRound,
} from 'lucide-react';
import { useStore } from '../state/store';
import {
  toggleMic,
  toggleCamera,
  next,
  stop,
  report,
  sendEmoji,
  toggleCaptions,
  setFilter,
  saveReconnectCode,
} from '../lib/callController';
import { REACTION_EMOJIS } from '../lib/icebreakers';
import { FILTERS } from '../lib/filters';

type Popover = 'emoji' | 'filters' | 'more' | null;

export function ControlBar() {
  const micOn = useStore((s) => s.micOn);
  const cameraOn = useStore((s) => s.cameraOn);
  const chatOpen = useStore((s) => s.chatOpen);
  const setChatOpen = useStore((s) => s.setChatOpen);
  const unread = useStore((s) => s.unreadCount);
  const captionsEnabled = useStore((s) => s.captionsEnabled);
  const filter = useStore((s) => s.filter);
  const [pop, setPop] = useState<Popover>(null);

  const toggle = (p: Popover) => setPop((cur) => (cur === p ? null : p));

  return (
    <div className="pointer-events-auto relative flex items-center justify-center gap-2 sm:gap-3">
      <AnimatePresence>
        {pop === 'emoji' && (
          <Tray>
            <div className="flex gap-1">
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    sendEmoji(e);
                    setPop(null);
                  }}
                  className="grid h-10 w-10 place-items-center rounded-xl text-2xl hover:bg-white/10"
                >
                  {e}
                </button>
              ))}
            </div>
          </Tray>
        )}
        {pop === 'filters' && (
          <Tray>
            <div className="grid grid-cols-2 gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs ${
                    filter === f.id ? 'bg-white text-black' : 'hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Tray>
        )}
        {pop === 'more' && (
          <Tray>
            <div className="flex flex-col gap-1">
              <MenuItem
                icon={<KeyRound size={15} />}
                label="Save reconnect code"
                onClick={() => {
                  saveReconnectCode();
                  setPop(null);
                }}
              />
              <MenuItem
                icon={<Flag size={15} />}
                label="Report & skip"
                danger
                onClick={() => {
                  void report();
                  setPop(null);
                }}
              />
            </div>
          </Tray>
        )}
      </AnimatePresence>

      <CircleButton active={micOn} onClick={toggleMic} label={micOn ? 'Mute' : 'Unmute'}>
        {micOn ? <Mic size={18} /> : <MicOff size={18} />}
      </CircleButton>
      <CircleButton
        active={cameraOn}
        onClick={toggleCamera}
        label={cameraOn ? 'Camera off' : 'Camera on'}
      >
        {cameraOn ? <Video size={18} /> : <VideoOff size={18} />}
      </CircleButton>

      <CircleButton onClick={() => toggle('emoji')} label="React" open={pop === 'emoji'}>
        <Smile size={18} />
      </CircleButton>
      <CircleButton
        onClick={() => setChatOpen(!chatOpen)}
        label="Chat"
        badge={unread}
      >
        <MessageSquare size={18} />
      </CircleButton>
      <CircleButton onClick={() => toggle('filters')} label="Filters" open={pop === 'filters'}>
        <Wand2 size={18} />
      </CircleButton>
      <CircleButton
        active={captionsEnabled}
        onClick={() => void toggleCaptions()}
        label="Captions"
      >
        <CaptionsIcon size={18} />
      </CircleButton>

      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => void next()}
        className="flex h-12 items-center gap-2 rounded-full bg-gradient-to-br from-brand to-brand-2 px-5 font-medium shadow-lg shadow-brand/30"
      >
        <SkipForward size={18} /> Next
      </motion.button>

      <CircleButton onClick={() => toggle('more')} label="More" open={pop === 'more'}>
        <MoreHorizontal size={18} />
      </CircleButton>
      <CircleButton onClick={() => void stop()} label="Leave" danger>
        <PhoneOff size={18} />
      </CircleButton>
    </div>
  );
}

function Tray({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      className="glass absolute bottom-16 left-1/2 -translate-x-1/2 rounded-2xl p-2"
    >
      {children}
    </motion.div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-white/10 ${
        danger ? 'text-brand-2' : ''
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CircleButton({
  children,
  onClick,
  label,
  active = true,
  danger,
  open,
  badge,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  danger?: boolean;
  open?: boolean;
  badge?: number;
}) {
  const tone = danger
    ? 'bg-brand-2 text-white'
    : !active
      ? 'bg-brand-2/90 text-white'
      : open
        ? 'bg-white text-black'
        : 'bg-white/10 text-white hover:bg-white/20';
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative grid h-12 w-12 place-items-center rounded-full backdrop-blur transition ${tone}`}
    >
      {children}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-black">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  );
}
