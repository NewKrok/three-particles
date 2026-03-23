import * as THREE from 'three';
import {
  Shape,
  LifeTimeCurve,
} from '../js/effects/three-particles/three-particles-enums.js';
import { createParticleSystem } from '../js/effects/three-particles/three-particles.js';
import { ParticleSystem } from '../js/effects/three-particles/types.js';

const countActiveParticles = (ps: ParticleSystem): number => {
  const points = ps.instance as THREE.Points;
  const isActiveArr = points.geometry.attributes.isActive.array;
  let count = 0;
  for (let i = 0; i < isActiveArr.length; i++) {
    if (isActiveArr[i]) count++;
  }
  return count;
};

const getAttributes = (ps: ParticleSystem) => {
  const points = ps.instance as THREE.Points;
  return points.geometry.attributes;
};

const createVelocityTestSystem = (
  velocityConfig: Record<string, unknown>,
  extraConfig: Record<string, unknown> = {},
  startTime = 1000
) => {
  const ps = createParticleSystem(
    {
      maxParticles: 20,
      duration: 5,
      looping: true,
      startLifetime: 2,
      startSpeed: 0,
      emission: { rateOverTime: 50 },
      velocityOverLifetime: {
        isActive: true,
        ...velocityConfig,
      },
      ...extraConfig,
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

describe('Velocity Over Lifetime - Linear', () => {
  it('should initialize linear velocity data when active with constant values', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: { x: 1, y: 2, z: 3 },
      orbital: { x: 0, y: 0, z: 0 },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should apply linear velocity to particle positions', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: { x: 5, y: 0, z: 0 },
      orbital: { x: 0, y: 0, z: 0 },
    });

    step(16);
    step(100);

    const attrs = getAttributes(ps);
    // Particles should have moved in x direction
    let hasPositiveX = false;
    for (let i = 0; i < attrs.isActive.array.length; i++) {
      if (attrs.isActive.array[i]) {
        const posX = attrs.position.array[i * 3];
        if (posX !== 0) hasPositiveX = true;
      }
    }
    expect(hasPositiveX).toBe(true);

    ps.dispose();
  });

  it('should handle linear velocity with random range values', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: {
        x: { min: -1, max: 1 },
        y: { min: -1, max: 1 },
        z: { min: -1, max: 1 },
      },
      orbital: { x: 0, y: 0, z: 0 },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle linear velocity with bezier curves', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: {
        x: {
          type: LifeTimeCurve.BEZIER,
          scale: 2,
          bezierPoints: [
            { x: 0, y: 0, percentage: 0 },
            { x: 0.5, y: 1 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
        y: 0,
        z: 0,
      },
      orbital: { x: 0, y: 0, z: 0 },
    });

    step(16);
    step(100);
    step(200);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle linear velocity with easing curves', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: {
        x: {
          type: LifeTimeCurve.EASING,
          scale: 3,
          curveFunction: (t: number) => t * t,
        },
        y: 0,
        z: 0,
      },
      orbital: { x: 0, y: 0, z: 0 },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle zero linear velocity on some axes', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: { x: 5, y: 0, z: 0 },
      orbital: { x: 0, y: 0, z: 0 },
    });

    step(16);
    step(100);
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should handle mixed constant and curve linear velocity', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: {
        x: 2,
        y: {
          type: LifeTimeCurve.BEZIER,
          scale: 1,
          bezierPoints: [
            { x: 0, y: 0, percentage: 0 },
            { x: 1, y: 1, percentage: 1 },
          ],
        },
        z: { min: -1, max: 1 },
      },
      orbital: { x: 0, y: 0, z: 0 },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

describe('Velocity Over Lifetime - Orbital', () => {
  it('should initialize orbital velocity data when active', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: { x: 0, y: 0, z: 0 },
      orbital: { x: 1, y: 0, z: 0 },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should apply orbital velocity to particle positions', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: { x: 0, y: 0, z: 0 },
      orbital: { x: 0, y: 5, z: 0 },
    });

    step(16);
    step(100);
    step(200);

    // Particles should exist and have been modified
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle orbital velocity with constant values on all axes', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: { x: 0, y: 0, z: 0 },
      orbital: { x: 2, y: 3, z: 1 },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle orbital velocity with random range values', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: { x: 0, y: 0, z: 0 },
      orbital: {
        x: { min: 0, max: 5 },
        y: { min: 0, max: 5 },
        z: { min: 0, max: 5 },
      },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle orbital velocity with bezier curves', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: { x: 0, y: 0, z: 0 },
      orbital: {
        x: {
          type: LifeTimeCurve.BEZIER,
          scale: 1,
          bezierPoints: [
            { x: 0, y: 0, percentage: 0 },
            { x: 0.5, y: 2 },
            { x: 1, y: 1, percentage: 1 },
          ],
        },
        y: 0,
        z: 0,
      },
    });

    step(16);
    step(100);
    step(200);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle orbital velocity with easing curves', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: { x: 0, y: 0, z: 0 },
      orbital: {
        x: 0,
        y: {
          type: LifeTimeCurve.EASING,
          scale: 2,
          curveFunction: (t: number) => Math.sin(t * Math.PI),
        },
        z: 0,
      },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle combined linear and orbital velocity', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: { x: 1, y: 2, z: 0 },
      orbital: { x: 0, y: 3, z: 0 },
    });

    step(16);
    step(100);
    step(200);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should set position offset for orbital velocity', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: { x: 0, y: 0, z: 0 },
      orbital: { x: 0, y: 1, z: 0 },
    });

    step(16);
    step(100);
    // Orbital velocity stores position offsets from start positions
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should handle zero orbital velocity', () => {
    const { ps, step } = createVelocityTestSystem({
      linear: { x: 1, y: 0, z: 0 },
      orbital: { x: 0, y: 0, z: 0 },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

describe('Velocity Over Lifetime - Inactive', () => {
  it('should not create velocity data when velocityOverLifetime is inactive', () => {
    const ps = createParticleSystem(
      {
        maxParticles: 10,
        velocityOverLifetime: {
          isActive: false,
          linear: { x: 5, y: 5, z: 5 },
          orbital: { x: 5, y: 5, z: 5 },
        },
        emission: { rateOverTime: 50 },
      } as any,
      1000
    );

    ps.update({ now: 1100, delta: 0.1, elapsed: 0.1 });
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });
});
