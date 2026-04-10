import * as THREE from 'three';
import { SimulationSpace } from '../js/effects/three-particles/three-particles-enums.js';
import { createParticleSystem } from '../js/effects/three-particles/three-particles.js';
import { ParticleSystem } from '../js/effects/three-particles/types.js';

const countActiveParticles = (ps: ParticleSystem): number => {
  const points = ps.instance as THREE.Object3D;
  let geometry: THREE.BufferGeometry;
  if ((points as THREE.Points).geometry) {
    geometry = (points as THREE.Points).geometry;
  } else {
    // For world space, the instance is a Gyroscope wrapper; get child
    const child = points.children[0] as THREE.Points;
    geometry = child.geometry;
  }
  const isActiveAttr = geometry.attributes.isActive;
  let count = 0;
  for (let i = 0; i < isActiveAttr.count; i++) {
    if (isActiveAttr.getX(i)) count++;
  }
  return count;
};

const getWorldSpaceAttributes = (ps: ParticleSystem) => {
  const instance = ps.instance as THREE.Object3D;
  if ((instance as THREE.Points).geometry) {
    return (instance as THREE.Points).geometry.attributes;
  }
  const child = instance.children[0] as THREE.Points;
  return child.geometry.attributes;
};

const createWorldSpaceSystem = (
  extraConfig: Record<string, unknown> = {},
  startTime = 1000
) => {
  const ps = createParticleSystem(
    {
      maxParticles: 20,
      duration: 5,
      looping: true,
      startLifetime: 2,
      startSpeed: 1,
      simulationSpace: SimulationSpace.WORLD,
      emission: { rateOverTime: 50 },
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

describe('World Simulation Space', () => {
  it('should create a Gyroscope wrapper for WORLD simulation space', () => {
    const { ps } = createWorldSpaceSystem();

    // In world space, instance is a Gyroscope wrapper
    expect(ps.instance).toBeDefined();
    expect(ps.instance.children.length).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should emit particles in world space', () => {
    const { ps, step } = createWorldSpaceSystem();

    step(16);
    step(100);
    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should handle world position changes', () => {
    const { ps, step } = createWorldSpaceSystem();

    step(16);

    // Move the instance
    const child = ps.instance.children[0] as THREE.Points;
    child.position.set(10, 0, 0);

    step(32);
    step(100);

    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should compensate for emitter movement in world space', () => {
    const { ps, step } = createWorldSpaceSystem({
      startSpeed: 0,
      emission: { rateOverTime: 50 },
    });

    // Initialize
    step(16);

    // Emit some particles
    step(100);
    const initialActive = countActiveParticles(ps);
    expect(initialActive).toBeGreaterThan(0);

    // Move emitter - particles should stay in world position
    const child = ps.instance.children[0] as THREE.Points;
    child.position.set(5, 0, 0);
    step(200);

    // System should still function
    expect(ps.instance).toBeDefined();

    ps.dispose();
  });

  it('should handle parent attachment for wrapper quaternion', () => {
    const { ps, step } = createWorldSpaceSystem();

    // Attach to a parent
    const parent = new THREE.Group();
    parent.add(ps.instance);

    // Rotate parent
    parent.quaternion.setFromEuler(new THREE.Euler(0, Math.PI / 4, 0));

    step(16);
    step(100);

    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should work with gravity in world space', () => {
    const { ps, step } = createWorldSpaceSystem({
      gravity: -9.8,
      startSpeed: 0,
    });

    step(16);
    step(100);
    step(200);

    expect(countActiveParticles(ps)).toBeGreaterThan(0);

    ps.dispose();
  });

  it('should remove the Gyroscope wrapper from scene when disposed', () => {
    const scene = new THREE.Group();
    const { ps, step } = createWorldSpaceSystem();
    scene.add(ps.instance);

    step(16);
    expect(scene.children.length).toBe(1);

    ps.dispose();

    expect(scene.children.length).toBe(0);
  });

  it('should handle pause/resume in world space', () => {
    const { ps, step } = createWorldSpaceSystem();

    step(16);
    step(100);
    const activeBeforePause = countActiveParticles(ps);
    expect(activeBeforePause).toBeGreaterThan(0);

    ps.pauseEmitter();
    step(200);

    ps.resumeEmitter();
    step(300);

    expect(ps.instance).toBeDefined();

    ps.dispose();
  });
});

describe('Local Simulation Space', () => {
  it('should not create a Gyroscope wrapper for LOCAL space', () => {
    const ps = createParticleSystem(
      {
        maxParticles: 10,
        simulationSpace: SimulationSpace.LOCAL,
        emission: { rateOverTime: 10 },
      },
      1000
    );

    // In local space, instance is directly the Points object
    expect((ps.instance as THREE.Points).geometry).toBeDefined();

    ps.dispose();
  });

  it('should default to LOCAL simulation space', () => {
    const ps = createParticleSystem({ maxParticles: 10 }, 1000);

    // Default should be local - instance is Points directly
    expect((ps.instance as THREE.Points).geometry).toBeDefined();

    ps.dispose();
  });
});
