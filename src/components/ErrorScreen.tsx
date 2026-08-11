import { AlertTriangle } from 'lucide-react';
import { useStore } from '../state/store';

export function ErrorScreen() {
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="glass max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-2/20 text-brand-2">
          <AlertTriangle size={22} />
        </div>
        <h1 className="mb-1 text-lg font-semibold">Something interrupted the orbit</h1>
        <p className="mb-6 text-sm text-white/60">{error ?? 'An unexpected error occurred.'}</p>
        <button
          onClick={() => setError(null)}
          className="rounded-xl bg-gradient-to-br from-brand to-brand-2 px-5 py-2.5 text-sm font-medium"
        >
          Back to start
        </button>
      </div>
    </div>
  );
}
