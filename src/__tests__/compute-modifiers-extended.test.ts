/**
 * Extended tests for compute-modifiers.ts — pipeline creation with all modifier
 * combinations and force fields enabled.
 *
 * Covers previously uncovered lines:
 *   - createCurveLookup (lines 471-482)
 *   - createModifierComputeUpdate full kernel (lines 558-896)
 *
 * Since TSL compute kernels cannot be executed in Jest, these tests validate:
 *   - Pipeline creation succeeds with every modifier flag combination
 *   - Force field integration via the forceFields flag
 *   - Uniforms are properly exposed for noise, gravity, world-space, etc.
 *   - curveDataLength is correctly computed
 */

import { StorageBufferAttribute } from 'three/webgpu';
import {
  createModifierStorageBuffers,
  createModifierComputeUpdate,
  registerCurveDataLength,
  INIT_STRIDE,
  type ModifierFlags,
} from '../js/effects/three-particles/webgpu/compute-modifiers.js';
import { CURVE_RESOLUTION } from '../js/effects/three-particles/webgpu/curve-bake.js';
import type { BakedCurveMap } from '../js/effects/three-particles/webgpu/curve-bake.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCurveMap(overrides: Partial<BakedCurveMap> = {}): BakedCurveMap {
  const curveCount = overrides.curveCount ?? 0;
  return {
    data: overrides.data ?? new Float32Array(curveCount * CURVE_RESOLUTION),
    curveCount,
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
    ...overrides,
  };
}

const NO_FLAGS: ModifierFlags = {
  sizeOverLifetime: false,
  opacityOverLifetime: false,
  colorOverLifetime: false,
  rotationOverLifetime: false,
  linearVelocity: false,
  orbitalVelocity: false,
  noise: false,
  forceFields: false,
};

// ─── Pipeline with individual modifier flags ────────────────────────────────

