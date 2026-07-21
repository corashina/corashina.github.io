import * as THREE from "three";

type RenderChannels = {
  energy?: number;
  energyColor?: THREE.ColorRepresentation;
  roughness?: number;
};

type SavedMeshState = {
  mesh: THREE.Mesh;
  material: THREE.Material | THREE.Material[];
  onBeforeRender: THREE.Object3D["onBeforeRender"];
};

const vertexShader = /* glsl */ `
  in vec3 position;
  in vec3 normal;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform mat3 normalMatrix;
  out vec3 vViewNormal;
  void main() {
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  in vec3 vViewNormal;
  uniform float uEnergy;
  uniform vec3 uEnergyColor;
  uniform float uRoughness;
  layout(location = 0) out vec4 outNormal;
  layout(location = 1) out vec4 outEnergy;
  void main() {
    outNormal = vec4(normalize(vViewNormal) * 0.5 + 0.5, uRoughness);
    outEnergy = vec4(uEnergyColor * uEnergy, uEnergy);
  }
`;

function clampUnit(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : fallback;
}

function readChannels(object: THREE.Object3D, sourceMaterial: THREE.Material | THREE.Material[]): Required<RenderChannels> {
  const raw = object.userData.renderChannels;
  const channels: RenderChannels = Array.isArray(raw) ? {
    energy: raw.includes("low-energy") ? 0.2 : raw.includes("energy") ? clampUnit(object.userData.energy, 1) : 0,
    roughness: raw.includes("low-roughness") ? 0.75 : raw.includes("roughness") ? clampUnit(object.userData.roughness, 0.5) : 0.5,
  } : typeof raw === "object" && raw !== null ? raw as RenderChannels : {};
  const physical = Array.isArray(sourceMaterial) ? sourceMaterial[0] : sourceMaterial;
  const roughness = physical !== undefined && "roughness" in physical ? (physical as THREE.MeshPhysicalMaterial).roughness : 0.5;
  return {
    energy: clampUnit(channels.energy ?? object.userData.energy, 0),
    energyColor: channels.energyColor ?? object.userData.energyColor ?? new THREE.Color(1, 1, 1),
    roughness: clampUnit(channels.roughness ?? object.userData.roughness, roughness),
  };
}

/** Renders normal/roughness and energy tags into a WebGL2 multiple-render-target. */
export class AuxiliaryBufferPass {
  readonly target: THREE.WebGLRenderTarget;
  readonly material: THREE.ShaderMaterial;
  readonly normalTexture: THREE.Texture;
  readonly energyTexture: THREE.Texture;
  private disposed = false;

  constructor(private readonly scene: THREE.Scene, private readonly camera: THREE.Camera) {
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      count: 2,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    });
    this.target.textures.forEach((texture) => {
      texture.type = THREE.HalfFloatType;
      texture.format = THREE.RGBAFormat;
    });
    this.normalTexture = this.target.textures[0]!;
    this.energyTexture = this.target.textures[1]!;
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthTest: true,
      depthWrite: true,
      uniforms: {
        uEnergy: { value: 0 },
        uEnergyColor: { value: new THREE.Color(1, 1, 1) },
        uRoughness: { value: 0.5 },
      },
      vertexShader,
      fragmentShader,
    });
  }

  setSize(width: number, height: number): void {
    if (this.disposed) return;
    this.target.setSize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
  }

  render(renderer: THREE.WebGLRenderer): void {
    if (this.disposed) return;
    const saved = this.replaceMaterials();
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    try {
      renderer.autoClear = true;
      renderer.setRenderTarget(this.target);
      renderer.clear();
      renderer.render(this.scene, this.camera);
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.autoClear = previousAutoClear;
      this.restoreMaterials(saved);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.material.dispose();
    this.target.dispose();
  }

  private replaceMaterials(): SavedMeshState[] {
    const saved: SavedMeshState[] = [];
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const mesh = object as THREE.Mesh;
      const material = mesh.material;
      const onBeforeRender = mesh.onBeforeRender;
      saved.push({ mesh, material, onBeforeRender });
      mesh.material = this.material;
      mesh.onBeforeRender = (_renderer, _scene, _camera, _geometry, sourceMaterial, group) => {
        const channels = readChannels(mesh, material);
        this.material.uniforms.uEnergy!.value = channels.energy;
        (this.material.uniforms.uEnergyColor!.value as THREE.Color).set(channels.energyColor);
        this.material.uniforms.uRoughness!.value = channels.roughness;
        onBeforeRender.call(mesh, _renderer, _scene, _camera, _geometry, sourceMaterial, group);
      };
    });
    return saved;
  }

  private restoreMaterials(saved: SavedMeshState[]): void {
    for (const state of saved) {
      state.mesh.material = state.material;
      state.mesh.onBeforeRender = state.onBeforeRender;
    }
  }
}
