/**
 * Canvas-based video filter pipeline. The camera feed is always routed through
 * a canvas so the *outgoing* WebRTC track carries whatever filter is active —
 * that means a partner actually sees your "privacy blur"/pixelation, not just
 * you. Keeping the canvas always-on means switching filters never needs a
 * track renegotiation. Audio is passed straight through untouched.
 *
 * Filters are pure Canvas2D (ctx.filter + pixelation), so there is no heavy ML
 * dependency and it runs smoothly on modest devices. Face-tracked AR overlays
 * and segmentation-based background blur are a natural future extension.
 */

export interface FilterOption {
  id: string;
  label: string;
  /** Category used for grouping in the UI. */
  kind: 'off' | 'privacy' | 'style';
}

export const FILTERS: FilterOption[] = [
  { id: 'none', label: 'None', kind: 'off' },
  { id: 'blur', label: 'Privacy blur', kind: 'privacy' },
  { id: 'pixelate', label: 'Pixelate', kind: 'privacy' },
  { id: 'noir', label: 'Noir', kind: 'style' },
  { id: 'sepia', label: 'Sepia', kind: 'style' },
  { id: 'warm', label: 'Warm', kind: 'style' },
  { id: 'cool', label: 'Cool', kind: 'style' },
  { id: 'vivid', label: 'Vivid', kind: 'style' },
];

const CSS_FILTER: Record<string, string> = {
  none: 'none',
  noir: 'grayscale(1) contrast(1.15)',
  sepia: 'sepia(0.7) contrast(1.05)',
  warm: 'saturate(1.2) hue-rotate(-12deg) brightness(1.05)',
  cool: 'saturate(1.1) hue-rotate(14deg) brightness(1.02)',
  vivid: 'saturate(1.6) contrast(1.1)',
  blur: 'blur(14px) brightness(0.95)',
};

export class FilterPipeline {
  private readonly video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly scratch: HTMLCanvasElement;
  private raf = 0;
  private filter = 'none';
  private cameraOn = true;
  private name = '';
  readonly output: MediaStream;

  constructor(private readonly raw: MediaStream) {
    this.video = document.createElement('video');
    this.video.srcObject = raw;
    this.video.muted = true;
    this.video.playsInline = true;
    void this.video.play().catch(() => {});

    this.canvas = document.createElement('canvas');
    this.canvas.width = 1280;
    this.canvas.height = 720;
    this.ctx = this.canvas.getContext('2d')!;
    this.scratch = document.createElement('canvas');

    const captured = this.canvas.captureStream(30);
    this.output = new MediaStream([
      captured.getVideoTracks()[0],
      ...raw.getAudioTracks(),
    ]);

    this.loop();
  }

  setFilter(id: string): void {
    this.filter = id;
  }

  setCameraOn(on: boolean): void {
    this.cameraOn = on;
  }

  setName(name: string): void {
    this.name = name;
  }

  private loop = (): void => {
    const { video, ctx, canvas } = this;
    if (video.videoWidth && video.videoHeight) {
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      if (!this.cameraOn) {
        this.drawPlaceholder();
      } else if (this.filter === 'pixelate') {
        this.drawPixelated();
      } else {
        ctx.filter = CSS_FILTER[this.filter] ?? 'none';
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private drawPixelated(): void {
    const { video, ctx, canvas, scratch } = this;
    const w = 48;
    const h = Math.round((w * canvas.height) / canvas.width);
    scratch.width = w;
    scratch.height = h;
    const sctx = scratch.getContext('2d')!;
    sctx.drawImage(video, 0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scratch, 0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
  }

  private drawPlaceholder(): void {
    const { ctx, canvas } = this;
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, '#1c1c2b');
    g.addColorStop(1, '#0d0d18');
    ctx.filter = 'none';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const letter = (this.name.trim()[0] || '·').toUpperCase();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `600 ${Math.round(canvas.height / 4)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, canvas.width / 2, canvas.height / 2);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.output.getVideoTracks().forEach((t) => t.stop());
    this.raw.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
  }
}
