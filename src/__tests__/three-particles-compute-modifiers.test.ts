import { StorageBufferAttribute } from 'three/webgpu';
import {
  createModifierStorageBuffers,
  createModifierComputeUpdate,
  writeParticleToModifierBuffers,
  deactivateParticleInModifierBuffers,
  flushEmitQueue,
  registerCurveDataLength,
  INIT_STRIDE,
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
  forceFields: false,
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

const SAMPLE_EMIT_DATA = {
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
};

/**
 * Helper: snapshot the buffer version so we can detect whether needsUpdate
 * was set (Three.js `needsUpdate = true` increments `.version`).
 */
function getVersion(
  buf: StorageBufferAttribute | { version?: number }
): number {
  return (buf as { version?: number }).version ?? 0;
}

/** Helper to create buffers and register curveDataLength in one call. */
function createBuffersWithInitData(
  maxParticles: number,
  curveData = new Float32Array(0)
) {
  const buffers = createModifierStorageBuffers(maxParticles, false, curveData);
  const curveLen = Math.max(curveData.length, 1);
  registerCurveDataLength(buffers, curveLen);
  return { buffers, curveLen };
}

// ─── createModifierStorageBuffers ────────────────────────────────────────────

describe('createModifierStorageBuffers', () => {
  it('creates all required buffers with per-particle init data in curveData tail', () => {
    const curveData = new Float32Array(256);
    const buffers = createModifierStorageBuffers(50, false, curveData);

    expect(buffers.position).toBeInstanceOf(StorageBufferAttribute);
    expect(buffers.position.array).toHaveLength(200); // 50 * 4 (vec4)
    expect(buffers.velocity.array).toHaveLength(200);
    expect(buffers.color.array).toHaveLength(200);
    expect(buffers.particleState.array).toHaveLength(200);
    expect(buffers.startValues.array).toHaveLength(200);
    expect(buffers.startColorsExt.array).toHaveLength(200);
    expect(buffers.orbitalIsActive.array).toHaveLength(200);
    // curveData = original curves + per-particle init data (maxParticles * INIT_STRIDE)
    const expectedLen = 256 + 50 * INIT_STRIDE;
    expect(buffers.curveData.array).toHaveLength(expectedLen);
    // No separate emitQueue buffer
    expect((buffers as Record<string, unknown>).emitQueue).toBeUndefined();
  });

  it('creates 1-element curveData base when input is empty', () => {
    const buffers = createModifierStorageBuffers(
      10,
      false,
      new Float32Array(0)
    );
    // 1 (min curve) + per-particle init data (10 * INIT_STRIDE)
    const expectedLen = 1 + 10 * INIT_STRIDE;
    expect(buffers.curveData.array).toHaveLength(expectedLen);
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
    expect(pipeline.curveDataLength).toBe(1); // max(0,1) = 1
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
      forceFields: false,
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
    expect(pipeline.curveDataLength).toBe(256 * 8);
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

// ─── writeParticleToModifierBuffers (per-particle init in curveData tail) ────

describe('writeParticleToModifierBuffers', () => {
  it('writes init data to the per-particle slot in curveData', () => {
    const { buffers, curveLen } = createBuffersWithInitData(10);

    writeParticleToModifierBuffers(buffers, 3, SAMPLE_EMIT_DATA);

    // Particle 3's init slot starts at curveLen + 3 * INIT_STRIDE
    const arr = buffers.curveData.array as Float32Array;
    const base = curveLen + 3 * INIT_STRIDE;
    expect(arr[base]).toBe(1); // position.x
    expect(arr[base + 1]).toBe(2); // position.y
    expect(arr[base + 2]).toBe(3); // position.z
    expect(arr[base + 3]).toBe(1.0); // initFlag = 1
    expect(arr[base + 4]).toBe(4); // velocity.x
    expect(arr[base + 5]).toBe(5); // velocity.y
    expect(arr[base + 6]).toBe(6); // velocity.z
    expect(arr[base + 8]).toBeCloseTo(0.9); // colorR
    expect(arr[base + 9]).toBeCloseTo(0.7); // colorG
    expect(arr[base + 10]).toBeCloseTo(0.3); // colorB
    expect(arr[base + 11]).toBeCloseTo(0.8); // colorA
    expect(arr[base + 12]).toBe(0); // lifetime = 0
    expect(arr[base + 13]).toBeCloseTo(0.5); // size
    expect(arr[base + 14]).toBeCloseTo(1.2); // rotation
    expect(arr[base + 15]).toBe(2); // startFrame
    expect(arr[base + 16]).toBe(10); // orbitalOffset.x
    expect(arr[base + 17]).toBe(20); // orbitalOffset.y
    expect(arr[base + 18]).toBe(30); // orbitalOffset.z
    expect(arr[base + 19]).toBe(1.0); // isActive = 1
  });

  it('writes to CPU-only startValues and startColorsExt buffers', () => {
    const { buffers } = createBuffersWithInitData(10);

    writeParticleToModifierBuffers(buffers, 3, SAMPLE_EMIT_DATA);

    const svArr = buffers.startValues.array as Float32Array;
    expect(svArr[12]).toBe(2000); // startLifetime at 3*4
    expect(svArr[13]).toBeCloseTo(0.5); // startSize

    const sceArr = buffers.startColorsExt.array as Float32Array;
    expect(sceArr[12]).toBeCloseTo(0.7); // startColorG
    expect(sceArr[15]).toBe(42); // noiseOffset
  });

  it('does NOT bump version on compute-output buffers', () => {
    const { buffers } = createBuffersWithInitData(10);

    const vPos = getVersion(buffers.position);
    const vVel = getVersion(buffers.velocity);
    const vCol = getVersion(buffers.color);
    const vPs = getVersion(buffers.particleState);
    const vOia = getVersion(buffers.orbitalIsActive);

    writeParticleToModifierBuffers(buffers, 0, SAMPLE_EMIT_DATA);

    expect(getVersion(buffers.position)).toBe(vPos);
    expect(getVersion(buffers.velocity)).toBe(vVel);
    expect(getVersion(buffers.color)).toBe(vCol);
    expect(getVersion(buffers.particleState)).toBe(vPs);
    expect(getVersion(buffers.orbitalIsActive)).toBe(vOia);
  });

  it('writes to separate per-particle slots for different indices', () => {
    const { buffers, curveLen } = createBuffersWithInitData(10);

    writeParticleToModifierBuffers(buffers, 0, {
      ...SAMPLE_EMIT_DATA,
      position: { x: 10, y: 20, z: 30 },
    });
    writeParticleToModifierBuffers(buffers, 5, {
      ...SAMPLE_EMIT_DATA,
      position: { x: 40, y: 50, z: 60 },
    });

    const arr = buffers.curveData.array as Float32Array;
    // Particle 0's slot
    const base0 = curveLen + 0 * INIT_STRIDE;
    expect(arr[base0]).toBe(10); // position.x
    expect(arr[base0 + 1]).toBe(20); // position.y
    expect(arr[base0 + 3]).toBe(1.0); // initFlag

    // Particle 5's slot
    const base5 = curveLen + 5 * INIT_STRIDE;
    expect(arr[base5]).toBe(40); // position.x
    expect(arr[base5 + 1]).toBe(50); // position.y
    expect(arr[base5 + 3]).toBe(1.0); // initFlag

    // Particle 3 should NOT have initFlag set (wasn't emitted)
    const base3 = curveLen + 3 * INIT_STRIDE;
    expect(arr[base3 + 3]).toBe(0); // initFlag = 0
  });
});

// ─── flushEmitQueue ─────────────────────────────────────────────────────────

describe('flushEmitQueue', () => {
  it('returns the number of queued emits and resets the counter', () => {
    const { buffers } = createBuffersWithInitData(10);

    writeParticleToModifierBuffers(buffers, 0, SAMPLE_EMIT_DATA);
    writeParticleToModifierBuffers(buffers, 1, SAMPLE_EMIT_DATA);

    const count = flushEmitQueue(buffers);
    expect(count).toBe(2);

    // Second flush should return 0
    const count2 = flushEmitQueue(buffers);
    expect(count2).toBe(0);
  });

  it('bumps curveData version when emits are pending', () => {
    const { buffers } = createBuffersWithInitData(10);

    const vCd = getVersion(buffers.curveData);

    writeParticleToModifierBuffers(buffers, 0, SAMPLE_EMIT_DATA);
    writeParticleToModifierBuffers(buffers, 1, SAMPLE_EMIT_DATA);
    flushEmitQueue(buffers);

    expect(getVersion(buffers.curveData)).toBeGreaterThan(vCd);
  });

  it('does not bump version when no emits are queued', () => {
    const { buffers } = createBuffersWithInitData(10);

    const vCd = getVersion(buffers.curveData);

    flushEmitQueue(buffers);

    expect(getVersion(buffers.curveData)).toBe(vCd);
  });

  it('does not bump version on compute-output buffers', () => {
    const { buffers } = createBuffersWithInitData(10);

    const vPos = getVersion(buffers.position);
    const vVel = getVersion(buffers.velocity);
    const vCol = getVersion(buffers.color);
    const vPs = getVersion(buffers.particleState);
    const vOia = getVersion(buffers.orbitalIsActive);

    writeParticleToModifierBuffers(buffers, 0, SAMPLE_EMIT_DATA);
    flushEmitQueue(buffers);

    expect(getVersion(buffers.position)).toBe(vPos);
    expect(getVersion(buffers.velocity)).toBe(vVel);
    expect(getVersion(buffers.color)).toBe(vCol);
    expect(getVersion(buffers.particleState)).toBe(vPs);
    expect(getVersion(buffers.orbitalIsActive)).toBe(vOia);
  });

  it('clears previous frame initFlags before next upload (prevents flicker)', () => {
    const { buffers, curveLen } = createBuffersWithInitData(10);
    const arr = buffers.curveData.array as Float32Array;

    // Frame 1: emit particles 2 and 5
    writeParticleToModifierBuffers(buffers, 2, SAMPLE_EMIT_DATA);
    writeParticleToModifierBuffers(buffers, 5, SAMPLE_EMIT_DATA);
    flushEmitQueue(buffers);

    // After flush, CPU array still has initFlag=1 for particles 2 and 5
    expect(arr[curveLen + 2 * INIT_STRIDE + 3]).toBe(1.0);
    expect(arr[curveLen + 5 * INIT_STRIDE + 3]).toBe(1.0);

    // Frame 2: emit particle 7
    writeParticleToModifierBuffers(buffers, 7, SAMPLE_EMIT_DATA);
    flushEmitQueue(buffers);

    // The previous frame's initFlags (particles 2 and 5) should now be cleared
    expect(arr[curveLen + 2 * INIT_STRIDE + 3]).toBe(0);
    expect(arr[curveLen + 5 * INIT_STRIDE + 3]).toBe(0);
    // Particle 7 was just emitted — its initFlag is still 1
    expect(arr[curveLen + 7 * INIT_STRIDE + 3]).toBe(1.0);
  });

  it('clears initFlags even when no new particles are emitted next frame', () => {
    const { buffers, curveLen } = createBuffersWithInitData(10);
    const arr = buffers.curveData.array as Float32Array;

    // Frame 1: emit particle 3
    writeParticleToModifierBuffers(buffers, 3, SAMPLE_EMIT_DATA);
    flushEmitQueue(buffers);

    expect(arr[curveLen + 3 * INIT_STRIDE + 3]).toBe(1.0);

    // Frame 2: no new emissions, just flush
    flushEmitQueue(buffers);

    // Previous frame's initFlag for particle 3 should be cleared
    expect(arr[curveLen + 3 * INIT_STRIDE + 3]).toBe(0);
  });
});

// ─── deactivateParticleInModifierBuffers ────────────────────────────────────

describe('deactivateParticleInModifierBuffers', () => {
  it('is a no-op — does not bump version on any buffer', () => {
    const { buffers } = createBuffersWithInitData(5);

    const vOia = getVersion(buffers.orbitalIsActive);
    const vCol = getVersion(buffers.color);

    deactivateParticleInModifierBuffers(buffers, 2);

    expect(getVersion(buffers.orbitalIsActive)).toBe(vOia);
    expect(getVersion(buffers.color)).toBe(vCol);
  });
});

// ─── Large burst support ──────────────────────────────────────────────────

describe('large burst support', () => {
  it('handles a 75K particle burst without overflow', () => {
    const maxParticles = 75000;
    const { buffers, curveLen } = createBuffersWithInitData(maxParticles);

    // Emit all 75K particles
    for (let i = 0; i < maxParticles; i++) {
      writeParticleToModifierBuffers(buffers, i, {
        ...SAMPLE_EMIT_DATA,
        position: { x: i, y: i + 1, z: i + 2 },
      });
    }

    const count = flushEmitQueue(buffers);
    expect(count).toBe(maxParticles);

    // Verify first and last particles have correct init data
    const arr = buffers.curveData.array as Float32Array;
    const base0 = curveLen + 0 * INIT_STRIDE;
    expect(arr[base0]).toBe(0); // position.x for particle 0
    expect(arr[base0 + 3]).toBe(1.0); // initFlag

    const baseLast = curveLen + (maxParticles - 1) * INIT_STRIDE;
    expect(arr[baseLast]).toBe(maxParticles - 1); // position.x for last particle
    expect(arr[baseLast + 3]).toBe(1.0); // initFlag
  });
});
