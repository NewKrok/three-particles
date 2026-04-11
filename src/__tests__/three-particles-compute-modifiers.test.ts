import { StorageBufferAttribute } from 'three/webgpu';
import {
  createModifierStorageBuffers,
  createModifierComputeUpdate,
  writeParticleToModifierBuffers,
  deactivateParticleInModifierBuffers,
  type ModifierFlags,
} from '../js/effects/three-particles/webgpu/compute-modifiers.js';
import type { BakedCurveMap } from '../js/effects/three-particles/webgpu/curve-bake.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NO_FLAGS: ModifierFlags = {
  sizeOverLifetime: false,
  opacityOverLifetime: false,
  colorOverLifetime: false,
  rotationOverLifetime: false,
  linearVelocity: false,
  orbitalVelocity: false,
  noise: false,
};

const EMPTY_CURVE_MAP: BakedCurveMap = {
  data: new Float32Array(0),
  curveCount: 0,
  sizeOverLifetime: -1,
  opacityOverLifetime: -1,
  colorR: -1,
  colorG: -1,
  colorB: -1,
  linearVelX: -1,
  linearVelY: -1,
  linearVelZ: -1,
  orbitalVelX: -1,
  orbitalVelY: -1,
  orbitalVelZ: -1,
};

// ─── createModifierStorageBuffers ────────────────────────────────────────────

describe('createModifierStorageBuffers', () => {
  it('creates all required buffers', () => {
    const buffers = createModifierStorageBuffers(
      50,
      false,
      new Float32Array(256)
    );

    // Packed storage buffers (8 total, matching WebGPU per-stage limit)
    expect(buffers.position).toBeInstanceOf(StorageBufferAttribute);
    expect(buffers.position.array).toHaveLength(200); // 50 * 4 (vec4 for WebGPU alignment)
    expect(buffers.velocity.array).toHaveLength(200); // 50 * 4 (vec4 for WebGPU alignment)
    expect(buffers.color.array).toHaveLength(200); // 50 * 4 (R,G,B,A)
    // particleState: (lifetime, size, rotation, startFrame)
    expect(buffers.particleState.array).toHaveLength(200); // 50 * 4
    // startValues: (startLifetime, startSize, startOpacity, startColorR)
    expect(buffers.startValues.array).toHaveLength(200); // 50 * 4
    // startColorsExt: (startColorG, startColorB, rotationSpeed, noiseOffset)
    expect(buffers.startColorsExt.array).toHaveLength(200); // 50 * 4
    // orbitalIsActive: (offsetX, offsetY, offsetZ, isActive)
    expect(buffers.orbitalIsActive.array).toHaveLength(200); // 50 * 4
    // Curve data
    expect(buffers.curveData.array).toHaveLength(256);
  });

  it('creates 1-element curveData when empty', () => {
    const buffers = createModifierStorageBuffers(
      10,
      false,
      new Float32Array(0)
    );
    expect(buffers.curveData.array).toHaveLength(1);
  });
});

// ─── createModifierComputeUpdate ─────────────────────────────────────────────

