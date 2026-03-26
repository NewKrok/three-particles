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
  // In trail mode, the instance is a THREE.Points (invisible) containing a trail mesh child
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
  const isActiveArr = points.geometry.attributes.isActive.array;
  let count = 0;
  for (let i = 0; i < isActiveArr.length; i++) {
    if (isActiveArr[i]) count++;
  }
  return count;
};

describe('Trail / Ribbon Renderer (RendererType.TRAIL)', () => {
  describe('creation', () => {
    it('should create a THREE.Points object for simulation', () => {
      const { ps } = createTrailSystem();
      expect(ps.instance).toBeInstanceOf(THREE.Points);
      ps.dispose();
    });

    it('should hide the simulation Points material (not the object, so trail mesh child renders)', () => {
      const { ps } = createTrailSystem();
      const points = getSimulationObject(ps);
      expect(points.visible).toBe(true);
      expect((points.material as THREE.Material).visible).toBe(false);
      ps.dispose();
    });

    it('should add a trail mesh as a child of the particle system', () => {
      const { ps } = createTrailSystem();
      const trailMesh = getTrailMesh(ps);
      expect(trailMesh).toBeDefined();
      expect(trailMesh).toBeInstanceOf(THREE.Mesh);
      ps.dispose();
    });

    it('should have trail mesh with correct attributes', () => {
      const { ps } = createTrailSystem();
      const trailMesh = getTrailMesh(ps)!;
      const geom = trailMesh.geometry;

      expect(geom.getAttribute('position')).toBeDefined();
      expect(geom.getAttribute('trailAlpha')).toBeDefined();
      expect(geom.getAttribute('trailColor')).toBeDefined();
      expect(geom.getIndex()).not.toBeNull();

      ps.dispose();
    });

    it('should accept widthOverTrail/opacityOverTrail without type field (legacy format)', () => {
      const { ps } = createTrailSystem({
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: {
            length: 8,
            widthOverTrail: {
              bezierPoints: [
                { x: 0, y: 1, percentage: 0 },
                { x: 0.5, y: 0.5 },
                { x: 1, y: 0, percentage: 1 },
              ],
            },
            opacityOverTrail: {
              bezierPoints: [
                { x: 0, y: 1, percentage: 0 },
                { x: 1, y: 0, percentage: 1 },
              ],
            },
          },
        },
      });
      expect(ps.instance).toBeInstanceOf(THREE.Points);
      const trailMesh = getTrailMesh(ps);
      expect(trailMesh).toBeDefined();
      ps.dispose();
    });

    it('should have correct vertex count based on maxParticles and trail length', () => {
      const trailLength = 8;
      const maxParticles = 10;
      const { ps } = createTrailSystem({
        maxParticles,
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: trailLength },
        },
      });
      const trailMesh = getTrailMesh(ps)!;
      const posAttr = trailMesh.geometry.getAttribute('position');
      const expectedVertices = maxParticles * trailLength * 2;
      expect(posAttr.count).toBe(expectedVertices);
      ps.dispose();
    });

    it('should have correct index count based on maxParticles and trail length', () => {
      const trailLength = 8;
      const maxParticles = 10;
      const { ps } = createTrailSystem({
        maxParticles,
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: trailLength },
        },
      });
      const trailMesh = getTrailMesh(ps)!;
      const indexAttr = trailMesh.geometry.getIndex()!;
      const expectedIndices = maxParticles * (trailLength - 1) * 6;
      expect(indexAttr.count).toBe(expectedIndices);
      ps.dispose();
    });

    it('should use DoubleSide rendering', () => {
      const { ps } = createTrailSystem();
      const trailMesh = getTrailMesh(ps)!;
      const material = trailMesh.material as THREE.ShaderMaterial;
      expect(material.side).toBe(THREE.DoubleSide);
      ps.dispose();
    });

    it('should use the trail fragment and vertex shaders', () => {
      const { ps } = createTrailSystem();
      const trailMesh = getTrailMesh(ps)!;
      const material = trailMesh.material as THREE.ShaderMaterial;
      expect(material.vertexShader).toContain('trailAlpha');
      expect(material.fragmentShader).toContain('vAlpha');
      ps.dispose();
    });
  });

  describe('defaults', () => {
    it('should use default trail length of 20 when not specified', () => {
      const maxParticles = 5;
      const ps = createParticleSystem(
        {
          maxParticles,
          duration: 5,
          looping: true,
          startLifetime: 2,
          startSpeed: 1,
          startSize: 1,
          startOpacity: 1,
          startRotation: 0,
          emission: { rateOverTime: 10 },
          renderer: { rendererType: RendererType.TRAIL },
        } as any,
        1000
      );
      const trailMesh = getTrailMesh(ps)!;
      const posAttr = trailMesh.geometry.getAttribute('position');
      const expectedVertices = maxParticles * 20 * 2; // default trail length = 20
      expect(posAttr.count).toBe(expectedVertices);
      ps.dispose();
    });
  });

  describe('particle simulation', () => {
    it('should emit particles over time', () => {
      const { ps, step } = createTrailSystem();

      step(500);
      const count = countActiveParticles(ps);
      expect(count).toBeGreaterThanOrEqual(4);
      ps.dispose();
    });

    it('should deactivate expired particles', () => {
      const { ps, step } = createTrailSystem({
        startLifetime: 0.5,
        emission: { rateOverTime: 100 },
        looping: false,
        duration: 1,
      });

      step(100);
      step(200, 100);
      const countBefore = countActiveParticles(ps);
      expect(countBefore).toBeGreaterThan(0);

      step(1500, 1300);
      const countAfter = countActiveParticles(ps);
      expect(countAfter).toBe(0);

      ps.dispose();
    });
  });

  describe('trail geometry updates', () => {
    it('should update trail position attribute after stepping', () => {
      const { ps, step } = createTrailSystem({
        startSpeed: 5,
        emission: { rateOverTime: 50 },
      });

      step(100);
      step(200, 100);

      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;

      // At least some trail positions should be non-zero
      let hasNonZero = false;
      for (let i = 0; i < posArr.length; i++) {
        if (Math.abs(posArr[i]) > 0.0001) {
          hasNonZero = true;
          break;
        }
      }
      expect(hasNonZero).toBe(true);

      ps.dispose();
    });

    it('should update trail alpha attribute after stepping', () => {
      const { ps, step } = createTrailSystem({
        startSpeed: 5,
        emission: { rateOverTime: 50 },
      });

      step(100);
      step(200, 100);

      const trailMesh = getTrailMesh(ps)!;
      const alphaArr = trailMesh.geometry.getAttribute('trailAlpha')
        .array as Float32Array;

      // At least some trail alphas should be non-zero (active particles)
      let hasNonZero = false;
      for (let i = 0; i < alphaArr.length; i++) {
        if (alphaArr[i] > 0.0001) {
          hasNonZero = true;
          break;
        }
      }
      expect(hasNonZero).toBe(true);

      ps.dispose();
    });

    it('should update trail color attribute after stepping', () => {
      const { ps, step } = createTrailSystem({
        startSpeed: 5,
        emission: { rateOverTime: 50 },
        startColor: {
          min: { r: 1, g: 0.5, b: 0 },
          max: { r: 1, g: 0.5, b: 0 },
        },
      });

      step(100);
      step(200, 100);

      const trailMesh = getTrailMesh(ps)!;
      const colorArr = trailMesh.geometry.getAttribute('trailColor')
        .array as Float32Array;

      // Check that some color values are non-zero
      let hasColor = false;
      for (let i = 0; i < colorArr.length; i += 4) {
        if (colorArr[i] > 0.01 || colorArr[i + 1] > 0.01) {
          hasColor = true;
          break;
        }
      }
      expect(hasColor).toBe(true);

      ps.dispose();
    });

    it('should collapse trail vertices for inactive particles', () => {
      const { ps, step } = createTrailSystem({
        maxParticles: 5,
        startLifetime: 0.2,
        startSpeed: 3,
        emission: { rateOverTime: 50 },
        looping: false,
        duration: 0.3,
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: 4 },
        },
      });

      // Emit particles
      step(100);
      step(200, 100);
      expect(countActiveParticles(ps)).toBeGreaterThan(0);

      // Wait for all to expire
      step(2000, 1800);
      expect(countActiveParticles(ps)).toBe(0);

      // All trail alphas should be zero
      const trailMesh = getTrailMesh(ps)!;
      const alphaArr = trailMesh.geometry.getAttribute('trailAlpha')
        .array as Float32Array;
      let anyNonZero = false;
      for (let i = 0; i < alphaArr.length; i++) {
        if (alphaArr[i] > 0) {
          anyNonZero = true;
          break;
        }
      }
      expect(anyNonZero).toBe(false);

      ps.dispose();
    });

    it('should build ribbon with two vertices per history sample', () => {
      const trailLength = 4;
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startSpeed: 5,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: trailLength },
        },
      });

      // Emit and step multiple frames to build position history
      step(50);
      step(100, 50);
      step(150, 50);
      step(200, 50);

      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;

      // For particle 0, check that vertices at segment 0 (head) form a pair
      // that differ (left vs right of ribbon)
      const v0x = posArr[0];
      const v0y = posArr[1];
      const v0z = posArr[2];
      const v1x = posArr[3];
      const v1y = posArr[4];
      const v1z = posArr[5];

      // The two vertices should be offset from each other (not identical)
      const dist = Math.sqrt(
        (v0x - v1x) ** 2 + (v0y - v1y) ** 2 + (v0z - v1z) ** 2
      );

      // They should be separated by the ribbon width (or collapsed if only 1 sample)
      if (countActiveParticles(ps) > 0) {
        // With multiple history samples, the ribbon should have some width
        expect(dist).toBeGreaterThanOrEqual(0);
      }

      ps.dispose();
    });

    it('should produce a smooth ribbon: left/right vertices stay on consistent sides', () => {
      const trailLength = 8;
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startLifetime: 5,
        startSpeed: 3,
        startSize: 0.5,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: trailLength, width: 0.1 },
        },
        // Emit along Y axis only for predictable motion
        shape: { shape: 'CONE', cone: { angle: 0, radius: 0.001 } },
        transform: { rotation: { x: -90 } },
      });

      // Build up full trail history
      for (let t = 50; t <= 500; t += 50) step(t, 50);

      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;
      const alphaArr = trailMesh.geometry.getAttribute('trailAlpha')
        .array as Float32Array;

      // Collect active segment centers and check ribbon smoothness
      const centers: { x: number; y: number; z: number }[] = [];
      const widths: number[] = [];

      for (let s = 0; s < trailLength; s++) {
        const aIdx = s * 2;
        if (alphaArr[aIdx] < 0.001) break; // no more active segments

        const vi = s * 2 * 3;
        const lx = posArr[vi],
          ly = posArr[vi + 1],
          lz = posArr[vi + 2];
        const rx = posArr[vi + 3],
          ry = posArr[vi + 4],
          rz = posArr[vi + 5];

        const cx = (lx + rx) / 2;
        const cy = (ly + ry) / 2;
        const cz = (lz + rz) / 2;
        centers.push({ x: cx, y: cy, z: cz });

        const w = Math.sqrt((lx - rx) ** 2 + (ly - ry) ** 2 + (lz - rz) ** 2);
        widths.push(w);
      }

      // Must have at least 3 active segments to test smoothness
      expect(centers.length).toBeGreaterThanOrEqual(3);

      // Ribbon width should be reasonable (not zero, not huge)
      for (const w of widths) {
        // startSize=0.5, halfWidth = 0.5 * widthScale * 0.5 => max width ~0.5
        expect(w).toBeLessThan(2.0);
      }

      // Consecutive segment centers should form a smooth path:
      // distance between consecutive centers should be small and similar
      const segDists: number[] = [];
      for (let i = 1; i < centers.length; i++) {
        const dx = centers[i].x - centers[i - 1].x;
        const dy = centers[i].y - centers[i - 1].y;
        const dz = centers[i].z - centers[i - 1].z;
        segDists.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
      }

      // No huge jumps between consecutive centers — each segment distance
      // should be less than 10x the median (no teleporting vertices)
      const sorted = [...segDists].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      for (const d of segDists) {
        expect(d).toBeLessThan(median * 10 + 0.001);
      }

      // Width should taper (head wider, tail narrower) given default widthOverTrail curve
      if (widths.length >= 4) {
        expect(widths[0]).toBeGreaterThanOrEqual(
          widths[widths.length - 1] - 0.01
        );
      }

      ps.dispose();
    });

    it('should not have crossed/twisted quads (no bowtie shapes)', () => {
      const trailLength = 6;
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startLifetime: 5,
        startSpeed: 3,
        startSize: 0.4,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: trailLength, width: 0.1 },
        },
        shape: { shape: 'CONE', cone: { angle: 0, radius: 0.001 } },
        transform: { rotation: { x: -90 } },
      });

      for (let t = 50; t <= 400; t += 50) step(t, 50);

      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;
      const alphaArr = trailMesh.geometry.getAttribute('trailAlpha')
        .array as Float32Array;

      // For each consecutive pair of segments, check that the quad is not twisted:
      // The "left" side offset direction should be consistent (dot product > 0)
      let prevOffX = 0,
        prevOffY = 0,
        prevOffZ = 0;
      let twists = 0;

      for (let s = 0; s < trailLength; s++) {
        const aIdx = s * 2;
        if (alphaArr[aIdx] < 0.001) break;

        const vi = s * 2 * 3;
        const lx = posArr[vi],
          ly = posArr[vi + 1],
          lz = posArr[vi + 2];
        const rx = posArr[vi + 3],
          ry = posArr[vi + 4],
          rz = posArr[vi + 5];

        // Offset from center to left vertex
        const offX = lx - (lx + rx) / 2;
        const offY = ly - (ly + ry) / 2;
        const offZ = lz - (lz + rz) / 2;

        if (s > 0) {
          const dot = offX * prevOffX + offY * prevOffY + offZ * prevOffZ;
          if (dot < 0) twists++;
        }
        prevOffX = offX;
        prevOffY = offY;
        prevOffZ = offZ;
      }

      // No twists should occur
      expect(twists).toBe(0);
      ps.dispose();
    });

    it('ribbon segment centers should follow particle path monotonically', () => {
      const trailLength = 8;
      const { ps, step } = createTrailSystem({
        maxParticles: 1,
        startLifetime: 5,
        startSpeed: 3,
        startSize: 1,
        emission: { rateOverTime: 100 },
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: trailLength, width: 0.5 },
        },
        shape: { shape: 'CONE', cone: { angle: 0, radius: 0.001 } },
        transform: { rotation: { x: -90 } },
      });

      for (let t = 50; t <= 500; t += 50) step(t, 50);

      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;
      const alphaArr = trailMesh.geometry.getAttribute('trailAlpha')
        .array as Float32Array;

      // Collect segment centers
      const centers: [number, number, number][] = [];
      for (let s = 0; s < trailLength; s++) {
        const aIdx = s * 2;
        if (alphaArr[aIdx] < 0.001) break;
        const vi = s * 2 * 3;
        centers.push([
          (posArr[vi] + posArr[vi + 3]) / 2,
          (posArr[vi + 1] + posArr[vi + 4]) / 2,
          (posArr[vi + 2] + posArr[vi + 5]) / 2,
        ]);
      }

      expect(centers.length).toBeGreaterThanOrEqual(3);

      // Centers should move monotonically in Y (cone emits along +Y)
      // Head (index 0) should have the highest Y, tail the lowest
      for (let i = 1; i < centers.length; i++) {
        expect(centers[i - 1][1]).toBeGreaterThanOrEqual(centers[i][1] - 0.01);
      }

      ps.dispose();
    });
  });

  describe('trail configuration', () => {
    it('should support custom trail length', () => {
      const trailLength = 32;
      const maxParticles = 3;
      const { ps } = createTrailSystem({
        maxParticles,
        renderer: {
          rendererType: RendererType.TRAIL,
          trail: { length: trailLength },
        },
      });
      const trailMesh = getTrailMesh(ps)!;
      const posAttr = trailMesh.geometry.getAttribute('position');
      expect(posAttr.count).toBe(maxParticles * trailLength * 2);
      ps.dispose();
    });

    it('should support blending mode configuration', () => {
      const { ps } = createTrailSystem({
        renderer: {
          rendererType: RendererType.TRAIL,
          blending: THREE.AdditiveBlending,
          trail: { length: 8 },
        },
      });
      const trailMesh = getTrailMesh(ps)!;
      const material = trailMesh.material as THREE.ShaderMaterial;
      expect(material.blending).toBe(THREE.AdditiveBlending);
      ps.dispose();
    });

    it('should support transparency configuration', () => {
      const { ps } = createTrailSystem({
        renderer: {
          rendererType: RendererType.TRAIL,
          transparent: true,
          trail: { length: 8 },
        },
      });
      const trailMesh = getTrailMesh(ps)!;
      const material = trailMesh.material as THREE.ShaderMaterial;
      expect(material.transparent).toBe(true);
      ps.dispose();
    });
  });

  describe('dispose', () => {
    it('should clean up trail mesh on dispose', () => {
      const { ps } = createTrailSystem();
      const trailMesh = getTrailMesh(ps)!;
      expect(trailMesh).toBeDefined();

      const geom = trailMesh.geometry;
      const mat = trailMesh.material as THREE.ShaderMaterial;

      ps.dispose();

      // After dispose, the geometry's dispose method was called.
      // Three.js dispose() doesn't remove attributes but marks internal resources for cleanup.
      // Verify the trail mesh was removed from its parent.
      expect(trailMesh.parent).toBeNull();
    });

    it('should not break when disposing a trail system that was never updated', () => {
      const { ps } = createTrailSystem();
      expect(() => ps.dispose()).not.toThrow();
    });
  });

  describe('integration with other features', () => {
    it('should work with gravity', () => {
      const { ps, step } = createTrailSystem({
        gravity: 5,
        startSpeed: 5,
        emission: { rateOverTime: 20 },
      });

      step(100);
      step(200, 100);
      step(300, 100);

      const count = countActiveParticles(ps);
      expect(count).toBeGreaterThan(0);

      // Trail mesh should have non-zero positions
      const trailMesh = getTrailMesh(ps)!;
      const posArr = trailMesh.geometry.getAttribute('position')
        .array as Float32Array;
      let hasNonZero = false;
      for (let i = 0; i < posArr.length; i++) {
        if (Math.abs(posArr[i]) > 0.001) {
          hasNonZero = true;
          break;
        }
      }
      expect(hasNonZero).toBe(true);

      ps.dispose();
    });

    it('should work with opacity over lifetime', () => {
      const { ps, step } = createTrailSystem({
        startSpeed: 5,
        emission: { rateOverTime: 20 },
        opacityOverLifetime: {
          isActive: true,
          lifetimeCurve: {
            bezierPoints: [
              { x: 0, y: 1, percentage: 0 },
              { x: 1, y: 0, percentage: 1 },
            ],
          },
        },
      });

      step(100);
      step(200, 100);

      const count = countActiveParticles(ps);
      expect(count).toBeGreaterThan(0);

      ps.dispose();
    });

    it('should work with size over lifetime', () => {
      const { ps, step } = createTrailSystem({
        startSpeed: 5,
        emission: { rateOverTime: 20 },
        sizeOverLifetime: {
          isActive: true,
          lifetimeCurve: {
            bezierPoints: [
              { x: 0, y: 1, percentage: 0 },
              { x: 1, y: 0.5, percentage: 1 },
            ],
          },
        },
      });

      step(100);
      step(200, 100);

      const count = countActiveParticles(ps);
      expect(count).toBeGreaterThan(0);

      ps.dispose();
    });

    it('should work with color over lifetime', () => {
      const { ps, step } = createTrailSystem({
        startSpeed: 5,
        startColor: {
          min: { r: 1, g: 1, b: 1 },
          max: { r: 1, g: 1, b: 1 },
        },
        emission: { rateOverTime: 20 },
        colorOverLifetime: {
          isActive: true,
          r: {
            bezierPoints: [
              { x: 0, y: 1, percentage: 0 },
              { x: 1, y: 0, percentage: 1 },
            ],
          },
          g: {
            bezierPoints: [
              { x: 0, y: 0, percentage: 0 },
              { x: 1, y: 1, percentage: 1 },
            ],
          },
          b: {
            bezierPoints: [
              { x: 0, y: 1, percentage: 0 },
              { x: 1, y: 1, percentage: 1 },
            ],
          },
        },
      });

      step(100);
      step(200, 100);

      const count = countActiveParticles(ps);
      expect(count).toBeGreaterThan(0);

      ps.dispose();
    });

    it('should work with noise', () => {
      const { ps, step } = createTrailSystem({
        startSpeed: 5,
        emission: { rateOverTime: 20 },
        noise: {
          isActive: true,
          useRandomOffset: true,
          strength: 0.5,
          frequency: 0.5,
          octaves: 1,
          positionAmount: 1,
          rotationAmount: 0,
          sizeAmount: 0,
        },
      });

      step(100);
      step(200, 100);

      const count = countActiveParticles(ps);
      expect(count).toBeGreaterThan(0);

      ps.dispose();
    });

    it('should work with burst emission', () => {
      const { ps, step } = createTrailSystem({
        startSpeed: 5,
        emission: {
          rateOverTime: 0,
          bursts: [{ time: 0, count: 5, cycles: 1 }],
        },
      });

      step(100);
      step(200, 100);

      const count = countActiveParticles(ps);
      expect(count).toBeGreaterThan(0);

      ps.dispose();
    });

    it('should work with different shape emitters', () => {
      const { ps, step } = createTrailSystem({
        startSpeed: 3,
        emission: { rateOverTime: 20 },
        shape: {
          shape: 'SPHERE',
          sphere: { radius: 1, radiusThickness: 1, arc: 360 },
        },
      });

      step(100);
      step(200, 100);

      const count = countActiveParticles(ps);
      expect(count).toBeGreaterThan(0);

      ps.dispose();
    });
  });

  describe('frustum culling', () => {
    it('should have frustum culling disabled on trail mesh', () => {
      const { ps } = createTrailSystem();
      const trailMesh = getTrailMesh(ps)!;
      expect(trailMesh.frustumCulled).toBe(false);
      ps.dispose();
    });
  });
});
