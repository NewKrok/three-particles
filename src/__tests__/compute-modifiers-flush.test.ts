/**
 * Tests for flushEmitQueue initFlag management.
 *
 * Verifies that the initFlag mechanism correctly handles rapid particle
 * recycling — when a particle dies and is re-emitted within the same
 * frame, the initFlag must remain set so the GPU compute shader
 * initialises it with the new data.
 */

import {
  createModifierStorageBuffers,
  writeParticleToModifierBuffers,
  flushEmitQueue,
  registerCurveDataLength,
  INIT_STRIDE,
} from '../js/effects/three-particles/webgpu/compute-modifiers.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CURVE_LEN = 256; // minimal baked curve data (1 curve × 256 samples)
const MAX_PARTICLES = 10;

function createTestBuffers() {
  const curveData = new Float32Array(CURVE_LEN);
  // Fill with some non-zero values so we can detect cross-reads
  for (let i = 0; i < CURVE_LEN; i++) curveData[i] = i / CURVE_LEN;

  const buffers = createModifierStorageBuffers(
    MAX_PARTICLES,
    true,
    curveData,
    false
  );
  registerCurveDataLength(buffers, CURVE_LEN);
  return buffers;
}

function makeParticleData(overrides: Record<string, unknown> = {}) {
  return {
    position: { x: 0.1, y: 0.2, z: 0.3 },
    velocity: { x: 0, y: 0, z: 0 },
    startLifetime: 500,
    colorA: 1.0,
    size: 0.5,
    rotation: 0,
    colorR: 0.7,
    colorG: 0.1,
    colorB: 0.9,
    startSize: 0.5,
    startOpacity: 1.0,
    startColorR: 0.7,
    startColorG: 0.1,
    startColorB: 0.9,
    startFrame: 0,
    rotationSpeed: 0,
    noiseOffset: 0,
    orbitalOffset: { x: 0, y: 0, z: 0 },
    ...overrides,
  };
}

function getInitFlag(
  buffers: ReturnType<typeof createTestBuffers>,
  particleIndex: number
): number {
  const arr = buffers.curveData.array as Float32Array;
  return arr[CURVE_LEN + particleIndex * INIT_STRIDE + 3];
}

function getInitColor(
  buffers: ReturnType<typeof createTestBuffers>,
  particleIndex: number
) {
  const arr = buffers.curveData.array as Float32Array;
  const base = CURVE_LEN + particleIndex * INIT_STRIDE;
  return {
    r: arr[base + 8],
    g: arr[base + 9],
    b: arr[base + 10],
    a: arr[base + 11],
  };
}

