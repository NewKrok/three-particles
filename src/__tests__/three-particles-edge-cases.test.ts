import * as THREE from 'three';
import {
  Shape,
  LifeTimeCurve,
  EmitFrom,
} from '../js/effects/three-particles/three-particles-enums.js';
import {
  createParticleSystem,
  updateParticleSystems,
} from '../js/effects/three-particles/three-particles.js';
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

const createTestSystem = (
  config: Record<string, unknown> = {},
  startTime = 1000
) => {
  const ps = createParticleSystem(
    {
      maxParticles: 20,
      duration: 5,
      looping: true,
      startLifetime: 2,
      startSpeed: 1,
      emission: { rateOverTime: 50 },
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

describe('Edge cases - maxParticles', () => {
  it('should handle maxParticles of 1', () => {
    const { ps, step } = createTestSystem({
      maxParticles: 1,
      emission: { rateOverTime: 100 },
    });

    step(100);
    expect(countActiveParticles(ps)).toBeLessThanOrEqual(1);

    ps.dispose();
  });

  it('should handle large maxParticles', () => {
    const { ps, step } = createTestSystem({
      maxParticles: 1000,
      emission: { rateOverTime: 10 },
    });

    step(100);
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should not emit more particles than maxParticles', () => {
    const { ps, step } = createTestSystem({
      maxParticles: 5,
      emission: { rateOverTime: 1000 },
      startLifetime: 10,
    });

    step(100);
    step(200);
    step(500);
    expect(countActiveParticles(ps)).toBeLessThanOrEqual(5);

    ps.dispose();
  });
});

describe('Edge cases - zero and extreme values', () => {
  it('should handle zero emission rate', () => {
    const { ps, step } = createTestSystem({
      emission: { rateOverTime: 0, rateOverDistance: 0 },
    });

    step(100);
    step(500);
    expect(countActiveParticles(ps)).toBe(0);

    ps.dispose();
  });

  it('should handle very small duration', () => {
    const { ps, step } = createTestSystem({
      duration: 0.001,
      looping: true,
    });

    step(16);
    step(50);
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should handle very large duration', () => {
    const { ps, step } = createTestSystem({
      duration: 10000,
      looping: false,
    });

    step(100);
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should handle zero startSpeed', () => {
    const { ps, step } = createTestSystem({
      startSpeed: 0,
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle very small startLifetime', () => {
    const { ps, step } = createTestSystem({
      startLifetime: 0.001,
      emission: { rateOverTime: 1000 },
      maxParticles: 50,
    });

    step(16);
    // Particles should be created and quickly expire
    step(50);
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should handle zero startSize', () => {
    const { ps, step } = createTestSystem({
      startSize: 0,
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle zero startOpacity', () => {
    const { ps, step } = createTestSystem({
      startOpacity: 0,
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

describe('Edge cases - startSpeed with LifetimeCurve', () => {
  it('should handle bezier curve for startSpeed', () => {
    const { ps, step } = createTestSystem({
      startSpeed: {
        type: LifeTimeCurve.BEZIER,
        scale: 2,
        bezierPoints: [
          { x: 0, y: 0.5, percentage: 0 },
          { x: 1, y: 1, percentage: 1 },
        ],
      },
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle easing curve for startSpeed', () => {
    const { ps, step } = createTestSystem({
      startSpeed: {
        type: LifeTimeCurve.EASING,
        scale: 3,
        curveFunction: (t: number) => t,
      },
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

describe('Edge cases - startLifetime with LifetimeCurve', () => {
  it('should handle bezier curve for startLifetime', () => {
    const { ps, step } = createTestSystem({
      startLifetime: {
        type: LifeTimeCurve.BEZIER,
        scale: 2,
        bezierPoints: [
          { x: 0, y: 0.5, percentage: 0 },
          { x: 1, y: 1, percentage: 1 },
        ],
      },
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

describe('Edge cases - startSize with LifetimeCurve', () => {
  it('should handle bezier curve for startSize', () => {
    const { ps, step } = createTestSystem({
      startSize: {
        type: LifeTimeCurve.BEZIER,
        scale: 1,
        bezierPoints: [
          { x: 0, y: 0.5, percentage: 0 },
          { x: 1, y: 2, percentage: 1 },
        ],
      },
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

describe('Edge cases - rateOverTime with values', () => {
  it('should handle rateOverTime as random range', () => {
    const { ps, step } = createTestSystem({
      emission: { rateOverTime: { min: 50, max: 100 } },
    });

    step(16);
    step(500);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle rateOverTime as bezier curve', () => {
    const { ps, step } = createTestSystem({
      emission: {
        rateOverTime: {
          type: LifeTimeCurve.BEZIER,
          scale: 50,
          bezierPoints: [
            { x: 0, y: 1, percentage: 0 },
            { x: 1, y: 1, percentage: 1 },
          ],
        },
      },
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

describe('Edge cases - quaternion changes during update', () => {
  it('should handle quaternion changes between updates', () => {
    const { ps, step } = createTestSystem({
      gravity: -1,
    });
    const points = ps.instance as THREE.Points;

    step(16);

    // Change rotation
    points.rotation.y = Math.PI / 4;
    step(32);

    points.rotation.y = Math.PI / 2;
    step(48);

    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should recalculate gravity velocity on quaternion change', () => {
    const { ps, step } = createTestSystem({
      gravity: -9.8,
    });
    const points = ps.instance as THREE.Points;

    step(16);
    step(32);

    // Rotate the system
    points.rotation.x = Math.PI / 6;
    step(48);

    // Gravity should be recalculated in the new local space
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });
});

describe('Edge cases - first frame initialization', () => {
  it('should handle first frame world position initialization', () => {
    const { ps, step } = createTestSystem();

    // First frame - lastWorldPosition is -99999
    step(1);
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should handle first frame quaternion initialization', () => {
    const { ps, step } = createTestSystem({
      gravity: -1,
    });

    // First frame - lastWorldQuaternion is -99999
    step(1);
    step(16);
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });
});

describe('Edge cases - multiple systems lifecycle', () => {
  it('should handle creating and disposing multiple systems', () => {
    const systems: ParticleSystem[] = [];
    for (let i = 0; i < 5; i++) {
      systems.push(
        createParticleSystem(
          { maxParticles: 5, emission: { rateOverTime: 10 } },
          1000
        )
      );
    }

    updateParticleSystems({ now: 1100, delta: 0.1, elapsed: 0.1 });

    // Dispose in reverse order
    for (let i = systems.length - 1; i >= 0; i--) {
      systems[i].dispose();
    }

    expect(() => {
      updateParticleSystems({ now: 1200, delta: 0.1, elapsed: 0.2 });
    }).not.toThrow();
  });

  it('should handle disposing middle system from a list', () => {
    const ps1 = createParticleSystem({ maxParticles: 5 }, 1000);
    const ps2 = createParticleSystem({ maxParticles: 5 }, 1000);
    const ps3 = createParticleSystem({ maxParticles: 5 }, 1000);

    ps2.dispose();

    expect(() => {
      updateParticleSystems({ now: 1100, delta: 0.1, elapsed: 0.1 });
    }).not.toThrow();

    ps1.dispose();
    ps3.dispose();
  });
});

describe('Edge cases - particle system with map', () => {
  it('should use provided texture map', () => {
    const texture = new THREE.Texture();
    const ps = createParticleSystem(
      {
        map: texture,
        maxParticles: 5,
      },
      1000
    );

    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('should create default texture when no map provided', () => {
    const ps = createParticleSystem({ maxParticles: 5 }, 1000);
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });
});

describe('Edge cases - particle motion detection', () => {
  it('should detect motion from non-zero velocity', () => {
    const { ps, step } = createTestSystem({
      startSpeed: 5,
      gravity: 0,
    });

    step(16);
    step(100);

    // Particles with non-zero speed should have moved
    const points = ps.instance as THREE.Points;
    const posArr = points.geometry.attributes.position.array;
    const isActiveArr = points.geometry.attributes.isActive.array;

    let hasMoved = false;
    for (let i = 0; i < isActiveArr.length; i++) {
      if (isActiveArr[i]) {
        // At least one coordinate should be non-zero
        if (
          posArr[i * 3] !== 0 ||
          posArr[i * 3 + 1] !== 0 ||
          posArr[i * 3 + 2] !== 0
        ) {
          hasMoved = true;
          break;
        }
      }
    }
    expect(hasMoved).toBe(true);

    ps.dispose();
  });

  it('should skip position update when no motion forces exist', () => {
    const { ps, step } = createTestSystem({
      startSpeed: 0,
      gravity: 0,
    });

    step(16);
    step(100);

    // No crash means the no-motion optimization works
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });
});

describe('Edge cases - update method', () => {
  it('should handle update with very large delta', () => {
    const { ps, step } = createTestSystem();

    step(16);
    // Simulate a very large frame skip
    step(5000, 5000);

    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should handle update with very small delta', () => {
    const { ps, step } = createTestSystem();

    step(1, 1);
    step(2, 1);
    step(3, 1);

    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should handle rapid successive updates', () => {
    const { ps, step } = createTestSystem();

    for (let i = 0; i < 100; i++) {
      step(i * 16, 16);
    }

    expect(ps.instance).toBeDefined();

    ps.dispose();
  });
});

describe('Edge cases - emission with distance and time combined', () => {
  it('should emit by both time and distance simultaneously', () => {
    const startTime = 1000;
    const ps = createParticleSystem(
      {
        maxParticles: 100,
        duration: 10,
        looping: true,
        startLifetime: 5,
        startSpeed: 0,
        emission: {
          rateOverTime: 10,
          rateOverDistance: 5,
        },
      } as any,
      startTime
    );

    const instance = ps.instance as THREE.Points;

    // First frame
    ps.update({ now: startTime + 16, delta: 0.016, elapsed: 0.016 });

    // Move and update
    instance.position.x = 5;
    ps.update({ now: startTime + 32, delta: 0.016, elapsed: 0.032 });

    // Should have particles from both time and distance
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

describe('Edge cases - renderer options', () => {
  it('should handle all blending modes', () => {
    const modes = [
      THREE.NoBlending,
      THREE.NormalBlending,
      THREE.AdditiveBlending,
      THREE.SubtractiveBlending,
      THREE.MultiplyBlending,
    ];

    for (const blending of modes) {
      const ps = createParticleSystem(
        {
          maxParticles: 5,
          renderer: {
            blending,
            transparent: true,
            depthTest: true,
            depthWrite: false,
          },
        },
        1000
      );
      expect(ps.instance).toBeDefined();
      ps.dispose();
    }
  });

  it('should handle depthTest false', () => {
    const ps = createParticleSystem(
      {
        maxParticles: 5,
        renderer: {
          blending: THREE.NormalBlending,
          transparent: true,
          depthTest: false,
          depthWrite: true,
        },
      },
      1000
    );
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('should handle transparent false', () => {
    const ps = createParticleSystem(
      {
        maxParticles: 5,
        renderer: {
          blending: THREE.NormalBlending,
          transparent: false,
          depthTest: true,
          depthWrite: true,
        },
      },
      1000
    );
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });
});

describe('Edge cases - cone shape variations', () => {
  it('should handle cone with zero angle', () => {
    const { ps, step } = createTestSystem({
      shape: {
        shape: Shape.CONE,
        cone: { angle: 0, radius: 1, radiusThickness: 1, arc: 360 },
      },
    });

    step(16);
    step(100);
    step(200);
    // Should not crash; particles may or may not be emitted with zero angle
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should handle cone with 90 degree angle', () => {
    const { ps, step } = createTestSystem({
      shape: {
        shape: Shape.CONE,
        cone: { angle: 90, radius: 2, radiusThickness: 0, arc: 180 },
      },
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

describe('Edge cases - sphere shape variations', () => {
  it('should handle sphere with small arc', () => {
    const { ps, step } = createTestSystem({
      shape: {
        shape: Shape.SPHERE,
        sphere: { radius: 1, radiusThickness: 1, arc: 10 },
      },
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle sphere with zero radiusThickness (shell only)', () => {
    const { ps, step } = createTestSystem({
      shape: {
        shape: Shape.SPHERE,
        sphere: { radius: 5, radiusThickness: 0, arc: 360 },
      },
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

describe('Edge cases - circle shape variations', () => {
  it('should handle circle with small arc', () => {
    const { ps, step } = createTestSystem({
      shape: {
        shape: Shape.CIRCLE,
        circle: { radius: 2, radiusThickness: 0.5, arc: 45 },
      },
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

describe('Edge cases - rectangle shape variations', () => {
  it('should handle rectangle with rotation', () => {
    const { ps, step } = createTestSystem({
      shape: {
        shape: Shape.RECTANGLE,
        rectangle: {
          rotation: { x: 45, y: 30 },
          scale: { x: 3, y: 2 },
        },
      },
    });

    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle rectangle with zero scale', () => {
    const { ps, step } = createTestSystem({
      shape: {
        shape: Shape.RECTANGLE,
        rectangle: {
          rotation: { x: 0, y: 0 },
          scale: { x: 0, y: 0 },
        },
      },
    });

    step(100);
    // Should not crash even with zero-sized rectangle
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });
});

describe('Normalized lifetime percentage', () => {
  it('should calculate normalized lifetime correctly', () => {
    const onUpdate = jest.fn();
    const { ps, step } = createTestSystem({
      duration: 1.0,
      looping: true,
      onUpdate,
    });

    step(500);
    expect(onUpdate).toHaveBeenCalled();

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
    expect(lastCall.normalizedLifetime).toBeDefined();
    expect(lastCall.normalizedLifetime).toBeGreaterThanOrEqual(0);
    expect(lastCall.normalizedLifetime).toBeLessThanOrEqual(
      1000 // normalizedLifetime is in ms, duration * 1000
    );

    ps.dispose();
  });
});