describe('createModifierComputeUpdate — modifier flag coverage', () => {
  const maxParticles = 20;

  it('creates pipeline with sizeOverLifetime active', () => {
    const curveData = new Float32Array(CURVE_RESOLUTION);
    const buffers = createModifierStorageBuffers(
      maxParticles,
      false,
      curveData
    );
    const curveMap = makeCurveMap({
      curveCount: 1,
      data: curveData,
      sizeOverLifetime: 0,
    });
    const flags: ModifierFlags = { ...NO_FLAGS, sizeOverLifetime: true };

    const pipeline = createModifierComputeUpdate(
      buffers,
      maxParticles,
      curveMap,
      flags
    );
    expect(pipeline.computeNode).toBeDefined();
    expect(pipeline.curveDataLength).toBe(CURVE_RESOLUTION);
  });

  it('creates pipeline with opacityOverLifetime active', () => {
    const curveData = new Float32Array(CURVE_RESOLUTION);
    const buffers = createModifierStorageBuffers(
      maxParticles,
      false,
      curveData
    );
    const curveMap = makeCurveMap({
      curveCount: 1,
      data: curveData,
      opacityOverLifetime: 0,
    });
    const flags: ModifierFlags = { ...NO_FLAGS, opacityOverLifetime: true };

    const pipeline = createModifierComputeUpdate(
      buffers,
      maxParticles,
      curveMap,
      flags
    );
    expect(pipeline.computeNode).toBeDefined();
  });

  it('creates pipeline with colorOverLifetime active (3 curves)', () => {
    const curveData = new Float32Array(CURVE_RESOLUTION * 3);
    const buffers = createModifierStorageBuffers(
      maxParticles,
      false,
      curveData
    );
    const curveMap = makeCurveMap({
      curveCount: 3,
      data: curveData,
      colorR: 0,
      colorG: 1,
      colorB: 2,
    });
    const flags: ModifierFlags = { ...NO_FLAGS, colorOverLifetime: true };

    const pipeline = createModifierComputeUpdate(
      buffers,
      maxParticles,
      curveMap,
      flags
    );
    expect(pipeline.computeNode).toBeDefined();
    expect(pipeline.curveDataLength).toBe(CURVE_RESOLUTION * 3);
  });

  it('creates pipeline with rotationOverLifetime active', () => {
    const buffers = createModifierStorageBuffers(
      maxParticles,
      false,
      new Float32Array(0)
    );
    const flags: ModifierFlags = { ...NO_FLAGS, rotationOverLifetime: true };

    const pipeline = createModifierComputeUpdate(
      buffers,
      maxParticles,
      makeCurveMap(),
      flags
    );
    expect(pipeline.computeNode).toBeDefined();
  });

  it('creates pipeline with linearVelocity active (all 3 axes)', () => {
    const curveData = new Float32Array(CURVE_RESOLUTION * 3);
    const buffers = createModifierStorageBuffers(
      maxParticles,
      false,
      curveData
    );
    const curveMap = makeCurveMap({
      curveCount: 3,
      data: curveData,
      linearVelX: 0,
      linearVelY: 1,
      linearVelZ: 2,
    });
    const flags: ModifierFlags = { ...NO_FLAGS, linearVelocity: true };

    const pipeline = createModifierComputeUpdate(
      buffers,
      maxParticles,
      curveMap,
      flags
    );
    expect(pipeline.computeNode).toBeDefined();
  });

  it('creates pipeline with orbitalVelocity active (all 3 axes)', () => {
    const curveData = new Float32Array(CURVE_RESOLUTION * 3);
    const buffers = createModifierStorageBuffers(
      maxParticles,
      false,
      curveData
    );
    const curveMap = makeCurveMap({
      curveCount: 3,
      data: curveData,
      orbitalVelX: 0,
      orbitalVelY: 1,
      orbitalVelZ: 2,
    });
    const flags: ModifierFlags = { ...NO_FLAGS, orbitalVelocity: true };

    const pipeline = createModifierComputeUpdate(
      buffers,
      maxParticles,
      curveMap,
      flags
    );
    expect(pipeline.computeNode).toBeDefined();
  });

  it('creates pipeline with noise active', () => {
    const buffers = createModifierStorageBuffers(
      maxParticles,
      false,
      new Float32Array(0)
    );
    const flags: ModifierFlags = { ...NO_FLAGS, noise: true };

    const pipeline = createModifierComputeUpdate(
      buffers,
      maxParticles,
      makeCurveMap(),
      flags
    );
    expect(pipeline.computeNode).toBeDefined();
    expect(pipeline.uniforms.noiseStrength).toBeDefined();
    expect(pipeline.uniforms.noiseFrequency).toBeDefined();
    expect(pipeline.uniforms.noisePower).toBeDefined();
    expect(pipeline.uniforms.noisePositionAmount).toBeDefined();
    expect(pipeline.uniforms.noiseRotationAmount).toBeDefined();
    expect(pipeline.uniforms.noiseSizeAmount).toBeDefined();
  });

  it('creates pipeline with forceFields active', () => {
    const buffers = createModifierStorageBuffers(
      maxParticles,
      false,
      new Float32Array(0),
      true
    );
    const flags: ModifierFlags = { ...NO_FLAGS, forceFields: true };

    const pipeline = createModifierComputeUpdate(
      buffers,
      maxParticles,
      makeCurveMap(),
      flags,
      3
    );
    expect(pipeline.computeNode).toBeDefined();
    expect(pipeline.forceFieldInfo).not.toBeNull();
    expect(pipeline.forceFieldInfo!.countUniform).toBeDefined();
  });

  it('creates pipeline with all modifiers active simultaneously', () => {
    const curveData = new Float32Array(CURVE_RESOLUTION * 11);
    const buffers = createModifierStorageBuffers(
      maxParticles,
      false,
      curveData,
      true
    );
    const allFlags: ModifierFlags = {
      sizeOverLifetime: true,
      opacityOverLifetime: true,
      colorOverLifetime: true,
      rotationOverLifetime: true,
      linearVelocity: true,
      orbitalVelocity: true,
      noise: true,
      forceFields: true,
    };
    const curveMap = makeCurveMap({
      curveCount: 11,
      data: curveData,
      sizeOverLifetime: 0,
      opacityOverLifetime: 1,
      colorR: 2,
      colorG: 3,
      colorB: 4,
      linearVelX: 5,
      linearVelY: 6,
      linearVelZ: 7,
      orbitalVelX: 8,
      orbitalVelY: 9,
      orbitalVelZ: 10,
    });

    const pipeline = createModifierComputeUpdate(
      buffers,
      maxParticles,
      curveMap,
      allFlags,
      5
    );
    expect(pipeline.computeNode).toBeDefined();
    expect(pipeline.curveDataLength).toBe(CURVE_RESOLUTION * 11);
    expect(pipeline.uniforms.delta).toBeDefined();
    expect(pipeline.uniforms.gravityVelocity).toBeDefined();
    expect(pipeline.uniforms.worldPositionChange).toBeDefined();
    expect(pipeline.uniforms.simulationSpaceWorld).toBeDefined();
    expect(pipeline.uniforms.noiseStrength).toBeDefined();
    expect(pipeline.forceFieldInfo).not.toBeNull();
    expect(pipeline.forceFieldInfo!.countUniform).toBeDefined();
  });
});

