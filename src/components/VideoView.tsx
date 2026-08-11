import { useEffect, useRef } from 'react';

interface Props {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  className?: string;
}

/** Binds a MediaStream to a <video> element and keeps it in sync. */
export function VideoView({ stream, muted, mirror, className }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    if (stream) void el.play().catch(() => {});
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`${mirror ? 'mirror ' : ''}${className ?? ''}`}
    />
  );
}
