import * as THREE from "three";

type RenderChannels = { energy?: number; energyColor?: THREE.ColorRepresentation; roughness?: number };
type AuxUniforms = {
  uAuxEnergy: { value: number };
  uAuxEnergyColor: { value: THREE.Color };
  uAuxRoughness: { value: number };
  uAuxReflective: { value: number };
};
type CompanionEntry = {
  sources: THREE.Material[];
  callbacks: THREE.Material["onBeforeCompile"][];
  cacheKeys: THREE.Material["customProgramCacheKey"][];
  companions: THREE.Material[];
  uniforms: AuxUniforms[];
};
type MeshState = { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[]; onBeforeRender: THREE.Object3D["onBeforeRender"] };
type VisibilityState = { object: THREE.Object3D; visible: boolean };
type RendererState = {
  target: THREE.WebGLRenderTarget | null;
  activeCubeFace?: number;
  activeMipmapLevel?: number;
  autoClear: boolean;
  clearColor?: THREE.Color;
  clearAlpha?: number;
  viewport?: THREE.Vector4;
  scissor?: THREE.Vector4;
  scissorTest?: boolean;
  overrideMaterial: THREE.Material | null;
  background: THREE.Scene["background"];
  fog: THREE.Scene["fog"];
};

function unit(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : fallback;
}

function channelsFor(object: THREE.Object3D, source: THREE.Material | THREE.Material[]): Required<RenderChannels> {
  const raw = object.userData.renderChannels;
  const channels: RenderChannels = Array.isArray(raw) ? {
    energy: raw.includes("low-energy") ? 0.2 : raw.includes("energy") ? unit(object.userData.energy, 1) : 0,
    roughness: raw.includes("low-roughness") ? 0.12 : raw.includes("roughness") ? unit(object.userData.roughness, 0.12) : 0.5,
  } : raw !== null && typeof raw === "object" ? raw as RenderChannels : {};
  const material = Array.isArray(source) ? source[0] : source;
  const materialRoughness = material !== undefined && "roughness" in material ? (material as THREE.MeshPhysicalMaterial).roughness : 0.5;
  return {
    energy: unit(channels.energy ?? object.userData.energy, 0),
    energyColor: channels.energyColor ?? object.userData.energyColor ?? 0xffffff,
    roughness: unit(channels.roughness ?? object.userData.roughness, materialRoughness),
  };
}

function augmentFragment(source: string): string {
  const declaration = /* glsl */ `
layout(location = 1) out highp vec4 cosmicAuxEnergy;
uniform float uAuxEnergy;
uniform vec3 uAuxEnergyColor;
uniform float uAuxRoughness;
uniform float uAuxReflective;
`;
  const lastBrace = source.lastIndexOf("}");
  if (lastBrace < 0) return `${declaration}\n${source}`;
  const write = /* glsl */ `
  gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, uAuxRoughness );
  cosmicAuxEnergy = vec4( min( uAuxEnergyColor * uAuxEnergy, vec3( 16.0 ) ), uAuxReflective );
`;
  return `${declaration}\n${source.slice(0, lastBrace)}${write}${source.slice(lastBrace)}`;
}

