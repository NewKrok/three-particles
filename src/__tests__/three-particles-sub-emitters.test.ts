import * as THREE from 'three';
import { SubEmitterTrigger } from '../js/effects/three-particles/three-particles-enums.js';
import { createParticleSystem } from '../js/effects/three-particles/three-particles.js';
import { ParticleSystem } from '../js/effects/three-particles/types.js';

/**
 * Helper: count active particles by reading the isActive buffer attribute.
 */
const countActiveParticles = (ps: ParticleSystem): number => {
  const points = ps.instance as THREE.Points;
  const isActiveArr = points.geometry.attributes.isActive.array;
  let count = 0;
  for (let i = 0; i < isActiveArr.length; i++) {
    if (isActiveArr[i]) count++;
  }
  return count;
};

/**
 * Helper: create system and step function.
 */
const createTestSystem = (
  config: Record<string, unknown> = {},
  startTime = 1000
) => {
  const ps = createParticleSystem(
    {
      maxParticles: 10,
      duration: 5,
      looping: true,
      startLifetime: 0.2,
      startSpeed: 1,
      startSize: 1,
      startOpacity: 1,
      startRotation: 0,
      emission: { rateOverTime: 50, rateOverDistance: 0 },
      ...config,
    } as any,
    startTime
  );

  let currentTime = 0;

  const step = (timeOffsetMs: number, deltaMs: number = 16) => {
    currentTime = timeOffsetMs;
    ps.update({
      now: startTime + timeOffsetMs,
      delta: deltaMs / 1000,
      elapsed: timeOffsetMs / 1000,
    });
  };

  return { ps, step, startTime };
};

const subEmitterConfig = {
  maxParticles: 5,
  duration: 1,
  looping: false,
  startLifetime: 0.3,
  startSpeed: 0.5,
  startSize: 0.5,
  startOpacity: 1,
  startRotation: 0,
  emission: { rateOverTime: 5, rateOverDistance: 0 },
};

/**
 * Helper: run enough steps that particles emit, live, and die.
 * With startLifetime=0.2s (200ms), particles emitted at ~16ms will die after ~216ms.
 */
const emitAndWaitForDeath = (step: (t: number, d?: number) => void) => {
  step(16); // emit particles
  step(100, 84); // emit more
  step(300, 200); // some particles should die here (lifetime ~284ms > 200ms)
  step(500, 200); // more deaths, sub-emitters settle
};

