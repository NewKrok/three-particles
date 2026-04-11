import { StorageBufferAttribute } from 'three/webgpu';
import {
  createModifierStorageBuffers,
  createModifierComputeUpdate,
  writeParticleToModifierBuffers,
  deactivateParticleInModifierBuffers,
  flushEmitQueue,
  registerCurveDataLength,
  MAX_EMITS_PER_FRAME,
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
function createBuffersWithEmitQueue(
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
  it('creates all required buffers with emit queue in curveData tail', () => {
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
    // curveData = original curves + 1 (emit count) + queue entries
    const expectedLen = 256 + 1 + MAX_EMITS_PER_FRAME * 24;
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
    // 1 (min curve) + 1 (emit count) + queue
    const expectedLen = 1 + 1 + MAX_EMITS_PER_FRAME * 24;
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

// ─── writeParticleToModifierBuffers (emit queue in curveData tail) ──────────

describe('writeParticleToModifierBuffers', () => {
  it('writes emit data to the curveData tail', () => {
    const { buffers, curveLen } = createBuffersWithEmitQueue(10);

    writeParticleToModifierBuffers(buffers, 3, SAMPLE_EMIT_DATA);

    // Emit queue starts at curveLen + 1 (skip emit count slot)
    const arr = buffers.curveData.array as Float32Array;
    const base = curveLen + 1;
    expect(arr[base]).toBe(3); // particleIndex
    expect(arr[base + 1]).toBe(1); // position.x
    expect(arr[base + 2]).toBe(2); // position.y
    expect(arr[base + 3]).toBe(3); // position.z
    expect(arr[base + 4]).toBe(4); // velocity.x
    expect(arr[base + 7]).toBe(2000); // startLifetime
    expect(arr[base + 13]).toBeCloseTo(0.8); // colorA
    expect(arr[base + 19]).toBe(10); // orbitalOffset.x
  });

  it('writes to CPU-only startValues and startColorsExt buffers', () => {
    const { buffers } = createBuffersWithEmitQueue(10);

    writeParticleToModifierBuffers(buffers, 3, SAMPLE_EMIT_DATA);

    const svArr = buffers.startValues.array as Float32Array;
    expect(svArr[12]).toBe(2000); // startLifetime at 3*4
    expect(svArr[13]).toBeCloseTo(0.5); // startSize

    const sceArr = buffers.startColorsExt.array as Float32Array;
    expect(sceArr[12]).toBeCloseTo(0.7); // startColorG
    expect(sceArr[15]).toBe(42); // noiseOffset
  });

  it('does NOT bump version on compute-output buffers', () => {
    const { buffers } = createBuffersWithEmitQueue(10);

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

  it('queues multiple emits in sequence', () => {
    const { buffers, curveLen } = createBuffersWithEmitQueue(10);

    writeParticleToModifierBuffers(buffers, 0, {
      ...SAMPLE_EMIT_DATA,
      position: { x: 10, y: 20, z: 30 },
    });
    writeParticleToModifierBuffers(buffers, 5, {
      ...SAMPLE_EMIT_DATA,
      position: { x: 40, y: 50, z: 60 },
    });

    const arr = buffers.curveData.array as Float32Array;
    const qStart = curveLen + 1;
    // First entry
    expect(arr[qStart]).toBe(0); // particleIndex
    expect(arr[qStart + 1]).toBe(10); // position.x
    // Second entry at stride 24
    expect(arr[qStart + 24]).toBe(5); // particleIndex
    expect(arr[qStart + 25]).toBe(40); // position.x
  });
});

// ─── flushEmitQueue ─────────────────────────────────────────────────────────

describe('flushEmitQueue', () => {
  it('returns the number of queued emits and resets the counter', () => {
    const { buffers } = createBuffersWithEmitQueue(10);

    writeParticleToModifierBuffers(buffers, 0, SAMPLE_EMIT_DATA);
    writeParticleToModifierBuffers(buffers, 1, SAMPLE_EMIT_DATA);

    const count = flushEmitQueue(buffers);
    expect(count).toBe(2);

    // Second flush should return 0
    const count2 = flushEmitQueue(buffers);
    expect(count2).toBe(0);
  });

  it('writes emit count into curveData and bumps version', () => {
    const { buffers, curveLen } = createBuffersWithEmitQueue(10);

    const vCd = getVersion(buffers.curveData);

    writeParticleToModifierBuffers(buffers, 0, SAMPLE_EMIT_DATA);
    writeParticleToModifierBuffers(buffers, 1, SAMPLE_EMIT_DATA);
    flushEmitQueue(buffers);

    // Emit count written at curveLen index
    const arr = buffers.curveData.array as Float32Array;
    expect(arr[curveLen]).toBe(2);

    expect(getVersion(buffers.curveData)).toBeGreaterThan(vCd);
  });

  it('does not bump version when no emits are queued', () => {
    const { buffers } = createBuffersWithEmitQueue(10);

    const vCd = getVersion(buffers.curveData);

    flushEmitQueue(buffers);

    expect(getVersion(buffers.curveData)).toBe(vCd);
  });

  it('does not bump version on compute-output buffers', () => {
    const { buffers } = createBuffersWithEmitQueue(10);

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
});

// ─── deactivateParticleInModifierBuffers ────────────────────────────────────

describe('deactivateParticleInModifierBuffers', () => {
  it('is a no-op — does not bump version on any buffer', () => {
    const { buffers } = createBuffersWithEmitQueue(5);

    const vOia = getVersion(buffers.orbitalIsActive);
    const vCol = getVersion(buffers.color);

    deactivateParticleInModifierBuffers(buffers, 2);

    expect(getVersion(buffers.orbitalIsActive)).toBe(vOia);
    expect(getVersion(buffers.color)).toBe(vCol);
  });
});

// ─── Emit queue overflow guard ──────────────────────────────────────────────

describe('emit queue overflow', () => {
  it('silently drops emits beyond MAX_EMITS_PER_FRAME', () => {
    const { buffers } = createBuffersWithEmitQueue(MAX_EMITS_PER_FRAME + 10);

    for (let i = 0; i < MAX_EMITS_PER_FRAME + 5; i++) {
      writeParticleToModifierBuffers(buffers, i, SAMPLE_EMIT_DATA);
    }

    const count = flushEmitQueue(buffers);
    expect(count).toBe(MAX_EMITS_PER_FRAME);
  });
});
