import { StorageBufferAttribute } from 'three/webgpu';
import {
  createModifierStorageBuffers,
  createModifierComputeUpdate,
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

    // Core physics
    expect(buffers.position).toBeInstanceOf(StorageBufferAttribute);
    expect(buffers.position.array).toHaveLength(150); // 50 * 3
    expect(buffers.velocity.array).toHaveLength(150);
    expect(buffers.lifetime.array).toHaveLength(50);
    expect(buffers.startLifetime.array).toHaveLength(50);
    expect(buffers.isActive.array).toHaveLength(50);
    expect(buffers.colorA.array).toHaveLength(50);

    // Modifier-specific
    expect(buffers.size.array).toHaveLength(50);
    expect(buffers.rotation.array).toHaveLength(50);
    expect(buffers.colorR.array).toHaveLength(50);
    expect(buffers.colorG.array).toHaveLength(50);
    expect(buffers.colorB.array).toHaveLength(50);
    expect(buffers.startSize.array).toHaveLength(50);
    expect(buffers.startOpacity.array).toHaveLength(50);
    expect(buffers.startColorR.array).toHaveLength(50);
    expect(buffers.startColorG.array).toHaveLength(50);
    expect(buffers.startColorB.array).toHaveLength(50);
    expect(buffers.rotationSpeed.array).toHaveLength(50);
    expect(buffers.noiseOffset.array).toHaveLength(50);
    expect(buffers.orbitalOffset.array).toHaveLength(150); // 50 * 3

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