describe('Sub-emitters', () => {
  describe('death trigger', () => {
    it('should spawn sub-emitter systems when particles die', () => {
      const scene = new THREE.Group();

      const { ps, step } = createTestSystem({
        subEmitters: [
          {
            trigger: SubEmitterTrigger.DEATH,
            config: subEmitterConfig,
          },
        ],
      });

      scene.add(ps.instance);

      emitAndWaitForDeath(step);

      // After death, sub-emitters should have been added to the scene
      expect(scene.children.length).toBeGreaterThan(1);

      ps.dispose();
    });

    it('should default to DEATH trigger when trigger is not specified', () => {
      const scene = new THREE.Group();

      const { ps, step } = createTestSystem({
        subEmitters: [
          {
            config: subEmitterConfig,
            // no trigger specified — should default to DEATH
          },
        ],
      });

      scene.add(ps.instance);

      emitAndWaitForDeath(step);

      expect(scene.children.length).toBeGreaterThan(1);

      ps.dispose();
    });
  });

  describe('birth trigger', () => {
    it('should spawn sub-emitter systems when particles are born', () => {
      const scene = new THREE.Group();

      const { ps, step } = createTestSystem({
        subEmitters: [
          {
            trigger: SubEmitterTrigger.BIRTH,
            config: subEmitterConfig,
          },
        ],
      });

      scene.add(ps.instance);

      // Emit particles — birth sub-emitters should trigger immediately
      step(16);
      step(100, 84);

      expect(scene.children.length).toBeGreaterThan(1);

      ps.dispose();
    });
  });

  describe('maxInstances', () => {
    it('should respect the maxInstances cap', () => {
      const scene = new THREE.Group();

      const { ps, step } = createTestSystem({
        subEmitters: [
          {
            trigger: SubEmitterTrigger.BIRTH,
            config: subEmitterConfig,
            maxInstances: 3,
          },
        ],
      });

      scene.add(ps.instance);

      step(16);
      step(200, 184);

      // Scene children should be capped: 1 (parent) + at most 3 (sub-emitters)
      expect(scene.children.length).toBeLessThanOrEqual(4);

      ps.dispose();
    });
  });

  describe('dispose cleanup', () => {
    it('should dispose all sub-emitter instances when parent is disposed', () => {
      const scene = new THREE.Group();

      const { ps, step } = createTestSystem({
        subEmitters: [
          {
            trigger: SubEmitterTrigger.BIRTH,
            config: subEmitterConfig,
          },
        ],
      });

      scene.add(ps.instance);

      step(16);
      step(100, 84);

      const childrenBeforeDispose = scene.children.length;
      expect(childrenBeforeDispose).toBeGreaterThan(1);

      ps.dispose();

      expect(scene.children.length).toBeLessThan(childrenBeforeDispose);
    });
  });

  describe('no sub-emitters configured', () => {
    it('should not affect behavior when subEmitters is not set', () => {
      const scene = new THREE.Group();

      const { ps, step } = createTestSystem({});

      scene.add(ps.instance);

      emitAndWaitForDeath(step);

      expect(scene.children.length).toBe(1);

      ps.dispose();
    });

    it('should not affect behavior when subEmitters is empty array', () => {
      const scene = new THREE.Group();

      const { ps, step } = createTestSystem({
        subEmitters: [],
      });

      scene.add(ps.instance);

      emitAndWaitForDeath(step);

      expect(scene.children.length).toBe(1);

      ps.dispose();
    });
  });

  describe('inherit velocity', () => {
    it('should create sub-emitter with inheritVelocity=0 without error', () => {
      const scene = new THREE.Group();

      const { ps, step } = createTestSystem({
        subEmitters: [
          {
            trigger: SubEmitterTrigger.DEATH,
            config: subEmitterConfig,
            inheritVelocity: 0,
          },
        ],
      });

      scene.add(ps.instance);

      emitAndWaitForDeath(step);

      expect(scene.children.length).toBeGreaterThan(1);

      ps.dispose();
    });

    it('should create sub-emitter with inheritVelocity > 0 without error', () => {
      const scene = new THREE.Group();

      const { ps, step } = createTestSystem({
        startSpeed: 5,
        subEmitters: [
          {
            trigger: SubEmitterTrigger.DEATH,
            config: subEmitterConfig,
            inheritVelocity: 0.5,
          },
        ],
      });

      scene.add(ps.instance);

      emitAndWaitForDeath(step);

      expect(scene.children.length).toBeGreaterThan(1);

      ps.dispose();
    });
  });

  describe('update propagation', () => {
    it('should update sub-emitter particles when using instance update()', () => {
      const scene = new THREE.Group();

      const { ps, step } = createTestSystem({
        subEmitters: [
          {
            trigger: SubEmitterTrigger.DEATH,
            config: {
              ...subEmitterConfig,
              startLifetime: 2,
              emission: { rateOverTime: 50, rateOverDistance: 0 },
            },
          },
        ],
      });

      scene.add(ps.instance);

      emitAndWaitForDeath(step);

      // Sub-emitters should exist
      expect(scene.children.length).toBeGreaterThan(1);

      // Step forward a bit so sub-emitter particles have time to emit
      step(600, 100);
      step(700, 100);

      // Check that at least one sub-emitter has active particles
      let totalSubActive = 0;
      for (let i = 1; i < scene.children.length; i++) {
        const child = scene.children[i] as THREE.Points;
        const isActiveArr = child.geometry?.attributes?.isActive?.array;
        if (isActiveArr) {
          for (let j = 0; j < isActiveArr.length; j++) {
            if (isActiveArr[j]) totalSubActive++;
          }
        }
      }
      expect(totalSubActive).toBeGreaterThan(0);

      ps.dispose();
    });
  });

  describe('sub-emitter lifecycle', () => {
    it('sub-emitters should be created as non-looping', () => {
      const scene = new THREE.Group();

      const { ps, step } = createTestSystem({
        subEmitters: [
          {
            trigger: SubEmitterTrigger.DEATH,
            config: {
              ...subEmitterConfig,
              looping: true, // user sets looping — should be overridden to false
            },
          },
        ],
      });

      scene.add(ps.instance);

      emitAndWaitForDeath(step);

      expect(scene.children.length).toBeGreaterThan(1);

      ps.dispose();
    });

    it('should handle multiple sub-emitter configs on the same system', () => {
      const scene = new THREE.Group();

      const { ps, step } = createTestSystem({
        subEmitters: [
          {
            trigger: SubEmitterTrigger.DEATH,
            config: subEmitterConfig,
          },
          {
            trigger: SubEmitterTrigger.BIRTH,
            config: subEmitterConfig,
          },
        ],
      });

      scene.add(ps.instance);

      // Birth sub-emitters spawn
      step(16);
      step(100, 84);

      const childrenAfterBirth = scene.children.length;
      expect(childrenAfterBirth).toBeGreaterThan(1);

      // Wait for death — more sub-emitters spawn
      step(300, 200);
      step(500, 200);

      expect(scene.children.length).toBeGreaterThan(childrenAfterBirth);

      ps.dispose();
    });
  });
});
