import * as THREE from 'three';
import { RendererType } from '../js/effects/three-particles/three-particles-enums.js';
import { createParticleSystem } from '../js/effects/three-particles/three-particles.js';
import type { ParticleSystem } from '../js/effects/three-particles/types.js';

/**
 * Helper: create a mesh particle system with sensible defaults.
 */
const createMeshSystem = (
  config: Record<string, unknown> = {},
  startTime = 1000
) => {
  const ps = createParticleSystem(
    {
      maxParticles: 50,
      duration: 5,
      looping: true,
      startLifetime: 2,
      startSpeed: 1,
      startSize: 1,
      startOpacity: 1,
      startRotation: 0,
      emission: { rateOverTime: 10, rateOverDistance: 0 },
      renderer: {
        rendererType: RendererType.MESH,
        mesh: {
          geometry: new THREE.BoxGeometry(1, 1, 1),
        },
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
 * Helper: count active particles by reading the instanceIsActive buffer attribute.
 */
const countActiveParticles = (ps: ParticleSystem): number => {
  const mesh = ps.instance as THREE.Mesh;
  const isActiveArr = mesh.geometry.attributes.instanceIsActive.array;
  let count = 0;
  for (let i = 0; i < isActiveArr.length; i++) {
    if (isActiveArr[i]) count++;
  }
  return count;
};

/**
 * Helper: get geometry from the mesh particle system.
 */
const getGeometry = (ps: ParticleSystem): THREE.InstancedBufferGeometry => {
  const mesh = ps.instance as THREE.Mesh;
  return mesh.geometry as THREE.InstancedBufferGeometry;
};

describe('Mesh Particle Renderer (RendererType.MESH)', () => {
  describe('creation', () => {
    it('should create a THREE.Mesh instead of THREE.Points', () => {
      const { ps } = createMeshSystem();
      expect(ps.instance).toBeInstanceOf(THREE.Mesh);
      expect(ps.instance).not.toBeInstanceOf(THREE.Points);
      ps.dispose();
    });

    it('should use InstancedBufferGeometry', () => {
      const { ps } = createMeshSystem();
      const geom = getGeometry(ps);
      expect(geom).toBeInstanceOf(THREE.InstancedBufferGeometry);
      expect(geom.instanceCount).toBe(50);
      ps.dispose();
    });

    it('should copy base geometry from the provided mesh', () => {
      const boxGeom = new THREE.BoxGeometry(1, 1, 1);
      const { ps } = createMeshSystem({
        renderer: {
          rendererType: RendererType.MESH,
          mesh: { geometry: boxGeom },
        },
      });
      const geom = getGeometry(ps);
      // BoxGeometry has 24 vertices (4 per face × 6 faces)
      const pos = geom.getAttribute('position');
      expect(pos.count).toBe(boxGeom.getAttribute('position').count);
      expect(pos.itemSize).toBe(3);
      // Should have normals from the box
      const normal = geom.getAttribute('normal');
      expect(normal).toBeDefined();
      expect(normal.count).toBe(boxGeom.getAttribute('normal').count);
      // Should have UVs
      const uv = geom.getAttribute('uv');
      expect(uv).toBeDefined();
      // Should have index buffer
      const index = geom.getIndex();
      expect(index).not.toBeNull();
      ps.dispose();
    });

    it('should have instanced buffer attributes', () => {
      const { ps } = createMeshSystem();
      const geom = getGeometry(ps);

      const instancedAttrs = [
        'instanceOffset',
        'instanceIsActive',
        'instanceLifetime',
        'instanceStartLifetime',
        'instanceSize',
        'instanceRotation',
        'instanceColorR',
        'instanceColorG',
        'instanceColorB',
        'instanceColorA',
        'instanceStartFrame',
      ];

      for (const name of instancedAttrs) {
        const attr = geom.getAttribute(name);
        expect(attr).toBeDefined();
        expect(attr).toBeInstanceOf(THREE.InstancedBufferAttribute);
      }

      ps.dispose();
    });

    it('should have quaternion attributes for 3D rotation', () => {
      const { ps } = createMeshSystem();
      const geom = getGeometry(ps);

      const quatAttrs = [
        'instanceQuatX',
        'instanceQuatY',
        'instanceQuatZ',
        'instanceQuatW',
      ];

      for (const name of quatAttrs) {
        const attr = geom.getAttribute(name);
        expect(attr).toBeDefined();
        expect(attr).toBeInstanceOf(THREE.InstancedBufferAttribute);
        expect(attr.count).toBe(50);
      }

      // instanceQuatW should be initialized to 1 (identity quaternion)
      const quatW = geom.getAttribute('instanceQuatW');
      for (let i = 0; i < 50; i++) {
        expect(quatW.array[i]).toBe(1);
      }

      ps.dispose();
    });

    it('should have instanceOffset with itemSize 3', () => {
      const { ps } = createMeshSystem();
      const geom = getGeometry(ps);
      const offset = geom.getAttribute('instanceOffset');
      expect(offset.itemSize).toBe(3);
      expect(offset.count).toBe(50);
      ps.dispose();
    });

    it('should throw if no mesh geometry is provided', () => {
      expect(() =>
        createParticleSystem(
          {
            maxParticles: 10,
            duration: 5,
            looping: true,
            startLifetime: 2,
            startSpeed: 1,
            startSize: 1,
            startOpacity: 1,
            startRotation: 0,
            emission: { rateOverTime: 10 },
            renderer: {
              rendererType: RendererType.MESH,
              // No mesh config
            },
          } as any,
          1000
        )
      ).toThrow('RendererType.MESH requires a mesh configuration');
    });

    it('should work with different geometry types', () => {
      const geometries = [
        new THREE.SphereGeometry(0.5, 8, 6),
        new THREE.IcosahedronGeometry(0.5, 0),
        new THREE.TorusGeometry(0.5, 0.2, 8, 16),
        new THREE.ConeGeometry(0.5, 1, 8),
      ];

      for (const geometry of geometries) {
        const ps = createParticleSystem(
          {
            maxParticles: 10,
            duration: 5,
            looping: true,
            startLifetime: 2,
            startSpeed: 1,
            startSize: 1,
            startOpacity: 1,
            startRotation: 0,
            emission: { rateOverTime: 10 },
            renderer: {
              rendererType: RendererType.MESH,
              mesh: { geometry },
            },
          } as any,
          1000
        );
        expect(ps.instance).toBeInstanceOf(THREE.Mesh);
        const geom = (ps.instance as THREE.Mesh)
          .geometry as THREE.InstancedBufferGeometry;
        const pos = geom.getAttribute('position');
        expect(pos.count).toBe(geometry.getAttribute('position').count);
        ps.dispose();
      }
    });
  });

  describe('emission and lifecycle', () => {
    it('should emit particles over time', () => {
      const { ps, step } = createMeshSystem();

      // After 500ms with rate 10/s, should have ~5 particles
      step(500);
      const count = countActiveParticles(ps);
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(6);
      ps.dispose();
    });

    it('should deactivate expired particles', () => {
      const { ps, step } = createMeshSystem({
        startLifetime: 0.5,
        emission: { rateOverTime: 100 },
        looping: false,
        duration: 1,
      });

      step(100);
      step(200, 100);
      const countBefore = countActiveParticles(ps);
      expect(countBefore).toBeGreaterThan(0);

      // Wait for all particles to expire
      step(1500, 1300);
      const countAfter = countActiveParticles(ps);
      expect(countAfter).toBe(0);

      ps.dispose();
    });

    it('should update particle positions', () => {
      const { ps, step } = createMeshSystem({
        startSpeed: 5,
        emission: { rateOverTime: 50 },
      });

      step(100);

      const geom = getGeometry(ps);
      const offsetArr = geom.getAttribute('instanceOffset').array;

      let hasMoved = false;
      for (let i = 0; i < 50; i++) {
        const x = offsetArr[i * 3];
        const y = offsetArr[i * 3 + 1];
        const z = offsetArr[i * 3 + 2];
        if (Math.abs(x) > 0.001 || Math.abs(y) > 0.001 || Math.abs(z) > 0.001) {
          hasMoved = true;
          break;
        }
      }
      expect(hasMoved).toBe(true);

      ps.dispose();
    });

    it('should respect maxParticles', () => {
      const { ps, step } = createMeshSystem({
        maxParticles: 10,
        emission: { rateOverTime: 1000 },
        startLifetime: 5,
      });

      step(500);
      const count = countActiveParticles(ps);
      expect(count).toBeLessThanOrEqual(10);

      ps.dispose();
    });
  });

  describe('quaternion rotation', () => {
    it('should initialize quaternion from startRotation', () => {
      const startRot = Math.PI / 4; // 45 degrees
      const { ps, step } = createMeshSystem({
        maxParticles: 5,
        emission: { rateOverTime: 100 },
        startRotation: startRot,
      });

      step(100);

      const geom = getGeometry(ps);
      const quatZ = geom.getAttribute('instanceQuatZ').array;
      const quatW = geom.getAttribute('instanceQuatW').array;
      const isActive = geom.getAttribute('instanceIsActive').array;

      let found = false;
      for (let i = 0; i < 5; i++) {
        if (isActive[i]) {
          const halfZ = startRot * 0.5;
          expect(quatZ[i]).toBeCloseTo(Math.sin(halfZ), 3);
          expect(quatW[i]).toBeCloseTo(Math.cos(halfZ), 3);
          found = true;
          break;
        }
      }
      expect(found).toBe(true);

      ps.dispose();
    });

    it('should update quaternion when rotationOverLifetime is active', () => {
      const { ps, step } = createMeshSystem({
        maxParticles: 5,
        emission: { rateOverTime: 100 },
        startRotation: 0,
        startLifetime: 3,
        rotationOverLifetime: { isActive: true, min: 5, max: 5 },
      });

      step(100);

      const geom = getGeometry(ps);
      const quatZ = geom.getAttribute('instanceQuatZ').array;
      const isActive = geom.getAttribute('instanceIsActive').array;

      // Find an active particle's initial quatZ
      let idx = -1;
      for (let i = 0; i < 5; i++) {
        if (isActive[i]) {
          idx = i;
          break;
        }
      }
      expect(idx).toBeGreaterThanOrEqual(0);

      const initialQuatZ = quatZ[idx];

      // Step forward to rotate
      step(500, 400);

      // Quaternion Z should have changed
      expect(quatZ[idx]).not.toBeCloseTo(initialQuatZ, 2);

      ps.dispose();
    });
  });

  describe('modifiers', () => {
    it('should apply sizeOverLifetime', () => {
      const { ps, step } = createMeshSystem({
        maxParticles: 20,
        emission: { rateOverTime: 100 },
        startSize: 2,
        startLifetime: 2,
        sizeOverLifetime: {
          isActive: true,
          lifetimeCurve: {
            type: 'BEZIER',
            scale: 1,
            bezierPoints: [
              { x: 0, y: 1, percentage: 0 },
              { x: 1, y: 0, percentage: 1 },
            ],
          },
        },
      });

      step(200);
      step(500, 300);

      const geom = getGeometry(ps);
      const sizeArr = geom.getAttribute('instanceSize').array;
      const isActiveArr = geom.getAttribute('instanceIsActive').array;

      let hasModifiedSize = false;
      for (let i = 0; i < 20; i++) {
        if (isActiveArr[i] && sizeArr[i] > 0 && sizeArr[i] < 2) {
          hasModifiedSize = true;
          break;
        }
      }
      expect(hasModifiedSize).toBe(true);

      ps.dispose();
    });

    it('should apply opacityOverLifetime', () => {
      const { ps, step } = createMeshSystem({
        maxParticles: 20,
        emission: { rateOverTime: 100 },
        startOpacity: 1,
        startLifetime: 2,
        opacityOverLifetime: {
          isActive: true,
          lifetimeCurve: {
            type: 'BEZIER',
            scale: 1,
            bezierPoints: [
              { x: 0, y: 1, percentage: 0 },
              { x: 1, y: 0, percentage: 1 },
            ],
          },
        },
      });

      step(200);
      step(500, 300);

      const geom = getGeometry(ps);
      const alphaArr = geom.getAttribute('instanceColorA').array;
      const isActiveArr = geom.getAttribute('instanceIsActive').array;

      let hasModifiedAlpha = false;
      for (let i = 0; i < 20; i++) {
        if (isActiveArr[i] && alphaArr[i] > 0 && alphaArr[i] < 1) {
          hasModifiedAlpha = true;
          break;
        }
      }
      expect(hasModifiedAlpha).toBe(true);

      ps.dispose();
    });

    it('should apply colorOverLifetime', () => {
      const { ps, step } = createMeshSystem({
        maxParticles: 20,
        emission: { rateOverTime: 100 },
        startColor: {
          min: { r: 1.0, g: 1.0, b: 1.0 },
          max: { r: 1.0, g: 1.0, b: 1.0 },
        },
        startLifetime: 2,
        colorOverLifetime: {
          isActive: true,
          r: {
            type: 'BEZIER',
            scale: 1,
            bezierPoints: [
              { x: 0, y: 1, percentage: 0 },
              { x: 1, y: 0, percentage: 1 },
            ],
          },
          g: {
            type: 'BEZIER',
            scale: 1,
            bezierPoints: [
              { x: 0, y: 0, percentage: 0 },
              { x: 1, y: 1, percentage: 1 },
            ],
          },
          b: {
            type: 'BEZIER',
            scale: 1,
            bezierPoints: [
              { x: 0, y: 1, percentage: 0 },
              { x: 1, y: 1, percentage: 1 },
            ],
          },
        },
      });

      step(200);
      step(800, 600);

      const geom = getGeometry(ps);
      const colorR = geom.getAttribute('instanceColorR').array;
      const isActiveArr = geom.getAttribute('instanceIsActive').array;

      let hasModifiedColor = false;
      for (let i = 0; i < 20; i++) {
        if (isActiveArr[i] && colorR[i] < 1.0) {
          hasModifiedColor = true;
          break;
        }
      }
      expect(hasModifiedColor).toBe(true);

      ps.dispose();
    });

    it('should apply gravity', () => {
      const { ps, step } = createMeshSystem({
        maxParticles: 20,
        emission: { rateOverTime: 100 },
        gravity: 9.8,
        startSpeed: 0,
        startLifetime: 3,
      });

      step(100);
      step(500, 400);

      const geom = getGeometry(ps);
      const offsetArr = geom.getAttribute('instanceOffset').array;
      const isActiveArr = geom.getAttribute('instanceIsActive').array;

      // With gravity, particles should move downward (negative Y)
      let hasGravityEffect = false;
      for (let i = 0; i < 20; i++) {
        if (isActiveArr[i] && offsetArr[i * 3 + 1] < -0.01) {
          hasGravityEffect = true;
          break;
        }
      }
      expect(hasGravityEffect).toBe(true);

      ps.dispose();
    });
  });

  describe('pause and resume', () => {
    it('should stop emitting when paused', () => {
      const { ps, step } = createMeshSystem({
        maxParticles: 50,
        emission: { rateOverTime: 100 },
        startLifetime: 0.3,
      });

      step(100);
      const countBefore = countActiveParticles(ps);
      expect(countBefore).toBeGreaterThan(0);

      ps.pauseEmitter();

      // Wait for existing particles to expire then step again
      step(1000, 900);
      step(1500, 500);
      const countAfter = countActiveParticles(ps);
      expect(countAfter).toBe(0);

      ps.dispose();
    });

    it('should resume emitting after pause', () => {
      const { ps, step } = createMeshSystem({
        maxParticles: 50,
        emission: { rateOverTime: 100 },
        startLifetime: 5,
      });

      ps.pauseEmitter();
      step(200);
      expect(countActiveParticles(ps)).toBe(0);

      ps.resumeEmitter();
      step(500, 300);
      expect(countActiveParticles(ps)).toBeGreaterThan(0);

      ps.dispose();
    });
  });

  describe('dispose', () => {
    it('should clean up resources on dispose', () => {
      const { ps } = createMeshSystem();
      expect(() => ps.dispose()).not.toThrow();
    });
  });
});