// ─── Pipeline with partial velocity axes ────────────────────────────────────

describe('createModifierComputeUpdate — partial velocity axes', () => {
  const maxParticles = 10;

  it('handles linearVelocity with only X axis', () => {
    const curveData = new Float32Array(CURVE_RESOLUTION);
    const buffers = createModifierStorageBuffers(
      maxParticles,
      false,
      curveData
    );
    const curveMap = makeCurveMap({
      curveCount: 1,
      data: curveData,
      linearVelX: 0,
      linearVelY: -1,
      linearVelZ: -1,
    });
    const flags: ModifierFlags = { ...NO_FLAGS, linearVelocity: true };

    const pipeline = createModifierComputeUpdate(
      buffers,
      maxParticles,
      curveMap,
      flags
    );
    expect(pipeline.computeNode).toBeDefined();
  });

  it('handles orbitalVelocity with only Z axis', () => {
    const curveData = new Float32Array(CURVE_RESOLUTION);
    const buffers = createModifierStorageBuffers(
      maxParticles,
      false,
      curveData
    );
    const curveMap = makeCurveMap({
      curveCount: 1,
      data: curveData,
      orbitalVelX: -1,
      orbitalVelY: -1,
      orbitalVelZ: 0,
    });
    const flags: ModifierFlags = { ...NO_FLAGS, orbitalVelocity: true };

    const pipeline = createModifierComputeUpdate(
      buffers,
      maxParticles,
      curveMap,
      flags
    );
    expect(pipeline.computeNode).toBeDefined();
  });
});

// ─── Uniform exposure ───────────────────────────────────────────────────────

describe('createModifierComputeUpdate — uniforms', () => {
  it('exposes all core physics uniforms', () => {
    const buffers = createModifierStorageBuffers(
      10,
      false,
      new Float32Array(0)
    );
    const pipeline = createModifierComputeUpdate(
      buffers,
      10,
      makeCurveMap(),
      NO_FLAGS
    );

    expect(pipeline.uniforms.delta).toBeDefined();
    expect(pipeline.uniforms.deltaMs).toBeDefined();
    expect(pipeline.uniforms.gravityVelocity).toBeDefined();
    expect(pipeline.uniforms.worldPositionChange).toBeDefined();
    expect(pipeline.uniforms.simulationSpaceWorld).toBeDefined();
  });

  it('exposes noise uniforms even when noise is disabled', () => {
    const buffers = createModifierStorageBuffers(
      10,
      false,
      new Float32Array(0)
    );
    const pipeline = createModifierComputeUpdate(
      buffers,
      10,
      makeCurveMap(),
      NO_FLAGS
    );

    // Noise uniforms are always present (for uniform binding consistency)
    expect(pipeline.uniforms.noiseStrength).toBeDefined();
    expect(pipeline.uniforms.noisePower).toBeDefined();
    expect(pipeline.uniforms.noiseFrequency).toBeDefined();
    expect(pipeline.uniforms.noisePositionAmount).toBeDefined();
    expect(pipeline.uniforms.noiseRotationAmount).toBeDefined();
    expect(pipeline.uniforms.noiseSizeAmount).toBeDefined();
  });
});
