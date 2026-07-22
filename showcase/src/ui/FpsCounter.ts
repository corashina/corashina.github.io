export type FpsSampler = {
  sample(nowMs: number): void;
  reset(): void;
  dispose(): void;
};

export class FpsCounter implements FpsSampler {
  private samples: number[] = [];
  private lastPublishedAt = Number.NEGATIVE_INFINITY;
  private disposed = false;

  constructor(
    private readonly publish: (fps: number) => void,
    private readonly publishIntervalMs = 250,
    private readonly sampleWindowMs = 1000,
  ) {}

  sample(nowMs: number): void {
    if (this.disposed || !Number.isFinite(nowMs)) return;
    this.samples.push(nowMs);
    const cutoff = nowMs - this.sampleWindowMs;
    while (this.samples.length > 1 && this.samples[0]! < cutoff) this.samples.shift();
    if (this.samples.length < 2 || nowMs - this.lastPublishedAt < this.publishIntervalMs) return;
    const duration = nowMs - this.samples[0]!;
    if (duration <= 0) return;
    this.lastPublishedAt = nowMs;
    this.publish(Math.round(((this.samples.length - 1) * 1000) / duration));
  }

  reset(): void {
    this.samples = [];
    this.lastPublishedAt = Number.NEGATIVE_INFINITY;
  }

  dispose(): void {
    this.disposed = true;
    this.samples = [];
  }
}
