import * as THREE from "three";

type RenderChannels = { energy?: number; energyColor?: THREE.ColorRepresentation; roughness?: number };
type MeshState = { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[]; onBeforeRender: THREE.Object3D["onBeforeRender"] };
type VisibilityState = { object: THREE.Object3D; visible: boolean };
type RendererState = { target: THREE.WebGLRenderTarget | null; autoClear: boolean; clearColor?: THREE.Color; clearAlpha?: number; overrideMaterial: THREE.Material | null; background: THREE.Scene["background"]; fog: THREE.Scene["fog"] };

const vertexShader = /* glsl */ `
in vec3 position;
in vec3 normal;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
out vec3 vViewNormal;
void main() {
  vViewNormal = normalize( normalMatrix * normal );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;

const fragmentShader = /* glsl */ `
precision highp float;
in vec3 vViewNormal;
uniform float uEnergy;
uniform vec3 uEnergyColor;
uniform float uRoughness;
layout(location = 0) out vec4 outNormal;
layout(location = 1) out vec4 outEnergy;
void main() {
  outNormal = vec4( normalize( vViewNormal ) * 0.5 + 0.5, uRoughness );
  outEnergy = vec4( uEnergyColor * uEnergy, uEnergy );
}`;

function unit(value: unknown, fallback: number): number { return typeof value === "number" && Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : fallback; }

function channelsFor(object: THREE.Object3D, source: THREE.Material | THREE.Material[]): Required<RenderChannels> {
  const raw = object.userData.renderChannels;
  const channels: RenderChannels = Array.isArray(raw) ? {
    energy: raw.includes("low-energy") ? 0.2 : raw.includes("energy") ? unit(object.userData.energy, 1) : 0,
    roughness: raw.includes("low-roughness") ? 0.12 : raw.includes("roughness") ? unit(object.userData.roughness, 0.12) : 0.5,
  } : raw !== null && typeof raw === "object" ? raw as RenderChannels : {};
  const material = Array.isArray(source) ? source[0] : source;
  const materialRoughness = material !== undefined && "roughness" in material ? (material as THREE.MeshPhysicalMaterial).roughness : 0.5;
  return { energy: unit(channels.energy ?? object.userData.energy, 0), energyColor: channels.energyColor ?? object.userData.energyColor ?? 0xffffff, roughness: unit(channels.roughness ?? object.userData.roughness, materialRoughness) };
}

/** WebGL2 MRT scene capture with raw GLSL3 ownership and transactional scene mutation. */
export class AuxiliaryBufferPass {
  readonly target: THREE.WebGLRenderTarget;
  readonly material: THREE.RawShaderMaterial;
  readonly normalTexture: THREE.Texture;
  readonly energyTexture: THREE.Texture;
  private disposed = false;

  constructor(private readonly scene: THREE.Scene, private readonly camera: THREE.Camera) {
    this.target = new THREE.WebGLRenderTarget(1, 1, { count: 2, type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true, depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType) });
    this.normalTexture = this.target.textures[0]!;
    this.energyTexture = this.target.textures[1]!;
    this.material = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, depthTest: true, depthWrite: true, uniforms: { uEnergy: { value: 0 }, uEnergyColor: { value: new THREE.Color() }, uRoughness: { value: 0.5 } }, vertexShader, fragmentShader });
  }

  setSize(width: number, height: number): void { if (!this.disposed) this.target.setSize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height))); }

  render(renderer: THREE.WebGLRenderer): void {
    if (this.disposed) return;
    const state = this.captureRendererState(renderer);
    const meshes: MeshState[] = [];
    const hidden: VisibilityState[] = [];
    try {
      this.replaceSceneContent(meshes, hidden);
      renderer.autoClear = true;
      renderer.setRenderTarget(this.target);
      renderer.clear();
      renderer.render(this.scene, this.camera);
    } finally {
      this.restoreSceneContent(meshes, hidden);
      this.restoreRendererState(renderer, state);
    }
  }

  dispose(): void { if (!this.disposed) { this.disposed = true; this.material.dispose(); this.target.dispose(); } }

  private captureRendererState(renderer: THREE.WebGLRenderer): RendererState {
    const clearColor = typeof renderer.getClearColor === "function" ? renderer.getClearColor(new THREE.Color()) : undefined;
    return { target: renderer.getRenderTarget(), autoClear: renderer.autoClear, clearColor, clearAlpha: typeof renderer.getClearAlpha === "function" ? renderer.getClearAlpha() : undefined, overrideMaterial: this.scene.overrideMaterial, background: this.scene.background, fog: this.scene.fog };
  }

  private restoreRendererState(renderer: THREE.WebGLRenderer, state: RendererState): void {
    this.scene.overrideMaterial = state.overrideMaterial;
    this.scene.background = state.background;
    this.scene.fog = state.fog;
    if (state.clearColor !== undefined && typeof renderer.setClearColor === "function") renderer.setClearColor(state.clearColor, state.clearAlpha);
    renderer.setRenderTarget(state.target);
    renderer.autoClear = state.autoClear;
  }

  private replaceSceneContent(meshes: MeshState[], hidden: VisibilityState[]): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const material = object.material;
        const onBeforeRender = object.onBeforeRender;
        meshes.push({ mesh: object, material, onBeforeRender });
        object.material = this.material;
        object.onBeforeRender = (renderer, scene, camera, geometry, sourceMaterial, group) => {
          const channel = channelsFor(object, material);
          this.material.uniforms.uEnergy!.value = channel.energy;
          (this.material.uniforms.uEnergyColor!.value as THREE.Color).set(channel.energyColor);
          this.material.uniforms.uRoughness!.value = channel.roughness;
          onBeforeRender.call(object, renderer, scene, camera, geometry, sourceMaterial, group);
        };
      } else if (object instanceof THREE.Points || object instanceof THREE.Line || object instanceof THREE.Sprite) {
        hidden.push({ object, visible: object.visible });
        object.visible = false;
      }
    });
  }

  private restoreSceneContent(meshes: MeshState[], hidden: VisibilityState[]): void {
    for (const state of meshes) { state.mesh.material = state.material; state.mesh.onBeforeRender = state.onBeforeRender; }
    for (const state of hidden) state.object.visible = state.visible;
  }
}
