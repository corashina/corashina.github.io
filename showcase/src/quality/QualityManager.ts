import { QUALITY_PROFILES, type QualityMode, type QualityProfile, type QualityTier } from "./qualityProfiles";

export type QualityTransition = {
  from: QualityTier;
  to: QualityTier;
  startedAt: number;
  duration: 0.45;
};

const TIERS: readonly QualityTier[] = ["low", "medium", "high", "ultra"];
const WARM_UP_FRAMES = 180;
const SAMPLE_WINDOW = 120;
const COOLDOWN_FRAMES = 300;
const DOWNGRADE_FRAME_MS = 20;
const UPGRADE_FRAME_MS = 15;
const UPGRADE_STABLE_FRAMES = 600;

export class QualityManager {
  private mode: QualityMode = "auto";
  private tier: QualityTier;
  private warmUpFrames = 0;
  private cooldownFrames = 0;
  private stableFrames = 0;
  private upgradedThisSession = false;
  private readonly samples: number[] = [];
  private transition: QualityTransition | null = null;

  constructor(initialTier: QualityTier) {
    this.tier = initialTier;
  }

  setMode(mode: QualityMode): QualityTier {
    this.mode = mode;
    if (mode !== "auto") {
      this.tier = mode;
      this.samples.length = 0;
      this.stableFrames = 0;
      this.cooldownFrames = 0;
      this.transition = null;
    }
    return this.tier;
  }

  getTier(): QualityTier {
    return this.tier;
  }

  getProfile(): QualityProfile {
    return QUALITY_PROFILES[this.tier];
  }

  getTransition(now: number): QualityTransition | null {
    if (this.transition !== null && now - this.transition.startedAt >= this.transition.duration) {
      this.transition = null;
    }
    return this.transition;
  }

  sample(frameMs: number, now: number): QualityTier | null {
    if (this.mode !== "auto") {
      return null;
    }

    if (this.warmUpFrames < WARM_UP_FRAMES) {
      this.warmUpFrames += 1;
      return null;
    }

    if (this.cooldownFrames > 0) {
      this.cooldownFrames -= 1;
      return null;
    }

    this.samples.push(frameMs);
    if (this.samples.length > SAMPLE_WINDOW) {
      this.samples.shift();
    }

    this.stableFrames = frameMs < UPGRADE_FRAME_MS ? this.stableFrames + 1 : 0;
    if (this.samples.length < SAMPLE_WINDOW) {
      return null;
    }

    const percentile = [...this.samples].sort((left, right) => left - right)[Math.floor((SAMPLE_WINDOW - 1) * 0.75)];
    if (percentile === undefined) {
      return null;
    }

    if (percentile > DOWNGRADE_FRAME_MS) {
      this.stableFrames = 0;
      return this.changeTier(-1, now);
    }

    if (this.stableFrames >= UPGRADE_STABLE_FRAMES && !this.upgradedThisSession) {
      const changed = this.changeTier(1, now);
      if (changed !== null) {
        this.upgradedThisSession = true;
      }
      return changed;
    }

    return null;
  }

  private changeTier(direction: -1 | 1, now: number): QualityTier | null {
    const currentIndex = TIERS.indexOf(this.tier);
    const nextTier = TIERS[currentIndex + direction];
    if (nextTier === undefined) {
      return null;
    }

    const from = this.tier;
    this.tier = nextTier;
    this.cooldownFrames = COOLDOWN_FRAMES;
    this.samples.length = 0;
    this.stableFrames = 0;
    this.transition = { from, to: nextTier, startedAt: now, duration: 0.45 };
    return nextTier;
  }
}
