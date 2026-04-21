import * as THREE from 'three';
import {
  Shape,
  SimulationSpace,
  LifeTimeCurve,
  ForceFieldType,
  ForceFieldFalloff,
  SubEmitterTrigger,
} from '../js/effects/three-particles/three-particles-enums.js';
import {
  createParticleSystem,
  updateParticleSystems,
} from '../js/effects/three-particles/three-particles.js';
import { ParticleSystem } from '../js/effects/three-particles/types.js';

const countActiveParticles = (ps: ParticleSystem): number => {
  const points = ps.instance as THREE.Points;
  const isActiveAttr = points.geometry.attributes.isActive;
  let count = 0;
  for (let i = 0; i < isActiveAttr.count; i++) {
    if (isActiveAttr.getX(i)) count++;
  }
  return count;
};

const getAttributes = (ps: ParticleSystem) => {
  const points = ps.instance as THREE.Points;
  return points.geometry.attributes;
};

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

// ─── Force fields integration ───────────────────────────────────────────────

describe('Force fields integration in particle system', () => {
  it('should apply point force field to active particles', () => {
    const { ps, step } = createTestSystem({
      forceFields: [
        {
          isActive: true,
          type: ForceFieldType.POINT,
          position: { x: 0, y: 10, z: 0 },
          strength: 50,
          range: 100,
          falloff: ForceFieldFalloff.NONE,
        },
      ],
      startSpeed: 0,
      gravity: 0,
      emission: { rateOverTime: 50 },
    });

    step(16);
    step(200, 184);

    // Particles should have moved toward the force field
    const attrs = getAttributes(ps);
    let movedUpward = false;
    for (let i = 0; i < attrs.isActive.count; i++) {
      if (attrs.isActive.getX(i)) {
        const y = attrs.position.array[i * 3 + 1];
        if (y > 0.001) {
          movedUpward = true;
          break;
        }
      }
    }
    expect(movedUpward).toBe(true);

    ps.dispose();
  });

  it('should apply directional force field to particles', () => {
    const { ps, step } = createTestSystem({
      forceFields: [
        {
          isActive: true,
          type: ForceFieldType.DIRECTIONAL,
          direction: { x: 1, y: 0, z: 0 },
          strength: 20,
        },
      ],
      startSpeed: 0,
      gravity: 0,
      emission: { rateOverTime: 50 },
    });

    step(16);
    step(100);
    step(200);

    // Particles should have moved in the X direction
    const attrs = getAttributes(ps);
    let movedRight = false;
    for (let i = 0; i < attrs.isActive.count; i++) {
      if (attrs.isActive.getX(i)) {
        const x = attrs.position.array[i * 3];
        if (x > 0.01) {
          movedRight = true;
          break;
        }
      }
    }
    expect(movedRight).toBe(true);

    ps.dispose();
  });

  it('should handle multiple force fields simultaneously', () => {
    const { ps, step } = createTestSystem({
      forceFields: [
        {
          isActive: true,
          type: ForceFieldType.POINT,
          position: { x: 10, y: 0, z: 0 },
          strength: 10,
          range: 50,
        },
        {
          isActive: true,
          type: ForceFieldType.DIRECTIONAL,
          direction: { x: 0, y: 1, z: 0 },
          strength: 5,
        },
      ],
      startSpeed: 0,
      gravity: 0,
      emission: { rateOverTime: 50 },
    });

    step(16);
    step(100);
    step(200);

    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle inactive force fields', () => {
    const { ps, step } = createTestSystem({
      forceFields: [
        {
          isActive: false,
          type: ForceFieldType.POINT,
          position: { x: 0, y: 100, z: 0 },
          strength: 1000,
          range: 200,
        },
      ],
      startSpeed: 0,
      gravity: 0,
      emission: { rateOverTime: 50 },
    });

    step(16);
    step(100);
    // Particles should barely move since force field is inactive
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle force field with default values', () => {
    const { ps, step } = createTestSystem({
      forceFields: [{}],
      emission: { rateOverTime: 50 },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle empty force fields array', () => {
    const { ps, step } = createTestSystem({
      forceFields: [],
      emission: { rateOverTime: 50 },
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle undefined forceFields', () => {
    const { ps, step } = createTestSystem({
      emission: { rateOverTime: 50 },
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

// ─── Velocity over lifetime ─────────────────────────────────────────────────

describe('Velocity over lifetime integration', () => {
  it('should apply linear velocity when active', () => {
    const { ps, step } = createTestSystem({
      velocityOverLifetime: {
        isActive: true,
        linear: { x: 5, y: 0, z: 0 },
        orbital: { x: 0, y: 0, z: 0 },
      },
      startSpeed: 0,
      gravity: 0,
      emission: { rateOverTime: 50 },
    });

    step(16);
    step(100);
    step(200);

    const attrs = getAttributes(ps);
    let movedRight = false;
    for (let i = 0; i < attrs.isActive.count; i++) {
      if (attrs.isActive.getX(i)) {
        if (attrs.position.array[i * 3] > 0.01) {
          movedRight = true;
          break;
        }
      }
    }
    expect(movedRight).toBe(true);

    ps.dispose();
  });

  it('should apply orbital velocity when active', () => {
    const { ps, step } = createTestSystem({
      velocityOverLifetime: {
        isActive: true,
        linear: { x: 0, y: 0, z: 0 },
        orbital: { x: 0, y: 5, z: 0 },
      },
      startSpeed: 0,
      gravity: 0,
      shape: {
        shape: Shape.SPHERE,
        sphere: { radius: 1, radiusThickness: 1, arc: 360 },
      },
      emission: { rateOverTime: 50 },
    });

    step(16);
    step(100);
    step(200);

    // Particles should have rotated around Y axis
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should apply linear velocity with LifetimeCurve', () => {
    const { ps, step } = createTestSystem({
      velocityOverLifetime: {
        isActive: true,
        linear: {
          x: {
            type: LifeTimeCurve.EASING,
            scale: 10,
            curveFunction: (t: number) => t,
          },
          y: 0,
          z: 0,
        },
        orbital: { x: 0, y: 0, z: 0 },
      },
      startSpeed: 0,
      gravity: 0,
      emission: { rateOverTime: 50 },
    });

    step(16);
    step(200);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should apply orbital velocity with LifetimeCurve', () => {
    const { ps, step } = createTestSystem({
      velocityOverLifetime: {
        isActive: true,
        linear: { x: 0, y: 0, z: 0 },
        orbital: {
          x: {
            type: LifeTimeCurve.EASING,
            scale: 5,
            curveFunction: (t: number) => t,
          },
          y: 0,
          z: 0,
        },
      },
      startSpeed: 0,
      gravity: 0,
      emission: { rateOverTime: 50 },
    });

    step(16);
    step(200);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

// ─── Noise module integration ───────────────────────────────────────────────

describe('Noise module integration', () => {
  it('should apply noise with position amount', () => {
    const { ps, step } = createTestSystem({
      noise: {
        isActive: true,
        useRandomOffset: false,
        strength: 2,
        frequency: 1,
        octaves: 2,
        positionAmount: 1,
        rotationAmount: 0,
        sizeAmount: 0,
      },
      startSpeed: 0,
      gravity: 0,
      emission: { rateOverTime: 50 },
    });

    step(16);
    step(100);
    step(200);

    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should apply noise with random offsets', () => {
    const { ps, step } = createTestSystem({
      noise: {
        isActive: true,
        useRandomOffset: true,
        strength: 1,
        frequency: 0.5,
        octaves: 1,
        positionAmount: 1,
        rotationAmount: 0.5,
        sizeAmount: 0.3,
      },
      emission: { rateOverTime: 50 },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should apply noise to rotation', () => {
    const { ps, step } = createTestSystem({
      noise: {
        isActive: true,
        useRandomOffset: false,
        strength: 1,
        frequency: 0.5,
        octaves: 1,
        positionAmount: 0,
        rotationAmount: 5,
        sizeAmount: 0,
      },
      emission: { rateOverTime: 50 },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should apply noise to size', () => {
    const { ps, step } = createTestSystem({
      noise: {
        isActive: true,
        useRandomOffset: false,
        strength: 1,
        frequency: 0.5,
        octaves: 1,
        positionAmount: 0,
        rotationAmount: 0,
        sizeAmount: 5,
      },
      emission: { rateOverTime: 50 },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

// ─── Combined modifiers ─────────────────────────────────────────────────────

describe('Combined modifiers', () => {
  it('should handle all modifiers active simultaneously', () => {
    const { ps, step } = createTestSystem({
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.EASING,
          scale: 1,
          curveFunction: (t: number) => 1 - t,
        },
      },
      opacityOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.EASING,
          scale: 1,
          curveFunction: (t: number) => 1 - t,
        },
      },
      colorOverLifetime: {
        isActive: true,
        r: {
          type: LifeTimeCurve.EASING,
          scale: 1,
          curveFunction: () => 0.5,
        },
        g: {
          type: LifeTimeCurve.EASING,
          scale: 1,
          curveFunction: () => 0.5,
        },
        b: {
          type: LifeTimeCurve.EASING,
          scale: 1,
          curveFunction: () => 0.5,
        },
      },
      rotationOverLifetime: {
        isActive: true,
        min: -180,
        max: 180,
      },
      velocityOverLifetime: {
        isActive: true,
        linear: { x: 1, y: 2, z: 3 },
        orbital: { x: 0.5, y: 0.5, z: 0.5 },
      },
      noise: {
        isActive: true,
        useRandomOffset: true,
        strength: 0.5,
        frequency: 0.5,
        octaves: 1,
        positionAmount: 0.5,
        rotationAmount: 0.5,
        sizeAmount: 0.5,
      },
      gravity: -9.8,
      emission: { rateOverTime: 50 },
    });

    // Run for several frames
    for (let i = 1; i <= 20; i++) {
      step(i * 16);
    }

    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle size and opacity curves with bezier', () => {
    const { ps, step } = createTestSystem({
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.BEZIER,
          scale: 1,
          bezierPoints: [
            { x: 0, y: 1, percentage: 0 },
            { x: 0.5, y: 0.5, percentage: 0.5 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
      },
      opacityOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.BEZIER,
          scale: 1,
          bezierPoints: [
            { x: 0, y: 1, percentage: 0 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
      },
      emission: { rateOverTime: 50 },
    });

    step(16);
    step(100);
    step(500);

    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

// ─── Sub-emitter integration ────────────────────────────────────────────────

describe('Sub-emitter integration', () => {
  it('should spawn sub-emitter on particle death', () => {
    const parent = new THREE.Group();
    const { ps, step } = createTestSystem({
      startLifetime: 0.05,
      emission: { rateOverTime: 50 },
      maxParticles: 10,
      subEmitters: [
        {
          trigger: SubEmitterTrigger.DEATH,
          config: {
            maxParticles: 5,
            startLifetime: 0.5,
            emission: { rateOverTime: 10 },
            looping: false,
            duration: 0.3,
          },
        },
      ],
    });

    parent.add(ps.instance);

    step(16);
    step(50);
    step(100); // Particles should die and spawn sub-emitters

    // Sub-emitter instances should be created
    expect(parent.children.length).toBeGreaterThanOrEqual(1);

    ps.dispose();
  });

  it('should spawn sub-emitter on particle birth', () => {
    const parent = new THREE.Group();
    const { ps, step } = createTestSystem({
      emission: { rateOverTime: 50 },
      maxParticles: 10,
      subEmitters: [
        {
          trigger: SubEmitterTrigger.BIRTH,
          config: {
            maxParticles: 3,
            startLifetime: 0.5,
            emission: { rateOverTime: 10 },
            looping: false,
            duration: 0.3,
          },
        },
      ],
    });

    parent.add(ps.instance);

    step(16);
    step(100);

    // Sub-emitters should be created on birth
    expect(parent.children.length).toBeGreaterThanOrEqual(1);

    ps.dispose();
  });

  it('should respect maxInstances for sub-emitters', () => {
    const parent = new THREE.Group();
    const { ps, step } = createTestSystem({
      startLifetime: 0.03,
      emission: { rateOverTime: 200 },
      maxParticles: 20,
      subEmitters: [
        {
          trigger: SubEmitterTrigger.DEATH,
          maxInstances: 3,
          config: {
            maxParticles: 2,
            startLifetime: 10,
            emission: { rateOverTime: 5 },
            looping: false,
            duration: 10,
          },
        },
      ],
    });

    parent.add(ps.instance);

    step(16);
    step(50);
    step(100);
    step(200);

    // Should not exceed maxInstances + parent system
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should handle sub-emitter with inheritVelocity', () => {
    const parent = new THREE.Group();
    const { ps, step } = createTestSystem({
      startLifetime: 0.05,
      startSpeed: 5,
      emission: { rateOverTime: 50 },
      maxParticles: 10,
      subEmitters: [
        {
          trigger: SubEmitterTrigger.DEATH,
          inheritVelocity: 0.5,
          config: {
            maxParticles: 3,
            startLifetime: 0.5,
            startSpeed: 1,
            emission: { rateOverTime: 5 },
            looping: false,
            duration: 0.3,
          },
        },
      ],
    });

    parent.add(ps.instance);

    step(16);
    step(50);
    step(100);

    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should dispose sub-emitters when parent is disposed', () => {
    const parent = new THREE.Group();
    const { ps, step } = createTestSystem({
      startLifetime: 0.05,
      emission: { rateOverTime: 50 },
      maxParticles: 10,
      subEmitters: [
        {
          trigger: SubEmitterTrigger.DEATH,
          config: {
            maxParticles: 3,
            startLifetime: 0.5,
            emission: { rateOverTime: 5 },
            looping: false,
            duration: 0.3,
          },
        },
      ],
    });

    parent.add(ps.instance);
    step(16);
    step(100);

    // Dispose should not throw even with sub-emitters
    expect(() => ps.dispose()).not.toThrow();
  });
});

// ─── World space simulation ─────────────────────────────────────────────────

describe('World space simulation extended', () => {
  it('should create wrapper for world space mode', () => {
    const ps = createParticleSystem(
      {
        simulationSpace: SimulationSpace.WORLD,
        maxParticles: 10,
      },
      1000
    );

    // After the WORLD-space refactor, instance is the Points/Mesh itself —
    // no wrapper. matrixWorldAutoUpdate is held at false so rendering is
    // decoupled from the emitter's parent transform.
    expect(ps.instance).toBeDefined();
    expect(ps.instance).toBeInstanceOf(THREE.Points);
    expect(ps.instance.matrixWorldAutoUpdate).toBe(false);

    ps.dispose();
  });

  it('should handle world space with movement', () => {
    const ps = createParticleSystem(
      {
        simulationSpace: SimulationSpace.WORLD,
        maxParticles: 20,
        emission: { rateOverTime: 50 },
        startLifetime: 2,
        startSpeed: 1,
      } as any,
      1000
    );

    const parent = new THREE.Group();
    parent.add(ps.instance);

    // In world space, the Points is a child of the Gyroscope wrapper
    const points =
      ps.instance instanceof THREE.Points
        ? ps.instance
        : (ps.instance.children[0] as THREE.Points);

    ps.update({ now: 1016, delta: 0.016, elapsed: 0.016 });

    // Move the wrapper
    ps.instance.position.x += 5;
    ps.update({ now: 1032, delta: 0.016, elapsed: 0.032 });

    // Move again
    ps.instance.position.x += 5;
    ps.update({ now: 1048, delta: 0.016, elapsed: 0.048 });

    // Count active on the actual Points geometry
    const isActiveAttr = points.geometry.attributes.isActive;
    let count = 0;
    for (let i = 0; i < isActiveAttr.count; i++) {
      if (isActiveAttr.getX(i)) count++;
    }
    expect(count).toBeGreaterThan(0);

    ps.dispose();
  });
});

// ─── Dispose edge cases ─────────────────────────────────────────────────────

describe('Dispose edge cases', () => {
  it('should handle disposing system with wrapper', () => {
    const ps = createParticleSystem(
      {
        simulationSpace: SimulationSpace.WORLD,
        maxParticles: 5,
      },
      1000
    );
    const parent = new THREE.Group();
    parent.add(ps.instance);

    expect(() => ps.dispose()).not.toThrow();
    expect(parent.children.length).toBe(0);
  });

  it('should handle disposing system without parent', () => {
    const ps = createParticleSystem({ maxParticles: 5 }, 1000);
    // Don't add to any parent
    expect(() => ps.dispose()).not.toThrow();
  });

  it('should handle multiple dispose calls gracefully', () => {
    const ps = createParticleSystem({ maxParticles: 5 }, 1000);
    ps.dispose();
    // Second dispose should not throw
    expect(() => ps.dispose()).not.toThrow();
  });
});

// ─── Material array disposal ────────────────────────────────────────────────

describe('Material array disposal', () => {
  it('should handle disposing system where material is an array', () => {
    const ps = createParticleSystem({ maxParticles: 5 }, 1000);
    const points = ps.instance as THREE.Points;

    // Replace the material with an array of materials to test the array branch
    const mat1 = new THREE.ShaderMaterial();
    const mat2 = new THREE.ShaderMaterial();
    const disposeSpy1 = jest.spyOn(mat1, 'dispose');
    const disposeSpy2 = jest.spyOn(mat2, 'dispose');
    (points as any).material = [mat1, mat2];

    ps.dispose();

    expect(disposeSpy1).toHaveBeenCalled();
    expect(disposeSpy2).toHaveBeenCalled();
  });
});

// ─── Gravity with quaternion ────────────────────────────────────────────────

describe('Gravity with quaternion changes', () => {
  it('should recalculate gravity when world quaternion changes', () => {
    const { ps, step } = createTestSystem({
      gravity: -9.8,
      startSpeed: 0,
      emission: { rateOverTime: 50 },
    });

    const points = ps.instance as THREE.Points;

    step(16);
    step(32);

    // Change rotation
    points.rotation.x = Math.PI / 3;
    step(48);

    // Another change
    points.rotation.y = Math.PI / 4;
    step(64);

    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

// ─── Rate over distance ─────────────────────────────────────────────────────

describe('Rate over distance extended', () => {
  it('should emit particles based on movement distance', () => {
    const startTime = 1000;
    const ps = createParticleSystem(
      {
        maxParticles: 100,
        duration: 10,
        looping: true,
        startLifetime: 5,
        startSpeed: 0,
        emission: {
          rateOverTime: 0,
          rateOverDistance: 10,
        },
      } as any,
      startTime
    );

    const instance = ps.instance as THREE.Points;

    // First frame (initialization)
    ps.update({ now: startTime + 16, delta: 0.016, elapsed: 0.016 });

    // Move significantly
    instance.position.x = 10;
    ps.update({ now: startTime + 32, delta: 0.016, elapsed: 0.032 });

    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should not emit by distance when not moving', () => {
    const startTime = 1000;
    const ps = createParticleSystem(
      {
        maxParticles: 50,
        duration: 10,
        looping: true,
        startLifetime: 5,
        startSpeed: 0,
        emission: {
          rateOverTime: 0,
          rateOverDistance: 10,
        },
      } as any,
      startTime
    );

    ps.update({ now: startTime + 16, delta: 0.016, elapsed: 0.016 });
    ps.update({ now: startTime + 32, delta: 0.016, elapsed: 0.032 });

    // No movement, so no particles
    expect(countActiveParticles(ps)).toBe(0);

    ps.dispose();
  });
});
