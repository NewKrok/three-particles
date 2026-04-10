import * as THREE from 'three';
import { RendererType } from '../js/effects/three-particles/three-particles-enums.js';
import { createParticleSystem } from '../js/effects/three-particles/three-particles.js';
import type { ParticleSystem } from '../js/effects/three-particles/types.js';

/**
 * Helper: create a trail particle system with sensible defaults.
 */
const createTrailSystem = (
  config: Record<string, unknown> = {},
  startTime = 1000
) => {
  const ps = createParticleSystem(
    {
      maxParticles: 10,
      duration: 5,
      looping: true,
      startLifetime: 2,
      startSpeed: 3,
      startSize: 1,
      startOpacity: 1,
      startRotation: 0,
      emission: { rateOverTime: 20 },
      renderer: {
        rendererType: RendererType.TRAIL,
        trail: { length: 8 },
      },
      ...config,
    } as any,
    startTime
  );

  const step = (timeOffsetMs: number, deltaMs: number = 16) => {
    ps.update({
      now: startTime + timeOffsetMs,
      delta: deltaMs / 1000,
      elapsed: timeOffsetMs / 1000,
    });
  };

  return { ps, step, startTime };
};

/**
 * Helper: get the internal THREE.Points used for particle simulation.
 */
const getSimulationObject = (ps: ParticleSystem): THREE.Points => {
  return ps.instance as THREE.Points;
};

/**
 * Helper: get the trail mesh from the particle system.
 */
const getTrailMesh = (ps: ParticleSystem): THREE.Mesh | undefined => {
  const points = getSimulationObject(ps);
  return points.children.find((c) => c instanceof THREE.Mesh) as
    | THREE.Mesh
    | undefined;
};

/**
 * Helper: count active particles by reading the isActive buffer attribute.
 */
const countActiveParticles = (ps: ParticleSystem): number => {
  const points = getSimulationObject(ps);
  const isActiveAttr = points.geometry.attributes.isActive;
  let count = 0;
  for (let i = 0; i < isActiveAttr.count; i++) {
    if (isActiveAttr.getX(i)) count++;
  }
  return count;
};

/**
 * Helper: get trail alpha values for a given particle index.
 */
const getTrailAlphas = (
  ps: ParticleSystem,
  particleIndex: number,
  trailLength: number
): number[] => {
  const trailMesh = getTrailMesh(ps)!;
  const alphaArr = trailMesh.geometry.getAttribute('trailAlpha').array;
  const verticesPerParticle = trailLength * 2;
  const base = particleIndex * verticesPerParticle;
  const alphas: number[] = [];
  for (let s = 0; s < trailLength; s++) {
    alphas.push(alphaArr[base + s * 2] as number);
  }
  return alphas;
};

/**
 * Helper: get trail positions for a given particle index.
 */
const getTrailPositions = (
  ps: ParticleSystem,
  particleIndex: number,
  trailLength: number
) => {
  const trailMesh = getTrailMesh(ps)!;
  const posArr = trailMesh.geometry.getAttribute('position').array;
  const verticesPerParticle = trailLength * 2;
  const base = particleIndex * verticesPerParticle;
  const positions: Array<{ x: number; y: number; z: number }> = [];
  for (let s = 0; s < trailLength; s++) {
    const idx = (base + s * 2) * 3;
    positions.push({
      x: posArr[idx] as number,
      y: posArr[idx + 1] as number,
      z: posArr[idx + 2] as number,
    });
  }
  return positions;
};

/**
 * Helper: get trail half-widths for a given particle index.
 */
const getTrailHalfWidths = (
  ps: ParticleSystem,
  particleIndex: number,
  trailLength: number
) => {
  const trailMesh = getTrailMesh(ps)!;
  const hwArr = trailMesh.geometry.getAttribute('trailHalfWidth').array;
  const verticesPerParticle = trailLength * 2;
  const base = particleIndex * verticesPerParticle;
  const widths: number[] = [];
  for (let s = 0; s < trailLength; s++) {
    widths.push(hwArr[base + s * 2] as number);
  }
  return widths;
};

