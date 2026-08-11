import { motion } from 'framer-motion';
import { MapPin, Sparkles } from 'lucide-react';
import { useStore } from '../state/store';
import { formatDistance } from '../lib/geo';

export function DistanceBadge() {
  const peerMeta = useStore((s) => s.peerMeta);
  const distanceKm = useStore((s) => s.distanceKm);
  const myInterests = useStore((s) => s.prefs.interests);
  if (!peerMeta) return null;

  const shared = peerMeta.interests.filter((t) => myInterests.includes(t));

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass flex max-w-[80vw] items-center gap-3 rounded-2xl px-4 py-2"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{peerMeta.displayName}</p>
        <div className="flex items-center gap-2 text-xs text-white/60">
          {distanceKm != null ? (
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-accent" />
              {formatDistance(distanceKm)}
              {peerMeta.loc?.label ? ` · ${peerMeta.loc.label}` : ''}
            </span>
          ) : (
            <span className="text-white/40">location private</span>
          )}
        </div>
      </div>
      {shared.length > 0 && (
        <div className="flex items-center gap-1 rounded-full bg-brand/20 px-2 py-1 text-xs text-brand">
          <Sparkles size={11} />
          {shared.slice(0, 2).join(', ')}
        </div>
      )}
    </motion.div>
  );
}
