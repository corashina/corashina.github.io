export class FixedStepClock {
  private accumulator = 0;
  private lastNowMs: number | null = null;
  private paused = false;

  constructor(
    private readonly fixedDeltaSeconds = 1 / 60,
    private readonly maxSteps = 4,
    private readonly maxDeltaSeconds = 0.1,
  ) {}

  advance(nowMs: number, step: () => void): number {
    if (this.paused) {
      return 0;
    }

    if (this.lastNowMs === null) {
      this.lastNowMs = nowMs;
      return 0;
    }

    const elapsedSeconds = Math.max(0, (nowMs - this.lastNowMs) / 1_000);
    this.lastNowMs = nowMs;
    this.accumulator += Math.min(elapsedSeconds, this.maxDeltaSeconds);

    let steps = 0;
    while (this.accumulator >= this.fixedDeltaSeconds && steps < this.maxSteps) {
      step();
      this.accumulator -= this.fixedDeltaSeconds;
      steps += 1;
    }

    if (steps === this.maxSteps && this.accumulator >= this.fixedDeltaSeconds) {
      this.accumulator = 0;
    }

    return this.accumulator / this.fixedDeltaSeconds;
  }

  pause(): void {
    this.paused = true;
    this.accumulator = 0;
  }

  resume(nowMs: number): void {
    this.paused = false;
    this.accumulator = 0;
    this.lastNowMs = nowMs;
  }

  reset(nowMs?: number): void {
    this.accumulator = 0;
    this.lastNowMs = nowMs ?? null;
    this.paused = false;
  }
}