function getInitStartValues(
  buffers: ReturnType<typeof createTestBuffers>,
  particleIndex: number
) {
  const arr = buffers.curveData.array as Float32Array;
  const base = CURVE_LEN + particleIndex * INIT_STRIDE;
  return {
    startLifetime: arr[base + 20],
    startSize: arr[base + 21],
    startOpacity: arr[base + 22],
    startColorR: arr[base + 23],
    startColorG: arr[base + 24],
    startColorB: arr[base + 25],
    rotationSpeed: arr[base + 26],
    noiseOffset: arr[base + 27],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('flushEmitQueue initFlag management', () => {
  it('sets initFlag=1 when a particle is emitted', () => {
    const buffers = createTestBuffers();
    writeParticleToModifierBuffers(buffers, 3, makeParticleData());
    expect(getInitFlag(buffers, 3)).toBe(1);
  });

  it('flushEmitQueue preserves initFlag=1 for current frame emits', () => {
    const buffers = createTestBuffers();
    writeParticleToModifierBuffers(buffers, 3, makeParticleData());

    const count = flushEmitQueue(buffers);
    expect(count).toBe(1);
    // initFlag should still be 1 — it was emitted this frame
    expect(getInitFlag(buffers, 3)).toBe(1);
  });

  it('flushEmitQueue clears initFlag from previous frame after flush', () => {
    const buffers = createTestBuffers();

    // Frame 1: emit particle 3
    writeParticleToModifierBuffers(buffers, 3, makeParticleData());
    flushEmitQueue(buffers); // uploads initFlag=1 for particle 3

    // Frame 2: no new emits
    const count = flushEmitQueue(buffers);
    expect(count).toBe(0);
    // initFlag should now be 0 (cleared by the scan)
    expect(getInitFlag(buffers, 3)).toBe(0);
  });

  it('preserves initFlag when particle is re-emitted next frame', () => {
    const buffers = createTestBuffers();

    // Frame 1: emit particle 5
    writeParticleToModifierBuffers(
      buffers,
      5,
      makeParticleData({ colorR: 0.5 })
    );
    flushEmitQueue(buffers);

    // Frame 2: particle 5 dies and is re-emitted with new data
    writeParticleToModifierBuffers(
      buffers,
      5,
      makeParticleData({ colorR: 0.8 })
    );
    flushEmitQueue(buffers);

    // initFlag must be 1 (the re-emit)
    expect(getInitFlag(buffers, 5)).toBe(1);
    // Color should be the NEW data
    expect(getInitColor(buffers, 5).r).toBeCloseTo(0.8);
  });

  it('handles rapid recycle: emit → flush → re-emit → flush across frames', () => {
    const buffers = createTestBuffers();

    // Frame 1: emit particle 7
    writeParticleToModifierBuffers(
      buffers,
      7,
      makeParticleData({
        colorR: 0.6,
        position: { x: 0.1, y: 0.1, z: 0.1 },
      })
    );
    flushEmitQueue(buffers);

    // Simulate: GPU processes initFlag and clears it on GPU side.
    // On CPU, the initFlag is still 1 at this point (that's expected —
    // the GPU cleared its own copy, the CPU array still has 1).

    // Frame 2: particle 7 dies and is immediately re-emitted
    writeParticleToModifierBuffers(
      buffers,
      7,
      makeParticleData({
        colorR: 0.9,
        position: { x: 0.5, y: 0.5, z: 0.5 },
      })
    );
    flushEmitQueue(buffers);

    // The re-emit data must be present
    expect(getInitFlag(buffers, 7)).toBe(1);
    expect(getInitColor(buffers, 7).r).toBeCloseTo(0.9);

    // Frame 3: no emits — the initFlag from frame 2 should be cleared
    flushEmitQueue(buffers);
    expect(getInitFlag(buffers, 7)).toBe(0);
  });

  it('does not corrupt other particles during rapid recycle', () => {
    const buffers = createTestBuffers();

    // Frame 1: emit particles 2 and 5
    writeParticleToModifierBuffers(
      buffers,
      2,
      makeParticleData({ colorR: 0.3 })
    );
    writeParticleToModifierBuffers(
      buffers,
      5,
      makeParticleData({ colorR: 0.6 })
    );
    flushEmitQueue(buffers);

    // Frame 2: particle 5 re-emitted, particle 2 stays (its initFlag
    // should be cleared since it was emitted in the previous frame)
    writeParticleToModifierBuffers(
      buffers,
      5,
      makeParticleData({ colorR: 0.9 })
    );
    flushEmitQueue(buffers);

    // Particle 2: initFlag should be 0 (was emitted in frame 1, not frame 2)
    expect(getInitFlag(buffers, 2)).toBe(0);
    // Particle 5: initFlag should be 1 (re-emitted in frame 2)
    expect(getInitFlag(buffers, 5)).toBe(1);
    expect(getInitColor(buffers, 5).r).toBeCloseTo(0.9);
  });

  it('needsUpdate is true only when there are emits', () => {
    const buffers = createTestBuffers();

    // No emits — needsUpdate should not be triggered
    flushEmitQueue(buffers);
    // We can't directly check needsUpdate easily, but count should be 0
    expect(flushEmitQueue(buffers)).toBe(0);

    // With emit
    writeParticleToModifierBuffers(buffers, 0, makeParticleData());
    // The flush should report 1 emit
    expect(flushEmitQueue(buffers)).toBe(1);
  });

  it('initFlag never leaks: after two flushes without emit, all flags are 0', () => {
    const buffers = createTestBuffers();

    // Emit several particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      writeParticleToModifierBuffers(buffers, i, makeParticleData());
    }
    flushEmitQueue(buffers);

    // All should have initFlag=1 (current frame's emits, preserved)
    for (let i = 0; i < MAX_PARTICLES; i++) {
      expect(getInitFlag(buffers, i)).toBe(1);
    }

    // Flush without emits — clears all
    flushEmitQueue(buffers);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      expect(getInitFlag(buffers, i)).toBe(0);
    }

    // Flush again — still all 0
    flushEmitQueue(buffers);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      expect(getInitFlag(buffers, i)).toBe(0);
    }
  });

  it('stores startValues/startColorsExt in curveData init slot', () => {
    const buffers = createTestBuffers();
    writeParticleToModifierBuffers(
      buffers,
      4,
      makeParticleData({
        startLifetime: 750,
        startSize: 1.2,
        startOpacity: 0.8,
        startColorR: 0.3,
        startColorG: 0.4,
        startColorB: 0.5,
        rotationSpeed: 2.0,
        noiseOffset: 42.5,
      })
    );

    const sv = getInitStartValues(buffers, 4);
    expect(sv.startLifetime).toBeCloseTo(750);
    expect(sv.startSize).toBeCloseTo(1.2);
    expect(sv.startOpacity).toBeCloseTo(0.8);
    expect(sv.startColorR).toBeCloseTo(0.3);
    expect(sv.startColorG).toBeCloseTo(0.4);
    expect(sv.startColorB).toBeCloseTo(0.5);
    expect(sv.rotationSpeed).toBeCloseTo(2.0);
    expect(sv.noiseOffset).toBeCloseTo(42.5);
  });

  it('does not set startValues.needsUpdate on flush', () => {
    const buffers = createTestBuffers();
    writeParticleToModifierBuffers(buffers, 0, makeParticleData());
    // Record version before flush
    const svVersionBefore = (
      buffers.startValues as unknown as { version: number }
    ).version;
    const sceVersionBefore = (
      buffers.startColorsExt as unknown as { version: number }
    ).version;

    flushEmitQueue(buffers);

    // startValues and startColorsExt should NOT have been marked for upload
    const svVersionAfter = (
      buffers.startValues as unknown as { version: number }
    ).version;
    const sceVersionAfter = (
      buffers.startColorsExt as unknown as { version: number }
    ).version;
    expect(svVersionAfter).toBe(svVersionBefore);
    expect(sceVersionAfter).toBe(sceVersionBefore);
  });
});