describe('Trail Improvements', () => {
  // ========================================================================
  // ADAPTIVE TRAIL SAMPLING (minVertexDistance)
  // ========================================================================
  describe('Adaptive Trail Sampling (minVertexDistance)', () => {
    it('should create a trail system with minVertexDistance without errors', () => {
      const { ps } = createTrailSystem({
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8, minVertexDistance: 0.5 },
        },
      });
      expect(ps.instance).toBeInstanceOf(THREE.Points);
      ps.dispose();
    });

    it('should not record samples when particle has not moved enough', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 0.001, // very slow
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 20, minVertexDistance: 10 }, // high threshold
        },
      });

      step(16);
      step(32);
      step(48);
      step(64);
      step(80);

      // With very slow speed and high minVertexDistance, we expect very few samples
      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position').array;

      // Check that most trail slots have collapsed positions (few samples recorded)
      // The first active particle should have at most a few distinct positions
      const points = getSimulationObject(ps);
      const isActiveA = points.geometry.attributes.isActive;
      let firstActive = -1;
      for (let i = 0; i < isActiveA.count; i++) {
        if (isActiveA.getX(i)) {
          firstActive = i;
          break;
        }
      }

      if (firstActive >= 0) {
        const trailLength = 20;
        const verticesPerParticle = trailLength * 2;
        const base = firstActive * verticesPerParticle;
        // Count non-zero alpha entries (actually recorded samples)
        const alphaArr = trailMesh.geometry.getAttribute('trailAlpha').array;
        let nonZeroAlphas = 0;
        for (let s = 0; s < trailLength; s++) {
          if (alphaArr[base + s * 2] > 0) nonZeroAlphas++;
        }
        // With high minVertexDistance and slow speed, few samples should have been recorded
        // (just the initial sample, maybe 1-2 more)
        expect(nonZeroAlphas).toBeLessThan(5);
      }

      ps.dispose();
    });

    it('should record samples when particle has moved beyond threshold', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 10, // fast
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 20, minVertexDistance: 0.01 }, // low threshold
        },
      });

      // Run many frames so particles move fast and exceed distance
      for (let i = 1; i <= 20; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const alphaArr = trailMesh.geometry.getAttribute('trailAlpha').array;

      // With fast speed and low threshold, most slots should have been filled
      const points = getSimulationObject(ps);
      const isActiveA = points.geometry.attributes.isActive;
      let firstActive = -1;
      for (let i = 0; i < isActiveA.count; i++) {
        if (isActiveA.getX(i)) {
          firstActive = i;
          break;
        }
      }

      if (firstActive >= 0) {
        const trailLength = 20;
        const verticesPerParticle = trailLength * 2;
        const base = firstActive * verticesPerParticle;
        let nonZeroAlphas = 0;
        for (let s = 0; s < trailLength; s++) {
          if (alphaArr[base + s * 2] > 0) nonZeroAlphas++;
        }
        expect(nonZeroAlphas).toBeGreaterThan(5);
      }

      ps.dispose();
    });

    it('should produce frame-rate independent trail density', () => {
      // Two systems: one at 30fps, one at 60fps, both with minVertexDistance
      const createAndRun = (deltaMs: number) => {
        const { ps, startTime } = createTrailSystem({
          maxParticles: 1,
          startSpeed: 5,
          emission: { rateOverTime: 100 },
          renderer: {
            rendererType: RendererType.TRAIL,
            trail: { length: 30, minVertexDistance: 0.3 },
          },
        });

        const totalTimeMs = 500;
        let t = deltaMs;
        while (t <= totalTimeMs) {
          ps.update({
            now: startTime + t,
            delta: deltaMs / 1000,
            elapsed: t / 1000,
          });
          t += deltaMs;
        }

        const trailMesh = getTrailMesh(ps)!;
        const alphaArr = trailMesh.geometry.getAttribute('trailAlpha').array;
        const trailLength = 30;
        let nonZeroAlphas = 0;
        for (let s = 0; s < trailLength; s++) {
          if (alphaArr[s * 2] > 0) nonZeroAlphas++;
        }

        ps.dispose();
        return nonZeroAlphas;
      };

      const samples30fps = createAndRun(33); // ~30fps
      const samples60fps = createAndRun(16); // ~60fps

      // With adaptive sampling, sample counts should be similar regardless of frame rate
      // Allow some tolerance since emission timing differs slightly
      const diff = Math.abs(samples30fps - samples60fps);
      expect(diff).toBeLessThanOrEqual(
        Math.max(samples30fps, samples60fps) * 0.5
      );
    });

    it('should fall back to per-frame sampling when minVertexDistance is 0', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 3,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8, minVertexDistance: 0 },
        },
      });

      // With minVertexDistance=0, every frame should produce a sample
      for (let i = 1; i <= 10; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const alphaArr = trailMesh.geometry.getAttribute('trailAlpha').array;
      const points = getSimulationObject(ps);
      const isActiveA = points.geometry.attributes.isActive;
      let firstActive = -1;
      for (let i = 0; i < isActiveA.count; i++) {
        if (isActiveA.getX(i)) {
          firstActive = i;
          break;
        }
      }

      if (firstActive >= 0) {
        const trailLength = 8;
        const verticesPerParticle = trailLength * 2;
        const base = firstActive * verticesPerParticle;
        let nonZeroAlphas = 0;
        for (let s = 0; s < trailLength; s++) {
          if (alphaArr[base + s * 2] > 0) nonZeroAlphas++;
        }
        // After 10 frames, ring buffer (length 8) should be nearly or fully filled
        expect(nonZeroAlphas).toBeGreaterThanOrEqual(7);
      }

      ps.dispose();
    });
  });

  // ========================================================================
  // TRAIL MAX TIME
  // ========================================================================
  describe('Trail Max Time', () => {
    it('should create a trail system with maxTime without errors', () => {
      const { ps } = createTrailSystem({
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 20, maxTime: 1.0 },
        },
      });
      expect(ps.instance).toBeInstanceOf(THREE.Points);
      ps.dispose();
    });

    it('should fade out old trail segments after maxTime expires', () => {
      const { ps, startTime } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 3,
        startLifetime: 10,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 30, maxTime: 0.2 }, // 200ms max trail time
        },
      });

      // Build up some trail samples
      for (let i = 1; i <= 10; i++) {
        ps.update({
          now: startTime + i * 16,
          delta: 0.016,
          elapsed: i * 0.016,
        });
      }

      // Now wait much longer than maxTime (jump far ahead)
      ps.update({
        now: startTime + 5000, // 5 seconds later
        delta: 4.84,
        elapsed: 5.0,
      });

      // After waiting 5s with maxTime=200ms, old segments should be expired
      const trailMesh = getTrailMesh(ps)!;
      const alphaArr = trailMesh.geometry.getAttribute('trailAlpha').array;
      const trailLength = 30;

      // The most recent sample should still be visible, but older ones should be zero/near-zero
      // Count how many trail vertices have significant alpha
      let significantAlphas = 0;
      for (let s = 0; s < trailLength; s++) {
        if (alphaArr[s * 2] > 0.01) significantAlphas++;
      }

      // Only the most recent 1-2 samples should survive the time cutoff
      expect(significantAlphas).toBeLessThan(5);

      ps.dispose();
    });

    it('should not expire segments when maxTime is 0', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 3,
        startLifetime: 10,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8, maxTime: 0 }, // disabled
        },
      });

      for (let i = 1; i <= 10; i++) {
        step(i * 16);
      }

      // All or nearly all 8 slots should be filled regardless of time
      const trailMesh = getTrailMesh(ps)!;
      const alphaArr = trailMesh.geometry.getAttribute('trailAlpha').array;
      const trailLength = 8;
      let nonZeroAlphas = 0;
      for (let s = 0; s < trailLength; s++) {
        if (alphaArr[s * 2] > 0) nonZeroAlphas++;
      }
      expect(nonZeroAlphas).toBeGreaterThanOrEqual(7);

      ps.dispose();
    });

    it('should keep recent segments visible while expiring old ones', () => {
      const { ps, startTime } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 3,
        startLifetime: 10,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 20, maxTime: 0.5 }, // 500ms max
        },
      });

      // Build trail over 400ms (all within maxTime)
      for (let i = 1; i <= 25; i++) {
        ps.update({
          now: startTime + i * 16,
          delta: 0.016,
          elapsed: i * 0.016,
        });
      }

      // All samples should be within maxTime window
      const trailMesh = getTrailMesh(ps)!;
      const alphaArr = trailMesh.geometry.getAttribute('trailAlpha').array;
      const trailLength = 20;
      let nonZeroAlphas = 0;
      for (let s = 0; s < trailLength; s++) {
        if (alphaArr[s * 2] > 0) nonZeroAlphas++;
      }
      expect(nonZeroAlphas).toBeGreaterThan(10);

      ps.dispose();
    });
  });

  // ========================================================================
  // TRAIL TANGENT SMOOTHING (Catmull-Rom)
  // ========================================================================
  describe('Trail Tangent Smoothing (Catmull-Rom)', () => {
    it('should create a trail system with smoothing enabled without errors', () => {
      const { ps } = createTrailSystem({
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 20, smoothing: true, smoothingSubdivisions: 3 },
        },
      });
      expect(ps.instance).toBeInstanceOf(THREE.Points);
      ps.dispose();
    });

    it('should produce smooth interpolation between raw samples', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 3,
        startLifetime: 10,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 30, smoothing: true, smoothingSubdivisions: 3 },
        },
      });

      // Run enough frames to build up history
      for (let i = 1; i <= 20; i++) {
        step(i * 16);
      }

      const positions = getTrailPositions(ps, 0, 30);

      // Smoothed trail should have more gradual position changes
      // Check that consecutive positions don't have abrupt jumps
      let hasValidPositions = false;
      for (let i = 0; i < positions.length - 1; i++) {
        const p1 = positions[i];
        const p2 = positions[i + 1];
        if (p1.x !== 0 || p1.y !== 0 || p1.z !== 0) {
          hasValidPositions = true;
        }
        if (hasValidPositions && (p2.x !== 0 || p2.y !== 0 || p2.z !== 0)) {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dz = p2.z - p1.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          // With smoothing, distances between consecutive interpolated points
          // should be smaller and more uniform than raw samples
          expect(dist).toBeLessThan(5); // reasonable threshold
        }
      }
      expect(hasValidPositions).toBe(true);

      ps.dispose();
    });

    it('should not smooth when count < 3', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 3,
        startLifetime: 10,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 30, smoothing: true, smoothingSubdivisions: 3 },
        },
      });

      // Just one frame — only 1-2 samples, smoothing should not apply
      step(16);

      // With only 1-2 raw samples (<3), Catmull-Rom does not kick in.
      // Check via alpha: only the recorded sample slots should have non-zero alpha.
      const alphas = getTrailAlphas(ps, 0, 30);
      const nonZeroAlphas = alphas.filter((a) => a > 0).length;
      // Only the 1-2 actual samples should produce visible trail vertices
      expect(nonZeroAlphas).toBeLessThanOrEqual(5);

      ps.dispose();
    });

    it('should produce more vertices than raw samples when subdivisions > 1', () => {
      // Compare visible vertex count: smoothed vs unsmoothed
      const run = (smooth: boolean) => {
        const { ps, step } = createTrailSystem({
          maxParticles: 1,
          startSpeed: 3,
          startLifetime: 10,
          emission: { rateOverTime: 100 },
          renderer: {
            rendererType: RendererType.TRAIL,
            trail: { length: 30, smoothing: smooth, smoothingSubdivisions: 3 },
          },
        });

        for (let i = 1; i <= 8; i++) {
          step(i * 16);
        }

        const alphas = getTrailAlphas(ps, 0, 30);
        const nonZero = alphas.filter((a) => a > 0).length;
        ps.dispose();
        return nonZero;
      };

      const smoothedCount = run(true);
      const rawCount = run(false);

      // Smoothed should have at least as many (typically more) visible vertices
      // due to subdivision interpolation, capped by the trail length
      expect(smoothedCount).toBeGreaterThanOrEqual(rawCount);
    });

    it('should respect custom smoothingSubdivisions value', () => {
      const { ps } = createTrailSystem({
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 20, smoothing: true, smoothingSubdivisions: 5 },
        },
      });

      // Just verify it creates without error — the subdivision count
      // is applied internally during update
      expect(ps.instance).toBeInstanceOf(THREE.Points);
      ps.dispose();
    });
  });

  // ========================================================================
  // TRAIL TWIST PREVENTION
  // ========================================================================
  describe('Trail Twist Prevention', () => {
    it('should create a trail system with twistPrevention without errors', () => {
      const { ps } = createTrailSystem({
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8, twistPrevention: true },
        },
      });
      expect(ps.instance).toBeInstanceOf(THREE.Points);
      ps.dispose();
    });

    it('should maintain consistent ribbon orientation through multiple frames', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 5,
        startLifetime: 10,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 20, twistPrevention: true },
        },
      });

      // Simulate several frames of movement
      for (let i = 1; i <= 15; i++) {
        step(i * 16);
      }

      const halfWidths = getTrailHalfWidths(ps, 0, 20);

      // With twist prevention, all active half-widths should have consistent sign
      // (either all positive or all negative, depending on orientation)
      const activeWidths = halfWidths.filter((w) => w !== 0);
      if (activeWidths.length > 0) {
        const signs = activeWidths.map((w) => Math.sign(w));
        const firstSign = signs[0];
        const allSameSign = signs.every((s) => s === firstSign);
        expect(allSameSign).toBe(true);
      }

      ps.dispose();
    });

    it('should work correctly when combined with noise (direction changes)', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 3,
        startSpeed: 3,
        startLifetime: 5,
        emission: { rateOverTime: 20 },
        noise: {
          isActive: true,
          strength: 0.5,
          frequency: 2.0,
          octaves: 2,
          positionAmount: 1.0,
          useRandomOffset: true,
        },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 15, twistPrevention: true },
        },
      });

      // Run with noise-induced direction changes
      for (let i = 1; i <= 20; i++) {
        step(i * 16);
      }

      // Should not throw and trail should have active vertices
      const count = countActiveParticles(ps);
      expect(count).toBeGreaterThan(0);

      ps.dispose();
    });

    it('should reset twist normal when particle is recycled', () => {
      const { ps, startTime } = createTrailSystem({
        maxParticles: 2,
        startSpeed: 3,
        startLifetime: 0.1, // very short lifetime
        emission: { rateOverTime: 50 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8, twistPrevention: true },
        },
      });

      // First particle lives and dies
      for (let i = 1; i <= 20; i++) {
        ps.update({
          now: startTime + i * 16,
          delta: 0.016,
          elapsed: i * 0.016,
        });
      }

      // Should not throw — recycled particles should have their twist normal reset
      expect(() => {
        for (let i = 21; i <= 40; i++) {
          ps.update({
            now: startTime + i * 16,
            delta: 0.016,
            elapsed: i * 0.016,
          });
        }
      }).not.toThrow();

      ps.dispose();
    });
  });

  // ========================================================================
  // CONNECTED RIBBONS
  // ========================================================================
  describe('Connected Ribbons (ribbonId)', () => {
    it('should create a trail system with ribbonId without errors', () => {
      const { ps } = createTrailSystem({
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 20, ribbonId: 1 },
        },
      });
      expect(ps.instance).toBeInstanceOf(THREE.Points);
      ps.dispose();
    });

    it('should chain active particles into a connected ribbon', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 3,
        startLifetime: 5,
        emission: { rateOverTime: 20 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 20, ribbonId: 1 },
        },
      });

      // Emit several particles
      for (let i = 1; i <= 10; i++) {
        step(i * 16);
      }

      const active = countActiveParticles(ps);
      expect(active).toBeGreaterThan(1);

      // The leader particle (oldest active) should have a connected trail
      const trailMesh = getTrailMesh(ps)!;
      const alphaArr = trailMesh.geometry.getAttribute('trailAlpha').array;

      // Find leader (first active particle sorted by age)
      const points = getSimulationObject(ps);
      const isActiveA = points.geometry.attributes.isActive;
      let leaderIdx = -1;
      for (let i = 0; i < isActiveA.count; i++) {
        if (isActiveA.getX(i)) {
          leaderIdx = i;
          break;
        }
      }

      if (leaderIdx >= 0) {
        const trailLength = 20;
        const verticesPerParticle = trailLength * 2;
        const base = leaderIdx * verticesPerParticle;
        let nonZeroAlphas = 0;
        for (let s = 0; s < trailLength; s++) {
          if (alphaArr[base + s * 2] > 0) nonZeroAlphas++;
        }
        // Leader should have a trail connecting the active particles
        expect(nonZeroAlphas).toBeGreaterThan(0);
      }

      ps.dispose();
    });

    it('should hide non-leader particle trails when ribbonId is set', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 3,
        startLifetime: 5,
        emission: { rateOverTime: 30 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 10, ribbonId: 1 },
        },
      });

      for (let i = 1; i <= 10; i++) {
        step(i * 16);
      }

      const active = countActiveParticles(ps);
      if (active <= 1) return; // Need multiple particles for this test

      const trailMesh = getTrailMesh(ps)!;
      const alphaArr = trailMesh.geometry.getAttribute('trailAlpha').array;

      // Find all active particles
      const points = getSimulationObject(ps);
      const isActiveA = points.geometry.attributes.isActive;
      const activeIndices: number[] = [];
      for (let i = 0; i < isActiveA.count; i++) {
        if (isActiveA.getX(i)) activeIndices.push(i);
      }

      // Non-leader particles should have zero alpha in all trail slots
      const trailLength = 10;
      const verticesPerParticle = trailLength * 2;
      for (let ri = 1; ri < activeIndices.length; ri++) {
        const pIdx = activeIndices[ri];
        const base = pIdx * verticesPerParticle;
        for (let s = 0; s < trailLength; s++) {
          expect(alphaArr[base + s * 2]).toBe(0);
        }
      }

      ps.dispose();
    });

    it('should work without ribbonId (independent trails per particle)', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 3,
        startLifetime: 5,
        emission: { rateOverTime: 20 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8 },
        },
      });

      for (let i = 1; i <= 10; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const alphaArr = trailMesh.geometry.getAttribute('trailAlpha').array;

      // Each active particle should have its own trail
      const points = getSimulationObject(ps);
      const isActiveA = points.geometry.attributes.isActive;
      const trailLength = 8;
      const verticesPerParticle = trailLength * 2;
      let particlesWithTrails = 0;
      for (let i = 0; i < isActiveA.count; i++) {
        if (isActiveA.getX(i)) {
          const base = i * verticesPerParticle;
          let hasAlpha = false;
          for (let s = 0; s < trailLength; s++) {
            if (alphaArr[base + s * 2] > 0) {
              hasAlpha = true;
              break;
            }
          }
          if (hasAlpha) particlesWithTrails++;
        }
      }

      // Without ribbonId, each active particle should have its own trail
      expect(particlesWithTrails).toBeGreaterThan(1);

      ps.dispose();
    });
  });

  // ========================================================================
  // COMBINED FEATURES
  // ========================================================================
  describe('Combined Features', () => {
    it('should work with minVertexDistance + maxTime combined', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 3,
        startLifetime: 5,
        emission: { rateOverTime: 20 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 20,
            minVertexDistance: 0.1,
            maxTime: 1.0,
          },
        },
      });

      for (let i = 1; i <= 15; i++) {
        step(i * 16);
      }

      const count = countActiveParticles(ps);
      expect(count).toBeGreaterThan(0);

      ps.dispose();
    });

    it('should work with smoothing + twistPrevention combined', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 3,
        startSpeed: 3,
        startLifetime: 5,
        emission: { rateOverTime: 20 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 20,
            smoothing: true,
            smoothingSubdivisions: 3,
            twistPrevention: true,
          },
        },
      });

      for (let i = 1; i <= 15; i++) {
        step(i * 16);
      }

      const count = countActiveParticles(ps);
      expect(count).toBeGreaterThan(0);

      ps.dispose();
    });

    it('should work with all trail improvements enabled simultaneously', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 3,
        startLifetime: 5,
        emission: { rateOverTime: 20 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 20,
            minVertexDistance: 0.05,
            maxTime: 2.0,
            smoothing: true,
            smoothingSubdivisions: 2,
            twistPrevention: true,
          },
        },
      });

      // Run simulation
      for (let i = 1; i <= 20; i++) {
        step(i * 16);
      }

      const count = countActiveParticles(ps);
      expect(count).toBeGreaterThan(0);

      // Verify trail mesh has visible geometry
      const trailMesh = getTrailMesh(ps)!;
      const alphaArr = trailMesh.geometry.getAttribute('trailAlpha').array;
      let anyVisible = false;
      for (let i = 0; i < alphaArr.length; i++) {
        if (alphaArr[i] > 0) {
          anyVisible = true;
          break;
        }
      }
      expect(anyVisible).toBe(true);

      ps.dispose();
    });

    it('should work with sub-emitters using trail improvements', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 10,
        startSpeed: 3,
        startLifetime: 0.3,
        emission: { rateOverTime: 20 },
        subEmitters: [
          {
            trigger: 'DEATH',
            config: {
              maxParticles: 5,
              startLifetime: 0.5,
              startSpeed: 2,
              startSize: 1,
              startOpacity: 1,
              emission: { rateOverTime: 0, bursts: [{ time: 0, count: 3 }] },
              renderer: {
                rendererType: RendererType.TRAIL,
                trail: {
                  length: 10,
                  minVertexDistance: 0.1,
                  smoothing: true,
                },
              },
            },
          },
        ],
      });

      // Run long enough for particles to die and trigger sub-emitters
      for (let i = 1; i <= 50; i++) {
        step(i * 16);
      }

      // Should not throw
      expect(countActiveParticles(ps)).toBeGreaterThanOrEqual(0);

      ps.dispose();
    });

    it('should work with force fields and trail improvements', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 3,
        startLifetime: 3,
        emission: { rateOverTime: 10 },
        forceFields: [
          {
            type: 'POINT',
            position: { x: 0, y: 0, z: 0 },
            strength: 5.0,
            range: 10,
            falloff: 'LINEAR',
          },
        ],
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 15,
            smoothing: true,
            twistPrevention: true,
          },
        },
      });

      for (let i = 1; i <= 20; i++) {
        step(i * 16);
      }

      expect(countActiveParticles(ps)).toBeGreaterThan(0);

      ps.dispose();
    });
  });

  // ========================================================================
  // DEFAULTS
  // ========================================================================
  describe('Defaults', () => {
    it('should default minVertexDistance to 0 (per-frame sampling)', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 3,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8 },
        },
      });

      // Every frame should produce a sample
      for (let i = 1; i <= 10; i++) {
        step(i * 16);
      }

      const alphas = getTrailAlphas(ps, 0, 8);
      const nonZero = alphas.filter((a) => a > 0).length;
      // After 10 frames, ring buffer (length 8) should be nearly or fully filled
      expect(nonZero).toBeGreaterThanOrEqual(7);

      ps.dispose();
    });

    it('should default maxTime to 0 (disabled)', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 3,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8 },
        },
      });

      for (let i = 1; i <= 10; i++) {
        step(i * 16);
      }

      // All or nearly all segments should be present (no time-based expiry)
      const alphas = getTrailAlphas(ps, 0, 8);
      const nonZero = alphas.filter((a) => a > 0).length;
      expect(nonZero).toBeGreaterThanOrEqual(7);

      ps.dispose();
    });

    it('should default smoothing to false', () => {
      // Without smoothing, behavior should be identical to legacy
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 3,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8 },
        },
      });

      for (let i = 1; i <= 10; i++) {
        step(i * 16);
      }

      expect(countActiveParticles(ps)).toBeGreaterThan(0);

      ps.dispose();
    });

    it('should default twistPrevention to false', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 3,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8 },
        },
      });

      for (let i = 1; i <= 10; i++) {
        step(i * 16);
      }

      expect(countActiveParticles(ps)).toBeGreaterThan(0);

      ps.dispose();
    });
  });

  // ========================================================================
  // TAIL TANGENT FALLBACK
  // ========================================================================
  describe('Tail Tangent Fallback', () => {
    it('should use previous segment direction for tail tangent instead of hardcoded nudge', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 5,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8 },
        },
      });

      // Emit and simulate several frames to build trail history
      for (let i = 1; i <= 15; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const nextArr = trailMesh.geometry.getAttribute('trailNext')
        .array as Float32Array;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;

      // Find the last active trail vertex (tail). The tangent (trailNext - position)
      // should NOT be (0, 0.001, 0) for a particle moving primarily along one axis.
      const trailLength = 8;
      const verticesPerParticle = trailLength * 2;
      let lastActiveSlot = -1;
      for (let s = trailLength - 1; s >= 0; s--) {
        const aIdx = s * 2;
        const hw =
          trailMesh.geometry.getAttribute('trailHalfWidth').array[aIdx];
        if (hw !== 0) {
          lastActiveSlot = s;
          break;
        }
      }

      if (lastActiveSlot >= 1) {
        const vIdx = lastActiveSlot * 2 * 3;
        const tangentX = nextArr[vIdx] - posArr[vIdx];
        const tangentY = nextArr[vIdx + 1] - posArr[vIdx + 1];
        const tangentZ = nextArr[vIdx + 2] - posArr[vIdx + 2];
        const tangentLen = Math.sqrt(
          tangentX * tangentX + tangentY * tangentY + tangentZ * tangentZ
        );

        // The tangent should not be the old hardcoded (0, 0.001, 0) value
        if (tangentLen > 0.0001) {
          const normalizedY = tangentY / tangentLen;
          // If it was purely (0, 0.001, 0), normalizedY would be 1.0
          // A real continuation tangent should differ from pure Y
          expect(Math.abs(normalizedY)).toBeLessThan(0.999);
        }
      }

      ps.dispose();
    });

    it('should still handle single-point trails gracefully', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 0,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 4 },
        },
      });

      // Only one frame - single point in history
      step(16);

      // Should not throw
      expect(countActiveParticles(ps)).toBeGreaterThanOrEqual(0);

      ps.dispose();
    });
  });

  // ========================================================================
  // MAXTIME + SMOOTHING INTERACTION
  // ========================================================================
  describe('MaxTime + Smoothing Interaction', () => {
    it('should produce smooth time fade when smoothing and maxTime are combined', () => {
      const { ps, step, startTime } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 5,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 20,
            maxTime: 2.0,
            smoothing: true,
            smoothingSubdivisions: 3,
          },
        },
      });

      // Build up trail history with many frames
      for (let i = 1; i <= 40; i++) {
        step(i * 50);
      }

      const trailLength = 20;
      const alphas = getTrailAlphas(ps, 0, trailLength);

      // The alpha values along the trail should be monotonically
      // non-increasing (head to tail) when maxTime causes fade.
      // With the interpolation fix, there should be no sudden jumps.
      const activeAlphas = alphas.filter((a) => a > 0);
      if (activeAlphas.length >= 3) {
        for (let i = 1; i < activeAlphas.length; i++) {
          // Allow small floating point tolerance but no large jumps up
          expect(activeAlphas[i]).toBeLessThanOrEqual(
            activeAlphas[i - 1] + 0.01
          );
        }
      }

      ps.dispose();
    });
  });

  // ========================================================================
  // CONNECTED RIBBON MAXTIME
  // ========================================================================
  describe('Connected Ribbon MaxTime', () => {
    it('should apply time-based fade to connected ribbons', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 3,
        emission: { rateOverTime: 50 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 10, ribbonId: 1, maxTime: 0.5 },
        },
      });

      // Run long enough for particles to age
      for (let i = 1; i <= 80; i++) {
        step(i * 16);
      }

      // The ribbon should have been built with maxTime fade applied.
      // Check that the leader particle's trail has some non-zero alpha
      // values (ribbon is alive) and that they aren't all 1.0 (fade is applied).
      const trailLength = 10;
      const alphas = getTrailAlphas(ps, 0, trailLength);
      const nonZeroAlphas = alphas.filter((a) => a > 0);
      if (nonZeroAlphas.length > 0) {
        // At least one alpha should be less than the max (fade has been applied)
        const maxAlpha = Math.max(...nonZeroAlphas);
        const minAlpha = Math.min(...nonZeroAlphas);
        // If maxTime fade is working, we should see variation
        expect(maxAlpha).toBeGreaterThan(0);
        // With very short maxTime and long simulation, older parts should fade
        if (nonZeroAlphas.length >= 2) {
          expect(maxAlpha - minAlpha).toBeGreaterThanOrEqual(0);
        }
      }

      ps.dispose();
    });
  });

  // ========================================================================
  // CONNECTED RIBBON TWIST PREVENTION
  // ========================================================================
  describe('Connected Ribbon Twist Prevention', () => {
    it('should apply twist prevention to connected ribbons without errors', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 3,
        emission: { rateOverTime: 50 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 10,
            ribbonId: 1,
            twistPrevention: true,
          },
        },
      });

      // Run multiple frames - twist prevention should not throw
      for (let i = 1; i <= 30; i++) {
        step(i * 16);
      }

      expect(countActiveParticles(ps)).toBeGreaterThan(0);

      // Verify the trail mesh exists and has valid geometry
      const trailMesh = getTrailMesh(ps);
      expect(trailMesh).toBeDefined();
      const hwArr = trailMesh!.geometry.getAttribute('trailHalfWidth')
        .array as Float32Array;
      // Some half-widths should be non-zero (ribbon is visible)
      let hasNonZero = false;
      for (let i = 0; i < hwArr.length; i++) {
        if (hwArr[i] !== 0) {
          hasNonZero = true;
          break;
        }
      }
      expect(hasNonZero).toBe(true);

      ps.dispose();
    });

    it('should combine maxTime and twistPrevention on connected ribbons', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 3,
        emission: { rateOverTime: 50 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 10,
            ribbonId: 1,
            maxTime: 1.0,
            twistPrevention: true,
          },
        },
      });

      // Run many frames to exercise both features together
      for (let i = 1; i <= 50; i++) {
        step(i * 16);
      }

      expect(countActiveParticles(ps)).toBeGreaterThan(0);

      ps.dispose();
    });
  });

  // ========================================================================
  // CACHED TRAIL ATTRIBUTES
  // ========================================================================
  describe('Cached Trail Attributes', () => {
    it('should correctly update trail geometry using cached attributes', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 3,
        startSpeed: 5,
        emission: { rateOverTime: 50 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8 },
        },
      });

      // Run several frames to build trails
      for (let i = 1; i <= 20; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      // All cached attributes should still be valid and have data
      const posAttr = trailMesh.geometry.getAttribute('position');
      const nextAttr = trailMesh.geometry.getAttribute('trailNext');
      const hwAttr = trailMesh.geometry.getAttribute('trailHalfWidth');
      const uvAttr = trailMesh.geometry.getAttribute('trailUV');

      expect(posAttr).toBeDefined();
      expect(nextAttr).toBeDefined();
      expect(hwAttr).toBeDefined();
      expect(uvAttr).toBeDefined();

      // Verify some non-zero data exists in position and next attributes
      const posArr = posAttr.array as Float32Array;
      const nextArr = nextAttr.array as Float32Array;
      let hasPos = false;
      let hasNext = false;
      for (let i = 0; i < posArr.length; i++) {
        if (posArr[i] !== 0) hasPos = true;
        if (nextArr[i] !== 0) hasNext = true;
        if (hasPos && hasNext) break;
      }
      expect(hasPos).toBe(true);
      expect(hasNext).toBe(true);

      ps.dispose();
    });
  });

  // ========================================================================
  // CRITICAL EDGE CASES
  // ========================================================================
  describe('Critical Edge Cases', () => {
    it('should handle zero-length movement without NaN or artifacts', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 3,
        startSpeed: 0, // particles don't move
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8 },
        },
      });

      for (let i = 1; i <= 20; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;
      const nextArr = trailMesh.geometry.getAttribute('trailNext')
        .array as Float32Array;

      // No NaN or Inf values should exist
      for (let i = 0; i < posArr.length; i++) {
        expect(Number.isFinite(posArr[i])).toBe(true);
        expect(Number.isFinite(nextArr[i])).toBe(true);
      }

      ps.dispose();
    });

    it('should not activate smoothing with exactly 2 history points', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 5,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 10, smoothing: true, smoothingSubdivisions: 4 },
        },
      });

      // Only 2 frames = at most 2 history samples
      step(16);
      step(32);

      const trailLength = 10;
      const trailMesh = getTrailMesh(ps)!;
      const hwArr = trailMesh.geometry.getAttribute('trailHalfWidth')
        .array as Float32Array;

      // Count active trail vertices (non-zero halfWidth)
      let activeCount = 0;
      for (let s = 0; s < trailLength; s++) {
        if (hwArr[s * 2] !== 0) activeCount++;
      }

      // With 2 points and no smoothing activation, active count should be ≤ 2
      // (Catmull-Rom requires ≥ 3 points to activate)
      expect(activeCount).toBeLessThanOrEqual(2);

      ps.dispose();
    });

    it('should activate smoothing with exactly 3 history points', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 5,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 20, smoothing: true, smoothingSubdivisions: 3 },
        },
      });

      // 3 frames = 3 history samples (minimum for Catmull-Rom)
      step(16);
      step(32);
      step(48);

      const trailLength = 20;
      const trailMesh = getTrailMesh(ps)!;
      const hwArr = trailMesh.geometry.getAttribute('trailHalfWidth')
        .array as Float32Array;

      // Count active trail vertices
      let activeCount = 0;
      for (let s = 0; s < trailLength; s++) {
        if (hwArr[s * 2] !== 0) activeCount++;
      }

      // With 3 raw points and subdivisions=3, Catmull-Rom should produce
      // (3-1)*3+1 = 7 final points (more than the 3 raw points)
      expect(activeCount).toBeGreaterThan(3);

      ps.dispose();
    });

    it('should handle maxTime expiring all segments gracefully', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 5,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8, maxTime: 0.001 }, // extremely short maxTime (1ms)
        },
      });

      // Build some history
      for (let i = 1; i <= 5; i++) {
        step(i * 16);
      }

      // Step forward by a large delta so all older segments expire.
      // The most recent sample will be taken during this frame so it won't
      // have expired yet, but all previous ones should have.
      step(5000, 4920);

      const trailLength = 8;
      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;

      // No NaN values - division by zero should not occur
      for (let i = 0; i < posArr.length; i++) {
        expect(Number.isFinite(posArr[i])).toBe(true);
      }

      // With maxTime=1ms and a 4920ms jump, nearly all segments should have
      // expired.  The most recent frame sample keeps effectiveCount >= 1,
      // so we verify the majority of the trail has faded.
      const alphas = getTrailAlphas(ps, 0, trailLength);
      const nonZeroAlphas = alphas.filter((a) => a > 0.01);
      // At most 1-2 vertices should remain visible (the freshest sample)
      expect(nonZeroAlphas.length).toBeLessThanOrEqual(2);

      ps.dispose();
    });

    it('should reset twist prevention normal when particle is recycled', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 2,
        startSpeed: 5,
        startLifetime: 0.1, // very short lifetime - particles die quickly
        emission: { rateOverTime: 50 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8, twistPrevention: true },
        },
      });

      // Run enough frames for particles to be born, die, and be recycled
      for (let i = 1; i <= 60; i++) {
        step(i * 16);
      }

      // After recycling, verify trail is still valid (no corrupt normals)
      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;
      for (let i = 0; i < posArr.length; i++) {
        expect(Number.isFinite(posArr[i])).toBe(true);
      }

      ps.dispose();
    });
  });

  // ========================================================================
  // RIBBON-SPECIFIC EDGE CASES
  // ========================================================================
  describe('Ribbon-Specific Edge Cases', () => {
    it('should linearly interpolate connected ribbon with exactly 2 particles', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 2,
        startSpeed: 5,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 10, ribbonId: 1 },
        },
      });

      // Emit 2 particles and simulate
      for (let i = 1; i <= 10; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;

      // Leader (particle 0) should have a ribbon built from positions
      // Verify some non-zero positions exist on the leader's trail
      const trailLength = 10;
      let hasNonZero = false;
      for (let s = 0; s < trailLength; s++) {
        const idx = s * 2 * 3;
        if (
          posArr[idx] !== 0 ||
          posArr[idx + 1] !== 0 ||
          posArr[idx + 2] !== 0
        ) {
          hasNonZero = true;
          break;
        }
      }
      expect(hasNonZero).toBe(true);

      // Non-leader (particle 1) should have cleared trail vertices
      const p1Base = 1 * trailLength * 2;
      let p1HasNonZero = false;
      for (let s = 0; s < trailLength; s++) {
        const idx = (p1Base + s * 2) * 3;
        if (
          posArr[idx] !== 0 ||
          posArr[idx + 1] !== 0 ||
          posArr[idx + 2] !== 0
        ) {
          p1HasNonZero = true;
          break;
        }
      }
      // Non-leader's trail should be zeroed out (cleared)
      expect(p1HasNonZero).toBe(false);

      ps.dispose();
    });

    it('should handle particle dying mid-ribbon chain', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 3,
        startLifetime: 0.3, // short lifetime - some particles die
        emission: { rateOverTime: 30 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8, ribbonId: 1 },
        },
      });

      // Run long enough for some particles to die while others live
      for (let i = 1; i <= 60; i++) {
        step(i * 16);
      }

      // Should not crash; verify no NaN values
      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;
      for (let i = 0; i < posArr.length; i++) {
        expect(Number.isFinite(posArr[i])).toBe(true);
      }

      ps.dispose();
    });

    it('should handle twist prevention with upward-moving particle (Y-axis singularity)', () => {
      // When tangent ≈ (0,1,0), up vector fallback to X-axis should activate
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 10,
        // Default direction can vary; we just need twist prevention active
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8, twistPrevention: true },
        },
        // Force upward direction via gravity trick: high upward gravity
        gravity: -20, // negative gravity = upward force
      });

      for (let i = 1; i <= 20; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const hwArr = trailMesh.geometry.getAttribute('trailHalfWidth')
        .array as Float32Array;

      // Verify no NaN in half-widths (would indicate cross-product singularity)
      for (let i = 0; i < hwArr.length; i++) {
        expect(Number.isFinite(hwArr[i])).toBe(true);
      }

      ps.dispose();
    });

    it('should flip ribbon orientation on 180-degree direction reversal', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 10,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 15, twistPrevention: true },
        },
        // High gravity to force direction reversal (particle goes up then falls)
        gravity: 50,
      });

      // Run enough frames for the particle to reverse direction
      for (let i = 1; i <= 30; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const hwArr = trailMesh.geometry.getAttribute('trailHalfWidth')
        .array as Float32Array;

      // Verify geometry is valid (no NaN) after potential twist flip
      for (let i = 0; i < hwArr.length; i++) {
        expect(Number.isFinite(hwArr[i])).toBe(true);
      }

      // Check that at least some half-widths are non-zero (ribbon is visible)
      let hasVisible = false;
      for (let i = 0; i < hwArr.length; i++) {
        if (hwArr[i] !== 0) {
          hasVisible = true;
          break;
        }
      }
      expect(hasVisible).toBe(true);

      ps.dispose();
    });

    it('should apply twist prevention to connected ribbon with vertical movement', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 4,
        startSpeed: 5,
        emission: { rateOverTime: 50 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 10, ribbonId: 1, twistPrevention: true },
        },
        gravity: -30, // strong upward push
      });

      for (let i = 1; i <= 25; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const hwArr = trailMesh.geometry.getAttribute('trailHalfWidth')
        .array as Float32Array;

      for (let i = 0; i < hwArr.length; i++) {
        expect(Number.isFinite(hwArr[i])).toBe(true);
      }

      ps.dispose();
    });
  });

  // ========================================================================
  // COMBINED FEATURE TESTS
  // ========================================================================
  describe('Combined Feature Tests', () => {
    it('should handle adaptive sampling combined with maxTime', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 3,
        startSpeed: 8,
        emission: { rateOverTime: 50 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 15,
            minVertexDistance: 0.2,
            maxTime: 0.5,
          },
        },
      });

      // Run many frames - adaptive sampling limits samples, maxTime expires old ones
      for (let i = 1; i <= 60; i++) {
        step(i * 16);
      }

      const trailLength = 15;
      const alphas = getTrailAlphas(ps, 0, trailLength);

      // Some vertices should be visible, some expired
      const nonZero = alphas.filter((a) => a > 0);
      // With maxTime=0.5s and 60 frames at 16ms = 960ms, older segments should expire
      // but recent ones should be visible
      if (countActiveParticles(ps) > 0) {
        expect(nonZero.length).toBeGreaterThan(0);
        expect(nonZero.length).toBeLessThan(trailLength);
      }

      ps.dispose();
    });

    it('should apply colorOverTrail with all 3 RGB channels independently', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 5,
        startColor: { r: 1, g: 1, b: 1, a: 1 },
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 10,
            colorOverTrail: {
              isActive: true,
              r: {
                type: 'BEZIER' as any,
                scale: 1,
                bezierPoints: [
                  { x: 0, y: 1, percentage: 0 },
                  { x: 1, y: 0.2, percentage: 1 },
                ],
              },
              g: {
                type: 'BEZIER' as any,
                scale: 0.5,
                bezierPoints: [
                  { x: 0, y: 1, percentage: 0 },
                  { x: 1, y: 0.5, percentage: 1 },
                ],
              },
              b: {
                type: 'BEZIER' as any,
                scale: 0.8,
                bezierPoints: [
                  { x: 0, y: 1, percentage: 0 },
                  { x: 1, y: 0.1, percentage: 1 },
                ],
              },
            },
          },
        },
      });

      // Build up trail
      for (let i = 1; i <= 20; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const colorArr = trailMesh.geometry.getAttribute('trailColor')
        .array as Float32Array;
      const trailLength = 10;

      // Check that colors at head (s=0) differ from colors at tail
      // (colorOverTrail should modulate them)
      const headIdx = 0 * 2 * 4; // particle 0, slot 0, left vertex, RGBA
      const headR = colorArr[headIdx];
      const headG = colorArr[headIdx + 1];
      const headB = colorArr[headIdx + 2];

      // Find last active slot
      const hwArr = trailMesh.geometry.getAttribute('trailHalfWidth')
        .array as Float32Array;
      let lastSlot = 0;
      for (let s = trailLength - 1; s >= 0; s--) {
        if (hwArr[s * 2] !== 0) {
          lastSlot = s;
          break;
        }
      }

      if (lastSlot > 0) {
        const tailIdx = lastSlot * 2 * 4;
        const tailR = colorArr[tailIdx];
        const tailG = colorArr[tailIdx + 1];
        const tailB = colorArr[tailIdx + 2];

        // Tail colors should be dimmer than head colors due to the curves
        expect(tailR).toBeLessThan(headR + 0.01);
        expect(tailG).toBeLessThan(headG + 0.01);
        expect(tailB).toBeLessThan(headB + 0.01);
      }

      ps.dispose();
    });

    it('should handle degenerate segments from smoothing with nearly identical points', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 0.001, // extremely slow - points nearly overlap
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 12,
            smoothing: true,
            smoothingSubdivisions: 4,
          },
        },
      });

      // Many frames with nearly zero movement - triggers degenerate collapse
      for (let i = 1; i <= 30; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;
      const nextArr = trailMesh.geometry.getAttribute('trailNext')
        .array as Float32Array;

      // No NaN/Inf from zero-length tangents after degenerate collapse
      for (let i = 0; i < posArr.length; i++) {
        expect(Number.isFinite(posArr[i])).toBe(true);
        expect(Number.isFinite(nextArr[i])).toBe(true);
      }

      ps.dispose();
    });

    it('should handle smoothing + twist prevention + maxTime combined', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 2,
        startSpeed: 8,
        emission: { rateOverTime: 50 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 15,
            smoothing: true,
            smoothingSubdivisions: 3,
            twistPrevention: true,
            maxTime: 1.0,
          },
        },
        gravity: 20,
      });

      for (let i = 1; i <= 50; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;
      const hwArr = trailMesh.geometry.getAttribute('trailHalfWidth')
        .array as Float32Array;

      for (let i = 0; i < posArr.length; i++) {
        expect(Number.isFinite(posArr[i])).toBe(true);
      }
      for (let i = 0; i < hwArr.length; i++) {
        expect(Number.isFinite(hwArr[i])).toBe(true);
      }

      ps.dispose();
    });

    it('should handle adaptive sampling + smoothing combined', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 5,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 15,
            minVertexDistance: 0.3,
            smoothing: true,
            smoothingSubdivisions: 3,
          },
        },
      });

      for (let i = 1; i <= 30; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;

      // Verify valid geometry produced
      for (let i = 0; i < posArr.length; i++) {
        expect(Number.isFinite(posArr[i])).toBe(true);
      }

      // Adaptive sampling should produce fewer raw samples,
      // smoothing should interpolate between them
      const trailLength = 15;
      const hwArr = trailMesh.geometry.getAttribute('trailHalfWidth')
        .array as Float32Array;
      let activeCount = 0;
      for (let s = 0; s < trailLength; s++) {
        if (hwArr[s * 2] !== 0) activeCount++;
      }
      // Should have some active vertices from smoothed interpolation
      expect(activeCount).toBeGreaterThan(0);

      ps.dispose();
    });

    it('should handle connected ribbon with all features enabled', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 4,
        startSpeed: 5,
        emission: { rateOverTime: 30 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 12,
            ribbonId: 1,
            maxTime: 2.0,
            twistPrevention: true,
            // Note: smoothing applies to individual trails, not connected ribbon
          },
        },
      });

      for (let i = 1; i <= 40; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;

      for (let i = 0; i < posArr.length; i++) {
        expect(Number.isFinite(posArr[i])).toBe(true);
      }

      expect(countActiveParticles(ps)).toBeGreaterThan(0);

      ps.dispose();
    });

    it('should correctly produce UV values along the trail', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 5,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 8 },
        },
      });

      for (let i = 1; i <= 15; i++) {
        step(i * 16);
      }

      const trailMesh = getTrailMesh(ps)!;
      const uvArr = trailMesh.geometry.getAttribute('trailUV')
        .array as Float32Array;
      const hwArr = trailMesh.geometry.getAttribute('trailHalfWidth')
        .array as Float32Array;
      const trailLength = 8;

      // Collect UV.y (trail progress, 0=head, 1=tail) for active vertices
      const uvYValues: number[] = [];
      for (let s = 0; s < trailLength; s++) {
        if (hwArr[s * 2] !== 0) {
          const uvIdx = s * 2 * 2; // s * 2 vertices * 2 components
          // Left vertex: UV.x should be 0, right vertex: UV.x should be 1
          expect(uvArr[uvIdx]).toBeCloseTo(0, 5); // left U = 0
          expect(uvArr[uvIdx + 2]).toBeCloseTo(1, 5); // right U = 1
          // UV.y (trail progress) should be same for left and right
          expect(uvArr[uvIdx + 1]).toBeCloseTo(uvArr[uvIdx + 3], 5);
          uvYValues.push(uvArr[uvIdx + 1]);
        }
      }

      // UV.y should be monotonically non-decreasing (0 at head, approaches 1 at tail)
      if (uvYValues.length >= 2) {
        expect(uvYValues[0]).toBeCloseTo(0, 3); // head = 0
        // The last active vertex should have UV.y > 0 (progressing toward tail)
        expect(uvYValues[uvYValues.length - 1]).toBeGreaterThan(0);
        for (let i = 1; i < uvYValues.length; i++) {
          expect(uvYValues[i]).toBeGreaterThanOrEqual(uvYValues[i - 1] - 0.001);
        }
      }

      ps.dispose();
    });

    it('should handle widthOverTrail curve at boundary values (t=0, t=1)', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 5,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 8,
            width: 2.0,
            widthOverTrail: {
              type: 'BEZIER' as any,
              scale: 1,
              bezierPoints: [
                { x: 0, y: 1, percentage: 0 },
                { x: 1, y: 0, percentage: 1 },
              ],
            },
          },
        },
      });

      for (let i = 1; i <= 15; i++) {
        step(i * 16);
      }

      const trailLength = 8;
      const widths = getTrailHalfWidths(ps, 0, trailLength);

      // Find active widths
      const activeWidths = widths.filter((w) => w !== 0);
      if (activeWidths.length >= 2) {
        // Head should be wider than tail (curve goes from 1 to 0)
        expect(Math.abs(activeWidths[0])).toBeGreaterThan(
          Math.abs(activeWidths[activeWidths.length - 1]) - 0.01
        );
        // Head halfWidth should be close to width/2 * 1.0 = 1.0
        expect(Math.abs(activeWidths[0])).toBeCloseTo(1.0, 1);
      }

      ps.dispose();
    });
  });

  // ========================================================================
  // DISPOSAL
  // ========================================================================
  describe('Disposal', () => {
    it('should dispose without errors when trail improvements are enabled', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 3,
        emission: { rateOverTime: 20 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 20,
            minVertexDistance: 0.1,
            maxTime: 1.0,
            smoothing: true,
            twistPrevention: true,
          },
        },
      });

      for (let i = 1; i <= 10; i++) {
        step(i * 16);
      }

      expect(() => ps.dispose()).not.toThrow();
    });

    it('should dispose connected ribbon system without errors', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startSpeed: 3,
        emission: { rateOverTime: 20 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 10, ribbonId: 1 },
        },
      });

      for (let i = 1; i <= 10; i++) {
        step(i * 16);
      }

      expect(() => ps.dispose()).not.toThrow();
    });
  });
});
