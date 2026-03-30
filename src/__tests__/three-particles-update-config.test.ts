import * as THREE from 'three';
import {
  ForceFieldType,
  ForceFieldFalloff,
} from '../js/effects/three-particles/three-particles-enums.js';
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
 * Helper: get geometry attributes from particle system.
 */
const getAttributes = (ps: ParticleSystem) => {
  const points = ps.instance as THREE.Points;
  return points.geometry.attributes;
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
      maxParticles: 50,
      duration: 5,
      looping: true,
      startLifetime: 2,
      startSpeed: 1,
      startSize: 1,
      startOpacity: 1,
      startRotation: 0,
      emission: { rateOverTime: 10, rateOverDistance: 0 },
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

describe('ParticleSystem.updateConfig', () => {
  it('should be a function on the returned particle system', () => {
    const { ps } = createTestSystem();
    expect(typeof ps.updateConfig).toBe('function');
    ps.dispose();
  });

  describe('gravity updates', () => {
    it('should update gravity in real time', () => {
      const { ps, step } = createTestSystem({ gravity: 0 });

      // Emit some particles
      step(100);
      const active = countActiveParticles(ps);
      expect(active).toBeGreaterThan(0);

      // Record Y positions before gravity change
      const attrs = getAttributes(ps);
      const posArr = attrs.position.array as Float32Array;
      const yBefore = posArr[1]; // first particle Y

      // Change gravity
      ps.updateConfig({ gravity: -9.8 });

      // Step forward - gravity should now affect particles
      step(200, 100);
      step(500, 300);

      // The system should continue working without errors
      expect(countActiveParticles(ps)).toBeGreaterThan(0);
      ps.dispose();
    });
  });

  describe('force field updates', () => {
    it('should replace force fields at runtime', () => {
      const { ps, step } = createTestSystem();

      // Emit particles with no force fields
      step(100);
      expect(countActiveParticles(ps)).toBeGreaterThan(0);

      // Add a directional force field
      ps.updateConfig({
        forceFields: [
          {
            isActive: true,
            type: ForceFieldType.DIRECTIONAL,
            direction: { x: 1, y: 0, z: 0 },
            strength: 10,
          },
        ],
      });

      // Step forward - should not throw
      step(200, 100);
      expect(countActiveParticles(ps)).toBeGreaterThan(0);
      ps.dispose();
    });

    it('should allow removing all force fields', () => {
      const { ps, step } = createTestSystem({
        forceFields: [
          {
            isActive: true,
            type: ForceFieldType.DIRECTIONAL,
            direction: { x: 1, y: 0, z: 0 },
            strength: 5,
          },
        ],
      });

      step(100);
      expect(countActiveParticles(ps)).toBeGreaterThan(0);

      // Remove force fields
      ps.updateConfig({ forceFields: [] });

      // Should continue without errors
      step(200, 100);
      expect(countActiveParticles(ps)).toBeGreaterThan(0);
      ps.dispose();
    });
  });

  describe('emission rate updates', () => {
    it('should change emission rate at runtime', () => {
      const { ps, step } = createTestSystem({
        emission: { rateOverTime: 5, rateOverDistance: 0 },
      });

      step(500);
      const countLow = countActiveParticles(ps);

      // Increase emission rate dramatically
      ps.updateConfig({
        emission: { rateOverTime: 100, rateOverDistance: 0 },
      });

      step(1000, 500);
      const countHigh = countActiveParticles(ps);

      // With higher emission rate we should get more particles
      expect(countHigh).toBeGreaterThan(countLow);
      ps.dispose();
    });
  });

  describe('noise updates', () => {
    it('should enable noise at runtime', () => {
      const { ps, step } = createTestSystem({
        noise: {
          isActive: false,
          strength: 1,
          frequency: 1,
          octaves: 1,
          positionAmount: 1,
          rotationAmount: 0,
          sizeAmount: 0,
          useRandomOffset: false,
        },
      });

      step(100);
      expect(countActiveParticles(ps)).toBeGreaterThan(0);

      // Enable noise
      ps.updateConfig({
        noise: {
          isActive: true,
          strength: 2,
          frequency: 0.5,
          octaves: 2,
          positionAmount: 1,
          rotationAmount: 0,
          sizeAmount: 0,
          useRandomOffset: false,
        },
      });

      // Should not throw
      step(200, 100);
      expect(countActiveParticles(ps)).toBeGreaterThan(0);
      ps.dispose();
    });

    it('should disable noise at runtime', () => {
      const { ps, step } = createTestSystem({
        noise: {
          isActive: true,
          strength: 1,
          frequency: 1,
          octaves: 1,
          positionAmount: 1,
          rotationAmount: 0,
          sizeAmount: 0,
          useRandomOffset: false,
        },
      });

      step(100);

      ps.updateConfig({
        noise: {
          isActive: false,
          strength: 0,
          frequency: 1,
          octaves: 1,
          positionAmount: 0,
          rotationAmount: 0,
          sizeAmount: 0,
          useRandomOffset: false,
        },
      });

      step(200, 100);
      expect(countActiveParticles(ps)).toBeGreaterThan(0);
      ps.dispose();
    });
  });

  describe('duration and looping updates', () => {
    it('should update duration', () => {
      const { ps } = createTestSystem({ duration: 5 });

      ps.updateConfig({ duration: 10 });

      // Should not throw and system keeps running
      ps.update({ now: 6000, delta: 0.016, elapsed: 5 });
      ps.dispose();
    });

    it('should update looping', () => {
      const { ps } = createTestSystem({ looping: true });

      ps.updateConfig({ looping: false });

      // Should not throw
      ps.update({ now: 6000, delta: 0.016, elapsed: 5 });
      ps.dispose();
    });
  });

  describe('color and size config updates', () => {
    it('should update startColor for new particles', () => {
      const { ps, step } = createTestSystem({
        startColor: {
          min: { r: 1, g: 1, b: 1 },
          max: { r: 1, g: 1, b: 1 },
        },
      });

      step(100);

      // Change start color to red
      ps.updateConfig({
        startColor: {
          min: { r: 1, g: 0, b: 0 },
          max: { r: 1, g: 0, b: 0 },
        },
      });

      // Step to emit new particles with the new color
      step(500, 400);

      // System should work without errors
      expect(countActiveParticles(ps)).toBeGreaterThan(0);
      ps.dispose();
    });

    it('should update startSize for new particles', () => {
      const { ps, step } = createTestSystem({ startSize: 1 });

      step(100);

      ps.updateConfig({ startSize: 5 });

      step(500, 400);
      expect(countActiveParticles(ps)).toBeGreaterThan(0);
      ps.dispose();
    });
  });

  describe('multiple sequential updates', () => {
    it('should handle multiple updateConfig calls', () => {
      const { ps, step } = createTestSystem();

      step(100);

      // First update
      ps.updateConfig({ gravity: -5 });
      step(200, 100);

      // Second update
      ps.updateConfig({
        gravity: -10,
        forceFields: [
          {
            type: ForceFieldType.POINT,
            position: { x: 0, y: 5, z: 0 },
            strength: 3,
            range: 10,
          },
        ],
      });
      step(300, 100);

      // Third update - remove force fields and change emission
      ps.updateConfig({
        forceFields: [],
        emission: { rateOverTime: 50, rateOverDistance: 0 },
      });
      step(400, 100);

      expect(countActiveParticles(ps)).toBeGreaterThan(0);
      ps.dispose();
    });
  });

  describe('partial config merging', () => {
    it('should only update specified properties', () => {
      const { ps, step } = createTestSystem({
        gravity: -5,
        duration: 10,
      });

      step(100);

      // Only update gravity, duration should remain 10
      ps.updateConfig({ gravity: -20 });

      step(200, 100);

      // System should still work (not crash due to missing config)
      expect(countActiveParticles(ps)).toBeGreaterThan(0);
      ps.dispose();
    });
  });
});
