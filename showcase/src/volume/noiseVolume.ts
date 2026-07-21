import * as THREE from "three";

const OCTAVES = 4;

function hash3(x: number, y: number, z: number, seed: number): number {
  let value = (x * 0x1f123bb5) ^ (y * 0x5f356495) ^ (z * 0x2c1b3c6d) ^ seed;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function lerp(a: number, b: number, amount: number): number {
  return a + (b - a) * amount;
}

function periodicValueNoise(x: number, y: number, z: number, frequency: number, seed: number): number {
  const sample = (coordinate: number) => coordinate * frequency;
  const sx = sample(x);
  const sy = sample(y);
  const sz = sample(z);
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const z0 = Math.floor(sz);
  const tx = smoothstep(sx - x0);
  const ty = smoothstep(sy - y0);
  const tz = smoothstep(sz - z0);
  const valueAt = (ix: number, iy: number, iz: number) => hash3((ix + frequency) % frequency, (iy + frequency) % frequency, (iz + frequency) % frequency, seed);
  const x00 = lerp(valueAt(x0, y0, z0), valueAt(x0 + 1, y0, z0), tx);
  const x10 = lerp(valueAt(x0, y0 + 1, z0), valueAt(x0 + 1, y0 + 1, z0), tx);
  const x01 = lerp(valueAt(x0, y0, z0 + 1), valueAt(x0 + 1, y0, z0 + 1), tx);
  const x11 = lerp(valueAt(x0, y0 + 1, z0 + 1), valueAt(x0 + 1, y0 + 1, z0 + 1), tx);
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
}

/** Creates a seeded, tileable scalar density field for a WebGL2 3D texture. */
export function createNoiseVolume(size: number, seed: number): THREE.Data3DTexture {
  if (!Number.isInteger(size) || size < 2) throw new Error("Noise volume size must be an integer of at least two");

  const data = new Uint8Array(size ** 3);
  for (let z = 0; z < size; z += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const nx = x / (size - 1);
        const ny = y / (size - 1);
        const nz = z / (size - 1);
        let total = 0;
        let amplitude = 1;
        let amplitudeTotal = 0;
        for (let octave = 0; octave < OCTAVES; octave += 1) {
          total += periodicValueNoise(nx, ny, nz, 1 << octave, seed + octave * 0x9e3779b9) * amplitude;
          amplitudeTotal += amplitude;
          amplitude *= 0.5;
        }
        const density = Math.min(1, Math.max(0, (total / amplitudeTotal - 0.5) * 3.4 + 0.5));
        data[z * size * size + y * size + x] = Math.round(density * 255);
      }
    }
  }

  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.wrapR = THREE.RepeatWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}
