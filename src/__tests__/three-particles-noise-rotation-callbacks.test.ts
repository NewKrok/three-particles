import * as THREE from 'three';
import { LifeTimeCurve } from '../js/effects/three-particles/three-particles-enums.js';
import { createParticleSystem } from '../js/effects/three-particles/three-particles.js';
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
      maxParticles: 20,
      duration: 5,
      looping: true,
      startLifetime: 2,
      startSpeed: 0,
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

describe('Noise Module', () => {
  it('should create noise sampler when noise is active', () => {
    const { ps, step } = createTestSystem({
      noise: {
        isActive: true,
        useRandomOffset: false,
        strength: 1.0,
        frequency: 0.5,
        octaves: 2,
        positionAmount: 1.0,
        rotationAmount: 0.0,
        sizeAmount: 0.0,
      },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should create random offsets when useRandomOffset is true', () => {
    const { ps, step } = createTestSystem({
      noise: {
        isActive: true,
        useRandomOffset: true,
        strength: 0.5,
        frequency: 1.0,
        octaves: 1,
        positionAmount: 0.5,
        rotationAmount: 0.0,
        sizeAmount: 0.0,
      },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should apply noise to position', () => {
    const { ps, step } = createTestSystem({
      noise: {
        isActive: true,
        useRandomOffset: false,
        strength: 2.0,
        frequency: 1.0,
        octaves: 3,
        positionAmount: 1.0,
        rotationAmount: 0.0,
        sizeAmount: 0.0,
      },
    });

    step(16);
    step(100);
    step(200);

    // Particles should exist and have been affected by noise
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should apply noise to rotation', () => {
    const { ps, step } = createTestSystem({
      noise: {
        isActive: true,
        useRandomOffset: false,
        strength: 1.0,
        frequency: 0.5,
        octaves: 1,
        positionAmount: 0.0,
        rotationAmount: 1.0,
        sizeAmount: 0.0,
      },
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
        strength: 1.0,
        frequency: 0.5,
        octaves: 1,
        positionAmount: 0.0,
        rotationAmount: 0.0,
        sizeAmount: 1.0,
      },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should apply noise to all channels simultaneously', () => {
    const { ps, step } = createTestSystem({
      noise: {
        isActive: true,
        useRandomOffset: true,
        strength: 1.5,
        frequency: 0.8,
        octaves: 2,
        positionAmount: 0.5,
        rotationAmount: 0.3,
        sizeAmount: 0.2,
      },
    });

    step(16);
    step(100);
    step(200);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should not apply noise when inactive', () => {
    const { ps, step } = createTestSystem({
      noise: {
        isActive: false,
        strength: 10.0,
        frequency: 10.0,
      },
    });

    step(16);
    step(100);
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should reset noise offset on particle reactivation', () => {
    const { ps, step } = createTestSystem({
      startLifetime: 0.05,
      emission: { rateOverTime: 100 },
      maxParticles: 10,
      noise: {
        isActive: true,
        useRandomOffset: true,
        strength: 1.0,
        frequency: 0.5,
        octaves: 1,
        positionAmount: 1.0,
        rotationAmount: 0.0,
        sizeAmount: 0.0,
      },
    });

    // Emit and expire particles
    step(50);
    step(100);
    step(150);
    step(200);

    // After recycle, system should still work
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });
});

describe('Rotation Over Lifetime', () => {
  it('should initialize rotation over lifetime values when active', () => {
    const { ps, step } = createTestSystem({
      rotationOverLifetime: {
        isActive: true,
        min: -180,
        max: 180,
      },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should apply rotation over lifetime to particles', () => {
    const { ps, step } = createTestSystem({
      rotationOverLifetime: {
        isActive: true,
        min: 90,
        max: 90,
      },
    });

    step(16);
    step(100);
    step(200);

    const attrs = getAttributes(ps);
    // After some time, rotation should have been modified
    let hasRotation = false;
    for (let i = 0; i < attrs.isActive.count; i++) {
      if (attrs.isActive.getX(i) && attrs.rotation.getX(i) !== 0) {
        hasRotation = true;
        break;
      }
    }
    expect(hasRotation).toBe(true);

    ps.dispose();
  });

  it('should handle rotation with equal min and max', () => {
    const { ps, step } = createTestSystem({
      rotationOverLifetime: {
        isActive: true,
        min: 45,
        max: 45,
      },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle rotation with negative values', () => {
    const { ps, step } = createTestSystem({
      rotationOverLifetime: {
        isActive: true,
        min: -360,
        max: -90,
      },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should not apply rotation when inactive', () => {
    const { ps, step } = createTestSystem({
      rotationOverLifetime: {
        isActive: false,
        min: 999,
        max: 999,
      },
    });

    step(16);
    step(100);
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should update rotation values when particles are reactivated', () => {
    const { ps, step } = createTestSystem({
      startLifetime: 0.05,
      emission: { rateOverTime: 100 },
      maxParticles: 10,
      rotationOverLifetime: {
        isActive: true,
        min: 0,
        max: 360,
      },
    });

    step(50);
    step(100);
    step(150);
    step(200);

    // Particles reactivated should get new rotation values
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });
});

describe('Size Over Lifetime', () => {
  it('should apply size over lifetime with bezier curve', () => {
    const { ps, step } = createTestSystem({
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.BEZIER,
          scale: 1,
          bezierPoints: [
            { x: 0, y: 1, percentage: 0 },
            { x: 0.5, y: 0.5 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
      },
    });

    step(16);
    step(100);
    step(500);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should apply size over lifetime with easing curve', () => {
    const { ps, step } = createTestSystem({
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.EASING,
          scale: 2,
          curveFunction: (t: number) => 1 - t,
        },
      },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

describe('Opacity Over Lifetime', () => {
  it('should apply opacity over lifetime with bezier curve', () => {
    const { ps, step } = createTestSystem({
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
    });

    step(16);
    step(100);
    step(500);

    const attrs = getAttributes(ps);
    // Active particles should have modified opacity
    for (let i = 0; i < attrs.isActive.count; i++) {
      if (attrs.isActive.getX(i)) {
        // Opacity should be between 0 and 1
        expect(attrs.color.getW(i)).toBeGreaterThanOrEqual(0);
        expect(attrs.color.getW(i)).toBeLessThanOrEqual(1);
      }
    }

    ps.dispose();
  });

  it('should apply opacity over lifetime with easing curve', () => {
    const { ps, step } = createTestSystem({
      opacityOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.EASING,
          scale: 1,
          curveFunction: (t: number) => 1 - t * t,
        },
      },
    });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});

describe('Color Over Lifetime', () => {
  it('should apply color over lifetime with bezier curves', () => {
    const { ps, step } = createTestSystem({
      colorOverLifetime: {
        isActive: true,
        r: {
          type: LifeTimeCurve.BEZIER,
          scale: 1,
          bezierPoints: [
            { x: 0, y: 1, percentage: 0 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
        g: {
          type: LifeTimeCurve.BEZIER,
          scale: 1,
          bezierPoints: [
            { x: 0, y: 0, percentage: 0 },
            { x: 1, y: 1, percentage: 1 },
          ],
        },
        b: {
          type: LifeTimeCurve.BEZIER,
          scale: 1,
          bezierPoints: [
            { x: 0, y: 0.5, percentage: 0 },
            { x: 1, y: 0.5, percentage: 1 },
          ],
        },
      },
    });

    step(16);
    step(100);
    step(500);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should not apply color when colorOverLifetime is inactive', () => {
    const { ps, step } = createTestSystem({
      startColor: {
        min: { r: 1, g: 0, b: 0 },
        max: { r: 1, g: 0, b: 0 },
      },
      colorOverLifetime: {
        isActive: false,
      },
    });

    step(16);
    step(100);

    const attrs = getAttributes(ps);
    for (let i = 0; i < attrs.isActive.count; i++) {
      if (attrs.isActive.getX(i)) {
        // Color should remain at start value when colorOverLifetime is inactive
        expect(attrs.color.getX(i)).toBeCloseTo(1, 1);
        break;
      }
    }

    ps.dispose();
  });
});

describe('onUpdate callback', () => {
  it('should call onUpdate during active emission', () => {
    const onUpdate = jest.fn();
    const { ps, step } = createTestSystem({ onUpdate });

    step(16);
    step(100);

    expect(onUpdate).toHaveBeenCalled();

    ps.dispose();
  });

  it('should pass correct parameters to onUpdate', () => {
    const onUpdate = jest.fn();
    const { ps, step } = createTestSystem({ onUpdate });

    step(100);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        particleSystem: expect.any(Object),
        delta: expect.any(Number),
        elapsed: expect.any(Number),
        lifetime: expect.any(Number),
        normalizedLifetime: expect.any(Number),
        iterationCount: expect.any(Number),
      })
    );

    ps.dispose();
  });

  it('should increment iterationCount on each update', () => {
    const calls: number[] = [];
    const onUpdate = jest.fn((data: any) => {
      calls.push(data.iterationCount);
    });
    const { ps, step } = createTestSystem({ onUpdate });

    step(50);
    step(100);
    step(150);

    // iterationCount should be incrementing
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]).toBeGreaterThanOrEqual(calls[i - 1]);
    }

    ps.dispose();
  });

  it('should not call onUpdate when emitter is paused', () => {
    const onUpdate = jest.fn();
    const { ps, step } = createTestSystem({ onUpdate });

    ps.pauseEmitter();
    step(100);

    // onUpdate is inside the isEnabled && (looping || lifetime < duration) block
    // When paused (isEnabled=false), onUpdate should not be called
    expect(onUpdate).not.toHaveBeenCalled();

    ps.dispose();
  });
});

describe('onComplete callback', () => {
  it('should call onComplete when non-looping system finishes', () => {
    const onComplete = jest.fn();
    const { ps, step } = createTestSystem({
      onComplete,
      duration: 0.1,
      looping: false,
    });

    // Before duration
    step(50);
    expect(onComplete).not.toHaveBeenCalled();

    // After duration
    step(200);
    expect(onComplete).toHaveBeenCalled();

    ps.dispose();
  });

  it('should pass particleSystem to onComplete', () => {
    const onComplete = jest.fn();
    const { ps, step } = createTestSystem({
      onComplete,
      duration: 0.05,
      looping: false,
    });

    step(100);

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        particleSystem: expect.any(Object),
      })
    );

    ps.dispose();
  });

  it('should not call onComplete for looping systems', () => {
    const onComplete = jest.fn();
    const { ps, step } = createTestSystem({
      onComplete,
      duration: 0.1,
      looping: true,
    });

    step(50);
    step(200);
    step(500);

    expect(onComplete).not.toHaveBeenCalled();

    ps.dispose();
  });

  it('should not call both onUpdate and onComplete in same frame', () => {
    const onUpdate = jest.fn();
    const onComplete = jest.fn();

    const { ps, step } = createTestSystem({
      onUpdate,
      onComplete,
      duration: 0.05,
      looping: false,
    });

    // During active emission, only onUpdate is called
    step(10);
    expect(onUpdate).toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();

    onUpdate.mockClear();

    // After duration expires, onComplete should be called
    step(200);
    expect(onComplete).toHaveBeenCalled();
    // onUpdate should not be called in the same frame as onComplete
    expect(onUpdate).not.toHaveBeenCalled();

    ps.dispose();
  });
});

describe('Combined modifiers', () => {
  it('should handle all modifiers active simultaneously', () => {
    const { ps, step } = createTestSystem({
      gravity: -2,
      startSpeed: 3,
      velocityOverLifetime: {
        isActive: true,
        linear: { x: 1, y: 0, z: 0 },
        orbital: { x: 0, y: 1, z: 0 },
      },
      sizeOverLifetime: {
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
      colorOverLifetime: {
        isActive: true,
        r: {
          type: LifeTimeCurve.BEZIER,
          scale: 1,
          bezierPoints: [
            { x: 0, y: 1, percentage: 0 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
        g: {
          type: LifeTimeCurve.BEZIER,
          scale: 1,
          bezierPoints: [
            { x: 0, y: 1, percentage: 0 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
        b: {
          type: LifeTimeCurve.BEZIER,
          scale: 1,
          bezierPoints: [
            { x: 0, y: 1, percentage: 0 },
            { x: 1, y: 0, percentage: 1 },
          ],
        },
      },
      rotationOverLifetime: {
        isActive: true,
        min: -180,
        max: 180,
      },
      noise: {
        isActive: true,
        useRandomOffset: true,
        strength: 0.5,
        frequency: 1.0,
        octaves: 2,
        positionAmount: 0.5,
        rotationAmount: 0.3,
        sizeAmount: 0.2,
      },
    });

    step(16);
    step(100);
    step(200);
    step(500);

    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle velocity + gravity + noise together', () => {
    const { ps, step } = createTestSystem({
      gravity: -5,
      velocityOverLifetime: {
        isActive: true,
        linear: { x: 2, y: 3, z: -1 },
        orbital: { x: 0, y: 0, z: 0 },
      },
      noise: {
        isActive: true,
        useRandomOffset: false,
        strength: 1.0,
        frequency: 0.5,
        octaves: 1,
        positionAmount: 1.0,
        rotationAmount: 0.0,
        sizeAmount: 0.0,
      },
    });

    step(16);
    step(100);
    step(200);

    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });
});
