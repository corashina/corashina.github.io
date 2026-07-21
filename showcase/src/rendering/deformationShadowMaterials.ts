import * as THREE from "three";

export type DeformationShadowMaterials = {
  depth: THREE.MeshDepthMaterial;
  distance: THREE.MeshDistanceMaterial;
};

function chainDeformation(
  target: THREE.MeshDepthMaterial | THREE.MeshDistanceMaterial,
  source: THREE.Material,
  suffix: string,
): void {
  const callback = source.onBeforeCompile;
  const key = source.customProgramCacheKey;
  target.onBeforeCompile = function (_shader, renderer): void {
    callback.call(source, _shader, renderer);
  };
  target.customProgramCacheKey = function (): string {
    return `${key.call(source)}|cosmic-shadow-${suffix}`;
  };
}

/** Shadow companions reuse the beauty hook, including its live uniform objects. */
export function createDeformationShadowMaterials(source: THREE.Material): DeformationShadowMaterials {
  const common = {
    side: source.shadowSide ?? source.side,
    alphaTest: source.alphaTest,
    map: "map" in source ? (source as THREE.MeshBasicMaterial).map : null,
    alphaMap: "alphaMap" in source ? (source as THREE.MeshBasicMaterial).alphaMap : null,
  };
  const depth = new THREE.MeshDepthMaterial({ ...common, depthPacking: THREE.RGBADepthPacking });
  const distance = new THREE.MeshDistanceMaterial(common);
  chainDeformation(depth, source, "depth");
  chainDeformation(distance, source, "distance");
  return { depth, distance };
}