describe('createModifierComputeUpdate', () => {
  it('creates pipeline with no modifiers active', () => {
    const buffers = createModifierStorageBuffers(
      100,
      false,
      new Float32Array(0)
    );
    const pipeline = createModifierComputeUpdate(
      buffers,
      100,
      EMPTY_CURVE_MAP,
      NO_FLAGS
    );

    expect(pipeline.computeNode).toBeDefined();
    expect(pipeline.uniforms).toBeDefined();
    expect(pipeline.uniforms.delta).toBeDefined();
    expect(pipeline.uniforms.noiseStrength).toBeDefined();
    expect(pipeline.buffers).toBe(buffers);
  });

  it('creates pipeline with all modifiers active', () => {
    const curveData = new Float32Array(256 * 8); // 8 curves
    const buffers = createModifierStorageBuffers(50, false, curveData);
    const allFlags: ModifierFlags = {
      sizeOverLifetime: true,
      opacityOverLifetime: true,
      colorOverLifetime: true,
      rotationOverLifetime: true,
      linearVelocity: true,
      orbitalVelocity: true,
      noise: true,
    };
    const curveMap: BakedCurveMap = {
      data: curveData,
      curveCount: 8,
      sizeOverLifetime: 0,
      opacityOverLifetime: 1,
      colorR: 2,
      colorG: 3,
      colorB: 4,
      linearVelX: 5,
      linearVelY: 6,
      linearVelZ: 7,
      orbitalVelX: -1,
      orbitalVelY: -1,
      orbitalVelZ: -1,
    };

    const pipeline = createModifierComputeUpdate(
      buffers,
      50,
      curveMap,
      allFlags
    );
    expect(pipeline.computeNode).toBeDefined();
  });

  it('creates pipeline with instanced buffers', () => {
    const buffers = createModifierStorageBuffers(25, true, new Float32Array(0));
    const pipeline = createModifierComputeUpdate(
      buffers,
      25,
      EMPTY_CURVE_MAP,
      NO_FLAGS
    );
    expect(pipeline.computeNode).toBeDefined();
  });
});

// ─── writeParticleToModifierBuffers ─────────────────────────────────────────

describe('writeParticleToModifierBuffers', () => {
  it('writes all particle data into correct packed buffer positions', () => {
    const buffers = createModifierStorageBuffers(
      10,
      false,
      new Float32Array(0)
    );

    writeParticleToModifierBuffers(buffers, 3, {
      position: { x: 1, y: 2, z: 3 },
      velocity: { x: 4, y: 5, z: 6 },
      startLifetime: 2000,
      colorA: 0.8,
      size: 0.5,
      rotation: 1.2,
      colorR: 0.9,
      colorG: 0.7,
      colorB: 0.3,
      startSize: 0.5,
      startOpacity: 0.8,
      startColorR: 0.9,
      startColorG: 0.7,
      startColorB: 0.3,
      startFrame: 2,
      rotationSpeed: 0.1,
      noiseOffset: 42,
      orbitalOffset: { x: 10, y: 20, z: 30 },
    });

    // Position and velocity are vec4 (w=padding) for WebGPU alignment
    const posArr = buffers.position.array as Float32Array;
    expect(posArr[12]).toBe(1); // index 3 * 4
    expect(posArr[13]).toBe(2);
    expect(posArr[14]).toBe(3);
    expect(posArr[15]).toBe(0); // w padding

    const velArr = buffers.velocity.array as Float32Array;
    expect(velArr[12]).toBe(4); // index 3 * 4
    expect(velArr[13]).toBe(5);
    expect(velArr[14]).toBe(6);
    expect(velArr[15]).toBe(0); // w padding

    // color (vec4: R, G, B, A) at index 3 * 4 = 12
    const colorArr = buffers.color.array as Float32Array;
    expect(colorArr[12]).toBeCloseTo(0.9); // R
    expect(colorArr[13]).toBeCloseTo(0.7); // G
    expect(colorArr[14]).toBeCloseTo(0.3); // B
    expect(colorArr[15]).toBeCloseTo(0.8); // A

    // particleState (vec4: lifetime, size, rotation, startFrame) at index 3 * 4 = 12
    const psArr = buffers.particleState.array as Float32Array;
    expect(psArr[12]).toBe(0); // lifetime starts at 0
    expect(psArr[13]).toBeCloseTo(0.5); // size
    expect(psArr[14]).toBeCloseTo(1.2); // rotation
    expect(psArr[15]).toBe(2); // startFrame

    // startValues (vec4: startLifetime, startSize, startOpacity, startColorR) at index 3 * 4 = 12
    const svArr = buffers.startValues.array as Float32Array;
    expect(svArr[12]).toBe(2000); // startLifetime
    expect(svArr[13]).toBeCloseTo(0.5); // startSize
    expect(svArr[14]).toBeCloseTo(0.8); // startOpacity
    expect(svArr[15]).toBeCloseTo(0.9); // startColorR

    // startColorsExt (vec4: startColorG, startColorB, rotationSpeed, noiseOffset) at index 3 * 4 = 12
    const sceArr = buffers.startColorsExt.array as Float32Array;
    expect(sceArr[12]).toBeCloseTo(0.7); // startColorG
    expect(sceArr[13]).toBeCloseTo(0.3); // startColorB
    expect(sceArr[14]).toBeCloseTo(0.1); // rotationSpeed
    expect(sceArr[15]).toBe(42); // noiseOffset

    // orbitalIsActive (vec4: offsetX, offsetY, offsetZ, isActive) at index 3 * 4 = 12
    const oiaArr = buffers.orbitalIsActive.array as Float32Array;
    expect(oiaArr[12]).toBe(10);
    expect(oiaArr[13]).toBe(20);
    expect(oiaArr[14]).toBe(30);
    expect(oiaArr[15]).toBe(1); // isActive
  });

  it('should match what the TSL material reads for rendering', () => {
    // Verify the GPU rendering attribute layout matches what the material expects:
    // - instanceColor (vec4): color buffer -> R, G, B, A
    // - instanceParticleState (vec4): particleState buffer -> lifetime(.x), size(.y), rotation(.z), startFrame(.w)
    // - instanceStartValues (vec4): startValues buffer -> startLifetime(.x), ...
    const buffers = createModifierStorageBuffers(
      5,
      true, // instanced
      new Float32Array(0)
    );

    writeParticleToModifierBuffers(buffers, 0, {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      startLifetime: 3000,
      colorA: 1.0,
      size: 0.08, // GPU Galaxy typical size
      rotation: 0,
      colorR: 0.5,
      colorG: 0.6,
      colorB: 1.0,
      startSize: 0.08,
      startOpacity: 0.85,
      startColorR: 0.5,
      startColorG: 0.6,
      startColorB: 1.0,
      startFrame: 0,
      rotationSpeed: 0,
      noiseOffset: 0,
      orbitalOffset: { x: 0, y: 0, z: 0 },
    });

    // The material reads attribute('instanceParticleState').y for size
    const psArr = buffers.particleState.array as Float32Array;
    expect(psArr[1]).toBeCloseTo(0.08); // size at .y = index 1

    // The material reads attribute('instanceStartValues').x for startLifetime
    const svArr = buffers.startValues.array as Float32Array;
    expect(svArr[0]).toBe(3000); // startLifetime at .x = index 0

    // The material reads attribute('instanceColor') for RGBA
    const colorArr = buffers.color.array as Float32Array;
    expect(colorArr[0]).toBeCloseTo(0.5); // R
    expect(colorArr[1]).toBeCloseTo(0.6); // G
    expect(colorArr[2]).toBeCloseTo(1.0); // B
    expect(colorArr[3]).toBeCloseTo(1.0); // A (opacity)
  });
});

