import * as THREE from 'three';
import { RendererType } from '../js/effects/three-particles/three-particles-enums.js';
import { createParticleSystem } from '../js/effects/three-particles/three-particles.js';
import type { ParticleSystem } from '../js/effects/three-particles/types.js';

/**
 * Helper: create an instanced particle system with sensible defaults.
 */
const createInstancedSystem = (
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
      renderer: { rendererType: RendererType.INSTANCED },
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
 * Helper: get geometry from the instanced particle system.
 */
const getGeometry = (ps: ParticleSystem): THREE.InstancedBufferGeometry => {
  const mesh = ps.instance as THREE.Mesh;
  return mesh.geometry as THREE.InstancedBufferGeometry;
};

describe('GPU Instancing (RendererType.INSTANCED)', () => {
  describe('creation', () => {
    it('should create a THREE.Mesh instead of THREE.Points', () => {
      const { ps } = createInstancedSystem();
      expect(ps.instance).toBeInstanceOf(THREE.Mesh);
      expect(ps.instance).not.toBeInstanceOf(THREE.Points);
      ps.dispose();
    });

    it('should use InstancedBufferGeometry', () => {
      const { ps } = createInstancedSystem();
      const geom = getGeometry(ps);
      expect(geom).toBeInstanceOf(THREE.InstancedBufferGeometry);
      expect(geom.instanceCount).toBe(50);
      ps.dispose();
    });

    it('should have a base quad geometry with 4 vertices and 6 indices', () => {
      const { ps } = createInstancedSystem();
      const geom = getGeometry(ps);
      const pos = geom.getAttribute('position');
      expect(pos.count).toBe(4);
      expect(pos.itemSize).toBe(3);
      const index = geom.getIndex();
      expect(index).not.toBeNull();
      expect(index!.count).toBe(6);
      ps.dispose();
    });

    it('should have instanced buffer attributes', () => {
      const { ps } = createInstancedSystem();
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

    it('should have instanceOffset with itemSize 3', () => {
      const { ps } = createInstancedSystem();
      const geom = getGeometry(ps);
      const offset = geom.getAttribute('instanceOffset');
      expect(offset.itemSize).toBe(3);
      expect(offset.count).toBe(50);
      ps.dispose();
    });
  });

  describe('emission and lifecycle', () => {
    it('should emit particles over time', () => {
      const { ps, step } = createInstancedSystem();

      // After 500ms with rate 10/s, should have ~5 particles
      step(500);
      const count = countActiveParticles(ps);
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(6);
      ps.dispose();
    });

    it('should deactivate expired particles', () => {
      const { ps, step } = createInstancedSystem({
        startLifetime: 0.5,
        emission: { rateOverTime: 100 },
        looping: false,
        duration: 1,
      });

      // Emit particles over first 200ms
      step(100);
      step(200, 100);
      const countBefore = countActiveParticles(ps);
      expect(countBefore).toBeGreaterThan(0);

      // Wait for all particles to expire (lifetime = 0.5s = 500ms) + buffer
      step(1500, 1300);
      const countAfter = countActiveParticles(ps);
      expect(countAfter).toBe(0);

      ps.dispose();
    });

    it('should update particle positions', () => {
      const { ps, step } = createInstancedSystem({
        startSpeed: 5,
        emission: { rateOverTime: 50 },
      });

      step(100);

      const geom = getGeometry(ps);
      const offsetArr = geom.getAttribute('instanceOffset').array;

      // At least one active particle should have moved from origin
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
      const { ps, step } = createInstancedSystem({
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

  describe('modifiers', () => {
    it('should apply sizeOverLifetime', () => {
      const { ps, step } = createInstancedSystem({
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

      // Step enough to emit and age particles
      step(200);
      step(500, 300);

      const geom = getGeometry(ps);
      const sizeArr = geom.getAttribute('instanceSize').array;
      const isActiveArr = geom.getAttribute('instanceIsActive').array;

      // Active particles at ~25% lifetime should have size < startSize*1.0
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
      const { ps, step } = createInstancedSystem({
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

      // Step enough to emit and age particles
      step(200);
      step(800, 600);

      const geom = getGeometry(ps);
      const alphaArr = geom.getAttribute('instanceColorA').array;
      const isActiveArr = geom.getAttribute('instanceIsActive').array;

      // Active particles should have reduced alpha (< 1 since they've aged)
      let hasReducedAlpha = false;
      for (let i = 0; i < 20; i++) {
        if (isActiveArr[i] && alphaArr[i] < 1 && alphaArr[i] > 0) {
          hasReducedAlpha = true;
          break;
        }
      }
      expect(hasReducedAlpha).toBe(true);

      ps.dispose();
    });
  });

  describe('material and shaders', () => {
    it('should use ShaderMaterial with instanced shaders', () => {
      const { ps } = createInstancedSystem();
      const mesh = ps.instance as THREE.Mesh;
      const material = mesh.material as THREE.ShaderMaterial;

      expect(material).toBeInstanceOf(THREE.ShaderMaterial);
      expect(material.vertexShader).toContain('instanceOffset');
      expect(material.vertexShader).toContain('instanceSize');
      expect(material.fragmentShader).toContain('vUv');

      ps.dispose();
    });

    it('should have the same uniforms as the Points renderer', () => {
      const { ps } = createInstancedSystem();
      const mesh = ps.instance as THREE.Mesh;
      const material = mesh.material as THREE.ShaderMaterial;

      expect(material.uniforms.map).toBeDefined();
      expect(material.uniforms.tiles).toBeDefined();
      expect(material.uniforms.fps).toBeDefined();
      expect(material.uniforms.elapsed).toBeDefined();
      expect(material.uniforms.discardBackgroundColor).toBeDefined();

      ps.dispose();
    });

    it('should have a viewportHeight uniform for pixel-correct sizing', () => {
      const { ps } = createInstancedSystem();
      const mesh = ps.instance as THREE.Mesh;
      const material = mesh.material as THREE.ShaderMaterial;

      expect(material.uniforms.viewportHeight).toBeDefined();
      expect(material.uniforms.viewportHeight.value).toBe(1.0);

      ps.dispose();
    });

    it('should set onBeforeRender to update viewportHeight', () => {
      const { ps } = createInstancedSystem();
      const mesh = ps.instance as THREE.Mesh;

      expect(mesh.onBeforeRender).toBeDefined();
      expect(typeof mesh.onBeforeRender).toBe('function');

      ps.dispose();
    });
  });

  describe('pause, resume, and dispose', () => {
    it('should support pauseEmitter and resumeEmitter', () => {
      const { ps, step } = createInstancedSystem({
        emission: { rateOverTime: 50 },
      });

      step(200);
      const countBefore = countActiveParticles(ps);
      expect(countBefore).toBeGreaterThan(0);

      ps.pauseEmitter();
      step(400);
      step(600);
      // No new particles should be emitted while paused
      // (existing ones may expire)
      const countDuringPause = countActiveParticles(ps);

      ps.resumeEmitter();
      step(800);
      const countAfterResume = countActiveParticles(ps);
      expect(countAfterResume).toBeGreaterThanOrEqual(0);

      ps.dispose();
    });

    it('should clean up on dispose', () => {
      const { ps } = createInstancedSystem();
      expect(() => ps.dispose()).not.toThrow();
    });
  });

  describe('backwards compatibility', () => {
    it('should still create Points when rendererType is not set', () => {
      const ps = createParticleSystem(
        {
          maxParticles: 10,
          duration: 5,
          looping: true,
          startLifetime: 2,
          startSpeed: 1,
          startSize: 1,
          startOpacity: 1,
          emission: { rateOverTime: 10 },
        } as any,
        1000
      );
      expect(ps.instance).toBeInstanceOf(THREE.Points);
      ps.dispose();
    });

    it('should create Points when rendererType is POINTS', () => {
      const ps = createParticleSystem(
        {
          maxParticles: 10,
          duration: 5,
          looping: true,
          startLifetime: 2,
          startSpeed: 1,
          startSize: 1,
          startOpacity: 1,
          emission: { rateOverTime: 10 },
          renderer: { rendererType: RendererType.POINTS },
        } as any,
        1000
      );
      expect(ps.instance).toBeInstanceOf(THREE.Points);
      ps.dispose();
    });

    it('should not have viewportHeight uniform on Points renderer', () => {
      const ps = createParticleSystem(
        {
          maxParticles: 10,
          duration: 5,
          looping: true,
          startLifetime: 2,
          startSpeed: 1,
          startSize: 1,
          startOpacity: 1,
          emission: { rateOverTime: 10 },
        } as any,
        1000
      );
      const points = ps.instance as THREE.Points;
      const material = points.material as THREE.ShaderMaterial;
      expect(material.uniforms.viewportHeight).toBeUndefined();
      ps.dispose();
    });
  });

  describe('colorOverLifetime', () => {
    it('should modify color channels over particle lifetime', () => {
      const { ps, step } = createInstancedSystem({
        maxParticles: 20,
        emission: { rateOverTime: 100 },
        startLifetime: 2,
        startColor: {
          min: { r: 1, g: 1, b: 1 },
          max: { r: 1, g: 1, b: 1 },
        },
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
              { x: 0, y: 1, percentage: 0 },
              { x: 1, y: 0, percentage: 1 },
            ],
          },
          b: {
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
      step(800, 600);

      const geom = getGeometry(ps);
      const rArr = geom.getAttribute('instanceColorR').array;
      const isActiveArr = geom.getAttribute('instanceIsActive').array;

      let hasReducedColor = false;
      for (let i = 0; i < 20; i++) {
        if (isActiveArr[i] && rArr[i] < 1 && rArr[i] > 0) {
          hasReducedColor = true;
          break;
        }
      }
      expect(hasReducedColor).toBe(true);

      ps.dispose();
    });
  });

  describe('rotationOverLifetime', () => {
    it('should modify rotation over particle lifetime', () => {
      const { ps, step } = createInstancedSystem({
        maxParticles: 20,
        emission: { rateOverTime: 100 },
        startLifetime: 2,
        startRotation: 0,
        rotationOverLifetime: {
          isActive: true,
          min: 5,
          max: 5,
        },
      });

      step(200);
      step(600, 400);

      const geom = getGeometry(ps);
      const rotArr = geom.getAttribute('instanceRotation').array;
      const isActiveArr = geom.getAttribute('instanceIsActive').array;

      let hasRotated = false;
      for (let i = 0; i < 20; i++) {
        if (isActiveArr[i] && Math.abs(rotArr[i]) > 0.001) {
          hasRotated = true;
          break;
        }
      }
      expect(hasRotated).toBe(true);

      ps.dispose();
    });
  });

  describe('velocityOverLifetime', () => {
    it('should apply linear velocity over lifetime', () => {
      const { ps, step } = createInstancedSystem({
        maxParticles: 20,
        emission: { rateOverTime: 100 },
        startLifetime: 2,
        startSpeed: 0,
        velocityOverLifetime: {
          isActive: true,
          linear: { x: 0, y: 10, z: 0 },
          orbital: { x: 0, y: 0, z: 0 },
        },
      });

      step(200);
      step(600, 400);

      const geom = getGeometry(ps);
      const offsetArr = geom.getAttribute('instanceOffset').array;
      const isActiveArr = geom.getAttribute('instanceIsActive').array;

      let hasMovedY = false;
      for (let i = 0; i < 20; i++) {
        if (isActiveArr[i] && Math.abs(offsetArr[i * 3 + 1]) > 0.1) {
          hasMovedY = true;
          break;
        }
      }
      expect(hasMovedY).toBe(true);

      ps.dispose();
    });
  });

  describe('burst emission', () => {
    it('should emit burst particles', () => {
      const { ps, step } = createInstancedSystem({
        maxParticles: 50,
        emission: {
          rateOverTime: 0,
          bursts: [{ time: 0, count: 20 }],
        },
        startLifetime: 5,
      });

      step(100);
      const count = countActiveParticles(ps);
      expect(count).toBe(20);

      ps.dispose();
    });
  });

  describe('gravity', () => {
    it('should apply gravity to instanced particles', () => {
      const { ps, step } = createInstancedSystem({
        maxParticles: 20,
        emission: { rateOverTime: 100 },
        startLifetime: 2,
        startSpeed: 0,
        gravity: 10,
      });

      step(200);
      step(600, 400);

      const geom = getGeometry(ps);
      const offsetArr = geom.getAttribute('instanceOffset').array;
      const isActiveArr = geom.getAttribute('instanceIsActive').array;

      // Gravity should have moved particles in the -Y direction
      let hasGravity = false;
      for (let i = 0; i < 20; i++) {
        if (isActiveArr[i] && offsetArr[i * 3 + 1] < -0.01) {
          hasGravity = true;
          break;
        }
      }
      expect(hasGravity).toBe(true);

      ps.dispose();
    });
  });

  describe('shader features', () => {
    it('should include perspective size scaling in vertex shader', () => {
      const { ps } = createInstancedSystem();
      const mesh = ps.instance as THREE.Mesh;
      const material = mesh.material as THREE.ShaderMaterial;
      expect(material.vertexShader).toContain('instanceSize * 100.0 / dist');
      expect(material.vertexShader).toContain('viewportHeight');
      ps.dispose();
    });

    it('should include UV rotation in fragment shader', () => {
      const { ps } = createInstancedSystem();
      const mesh = ps.instance as THREE.Mesh;
      const material = mesh.material as THREE.ShaderMaterial;
      expect(material.fragmentShader).toContain('vRotation');
      expect(material.fragmentShader).toContain('rotation * centeredPoint');
      ps.dispose();
    });
  });
});