function createCompanion(source: THREE.Material): { material: THREE.Material; uniforms: AuxUniforms } {
  const callback = source.onBeforeCompile;
  const cacheKey = source.customProgramCacheKey;
  // `copy()` JSON-clones userData, which cannot serialize live Texture uniforms.
  // The hook closes over the source uniforms, so exclude userData from cloning.
  const sourceUserData = source.userData;
  let material: THREE.Material;
  try {
    source.userData = {};
    material = source.clone();
  } finally {
    source.userData = sourceUserData;
  }
  const uniforms: AuxUniforms = {
    uAuxEnergy: { value: 0 },
    uAuxEnergyColor: { value: new THREE.Color() },
    uAuxRoughness: { value: 0.5 },
    uAuxReflective: { value: 0 },
  };
  // Material.clone intentionally does not copy shader hooks. Chain the current
  // beauty hook explicitly so displacement and its live uniform objects survive.
  material.onBeforeCompile = function (_shader, renderer): void {
    const shader = _shader as THREE.WebGLProgramParametersWithUniforms;
    callback.call(source, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = augmentFragment(shader.fragmentShader);
  };
  material.customProgramCacheKey = function (): string {
    return `${cacheKey.call(source)}|cosmic-aux-mrt`;
  };
  material.name = `${source.name || source.type} Auxiliary MRT`;
  return { material, uniforms };
}

/** WebGL2 MRT capture that preserves every mesh's beauty-material deformation. */
export class AuxiliaryBufferPass {
  readonly target: THREE.WebGLRenderTarget;
  readonly normalTexture: THREE.Texture;
  readonly energyTexture: THREE.Texture;
  private disposed = false;
  private readonly companions = new Map<THREE.Mesh, CompanionEntry>();
  private reflectiveMeshes = new Set<THREE.Mesh>();

  constructor(private readonly scene: THREE.Scene, private readonly camera: THREE.Camera) {
    const depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    let target: THREE.WebGLRenderTarget | undefined;
    try {
      target = new THREE.WebGLRenderTarget(1, 1, {
        count: 2, type: THREE.HalfFloatType, format: THREE.RGBAFormat,
        depthBuffer: true, depthTexture,
      });
      this.target = target;
      this.normalTexture = target.textures[0]!;
      this.energyTexture = target.textures[1]!;
    } catch (error) {
      target?.dispose();
      depthTexture.dispose();
      throw error;
    }
  }

  setReflectiveObjects(meshes: Iterable<THREE.Mesh>): void {
    this.reflectiveMeshes = new Set(meshes);
  }

  setSize(width: number, height: number): void {
    if (!this.disposed) this.target.setSize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
  }

  render(renderer: THREE.WebGLRenderer): void {
    if (this.disposed) return;
    const state = this.captureRendererState(renderer);
    const meshes: MeshState[] = [];
    const hidden: VisibilityState[] = [];
    const active = new Set<THREE.Mesh>();
    try {
      this.replaceSceneContent(meshes, hidden, active);
      this.scene.background = null;
      this.scene.overrideMaterial = null;
      renderer.autoClear = true;
      if (typeof renderer.setClearColor === "function") renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(this.target);
      renderer.clear();
      renderer.render(this.scene, this.camera);
    } finally {
      this.restoreSceneContent(meshes, hidden);
      this.pruneCompanions(active);
      this.restoreRendererState(renderer, state);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of this.companions.values()) for (const material of entry.companions) material.dispose();
    this.companions.clear();
    this.target.dispose();
  }

  private getCompanions(mesh: THREE.Mesh, source: THREE.Material | THREE.Material[]): CompanionEntry {
    const sources = Array.isArray(source) ? source : [source];
    const existing = this.companions.get(mesh);
    const valid = existing !== undefined && sources.length === existing.sources.length && sources.every((item, index) =>
      item === existing.sources[index]
      && item.onBeforeCompile === existing.callbacks[index]
      && item.customProgramCacheKey === existing.cacheKeys[index]);
    if (valid) return existing;
    if (existing !== undefined) for (const material of existing.companions) material.dispose();
    const created = sources.map(createCompanion);
    const entry: CompanionEntry = {
      sources: [...sources],
      callbacks: sources.map((item) => item.onBeforeCompile),
      cacheKeys: sources.map((item) => item.customProgramCacheKey),
      companions: created.map((item) => item.material),
      uniforms: created.map((item) => item.uniforms),
    };
    this.companions.set(mesh, entry);
    return entry;
  }

  private captureRendererState(renderer: THREE.WebGLRenderer): RendererState {
    const optional = renderer as THREE.WebGLRenderer & {
      getActiveCubeFace?: () => number; getActiveMipmapLevel?: () => number;
      getViewport?: (target: THREE.Vector4) => THREE.Vector4; getScissor?: (target: THREE.Vector4) => THREE.Vector4;
      getScissorTest?: () => boolean;
    };
    return {
      target: renderer.getRenderTarget(),
      activeCubeFace: optional.getActiveCubeFace?.(), activeMipmapLevel: optional.getActiveMipmapLevel?.(),
      autoClear: renderer.autoClear,
      clearColor: typeof renderer.getClearColor === "function" ? renderer.getClearColor(new THREE.Color()) : undefined,
      clearAlpha: typeof renderer.getClearAlpha === "function" ? renderer.getClearAlpha() : undefined,
      viewport: optional.getViewport?.(new THREE.Vector4()), scissor: optional.getScissor?.(new THREE.Vector4()),
      scissorTest: optional.getScissorTest?.(),
      overrideMaterial: this.scene.overrideMaterial, background: this.scene.background, fog: this.scene.fog,
    };
  }

  private restoreRendererState(renderer: THREE.WebGLRenderer, state: RendererState): void {
    this.scene.overrideMaterial = state.overrideMaterial; this.scene.background = state.background; this.scene.fog = state.fog;
    if (state.clearColor !== undefined && typeof renderer.setClearColor === "function") renderer.setClearColor(state.clearColor, state.clearAlpha);
    if (state.activeCubeFace === undefined && state.activeMipmapLevel === undefined) renderer.setRenderTarget(state.target);
    else renderer.setRenderTarget(state.target, state.activeCubeFace, state.activeMipmapLevel);
    if (state.viewport !== undefined) renderer.setViewport(state.viewport);
    if (state.scissor !== undefined) renderer.setScissor(state.scissor);
    if (state.scissorTest !== undefined) renderer.setScissorTest(state.scissorTest);
    renderer.autoClear = state.autoClear;
  }

  private replaceSceneContent(meshes: MeshState[], hidden: VisibilityState[], active: Set<THREE.Mesh>): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        active.add(object);
        const source = object.material;
        const originalCallback = object.onBeforeRender;
        const entry = this.getCompanions(object, source);
        meshes.push({ mesh: object, material: source, onBeforeRender: originalCallback });
        object.material = Array.isArray(source) ? entry.companions : entry.companions[0]!;
        object.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
          const channel = channelsFor(object, source);
          for (const uniforms of entry.uniforms) {
            uniforms.uAuxEnergy.value = channel.energy;
            uniforms.uAuxEnergyColor.value.set(channel.energyColor);
            uniforms.uAuxRoughness.value = channel.roughness;
            uniforms.uAuxReflective.value = this.reflectiveMeshes.has(object) ? 1 : 0;
          }
          originalCallback.call(object, renderer, scene, camera, geometry, material, group);
        };
      } else if (object instanceof THREE.Points || object instanceof THREE.Line || object instanceof THREE.Sprite) {
        hidden.push({ object, visible: object.visible }); object.visible = false;
      }
    });
  }

  private restoreSceneContent(meshes: MeshState[], hidden: VisibilityState[]): void {
    for (const state of meshes) { state.mesh.material = state.material; state.mesh.onBeforeRender = state.onBeforeRender; }
    for (const state of hidden) state.object.visible = state.visible;
  }

  private pruneCompanions(active: Set<THREE.Mesh>): void {
    for (const [mesh, entry] of this.companions) {
      if (active.has(mesh)) continue;
      for (const material of entry.companions) material.dispose();
      this.companions.delete(mesh);
    }
  }
}
