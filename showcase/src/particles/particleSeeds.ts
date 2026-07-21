import * as THREE from "three";

export type ParticleSeedTextures = {
  count: number;
  position: THREE.DataTexture;
  velocity: THREE.DataTexture;
  energy: THREE.DataTexture;
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function createTexture(data: Float32Array, size: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createParticleSeedTexture(size: number, seed: number): ParticleSeedTextures {
  const count = size * size;
  const positionData = new Float32Array(count * 4);
  const velocityData = new Float32Array(count * 4);
  const energyData = new Float32Array(count * 4);
  const random = mulberry32(seed);

  for (let particle = 0; particle < count; particle += 1) {
    const offset = particle * 4;
    const angle = random() * Math.PI * 2;
    const radius = 1.2 + Math.sqrt(random()) * 6.6;
    const verticalJitter = (random() - 0.5) * 0.9;
    const alphaSeed = random();
    const tangent = 0.12 + random() * 0.34;

    positionData[offset] = Math.cos(angle) * radius;
    positionData[offset + 1] = verticalJitter;
    positionData[offset + 2] = Math.sin(angle) * radius;
    positionData[offset + 3] = alphaSeed;

    velocityData[offset] = -Math.sin(angle) * tangent;
    velocityData[offset + 1] = (random() - 0.5) * 0.08;
    velocityData[offset + 2] = Math.cos(angle) * tangent;
    velocityData[offset + 3] = alphaSeed;

    energyData[offset] = random();
    energyData[offset + 1] = random();
    energyData[offset + 2] = random();
    energyData[offset + 3] = alphaSeed;
  }

  return {
    count,
    position: createTexture(positionData, size),
    velocity: createTexture(velocityData, size),
    energy: createTexture(energyData, size),
  };
}