// ─── deactivateParticleInModifierBuffers ────────────────────────────────────

describe('deactivateParticleInModifierBuffers', () => {
  it('sets isActive to 0 and zeroes color alpha', () => {
    const buffers = createModifierStorageBuffers(5, false, new Float32Array(0));

    // First activate particle 2
    writeParticleToModifierBuffers(buffers, 2, {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      startLifetime: 1000,
      colorA: 1.0,
      size: 0.5,
      rotation: 0,
      colorR: 1,
      colorG: 1,
      colorB: 1,
      startSize: 0.5,
      startOpacity: 1,
      startColorR: 1,
      startColorG: 1,
      startColorB: 1,
      startFrame: 0,
      rotationSpeed: 0,
      noiseOffset: 0,
      orbitalOffset: { x: 0, y: 0, z: 0 },
    });

    const oiaArr = buffers.orbitalIsActive.array as Float32Array;
    expect(oiaArr[2 * 4 + 3]).toBe(1); // isActive = 1

    deactivateParticleInModifierBuffers(buffers, 2);

    expect(oiaArr[2 * 4 + 3]).toBe(0); // isActive = 0
    const colorArr = buffers.color.array as Float32Array;
    expect(colorArr[2 * 4 + 3]).toBe(0); // alpha = 0
  });
});
