import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const maskVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const maskFragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D tColor;
  uniform sampler2D tEnergy;
  void main() {
    vec3 contribution = texture2D(tColor, vUv).rgb * texture2D(tEnergy, vUv).rgb;
    gl_FragColor = vec4(min(contribution, vec3(16.0)), 1.0);
  }
`;

/** Five-mip UnrealBloomPass driven only by the auxiliary energy buffer. */
export class MaskedBloomPass extends UnrealBloomPass {
  readonly maskMaterial: THREE.ShaderMaterial;
  readonly maskQuad: FullScreenQuad;
  readonly maskTarget: THREE.WebGLRenderTarget;
  private energyTexture: THREE.Texture | null = null;
  private disposed = false;

  constructor(width = 1, height = 1) {
    super(new THREE.Vector2(width, height), 0.9, 0.62, 0.7);
    this.nMips = 5;
    this.maskTarget = new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
    });
    this.maskMaterial = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, tEnergy: { value: null } },
      vertexShader: maskVertexShader,
      fragmentShader: maskFragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.maskQuad = new FullScreenQuad(this.maskMaterial);
  }

  setEnergyTexture(texture: THREE.Texture | null): void {
    this.energyTexture = texture;
  }

  override setSize(width: number, height: number): void {
    super.setSize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
    this.maskTarget?.setSize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    deltaTime: number,
    maskActive: boolean,
  ): void {
    if (this.disposed || this.energyTexture === null) return;
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    const previousClearColor = typeof renderer.getClearColor === "function" ? renderer.getClearColor(new THREE.Color()) : undefined;
    const previousClearAlpha = typeof renderer.getClearAlpha === "function" ? renderer.getClearAlpha() : undefined;
    const previousBlend = this.blendMaterial.blending;
    const previousBlendTexture = this.blendMaterial.uniforms.tDiffuse!.value;
    const previousRenderToScreen = this.renderToScreen;
    const internalQuad = (this as unknown as { _fsQuad: FullScreenQuad })._fsQuad;
    const previousInternalMaterial = internalQuad.material;
    try {
      this.maskMaterial.uniforms.tColor!.value = readBuffer.texture;
      this.maskMaterial.uniforms.tEnergy!.value = this.energyTexture;
      renderer.setRenderTarget(this.maskTarget);
      renderer.autoClear = true;
      renderer.clear();
      this.maskQuad.render(renderer);
      // Have UnrealBloomPass produce bloom-only output in its temporary target,
      // then add that result to the composer buffer below.
      this.blendMaterial.blending = THREE.NoBlending;
      this.renderToScreen = false;
      super.render(renderer, writeBuffer, this.maskTarget, deltaTime, maskActive);
      this.blendMaterial.blending = THREE.AdditiveBlending;
      this.blendMaterial.uniforms.tDiffuse!.value = this.maskTarget.texture;
      renderer.setRenderTarget(readBuffer);
      this.maskQuad.material = this.blendMaterial;
      this.maskQuad.render(renderer);
      this.maskQuad.material = this.maskMaterial;
    } finally {
      this.blendMaterial.blending = previousBlend;
      this.blendMaterial.uniforms.tDiffuse!.value = previousBlendTexture;
      this.renderToScreen = previousRenderToScreen;
      this.maskQuad.material = this.maskMaterial;
      internalQuad.material = previousInternalMaterial;
      if (maskActive) renderer.state.buffers.stencil.setTest(true);
      if (previousClearColor !== undefined && typeof renderer.setClearColor === "function") renderer.setClearColor(previousClearColor, previousClearAlpha);
      renderer.setRenderTarget(previousTarget);
      renderer.autoClear = previousAutoClear;
    }
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    super.dispose();
    // UnrealBloomPass r185 omits this owned material from dispose().
    this.materialHighPassFilter.dispose();
    this.maskTarget.dispose();
    this.maskMaterial.dispose();
    this.maskQuad.dispose();
  }
}
