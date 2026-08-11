/**
 * Watches one or more media streams and fires a callback after a sustained
 * period of mutual silence. Used to surface a fresh icebreaker when the
 * conversation stalls. Everything runs locally via the Web Audio API.
 */
export class SilenceWatcher {
  private ctx: AudioContext | null = null;
  private analysers: AnalyserNode[] = [];
  private raf = 0;
  private silentSince = 0;
  private lastFired = 0;

  /** RMS below this (0..1) counts as silence. */
  private readonly threshold = 0.02;
  /** Silence must persist this long before firing. */
  private readonly holdMs = 12000;
  /** Minimum gap between two triggers. */
  private readonly cooldownMs = 25000;

  constructor(
    private readonly streams: MediaStream[],
    private readonly onSilence: () => void,
  ) {}

  start(): void {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();

    for (const stream of this.streams) {
      if (stream.getAudioTracks().length === 0) continue;
      const source = this.ctx.createMediaStreamSource(stream);
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      this.analysers.push(analyser);
    }

    this.silentSince = performance.now();
    this.lastFired = performance.now();
    this.loop();
  }

  private loop = (): void => {
    const now = performance.now();
    const loud = this.analysers.some((a) => this.rms(a) > this.threshold);

    if (loud) {
      this.silentSince = now;
    } else if (
      now - this.silentSince > this.holdMs &&
      now - this.lastFired > this.cooldownMs
    ) {
      this.lastFired = now;
      this.silentSince = now;
      this.onSilence();
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private rms(analyser: AnalyserNode): number {
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) {
      const centered = (v - 128) / 128;
      sum += centered * centered;
    }
    return Math.sqrt(sum / buf.length);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.analysers = [];
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
