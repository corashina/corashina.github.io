export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export type InteractionSnapshot = {
  pointerNdc: Vec2;
  pointerWorld: Vec3;
  pointerVelocity: Vec2;
  gravity: number;
  orbitDelta: Vec2;
  zoomDelta: number;
  pulseId: number;
  pulseCharge: number;
  pulseEnergy: number;
  pulseAge: number;
  pulseRadius: number;
  release: boolean;
  resetRequested: boolean;
  reducedMotion: boolean;
};

export type FrameContext = {
  deltaSeconds: number;
  elapsedSeconds: number;
  interaction: InteractionSnapshot;
};

export interface SceneSystem {
  update(frame: FrameContext): void;
  dispose(): void;
}

export interface QualityAwareSystem<TProfile> extends SceneSystem {
  setQuality(profile: TProfile): void;
}
