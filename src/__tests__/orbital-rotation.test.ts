/**
 * Tests that the GPU orbital velocity rotation (applyOrbitalRotation) produces
 * identical results to the CPU path (Three.js Vector3.applyEuler with the
 * speed→Euler axis mapping used in three-particles-modifiers.ts).
 *
 * The CPU path does:
 *   orbitalEuler.set(speedX * dt, speedZ * dt, speedY * dt);  // note Y↔Z swap
 *   positionOffset.applyEuler(orbitalEuler);                   // 'XYZ' order
 *
 * The GPU function must reproduce this exactly.
 */
import { Vector3, Euler } from 'three';
import { applyOrbitalRotation } from '../js/effects/three-particles/webgpu/compute-modifiers.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Run the CPU orbital rotation (same as three-particles-modifiers.ts:156-161) */
function cpuOrbitalRotation(
  offset: Vector3,
  speedX: number,
  speedY: number,
  speedZ: number,
  delta: number
): void {
  const euler = new Euler(
    speedX * delta,
    speedZ * delta, // Y↔Z swap
    speedY * delta,
    'XYZ'
  );
  offset.applyEuler(euler);
}

/** Compare GPU result to CPU result for a single frame */
function compareSingleFrame(
  startOffset: { x: number; y: number; z: number },
  speedX: number,
  speedY: number,
  speedZ: number,
  delta: number
) {
  const cpuOff = new Vector3(startOffset.x, startOffset.y, startOffset.z);
  cpuOrbitalRotation(cpuOff, speedX, speedY, speedZ, delta);

  const gpuOff = { ...startOffset };
  applyOrbitalRotation(gpuOff, speedX, speedY, speedZ, delta);

  return { cpu: cpuOff, gpu: gpuOff };
}

/** Compare GPU vs CPU over N accumulated frames */
function compareAccumulated(
  startOffset: { x: number; y: number; z: number },
  speedX: number,
  speedY: number,
  speedZ: number,
  delta: number,
  frames: number
) {
  const cpuOff = new Vector3(startOffset.x, startOffset.y, startOffset.z);
  const gpuOff = { ...startOffset };

  for (let f = 0; f < frames; f++) {
    cpuOrbitalRotation(cpuOff, speedX, speedY, speedZ, delta);
    applyOrbitalRotation(gpuOff, speedX, speedY, speedZ, delta);
  }

  return { cpu: cpuOff, gpu: gpuOff };
}

