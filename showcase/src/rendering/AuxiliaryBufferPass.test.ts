import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { AuxiliaryBufferPass } from "./AuxiliaryBufferPass";

describe("AuxiliaryBufferPass", () => {
  it("owns a half-float two-attachment target with depth, clamped sizing, and idempotent disposal", () => {
    const pass = new AuxiliaryBufferPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    const targetDispose = vi.spyOn(pass.target, "dispose");

    expect(pass.target.texture.type).toBe(THREE.HalfFloatType);
    expect(pass.target.textures).toHaveLength(2);
    expect(pass.target.depthTexture).toBeInstanceOf(THREE.DepthTexture);
    expect(pass.normalTexture).toBe(pass.target.textures[0]);
    expect(pass.energyTexture).toBe(pass.target.textures[1]);

    pass.setSize(0.5, -3);
    expect(pass.target.width).toBe(1);
    expect(pass.target.height).toBe(1);

    pass.dispose();
    pass.dispose();
    expect(targetDispose).toHaveBeenCalledTimes(1);
  });

  it("restores original materials, callbacks, and renderer state when auxiliary rendering throws", () => {
    const scene = new THREE.Scene();
    const background = new THREE.Color(0x334455);
    scene.background = background;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshPhysicalMaterial());
    const originalCallback = vi.fn();
    mesh.onBeforeRender = originalCallback;
    scene.add(mesh);
    const pass = new AuxiliaryBufferPass(scene, new THREE.PerspectiveCamera());
    const previousTarget = new THREE.WebGLRenderTarget(1, 1);
    const renderer = {
      autoClear: false,
      getClearColor: (value: THREE.Color) => value.set(0x123456),
      getClearAlpha: () => 0.6,
      setClearColor: vi.fn(),
      getRenderTarget: () => previousTarget,
      setRenderTarget: vi.fn(),
      clear: vi.fn(),
      render: () => { expect(scene.background).toBeNull(); throw new Error("draw failure"); },
    } as unknown as THREE.WebGLRenderer;

    expect(() => pass.render(renderer)).toThrow("draw failure");
    expect(mesh.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(mesh.onBeforeRender).toBe(originalCallback);
    expect(renderer.autoClear).toBe(false);
    expect(scene.background).toBe(background);
    expect(renderer.setClearColor).toHaveBeenCalledWith(0x000000, 0);
    expect(renderer.setClearColor).toHaveBeenLastCalledWith(expect.objectContaining({ isColor: true }), 0.6);
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(previousTarget);
    pass.dispose();
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    previousTarget.dispose();
  });

  it("chains the live beauty hook into a cached MRT companion without declaring location zero", () => {
    const scene = new THREE.Scene();
    const source = new THREE.MeshPhysicalMaterial();
    const liveUniform = { value: 3 };
    source.customProgramCacheKey = function () { expect(this).toBe(source); return "deformed"; };
    source.onBeforeCompile = function (shader) {
      expect(this).toBe(source);
      shader.uniforms.uLive = liveUniform;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "vec3 transformed = position + normal * uLive;");
    };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), source);
    mesh.userData.renderChannels = ["energy", "roughness"];
    scene.add(mesh);
    const pass = new AuxiliaryBufferPass(scene, new THREE.PerspectiveCamera());
    let companion: THREE.Material | undefined;
    const renderer = {
      autoClear: true, getRenderTarget: () => null, setRenderTarget: vi.fn(), clear: vi.fn(),
      render: () => { companion = mesh.material as THREE.Material; },
    } as unknown as THREE.WebGLRenderer;

    pass.render(renderer);
    const shader = THREE.ShaderLib.physical;
    const compiled = {
      uniforms: THREE.UniformsUtils.clone(shader.uniforms),
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
    } as THREE.WebGLProgramParametersWithUniforms;
    companion!.onBeforeCompile(compiled, renderer);

    expect(compiled.uniforms.uLive).toBe(liveUniform);
    expect(compiled.vertexShader).toContain("position + normal * uLive");
    expect(compiled.fragmentShader.match(/layout\s*\(\s*location\s*=\s*1\s*\)/g)).toHaveLength(1);
    expect(compiled.fragmentShader).not.toMatch(/layout\s*\(\s*location\s*=\s*0\s*\)/);
    expect(compiled.fragmentShader).toContain("gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, uAuxRoughness )");
    expect(companion!.customProgramCacheKey()).toContain("deformed|cosmic-aux-mrt");
    expect(mesh.material).toBe(source);
    pass.dispose();
    mesh.geometry.dispose();
    source.dispose();
  });

  it("prunes and disposes companions after a source replacement", () => {
    const scene = new THREE.Scene();
    const first = new THREE.MeshPhysicalMaterial();
    const second = new THREE.MeshPhysicalMaterial();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), first);
    scene.add(mesh);
    let captured: THREE.Material | undefined;
    const renderer = {
      autoClear: true, getRenderTarget: () => null, setRenderTarget: vi.fn(), clear: vi.fn(),
      render: () => { captured = mesh.material as THREE.Material; },
    } as unknown as THREE.WebGLRenderer;
    const pass = new AuxiliaryBufferPass(scene, new THREE.PerspectiveCamera());
    pass.render(renderer);
    const oldCompanion = captured!;
    const dispose = vi.spyOn(oldCompanion, "dispose");
    mesh.material = second;
    pass.render(renderer);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(captured).not.toBe(oldCompanion);
    pass.dispose();
    mesh.geometry.dispose(); first.dispose(); second.dispose();
  });

  it("uses opaque depth-writing companions and complementary dither coverage during transitions", () => {
    const scene = new THREE.Scene();
    const outgoingSource = new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.5, depthWrite: false });
    const incomingSource = outgoingSource.clone();
    const outgoing = new THREE.Mesh(new THREE.PlaneGeometry(), outgoingSource);
    const incoming = new THREE.Mesh(new THREE.PlaneGeometry(), incomingSource);
    outgoing.userData.auxTransition = { role: "outgoing", progress: 0.5 };
    incoming.userData.auxTransition = { role: "incoming", progress: 0.5 };
    scene.add(outgoing, incoming);
    const captured: THREE.Material[] = [];
    const renderer = {
      autoClear: true, getRenderTarget: () => null, setRenderTarget: vi.fn(), clear: vi.fn(),
      render: () => {
        for (const mesh of [outgoing, incoming]) {
          captured.push(mesh.material as THREE.Material);
          mesh.onBeforeRender(renderer as unknown as THREE.WebGLRenderer, scene, new THREE.PerspectiveCamera(), mesh.geometry, mesh.material as THREE.Material, new THREE.Group());
        }
      },
    } as unknown as THREE.WebGLRenderer;
    const pass = new AuxiliaryBufferPass(scene, new THREE.PerspectiveCamera());
    pass.render(renderer);

    for (const material of captured) {
      expect(material.transparent).toBe(false);
      expect(material.depthWrite).toBe(true);
      expect(material.blending).toBe(THREE.NoBlending);
    }
    const outgoingShader = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader } as THREE.WebGLProgramParametersWithUniforms;
    const incomingShader = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader } as THREE.WebGLProgramParametersWithUniforms;
    captured[0]!.onBeforeCompile(outgoingShader, renderer); captured[1]!.onBeforeCompile(incomingShader, renderer);
    expect(outgoingShader.uniforms.uAuxTransitionRole!.value).toBe(-1);
    expect(incomingShader.uniforms.uAuxTransitionRole!.value).toBe(1);
    expect(outgoingShader.uniforms.uAuxTransitionProgress!.value).toBe(0.5);
    expect(incomingShader.uniforms.uAuxTransitionProgress!.value).toBe(0.5);
    expect(outgoingShader.fragmentShader).toContain("auxNoise >= 1.0 - uAuxTransitionProgress");
    expect(outgoingShader.fragmentShader).toContain("auxNoise < 1.0 - uAuxTransitionProgress");
    expect(outgoingShader.fragmentShader.indexOf("discard")).toBeLessThan(outgoingShader.fragmentShader.indexOf("gl_FragColor = vec4"));
    pass.dispose();
    for (const mesh of [outgoing, incoming]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  });
});
