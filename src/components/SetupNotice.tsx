import { Github, Database } from 'lucide-react';

/** Shown when Firebase env vars are missing, with copy-paste setup steps. */
export function SetupNotice() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="glass w-full max-w-lg rounded-3xl p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2">
            <Database size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Almost there</h1>
            <p className="text-sm text-white/60">Connect a Firebase project to go live.</p>
          </div>
        </div>

        <ol className="space-y-3 text-sm text-white/80">
          <li>
            1. Create a project at{' '}
            <a
              className="text-accent underline"
              href="https://console.firebase.google.com/"
              target="_blank"
              rel="noreferrer"
            >
              console.firebase.google.com
            </a>
            .
          </li>
          <li>2. Enable <b>Firestore Database</b> and <b>Anonymous</b> sign-in.</li>
          <li>
            3. Copy <code className="rounded bg-white/10 px-1">.env.example</code> to{' '}
            <code className="rounded bg-white/10 px-1">.env.local</code> and paste your web
            config.
          </li>
          <li>
            4. Deploy the security rules in{' '}
            <code className="rounded bg-white/10 px-1">firestore.rules</code>.
          </li>
          <li>5. Restart the dev server.</li>
        </ol>

        <div className="mt-6 flex items-center gap-2 text-xs text-white/40">
          <Github size={14} />
          <span>No accounts, no stored data — just ephemeral matchmaking.</span>
        </div>
      </div>
    </div>
  );
}