const EPSILON = 1e-10;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('applyOrbitalRotation — CPU/GPU parity', () => {
  // ── Single-axis tests ──────────────────────────────────────────────────

  describe('single-axis orbital velocity', () => {
    it('Y-only (Magic Runes config) — single frame', () => {
      const { cpu, gpu } = compareSingleFrame(
        { x: 2, y: 0, z: 0 },
        0,
        1.0,
        0, // speedX=0, speedY=1.0, speedZ=0
        0.016
      );
      expect(gpu.x).toBeCloseTo(cpu.x, 10);
      expect(gpu.y).toBeCloseTo(cpu.y, 10);
      expect(gpu.z).toBeCloseTo(cpu.z, 10);
    });

    it('Y-only — offset on Z axis (edge case, minimal rotation)', () => {
      const { cpu, gpu } = compareSingleFrame(
        { x: 0, y: 0, z: 2 },
        0,
        1.0,
        0,
        0.016
      );
      expect(gpu.x).toBeCloseTo(cpu.x, 10);
      expect(gpu.y).toBeCloseTo(cpu.y, 10);
      expect(gpu.z).toBeCloseTo(cpu.z, 10);
    });

    it('X-only — single frame', () => {
      const { cpu, gpu } = compareSingleFrame(
        { x: 0, y: 1.5, z: 1 },
        2.0,
        0,
        0,
        0.016
      );
      expect(gpu.x).toBeCloseTo(cpu.x, 10);
      expect(gpu.y).toBeCloseTo(cpu.y, 10);
      expect(gpu.z).toBeCloseTo(cpu.z, 10);
    });

    it('Z-only (Flying Leaves config) — single frame', () => {
      const { cpu, gpu } = compareSingleFrame(
        { x: 1.5, y: 0.5, z: 0 },
        0,
        0,
        3.0,
        0.016
      );
      expect(gpu.x).toBeCloseTo(cpu.x, 10);
      expect(gpu.y).toBeCloseTo(cpu.y, 10);
      expect(gpu.z).toBeCloseTo(cpu.z, 10);
    });
  });

  // ── Multi-axis tests ───────────────────────────────────────────────────

  describe('multi-axis orbital velocity', () => {
    it('X + Y (Teleport config)', () => {
      const { cpu, gpu } = compareSingleFrame(
        { x: 1, y: 0.5, z: 0.8 },
        0.5,
        -1.5,
        0,
        0.016
      );
      expect(gpu.x).toBeCloseTo(cpu.x, 10);
      expect(gpu.y).toBeCloseTo(cpu.y, 10);
      expect(gpu.z).toBeCloseTo(cpu.z, 10);
    });

    it('X + Y + Z (Mystical Smoke config)', () => {
      const { cpu, gpu } = compareSingleFrame(
        { x: 0.8, y: 0.3, z: -0.5 },
        0.3,
        0.2,
        0.3,
        0.016
      );
      expect(gpu.x).toBeCloseTo(cpu.x, 10);
      expect(gpu.y).toBeCloseTo(cpu.y, 10);
      expect(gpu.z).toBeCloseTo(cpu.z, 10);
    });

    it('X + Y + Z — large angles (stress test)', () => {
      const { cpu, gpu } = compareSingleFrame(
        { x: 2, y: 1, z: 0.5 },
        3.0,
        5.0,
        2.0,
        0.1 // large delta → large rotation angles
      );
      expect(gpu.x).toBeCloseTo(cpu.x, 10);
      expect(gpu.y).toBeCloseTo(cpu.y, 10);
      expect(gpu.z).toBeCloseTo(cpu.z, 10);
    });

    it('negative speeds on all axes', () => {
      const { cpu, gpu } = compareSingleFrame(
        { x: 1.2, y: -0.7, z: 2.1 },
        -1.5,
        -2.0,
        -0.8,
        0.016
      );
      expect(gpu.x).toBeCloseTo(cpu.x, 10);
      expect(gpu.y).toBeCloseTo(cpu.y, 10);
      expect(gpu.z).toBeCloseTo(cpu.z, 10);
    });
  });

  // ── Accumulated multi-frame tests ──────────────────────────────────────

  describe('accumulated rotation over many frames', () => {
    it('Y-only — 200 frames (Magic Runes, ~3.2 seconds)', () => {
      const { cpu, gpu } = compareAccumulated(
        { x: 2, y: 0, z: 0.5 },
        0,
        1.0,
        0,
        0.016,
        200
      );
      expect(gpu.x).toBeCloseTo(cpu.x, 8);
      expect(gpu.y).toBeCloseTo(cpu.y, 8);
      expect(gpu.z).toBeCloseTo(cpu.z, 8);
    });

    it('X + Y + Z — 500 frames (Toxic Smoke, ~8 seconds)', () => {
      const { cpu, gpu } = compareAccumulated(
        { x: 1, y: 0.5, z: -0.3 },
        0.5,
        0.3,
        0.5,
        0.016,
        500
      );
      expect(gpu.x).toBeCloseTo(cpu.x, 6);
      expect(gpu.y).toBeCloseTo(cpu.y, 6);
      expect(gpu.z).toBeCloseTo(cpu.z, 6);
    });

    it('Z-only — 300 frames from diagonal offset', () => {
      const { cpu, gpu } = compareAccumulated(
        { x: 1.41, y: 0, z: 1.41 },
        0,
        0,
        3.0,
        0.016,
        300
      );
      expect(gpu.x).toBeCloseTo(cpu.x, 7);
      expect(gpu.y).toBeCloseTo(cpu.y, 7);
      expect(gpu.z).toBeCloseTo(cpu.z, 7);
    });

    it('all axes — 1000 frames (long-running stability)', () => {
      const { cpu, gpu } = compareAccumulated(
        { x: 2, y: 1, z: 0.5 },
        0.3,
        1.0,
        0.5,
        0.016,
        1000
      );
      expect(gpu.x).toBeCloseTo(cpu.x, 4);
      expect(gpu.y).toBeCloseTo(cpu.y, 4);
      expect(gpu.z).toBeCloseTo(cpu.z, 4);
    });
  });

  // ── Offset magnitude preservation ──────────────────────────────────────

  describe('rotation preserves offset magnitude', () => {
    it('single-axis preserves length', () => {
      const offset = { x: 2, y: 0, z: 0.5 };
      const origLen = Math.sqrt(offset.x ** 2 + offset.y ** 2 + offset.z ** 2);

      for (let f = 0; f < 100; f++) {
        applyOrbitalRotation(offset, 0, 1.0, 0, 0.016);
      }

      const newLen = Math.sqrt(offset.x ** 2 + offset.y ** 2 + offset.z ** 2);
      expect(newLen).toBeCloseTo(origLen, 10);
    });

    it('multi-axis preserves length', () => {
      const offset = { x: 1, y: 0.5, z: -0.3 };
      const origLen = Math.sqrt(offset.x ** 2 + offset.y ** 2 + offset.z ** 2);

      for (let f = 0; f < 500; f++) {
        applyOrbitalRotation(offset, 0.5, 0.3, 0.5, 0.016);
      }

      const newLen = Math.sqrt(offset.x ** 2 + offset.y ** 2 + offset.z ** 2);
      expect(newLen).toBeCloseTo(origLen, 10);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('zero speeds → no rotation', () => {
      const offset = { x: 2, y: 1, z: 0.5 };
      const original = { ...offset };
      applyOrbitalRotation(offset, 0, 0, 0, 0.016);

      expect(offset.x).toBe(original.x);
      expect(offset.y).toBe(original.y);
      expect(offset.z).toBe(original.z);
    });

    it('zero delta → no rotation', () => {
      const offset = { x: 2, y: 1, z: 0.5 };
      const original = { ...offset };
      applyOrbitalRotation(offset, 5, 3, 2, 0);

      expect(offset.x).toBe(original.x);
      expect(offset.y).toBe(original.y);
      expect(offset.z).toBe(original.z);
    });

    it('zero offset → stays at zero', () => {
      const offset = { x: 0, y: 0, z: 0 };
      applyOrbitalRotation(offset, 1, 2, 3, 0.016);

      expect(offset.x).toBe(0);
      expect(offset.y).toBe(0);
      expect(offset.z).toBe(0);
    });

    it('full revolution (2π) returns to start', () => {
      const offset = { x: 2, y: 0, z: 0 };
      // speedY=1, dt per frame → 2π / (1 * dt) frames for full revolution
      const framesForFullRev = Math.round((2 * Math.PI) / (1.0 * 0.001));
      for (let f = 0; f < framesForFullRev; f++) {
        applyOrbitalRotation(offset, 0, 1.0, 0, 0.001);
      }
      expect(offset.x).toBeCloseTo(2, 3);
      expect(offset.y).toBeCloseTo(0, 3);
      expect(offset.z).toBeCloseTo(0, 3);
    });
  });

  // ── Various starting offsets on CIRCLE emitter ─────────────────────────

  describe('CIRCLE emitter positions (XZ plane) with Y-only orbital', () => {
    // Magic Runes uses CIRCLE shape → particles spawn on XZ plane (y≈0)
    // orbital.y → Z-axis rotation (rotates in XY plane)
    const circlePositions = [
      { name: 'positive X', offset: { x: 2, y: 0, z: 0 } },
      { name: 'positive Z', offset: { x: 0, y: 0, z: 2 } },
      { name: 'negative X', offset: { x: -2, y: 0, z: 0 } },
      { name: 'negative Z', offset: { x: 0, y: 0, z: -2 } },
      { name: '45° XZ', offset: { x: 1.414, y: 0, z: 1.414 } },
      { name: '135° XZ', offset: { x: -1.414, y: 0, z: 1.414 } },
      { name: '225° XZ', offset: { x: -1.414, y: 0, z: -1.414 } },
      { name: '315° XZ', offset: { x: 1.414, y: 0, z: -1.414 } },
    ];

    for (const { name, offset } of circlePositions) {
      it(`${name}: matches CPU after 100 frames`, () => {
        const { cpu, gpu } = compareAccumulated(
          offset,
          0,
          1.0,
          0, // Y-only orbital
          0.016,
          100
        );
        expect(gpu.x).toBeCloseTo(cpu.x, 9);
        expect(gpu.y).toBeCloseTo(cpu.y, 9);
        expect(gpu.z).toBeCloseTo(cpu.z, 9);
      });
    }
  });
});
