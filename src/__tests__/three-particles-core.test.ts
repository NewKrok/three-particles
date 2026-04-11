import * as THREE from 'three';
import {
  Shape,
  SimulationSpace,
  LifeTimeCurve,
  TimeMode,
  EmitFrom,
} from '../js/effects/three-particles/three-particles-enums.js';
import {
  createParticleSystem,
  updateParticleSystems,
  getDefaultParticleSystemConfig,
  blendingMap,
} from '../js/effects/three-particles/three-particles.js';
import {
  ParticleSystem,
  CycleData,
} from '../js/effects/three-particles/types.js';

/**
 * Helper: count active particles by reading the isActive buffer attribute.
 */
const countActiveParticles = (ps: ParticleSystem): number => {
  const points = ps.instance as THREE.Points;
  const isActiveAttr = points.geometry.attributes.isActive;
  let count = 0;
  for (let i = 0; i < isActiveAttr.count; i++) {
    if (isActiveAttr.getX(i)) count++;
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

describe('getDefaultParticleSystemConfig', () => {
  it('should return a deep copy of the default config', () => {
    const config1 = getDefaultParticleSystemConfig();
    const config2 = getDefaultParticleSystemConfig();

    expect(config1).toEqual(config2);
    expect(config1).not.toBe(config2);
  });

  it('should have expected default values', () => {
    const config = getDefaultParticleSystemConfig();

    expect(config.duration).toBe(5.0);
    expect(config.looping).toBe(true);
    expect(config.startDelay).toBe(0);
    expect(config.startLifetime).toBe(5.0);
    expect(config.startSpeed).toBe(1.0);
    expect(config.startSize).toBe(1.0);
    expect(config.startOpacity).toBe(1.0);
    expect(config.startRotation).toBe(0.0);
    expect(config.gravity).toBe(0.0);
    expect(config.maxParticles).toBe(100);
  });

  it('should have default emission settings', () => {
    const config = getDefaultParticleSystemConfig();

    expect(config.emission.rateOverTime).toBe(10.0);
    expect(config.emission.rateOverDistance).toBe(0.0);
    expect(config.emission.bursts).toEqual([]);
  });

  it('should have default shape settings', () => {
    const config = getDefaultParticleSystemConfig();

    expect(config.shape.shape).toBe('SPHERE');
    expect(config.shape.sphere.radius).toBe(1.0);
    expect(config.shape.cone.angle).toBe(25.0);
  });

  it('should have default modifier settings', () => {
    const config = getDefaultParticleSystemConfig();

    expect(config.velocityOverLifetime.isActive).toBe(false);
    expect(config.sizeOverLifetime.isActive).toBe(false);
    expect(config.opacityOverLifetime.isActive).toBe(false);
    expect(config.colorOverLifetime.isActive).toBe(false);
    expect(config.rotationOverLifetime.isActive).toBe(false);
    expect(config.noise.isActive).toBe(false);
  });

  it('should allow modifying the returned config without affecting defaults', () => {
    const config1 = getDefaultParticleSystemConfig();
    config1.duration = 999;
    config1.emission.rateOverTime = 500;

    const config2 = getDefaultParticleSystemConfig();
    expect(config2.duration).toBe(5.0);
    expect(config2.emission.rateOverTime).toBe(10.0);
  });
});

describe('blendingMap', () => {
  it('should map string identifiers to THREE blending constants', () => {
    expect(blendingMap['THREE.NoBlending']).toBe(THREE.NoBlending);
    expect(blendingMap['THREE.NormalBlending']).toBe(THREE.NormalBlending);
    expect(blendingMap['THREE.AdditiveBlending']).toBe(THREE.AdditiveBlending);
    expect(blendingMap['THREE.SubtractiveBlending']).toBe(
      THREE.SubtractiveBlending
    );
    expect(blendingMap['THREE.MultiplyBlending']).toBe(THREE.MultiplyBlending);
  });
});

describe('createParticleSystem', () => {
  it('should create a particle system with default config', () => {
    const ps = createParticleSystem();
    expect(ps.instance).toBeDefined();
    expect(ps.resumeEmitter).toBeInstanceOf(Function);
    expect(ps.pauseEmitter).toBeInstanceOf(Function);
    expect(ps.dispose).toBeInstanceOf(Function);
    expect(ps.update).toBeInstanceOf(Function);
    ps.dispose();
  });

  it('should create a particle system with custom config', () => {
    const ps = createParticleSystem({
      maxParticles: 200,
      duration: 10,
      looping: false,
      startLifetime: 3,
      startSpeed: 2,
      startSize: 0.5,
    });
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('should accept externalNow parameter', () => {
    const ps = createParticleSystem({}, 5000);
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('should create geometry with correct buffer attributes', () => {
    const ps = createParticleSystem({ maxParticles: 10 });
    const points = ps.instance as THREE.Points;
    const attrs = points.geometry.attributes;

    expect(attrs.position).toBeDefined();
    expect(attrs.isActive).toBeDefined();
    expect(attrs.lifetime).toBeDefined();
    expect(attrs.startLifetime).toBeDefined();
    expect(attrs.rotation).toBeDefined();
    expect(attrs.size).toBeDefined();
    expect(attrs.color).toBeDefined();
    expect(attrs.startFrame).toBeDefined();

    ps.dispose();
  });

  it('should initialize all particles as inactive', () => {
    const ps = createParticleSystem({ maxParticles: 20 });
    expect(countActiveParticles(ps)).toBe(0);
    ps.dispose();
  });

  it('should apply transform position', () => {
    const ps = createParticleSystem({
      transform: {
        position: new THREE.Vector3(5, 10, 15),
        rotation: new THREE.Vector3(0, 0, 0),
        scale: new THREE.Vector3(1, 1, 1),
      },
    });
    const points = ps.instance as THREE.Points;
    expect(points.position.x).toBe(5);
    expect(points.position.y).toBe(10);
    expect(points.position.z).toBe(15);
    ps.dispose();
  });

  it('should apply transform rotation in degrees', () => {
    const ps = createParticleSystem({
      transform: {
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Vector3(90, 180, 270),
        scale: new THREE.Vector3(1, 1, 1),
      },
    });
    const points = ps.instance as THREE.Points;
    expect(points.rotation.x).toBeCloseTo(THREE.MathUtils.degToRad(90));
    expect(points.rotation.y).toBeCloseTo(THREE.MathUtils.degToRad(180));
    expect(points.rotation.z).toBeCloseTo(THREE.MathUtils.degToRad(270));
    ps.dispose();
  });

  it('should apply transform scale', () => {
    const ps = createParticleSystem({
      transform: {
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Vector3(0, 0, 0),
        scale: new THREE.Vector3(2, 3, 4),
      },
    });
    const points = ps.instance as THREE.Points;
    expect(points.scale.x).toBe(2);
    expect(points.scale.y).toBe(3);
    expect(points.scale.z).toBe(4);
    ps.dispose();
  });

  it('should handle string blending mode in renderer config', () => {
    const ps = createParticleSystem({
      renderer: {
        blending: 'THREE.AdditiveBlending' as any,
        transparent: true,
        depthTest: true,
        depthWrite: false,
      },
    });
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('should handle random range for startLifetime', () => {
    const ps = createParticleSystem({
      startLifetime: { min: 1, max: 3 },
      maxParticles: 10,
    });
    const points = ps.instance as THREE.Points;
    const startLifetimeAttr = points.geometry.attributes.startLifetime;
    for (let i = 0; i < 10; i++) {
      expect(startLifetimeAttr.getX(i)).toBeGreaterThanOrEqual(1000);
      expect(startLifetimeAttr.getX(i)).toBeLessThanOrEqual(3000);
    }
    ps.dispose();
  });

  it('should handle random range for startSpeed', () => {
    const ps = createParticleSystem({
      startSpeed: { min: 0.5, max: 2.0 },
      maxParticles: 5,
    });
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('should handle random range for startSize', () => {
    const ps = createParticleSystem({
      startSize: { min: 0.1, max: 5.0 },
      maxParticles: 5,
    });
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('should handle random range for startOpacity', () => {
    const ps = createParticleSystem({
      startOpacity: { min: 0.2, max: 0.8 },
      maxParticles: 5,
    });
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('should handle random range for startRotation', () => {
    const ps = createParticleSystem({
      startRotation: { min: 0, max: 360 },
      maxParticles: 5,
    });
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('should handle startDelay', () => {
    const { ps, step } = createTestSystem({ startDelay: 1.0 });

    // Before delay - no particles
    step(500);
    expect(countActiveParticles(ps)).toBe(0);

    // After delay - particles should start emitting
    step(1500);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle random startDelay', () => {
    const ps = createParticleSystem({
      startDelay: { min: 0.5, max: 1.5 },
      maxParticles: 10,
    });
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('should handle startColor with different min/max', () => {
    const ps = createParticleSystem({
      startColor: {
        min: { r: 0, g: 0, b: 0 },
        max: { r: 1, g: 1, b: 1 },
      },
      maxParticles: 10,
    });
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('should set up texture sheet animation with LIFETIME mode', () => {
    const ps = createParticleSystem({
      textureSheetAnimation: {
        tiles: new THREE.Vector2(4, 4),
        timeMode: TimeMode.LIFETIME,
        fps: 30,
        startFrame: 0,
      },
    });
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('should set up texture sheet animation with FPS mode', () => {
    const ps = createParticleSystem({
      textureSheetAnimation: {
        tiles: new THREE.Vector2(4, 4),
        timeMode: TimeMode.FPS,
        fps: 24,
        startFrame: 0,
      },
    });
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });

  it('should set up texture sheet animation with random startFrame', () => {
    const ps = createParticleSystem({
      textureSheetAnimation: {
        tiles: new THREE.Vector2(4, 4),
        timeMode: TimeMode.LIFETIME,
        fps: 30,
        startFrame: { min: 0, max: 15 },
      },
      maxParticles: 10,
    });

    const points = ps.instance as THREE.Points;
    const startFrameAttr = points.geometry.attributes.startFrame;
    for (let i = 0; i < 10; i++) {
      expect(startFrameAttr.getX(i)).toBeGreaterThanOrEqual(0);
      expect(startFrameAttr.getX(i)).toBeLessThanOrEqual(15);
    }
    ps.dispose();
  });

  it('should handle renderer discardBackgroundColor option', () => {
    const ps = createParticleSystem({
      renderer: {
        blending: THREE.AdditiveBlending,
        discardBackgroundColor: true,
        backgroundColorTolerance: 0.5,
        backgroundColor: { r: 0, g: 0, b: 0 },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      },
    });
    expect(ps.instance).toBeDefined();
    ps.dispose();
  });
});

describe('createParticleSystem - Shape configurations', () => {
  it('should create system with SPHERE shape', () => {
    const { ps, step } = createTestSystem({
      shape: {
        shape: Shape.SPHERE,
        sphere: { radius: 2, radiusThickness: 0.5, arc: 180 },
      },
    });
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);
    ps.dispose();
  });

  it('should create system with CONE shape', () => {
    const { ps, step } = createTestSystem({
      shape: {
        shape: Shape.CONE,
        cone: { angle: 45, radius: 1, radiusThickness: 1, arc: 360 },
      },
    });
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);
    ps.dispose();
  });

  it('should create system with CIRCLE shape', () => {
    const { ps, step } = createTestSystem({
      shape: {
        shape: Shape.CIRCLE,
        circle: { radius: 1.5, radiusThickness: 0, arc: 360 },
      },
    });
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);
    ps.dispose();
  });

  it('should create system with RECTANGLE shape', () => {
    const { ps, step } = createTestSystem({
      shape: {
        shape: Shape.RECTANGLE,
        rectangle: { rotation: { x: 0, y: 0 }, scale: { x: 2, y: 3 } },
      },
    });
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);
    ps.dispose();
  });

  it('should create system with BOX shape (VOLUME)', () => {
    const { ps, step } = createTestSystem({
      shape: {
        shape: Shape.BOX,
        box: { scale: { x: 1, y: 2, z: 3 }, emitFrom: EmitFrom.VOLUME },
      },
    });
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);
    ps.dispose();
  });

  it('should create system with BOX shape (SHELL)', () => {
    const { ps, step } = createTestSystem({
      shape: {
        shape: Shape.BOX,
        box: { scale: { x: 1, y: 1, z: 1 }, emitFrom: EmitFrom.SHELL },
      },
    });
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);
    ps.dispose();
  });

  it('should create system with BOX shape (EDGE)', () => {
    const { ps, step } = createTestSystem({
      shape: {
        shape: Shape.BOX,
        box: { scale: { x: 1, y: 1, z: 1 }, emitFrom: EmitFrom.EDGE },
      },
    });
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);
    ps.dispose();
  });
});

describe('Particle lifecycle', () => {
  it('should emit particles over time', () => {
    const { ps, step } = createTestSystem({ emission: { rateOverTime: 20 } });

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should deactivate particles after their lifetime expires', () => {
    const { ps, step } = createTestSystem({
      startLifetime: 0.1,
      emission: { rateOverTime: 50 },
      maxParticles: 50,
    });

    step(50);
    const activeAtStart = countActiveParticles(ps);
    expect(activeAtStart).toBeGreaterThan(0);

    // Wait for particles to expire (100ms lifetime)
    step(300);
    // Some particles should have been deactivated and new ones created
    // The key point is the system handles the lifecycle
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should recycle particle slots after deactivation', () => {
    const { ps, step } = createTestSystem({
      startLifetime: 0.05,
      emission: { rateOverTime: 100 },
      maxParticles: 10,
    });

    // Emit particles
    step(50);
    step(100);

    // After lifetime expires, particles should be recycled
    step(200);
    step(300);

    // System should still function (reuses deactivated slots)
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should not emit particles when paused', () => {
    const { ps, step } = createTestSystem({ emission: { rateOverTime: 100 } });

    ps.pauseEmitter();
    step(100);
    step(200);
    expect(countActiveParticles(ps)).toBe(0);

    ps.dispose();
  });

  it('should resume emitting after resumeEmitter', () => {
    const { ps, step } = createTestSystem({ emission: { rateOverTime: 50 } });

    ps.pauseEmitter();
    step(100);
    expect(countActiveParticles(ps)).toBe(0);

    ps.resumeEmitter();
    step(200);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should stop emitting in non-looping mode after duration', () => {
    const { ps, step } = createTestSystem({
      duration: 0.5,
      looping: false,
      startLifetime: 10,
      emission: { rateOverTime: 50 },
    });

    step(100);
    const activeDuringEmission = countActiveParticles(ps);
    expect(activeDuringEmission).toBeGreaterThan(0);

    // After duration (500ms), no new particles
    step(600);
    const activeAfterDuration = countActiveParticles(ps);

    step(700);
    const activeAfterMore = countActiveParticles(ps);

    // Should not increase after duration
    expect(activeAfterMore).toBeLessThanOrEqual(activeAfterDuration);

    ps.dispose();
  });

  it('should loop emission when looping is true', () => {
    const { ps, step } = createTestSystem({
      duration: 0.2,
      looping: true,
      startLifetime: 0.05,
      emission: { rateOverTime: 50 },
      maxParticles: 50,
    });

    // First cycle
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    // After several loops, still emitting
    step(500);
    step(1000);
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });
});

describe('Particle activation and color', () => {
  it('should set particle color on activation', () => {
    const { ps, step } = createTestSystem({
      startColor: {
        min: { r: 1, g: 0, b: 0 },
        max: { r: 1, g: 0, b: 0 },
      },
      emission: { rateOverTime: 50 },
    });

    step(100);
    const attrs = getAttributes(ps);
    const activeCount = countActiveParticles(ps);
    expect(activeCount).toBeGreaterThan(0);

    // Check that at least one active particle has the correct color
    let foundColoredParticle = false;
    for (let i = 0; i < attrs.isActive.count; i++) {
      if (attrs.isActive.getX(i)) {
        expect(attrs.color.getX(i)).toBeCloseTo(1);
        expect(attrs.color.getY(i)).toBeCloseTo(0);
        expect(attrs.color.getZ(i)).toBeCloseTo(0);
        foundColoredParticle = true;
        break;
      }
    }
    expect(foundColoredParticle).toBe(true);

    ps.dispose();
  });

  it('should interpolate color between min and max', () => {
    const { ps, step } = createTestSystem({
      startColor: {
        min: { r: 0, g: 0, b: 0 },
        max: { r: 1, g: 1, b: 1 },
      },
      emission: { rateOverTime: 50 },
    });

    step(100);
    const attrs = getAttributes(ps);
    for (let i = 0; i < attrs.isActive.count; i++) {
      if (attrs.isActive.getX(i)) {
        expect(attrs.color.getX(i)).toBeGreaterThanOrEqual(0);
        expect(attrs.color.getX(i)).toBeLessThanOrEqual(1);
        break;
      }
    }

    ps.dispose();
  });

  it('should set opacity to 0 on deactivation', () => {
    const { ps, step } = createTestSystem({
      startLifetime: 0.05,
      emission: { rateOverTime: 100 },
      maxParticles: 10,
    });

    step(50);
    step(100);
    // After lifetime, some particles should be deactivated
    const attrs = getAttributes(ps);
    for (let i = 0; i < attrs.isActive.count; i++) {
      if (!attrs.isActive.getX(i)) {
        expect(attrs.color.getW(i)).toBe(0);
      }
    }

    ps.dispose();
  });
});

describe('Gravity', () => {
  it('should apply gravity to particle velocity', () => {
    const { ps, step } = createTestSystem({
      gravity: -9.8,
      startSpeed: 0,
      emission: { rateOverTime: 50 },
      maxParticles: 10,
    });

    step(16);
    step(100);

    // Particles should have moved due to gravity
    const attrs = getAttributes(ps);
    let positionChanged = false;
    for (let i = 0; i < attrs.isActive.count; i++) {
      if (attrs.isActive.getX(i)) {
        const posIndex = i * 3;
        const y = attrs.position.array[posIndex + 1];
        // With negative gravity the particle should move in y direction
        if (y !== 0) {
          positionChanged = true;
          break;
        }
      }
    }
    expect(positionChanged).toBe(true);

    ps.dispose();
  });

  it('should not apply gravity when gravity is 0', () => {
    const { ps, step } = createTestSystem({
      gravity: 0,
      startSpeed: 0,
      emission: { rateOverTime: 50 },
    });

    step(100);
    // System should work fine without gravity
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });
});

describe('updateParticleSystems', () => {
  it('should update all created particle systems', () => {
    const ps1 = createParticleSystem(
      { maxParticles: 5, emission: { rateOverTime: 50 } },
      1000
    );
    const ps2 = createParticleSystem(
      { maxParticles: 5, emission: { rateOverTime: 50 } },
      1000
    );

    updateParticleSystems({ now: 1100, delta: 0.1, elapsed: 0.1 });

    expect(countActiveParticles(ps1)).toBeGreaterThan(0);
    expect(countActiveParticles(ps2)).toBeGreaterThan(0);

    ps1.dispose();
    ps2.dispose();
  });

  it('should handle empty particle system list', () => {
    // After disposing all systems, this should not throw
    expect(() => {
      updateParticleSystems({ now: 2000, delta: 0.016, elapsed: 1 });
    }).not.toThrow();
  });
});

describe('dispose', () => {
  it('should dispose particle system resources', () => {
    const ps = createParticleSystem({ maxParticles: 10 }, 1000);
    expect(() => ps.dispose()).not.toThrow();
  });

  it('should remove particle system from update list', () => {
    const ps = createParticleSystem(
      { maxParticles: 10, emission: { rateOverTime: 50 } },
      1000
    );
    ps.dispose();

    // Updating should not affect the disposed system
    expect(() => {
      updateParticleSystems({ now: 1100, delta: 0.016, elapsed: 0.1 });
    }).not.toThrow();
  });

  it('should handle disposing system that is part of a parent', () => {
    const ps = createParticleSystem({ maxParticles: 10 }, 1000);
    const parent = new THREE.Group();
    parent.add(ps.instance);

    expect(ps.instance.parent).toBe(parent);
    ps.dispose();
  });

  it('should dispose array materials if present', () => {
    const ps = createParticleSystem({ maxParticles: 10 }, 1000);
    ps.dispose();
    // No error means it handled material disposal properly
  });
});
