import * as THREE from 'three';
import {
  CollisionPlaneMode,
  ForceFieldFalloff,
  ForceFieldType,
  Shape,
  SimulationSpace,
  SubEmitterTrigger,
} from '../js/effects/three-particles/three-particles-enums.js';
import { createParticleSystem } from '../js/effects/three-particles/three-particles.js';
import type { ParticleSystem } from '../js/effects/three-particles/types.js';

// ---------------------------------------------------------------------------
// Helpers — `ps.instance` IS the renderable after the WORLD-space refactor
// (no more Gyroscope wrapper). Kept as a named helper for clarity across the
// many test cases below.
// ---------------------------------------------------------------------------

const getRenderedPoints = (ps: ParticleSystem): THREE.Points =>
  ps.instance as unknown as THREE.Points;

const forceMatrixUpdate = (ps: ParticleSystem) => {
  const instance = ps.instance as THREE.Object3D;
  let root: THREE.Object3D = instance;
  while (root.parent) root = root.parent;
  root.updateMatrixWorld(true);
};

const getParticleWorldPosition = (
  ps: ParticleSystem,
  index: number
): THREE.Vector3 => {
  forceMatrixUpdate(ps);
  const points = getRenderedPoints(ps);
  const arr = points.geometry.attributes.position.array as Float32Array;
  const v = new THREE.Vector3(
    arr[index * 3] ?? 0,
    arr[index * 3 + 1] ?? 0,
    arr[index * 3 + 2] ?? 0
  );
  return v.applyMatrix4(points.matrixWorld);
};

const getActiveIndex = (ps: ParticleSystem): number => {
  const points = getRenderedPoints(ps);
  const isActive = points.geometry.attributes.isActive;
  for (let i = 0; i < isActive.count; i++) {
    if (isActive.getX(i)) return i;
  }
  return -1;
};

type StepFn = (deltaMs?: number) => void;

/**
 * Create a WORLD-space particle system that emits a single burst at t=0
 * from a point at the emitter origin. Particle does not move on its own
 * (startSpeed = 0), has long lifetime, and gravity is off by default.
 * Returns a `step` function which advances the system by `deltaMs` (default
 * 16ms), accumulating simulated time so emitter motion can be tested across
 * frames.
 */
const createBareWorldSystem = (
  overrides: Record<string, unknown> = {},
  startTime = 1000
): { ps: ParticleSystem; step: StepFn; parent: THREE.Group } => {
  const parent = new THREE.Group();
  const ps = createParticleSystem(
    {
      maxParticles: 8,
      duration: 100,
      looping: false,
      startLifetime: 100,
      startSpeed: 0,
      startSize: 1,
      startOpacity: 1,
      startRotation: 0,
      gravity: 0,
      simulationSpace: SimulationSpace.WORLD,
      shape: {
        shape: Shape.SPHERE,
        sphere: { radius: 1e-6, radiusThickness: 1, arc: 360 },
      },
      emission: {
        rateOverTime: 0,
        rateOverDistance: 0,
        bursts: [{ time: 0, count: 1 }],
      },
      ...overrides,
    } as unknown as Parameters<typeof createParticleSystem>[0],
    startTime
  );

  parent.add(ps.instance);
  parent.updateMatrixWorld(true);

  let elapsedMs = 0;
  const step: StepFn = (deltaMs = 16) => {
    elapsedMs += deltaMs;
    parent.updateMatrixWorld(true);
    ps.update({
      now: startTime + elapsedMs,
      delta: deltaMs / 1000,
      elapsed: elapsedMs / 1000,
    });
  };

  return { ps, step, parent };
};

// ---------------------------------------------------------------------------
// Layer 1 — WORLD simulation space invariants
//
// These tests encode the *semantic* contract of WORLD space: once a particle
// is emitted, its world-space position is decoupled from any further emitter
// motion. Gravity is always world-down. Variable frame timing does not cause
// jitter. `instance.position` (Option 2 semantics) offsets the spawn origin
// under the parent, but does not drag already-emitted particles.
// ---------------------------------------------------------------------------

describe('WORLD simulation space — invariants', () => {
  it('emitted particle world position is stable when the emitter translates', () => {
    const { ps, step, parent } = createBareWorldSystem();

    step(16); // emit the single burst particle at world origin
    const idx = getActiveIndex(ps);
    expect(idx).toBeGreaterThanOrEqual(0);
    const initial = getParticleWorldPosition(ps, idx);

    // Move parent around; particle should stay where it was emitted.
    for (let i = 0; i < 20; i++) {
      parent.position.set((i + 1) * 0.73, (i + 1) * -0.21, (i + 1) * 0.5);
      step(16);
    }

    const final = getParticleWorldPosition(ps, idx);
    expect(final.distanceTo(initial)).toBeLessThan(1e-3);
    ps.dispose();
  });

  it('emitted particle world position is stable when the emitter rotates', () => {
    const { ps, step, parent } = createBareWorldSystem();

    step(16);
    const idx = getActiveIndex(ps);
    expect(idx).toBeGreaterThanOrEqual(0);
    const initial = getParticleWorldPosition(ps, idx);

    for (let i = 0; i < 20; i++) {
      parent.quaternion.setFromEuler(
        new THREE.Euler(0.1 * i, 0.17 * i, 0.05 * i)
      );
      step(16);
    }

    const final = getParticleWorldPosition(ps, idx);
    expect(final.distanceTo(initial)).toBeLessThan(1e-3);
    ps.dispose();
  });

  it('no world-position drift over 1000 frames of continuous motion', () => {
    const { ps, step, parent } = createBareWorldSystem();

    step(16);
    const idx = getActiveIndex(ps);
    const initial = getParticleWorldPosition(ps, idx);

    for (let i = 1; i <= 1000; i++) {
      const t = i * 0.02;
      parent.position.set(Math.sin(t) * 5, Math.cos(t * 0.7) * 3, t * 0.1);
      parent.quaternion.setFromEuler(new THREE.Euler(t * 0.3, t * 0.5, 0));
      step(16);
    }

    const final = getParticleWorldPosition(ps, idx);
    expect(final.distanceTo(initial)).toBeLessThan(1e-2);
    ps.dispose();
  });

  it('variable framerate does not produce jitter on a moving emitter', () => {
    const { ps, step, parent } = createBareWorldSystem();

    step(16);
    const idx = getActiveIndex(ps);
    const initial = getParticleWorldPosition(ps, idx);

    // Variable dt, monotonic parent motion. Particle world pos should stay put.
    const dts = [16, 33, 8, 50, 16, 100, 4, 16];
    let x = 0;
    for (let i = 0; i < 40; i++) {
      const dt = dts[i % dts.length]!;
      x += dt * 0.01; // 10 units / sec
      parent.position.set(x, 0, 0);
      step(dt);
    }

    const final = getParticleWorldPosition(ps, idx);
    expect(final.distanceTo(initial)).toBeLessThan(1e-2);
    ps.dispose();
  });

  it('quaternion q and -q represent the same rotation (no hidden jitter)', () => {
    const { ps, step, parent } = createBareWorldSystem();

    step(16);
    const idx = getActiveIndex(ps);
    const before = getParticleWorldPosition(ps, idx);

    // Set parent quaternion.
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.4, 0.3, 0.2)
    );
    parent.quaternion.copy(q);
    step(16);

    // Flip to -q (mathematically identical rotation).
    parent.quaternion.set(-q.x, -q.y, -q.z, -q.w);
    step(16);

    const after = getParticleWorldPosition(ps, idx);
    expect(after.distanceTo(before)).toBeLessThan(1e-3);
    ps.dispose();
  });

  it('gravity is world-down (constant Y acceleration regardless of emitter rotation)', () => {
    // NOTE: the library's gravity sign convention is inverted from physics —
    // positive `gravity` pulls particles down (see `velocity -= gravityVelocity`
    // in the integrator). We preserve that convention here.
    const { ps, step, parent } = createBareWorldSystem({
      gravity: 10,
    });

    // Rotate parent 90° around Z before emission so that, if gravity were
    // (incorrectly) evaluated in emitter-local space, it would pull the
    // particle along world-X instead of world-Y.
    parent.quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
    step(16); // emit

    const idx = getActiveIndex(ps);
    expect(idx).toBeGreaterThanOrEqual(0);
    const p0 = getParticleWorldPosition(ps, idx);

    // Advance 500 ms (without any further parent movement).
    for (let i = 0; i < 31; i++) step(16);

    const p1 = getParticleWorldPosition(ps, idx);
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dz = p1.z - p0.z;

    // Particle should have fallen in world -Y only.
    expect(dy).toBeLessThan(-0.5);
    expect(Math.abs(dx)).toBeLessThan(0.05);
    expect(Math.abs(dz)).toBeLessThan(0.05);
    ps.dispose();
  });

  it('gravity direction stays world-down when emitter translates horizontally', () => {
    const { ps, step, parent } = createBareWorldSystem({
      gravity: 10,
    });

    step(16);
    const idx = getActiveIndex(ps);
    const p0 = getParticleWorldPosition(ps, idx);

    // Move emitter far away in X while letting the one existing particle
    // fall. Its world-X should not drift — gravity is purely world-down.
    for (let i = 1; i <= 30; i++) {
      parent.position.set(i * 2, 0, 0);
      step(16);
    }

    const p1 = getParticleWorldPosition(ps, idx);
    expect(p1.y).toBeLessThan(p0.y - 0.3);
    expect(Math.abs(p1.x - p0.x)).toBeLessThan(0.05);
    expect(Math.abs(p1.z - p0.z)).toBeLessThan(0.05);
    ps.dispose();
  });

  it('instance.position offsets the spawn origin under the parent (Option 2)', () => {
    const { ps, step, parent } = createBareWorldSystem();

    // Offset the instance inside the parent's local frame.
    (ps.instance as THREE.Object3D).position.set(5, 0, 0);
    // Rotate parent 90° around Y so the offset maps to world -Z.
    parent.quaternion.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
    parent.position.set(0, 0, 0);

    step(16); // emit

    const idx = getActiveIndex(ps);
    expect(idx).toBeGreaterThanOrEqual(0);
    const spawn = getParticleWorldPosition(ps, idx);

    // parent.worldRot * (5,0,0) = rotate 90° around Y -> (0, 0, -5)
    expect(spawn.x).toBeCloseTo(0, 3);
    expect(spawn.y).toBeCloseTo(0, 3);
    expect(spawn.z).toBeCloseTo(-5, 3);
    ps.dispose();
  });

  it('new emissions originate at the current emitter pose, old particles stay put', () => {
    const { ps, step, parent } = createBareWorldSystem({
      startLifetime: 100,
      // Two bursts — one at t=0, one at t=0.5s.
      emission: {
        rateOverTime: 0,
        rateOverDistance: 0,
        bursts: [
          { time: 0, count: 1 },
          { time: 0.5, count: 1 },
        ],
      },
      maxParticles: 4,
    });

    step(16); // first burst at origin
    const firstIdx = getActiveIndex(ps);
    const firstPos = getParticleWorldPosition(ps, firstIdx);

    // Move parent, then let time advance to t=0.5s so the second burst fires.
    parent.position.set(7, 0, 0);
    // Advance ~550 ms.
    for (let i = 0; i < 34; i++) step(16);

    // Find the second (new) active particle — first one is still alive.
    const points = getRenderedPoints(ps);
    const isActive = points.geometry.attributes.isActive;
    let secondIdx = -1;
    for (let i = 0; i < isActive.count; i++) {
      if (isActive.getX(i) && i !== firstIdx) {
        secondIdx = i;
        break;
      }
    }
    expect(secondIdx).toBeGreaterThanOrEqual(0);

    const secondPos = getParticleWorldPosition(ps, secondIdx);
    const firstPosNow = getParticleWorldPosition(ps, firstIdx);

    // First particle hasn't moved.
    expect(firstPosNow.distanceTo(firstPos)).toBeLessThan(1e-2);
    // Second particle spawned at new emitter world position (7,0,0).
    expect(secondPos.x).toBeCloseTo(7, 2);
    expect(secondPos.y).toBeCloseTo(0, 2);
    expect(secondPos.z).toBeCloseTo(0, 2);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — LOCAL simulation space regression
//
// The refactor must not alter LOCAL semantics: particles live in the emitter's
// local coordinate system and visually follow the parent's world transform.
// ---------------------------------------------------------------------------

describe('LOCAL simulation space — regression', () => {
  const createBareLocalSystem = (
    overrides: Record<string, unknown> = {},
    startTime = 1000
  ): { ps: ParticleSystem; step: StepFn; parent: THREE.Group } => {
    const parent = new THREE.Group();
    const ps = createParticleSystem(
      {
        maxParticles: 8,
        duration: 100,
        looping: false,
        startLifetime: 100,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        gravity: 0,
        simulationSpace: SimulationSpace.LOCAL,
        shape: {
          shape: Shape.SPHERE,
          sphere: { radius: 1e-6, radiusThickness: 1, arc: 360 },
        },
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 1 }],
        },
        ...overrides,
      } as unknown as Parameters<typeof createParticleSystem>[0],
      startTime
    );
    parent.add(ps.instance);
    parent.updateMatrixWorld(true);

    let elapsedMs = 0;
    const step: StepFn = (deltaMs = 16) => {
      elapsedMs += deltaMs;
      parent.updateMatrixWorld(true);
      ps.update({
        now: startTime + elapsedMs,
        delta: deltaMs / 1000,
        elapsed: elapsedMs / 1000,
      });
    };
    return { ps, step, parent };
  };

  it('LOCAL particle visually follows parent translation', () => {
    const { ps, step, parent } = createBareLocalSystem();

    step(16); // emit
    const idx = getActiveIndex(ps);
    expect(idx).toBeGreaterThanOrEqual(0);

    parent.position.set(3, -2, 4);
    step(16);

    const p = getParticleWorldPosition(ps, idx);
    expect(p.x).toBeCloseTo(3, 3);
    expect(p.y).toBeCloseTo(-2, 3);
    expect(p.z).toBeCloseTo(4, 3);

    ps.dispose();
  });

  it('LOCAL particle visually follows parent rotation', () => {
    // Start the particle at a non-zero radius so rotation is observable.
    const { ps, step, parent } = createBareLocalSystem({
      shape: {
        shape: Shape.SPHERE,
        sphere: { radius: 1, radiusThickness: 0, arc: 360 },
      },
    });

    step(16);
    const idx = getActiveIndex(ps);
    const before = getParticleWorldPosition(ps, idx);

    parent.quaternion.setFromEuler(new THREE.Euler(0, Math.PI, 0));
    step(16);
    const after = getParticleWorldPosition(ps, idx);

    // 180° rotation: particle should be mirrored across origin (approx).
    expect(after.x).toBeCloseTo(-before.x, 3);
    expect(after.z).toBeCloseTo(-before.z, 3);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Layer 3 — WORLD integration with force fields & sub-emitters
// ---------------------------------------------------------------------------

describe('WORLD simulation space — integration with subsystems', () => {
  it('death sub-emitter spawns at particle world position, not at the current emitter pose', () => {
    // Setup: a WORLD-mode parent system whose particles die quickly and
    // spawn a death sub-emitter. We emit one particle at world origin,
    // then move the emitter to (20, 0, 0) before the particle dies.
    // The sub-emitter system should spawn at the particle's WORLD position
    // (~origin), not at the current emitter world position (20, 0, 0).
    const scene = new THREE.Group();
    const parent = new THREE.Group();
    scene.add(parent);

    const subEmitterConfig = {
      maxParticles: 3,
      duration: 2,
      looping: false,
      startLifetime: 2,
      startSpeed: 0,
      startSize: 1,
      startOpacity: 1,
      startRotation: 0,
      simulationSpace: SimulationSpace.WORLD,
      shape: {
        shape: Shape.SPHERE,
        sphere: { radius: 1e-6, radiusThickness: 1, arc: 360 },
      },
      emission: {
        rateOverTime: 0,
        rateOverDistance: 0,
        bursts: [{ time: 0, count: 1 }],
      },
    };

    const ps = createParticleSystem(
      {
        maxParticles: 3,
        duration: 100,
        looping: false,
        startLifetime: 0.1, // dies after ~100 ms
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        gravity: 0,
        simulationSpace: SimulationSpace.WORLD,
        shape: {
          shape: Shape.SPHERE,
          sphere: { radius: 1e-6, radiusThickness: 1, arc: 360 },
        },
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 1 }],
        },
        subEmitters: [
          {
            trigger: SubEmitterTrigger.DEATH,
            config: subEmitterConfig,
          },
        ],
      } as unknown as Parameters<typeof createParticleSystem>[0],
      1000
    );
    parent.add(ps.instance);
    scene.updateMatrixWorld(true);

    let elapsedMs = 0;
    const step = (deltaMs = 16) => {
      elapsedMs += deltaMs;
      scene.updateMatrixWorld(true);
      ps.update({
        now: 1000 + elapsedMs,
        delta: deltaMs / 1000,
        elapsed: elapsedMs / 1000,
      });
    };

    // Emit parent particle at world origin.
    step(16);
    // Move emitter far away before the particle dies.
    parent.position.set(20, 0, 0);
    // Advance past the 100ms lifetime.
    for (let i = 0; i < 15; i++) step(16);

    // Sub-emitter instances are added as a child of the parent system's
    // parent object (three-particles.ts:1691-1692). In this test that is
    // `parent`. Anything in parent.children other than `ps.instance` is
    // the spawned sub-emitter's instance.
    scene.updateMatrixWorld(true);
    const subInstance = parent.children.find((c) => c !== ps.instance);
    expect(subInstance).toBeDefined();

    // The sub-emitter's instance IS the Points object (no wrapper).
    expect(subInstance).toBeInstanceOf(THREE.Points);
    const subPoints = subInstance as THREE.Points;

    // Tick once more so the sub-emitter runs its t=0 burst.
    step(16);
    scene.updateMatrixWorld(true);

    // Find the first active sub-particle and compute its world position.
    const subIsActive = subPoints.geometry.attributes.isActive;
    let firstActive = -1;
    for (let i = 0; i < subIsActive.count; i++) {
      if (subIsActive.getX(i)) {
        firstActive = i;
        break;
      }
    }
    expect(firstActive).toBeGreaterThanOrEqual(0);

    const subArr = subPoints.geometry.attributes.position.array as Float32Array;
    const subParticleWorld = new THREE.Vector3(
      subArr[firstActive * 3]!,
      subArr[firstActive * 3 + 1]!,
      subArr[firstActive * 3 + 2]!
    ).applyMatrix4(subPoints.matrixWorld);

    // Must be at the parent particle's death world location (~origin),
    // not at the current emitter world position (20, 0, 0).
    expect(subParticleWorld.length()).toBeLessThan(1);

    ps.dispose();
  });

  it('directional force field stays world-aligned when emitter rotates', () => {
    // A world-defined directional field pushing in world +X should keep
    // pushing in world +X regardless of emitter rotation.
    const parent = new THREE.Group();
    const ps = createParticleSystem(
      {
        maxParticles: 4,
        duration: 100,
        looping: false,
        startLifetime: 100,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        gravity: 0,
        simulationSpace: SimulationSpace.WORLD,
        shape: {
          shape: Shape.SPHERE,
          sphere: { radius: 1e-6, radiusThickness: 1, arc: 360 },
        },
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 1 }],
        },
        forceFields: [
          {
            type: ForceFieldType.DIRECTIONAL,
            direction: new THREE.Vector3(1, 0, 0),
            strength: 5,
          },
        ],
      } as unknown as Parameters<typeof createParticleSystem>[0],
      1000
    );
    parent.add(ps.instance);
    parent.updateMatrixWorld(true);

    let elapsedMs = 0;
    const step = (deltaMs = 16) => {
      elapsedMs += deltaMs;
      parent.updateMatrixWorld(true);
      ps.update({
        now: 1000 + elapsedMs,
        delta: deltaMs / 1000,
        elapsed: elapsedMs / 1000,
      });
    };

    step(16); // emit
    const idx = getActiveIndex(ps);
    expect(idx).toBeGreaterThanOrEqual(0);
    const p0 = getParticleWorldPosition(ps, idx);

    // Rotate parent 90° around Y. If the field were stored in emitter-local
    // space, this would redirect the force toward world -Z. In WORLD space,
    // the force should still push world +X.
    parent.quaternion.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));

    for (let i = 0; i < 30; i++) step(16);

    const p1 = getParticleWorldPosition(ps, idx);
    expect(p1.x - p0.x).toBeGreaterThan(0.1);
    expect(Math.abs(p1.z - p0.z)).toBeLessThan(0.1);

    ps.dispose();
  });

  it('collision plane at world z=2 kills particle moving forward, regardless of emitter motion', () => {
    // A CONE emitter at the origin fires a particle along its local +Z (the
    // library's CONE default emission axis) at 10 u/s. A KILL-mode collision
    // plane sits at world z=2 with front facing -Z, so the particle starts in
    // front of the plane and must cross it to be killed. While the particle
    // travels, we drag the emitter horizontally in world +X. In WORLD mode the
    // particle buffer holds world coordinates, so the plane intersection
    // check compares world-vs-world and the kill happens on schedule —
    // emitter motion does not smear the check.
    const parent = new THREE.Group();
    const ps = createParticleSystem(
      {
        maxParticles: 2,
        duration: 10,
        looping: false,
        startLifetime: 10, // long, so only the plane can kill
        startSpeed: 10,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        gravity: 0,
        simulationSpace: SimulationSpace.WORLD,
        shape: {
          shape: Shape.CONE,
          cone: { angle: 0, radius: 1e-6, radiusThickness: 1, arc: 360 },
        },
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 1 }],
        },
        collisionPlanes: [
          {
            position: { x: 0, y: 0, z: 2 },
            normal: { x: 0, y: 0, z: -1 },
            mode: CollisionPlaneMode.KILL,
          },
        ],
      } as unknown as Parameters<typeof createParticleSystem>[0],
      1000
    );
    parent.add(ps.instance);
    parent.updateMatrixWorld(true);

    let elapsedMs = 0;
    const step = (deltaMs = 16) => {
      elapsedMs += deltaMs;
      // Slide the emitter in +X at 30 u/s — fast enough that an incorrect
      // coordinate-space mixing would push the particle past the plane early
      // or miss it entirely.
      parent.position.set((elapsedMs / 1000) * 30, 0, 0);
      parent.updateMatrixWorld(true);
      ps.update({
        now: 1000 + elapsedMs,
        delta: deltaMs / 1000,
        elapsed: elapsedMs / 1000,
      });
    };

    step(16); // emit at world origin
    const idx = getActiveIndex(ps);
    expect(idx).toBeGreaterThanOrEqual(0);

    // At ~100 ms the particle is at world z=1 — below the plane, still alive.
    for (let i = 0; i < 5; i++) step(16);
    expect(getActiveIndex(ps)).toBe(idx);

    // At ~300 ms the particle has crossed world z=2 and must be killed.
    for (let i = 0; i < 13; i++) step(16);
    expect(getActiveIndex(ps)).toBe(-1);

    ps.dispose();
  });

  it('point (attractor) force field position stays world-anchored when emitter moves', () => {
    // A POINT force field at world (5, 0, 0) should keep pulling the particle
    // toward world +X regardless of emitter motion. If the field position
    // were accidentally treated as emitter-local, moving the emitter would
    // drag the attractor and reverse the particle's horizontal drift.
    const parent = new THREE.Group();
    const ps = createParticleSystem(
      {
        maxParticles: 2,
        duration: 10,
        looping: false,
        startLifetime: 10,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        gravity: 0,
        simulationSpace: SimulationSpace.WORLD,
        shape: {
          shape: Shape.SPHERE,
          sphere: { radius: 1e-6, radiusThickness: 1, arc: 360 },
        },
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 1 }],
        },
        forceFields: [
          {
            type: ForceFieldType.POINT,
            position: new THREE.Vector3(5, 0, 0),
            strength: 20,
            range: 100,
            falloff: ForceFieldFalloff.LINEAR,
          },
        ],
      } as unknown as Parameters<typeof createParticleSystem>[0],
      1000
    );
    parent.add(ps.instance);
    parent.updateMatrixWorld(true);

    let elapsedMs = 0;
    const step = (deltaMs = 16) => {
      elapsedMs += deltaMs;
      parent.updateMatrixWorld(true);
      ps.update({
        now: 1000 + elapsedMs,
        delta: deltaMs / 1000,
        elapsed: elapsedMs / 1000,
      });
    };

    step(16); // emit at world origin
    const idx = getActiveIndex(ps);
    expect(idx).toBeGreaterThanOrEqual(0);
    const p0 = getParticleWorldPosition(ps, idx);

    // Move the emitter far in -X. If the attractor were emitter-local, it
    // would follow to world (-15, 0, 0) and pull the particle toward -X.
    parent.position.set(-20, 0, 0);
    for (let i = 0; i < 30; i++) step(16);

    const p1 = getParticleWorldPosition(ps, idx);
    // Attractor at world (5,0,0) — particle must drift toward +X, never -X.
    expect(p1.x - p0.x).toBeGreaterThan(0.1);
    ps.dispose();
  });

  it('instance.rotation rotates the shape emission axis (Option 2)', () => {
    // A CONE emits along its local +Z (per `calculateRandomPositionAndVelocityOnCone`).
    // Rotating `instance` 90° around world X should redirect the emission to
    // world -Y under an identity parent. If rotation were ignored the particle
    // would drift in world +Z instead — so this test distinguishes the two.
    const { ps, step } = createBareWorldSystem({
      shape: {
        shape: Shape.CONE,
        cone: { angle: 0, radius: 1e-6, radiusThickness: 1, arc: 360 },
      },
      startSpeed: 5,
      startLifetime: 10,
    });
    (ps.instance as THREE.Object3D).rotation.set(Math.PI / 2, 0, 0);

    step(16); // emit
    const idx = getActiveIndex(ps);
    expect(idx).toBeGreaterThanOrEqual(0);
    const p0 = getParticleWorldPosition(ps, idx);

    // Let the particle fly ~100 ms — it should have moved ~0.5 u along the
    // rotated emission axis (world -Y).
    for (let i = 0; i < 6; i++) step(16);
    const p1 = getParticleWorldPosition(ps, idx);

    // Rotated axis maps local +Z -> world -Y.
    expect(p1.y - p0.y).toBeLessThan(-0.1);
    // And the un-rotated axis (world +Z) stays quiet.
    expect(Math.abs(p1.z - p0.z)).toBeLessThan(0.05);

    ps.dispose();
  });

  it('BIRTH sub-emitter in WORLD mode spawns children decoupled from the moving parent', () => {
    // At t=0 the parent emits one particle; its BIRTH sub-emitter fires at
    // the spawn world position. The sub-emitter's own particle is itself
    // WORLD-simulated, so subsequent motion of the main emitter must not
    // drag it along.
    const scene = new THREE.Scene();
    const parent = new THREE.Group();
    scene.add(parent);

    const subEmitterConfig = {
      maxParticles: 2,
      duration: 2,
      looping: false,
      startLifetime: 2,
      startSpeed: 0,
      startSize: 1,
      startOpacity: 1,
      startRotation: 0,
      simulationSpace: SimulationSpace.WORLD,
      shape: {
        shape: Shape.SPHERE,
        sphere: { radius: 1e-6, radiusThickness: 1, arc: 360 },
      },
      emission: {
        rateOverTime: 0,
        rateOverDistance: 0,
        bursts: [{ time: 0, count: 1 }],
      },
    };

    const ps = createParticleSystem(
      {
        maxParticles: 2,
        duration: 10,
        looping: false,
        startLifetime: 10,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        startRotation: 0,
        gravity: 0,
        simulationSpace: SimulationSpace.WORLD,
        shape: {
          shape: Shape.SPHERE,
          sphere: { radius: 1e-6, radiusThickness: 1, arc: 360 },
        },
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 1 }],
        },
        subEmitters: [
          {
            trigger: SubEmitterTrigger.BIRTH,
            config: subEmitterConfig,
          },
        ],
      } as unknown as Parameters<typeof createParticleSystem>[0],
      1000
    );
    parent.add(ps.instance);
    scene.updateMatrixWorld(true);

    let elapsedMs = 0;
    const step = (deltaMs = 16) => {
      elapsedMs += deltaMs;
      scene.updateMatrixWorld(true);
      ps.update({
        now: 1000 + elapsedMs,
        delta: deltaMs / 1000,
        elapsed: elapsedMs / 1000,
      });
    };

    // Emit parent particle at world origin — BIRTH fires immediately.
    step(16);

    // Drag the main emitter far away and tick the sub-emitter's t=0 burst.
    parent.position.set(25, 0, 0);
    step(16);
    step(16);
    scene.updateMatrixWorld(true);

    const subInstance = parent.children.find((c) => c !== ps.instance);
    expect(subInstance).toBeInstanceOf(THREE.Points);
    const subPoints = subInstance as THREE.Points;

    const subIsActive = subPoints.geometry.attributes.isActive;
    let firstActive = -1;
    for (let i = 0; i < subIsActive.count; i++) {
      if (subIsActive.getX(i)) {
        firstActive = i;
        break;
      }
    }
    expect(firstActive).toBeGreaterThanOrEqual(0);

    const subArr = subPoints.geometry.attributes.position.array as Float32Array;
    const subParticleWorld = new THREE.Vector3(
      subArr[firstActive * 3]!,
      subArr[firstActive * 3 + 1]!,
      subArr[firstActive * 3 + 2]!
    ).applyMatrix4(subPoints.matrixWorld);

    // BIRTH fired at the parent particle's spawn location (~origin);
    // despite the main emitter now sitting at x=25, the sub particle
    // must remain near the origin.
    expect(subParticleWorld.length()).toBeLessThan(1);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Layer 4 — Unity parent-scale parity
//
// Unity's ParticleSystem keeps gravity at a fixed world magnitude regardless
// of parent scale (LOCAL simulation space stores it in local units and thus
// divides by scale). The Shape module obeys parent scale when Scaling Mode
// is Local/Hierarchy, so spawn offsets scale with the parent in WORLD space
// too; live particles however are unaffected by subsequent scale changes.
// ---------------------------------------------------------------------------

describe('Unity parent-scale parity', () => {
  it('LOCAL gravity falls at world -g regardless of parent scale', () => {
    // Scaled parent (×2): a 0.96 s fall at g=9.81 m/s² (downward in the
    // library's convention, since `velocity -= g·dt`) must move the
    // rendered particle by -0.5·g·t² ≈ -4.52 m in world units,
    // regardless of parent scale — Unity keeps gravity in world m/s².
    const runFall = (scale: number): number => {
      const parent = new THREE.Group();
      parent.scale.setScalar(scale);
      const ps = createParticleSystem(
        {
          maxParticles: 4,
          duration: 10,
          looping: false,
          startLifetime: 10,
          startSpeed: 0,
          startSize: 1,
          startOpacity: 1,
          gravity: 9.81,
          simulationSpace: SimulationSpace.LOCAL,
          shape: {
            shape: Shape.SPHERE,
            sphere: { radius: 1e-6, radiusThickness: 1, arc: 360 },
          },
          emission: {
            rateOverTime: 0,
            rateOverDistance: 0,
            bursts: [{ time: 0, count: 1 }],
          },
        } as unknown as Parameters<typeof createParticleSystem>[0],
        1000
      );
      parent.add(ps.instance);
      parent.updateMatrixWorld(true);
      // 60 frames × 16ms ≈ 0.96 s; close enough to validate magnitude.
      for (let i = 1; i <= 60; i++) {
        parent.updateMatrixWorld(true);
        ps.update({
          now: 1000 + i * 16,
          delta: 0.016,
          elapsed: (i * 16) / 1000,
        });
      }
      const y = getParticleWorldPosition(ps, 0).y;
      ps.dispose();
      return y;
    };

    const yUnscaled = runFall(1);
    const yScaled = runFall(2);

    // Expected world-y after 60 × 16ms ≈ 0.96 s: y = -0.5 · 9.81 · 0.96² ≈ -4.52.
    // Allow ~15% tolerance for discrete integration.
    expect(yUnscaled).toBeLessThan(-3.8);
    expect(yUnscaled).toBeGreaterThan(-5.5);
    // Scaled parent: world-y must match the unscaled fall within a few percent.
    expect(Math.abs(yScaled - yUnscaled)).toBeLessThan(0.2);
  });

  it('WORLD spawn offset scales with parent (Shape module Local/Hierarchy)', () => {
    // Spawn from a sphere of radius 1 centered at origin, under a ×3 parent.
    // Unity would spawn particles on a sphere of radius 3 in world space.
    const parent = new THREE.Group();
    parent.scale.setScalar(3);
    const ps = createParticleSystem(
      {
        maxParticles: 256,
        duration: 1,
        looping: false,
        startLifetime: 10,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        gravity: 0,
        simulationSpace: SimulationSpace.WORLD,
        shape: {
          shape: Shape.SPHERE,
          sphere: { radius: 1, radiusThickness: 0, arc: 360 },
        },
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 256 }],
        },
      } as unknown as Parameters<typeof createParticleSystem>[0],
      1000
    );
    parent.add(ps.instance);
    parent.updateMatrixWorld(true);
    parent.updateMatrixWorld(true);
    ps.update({ now: 1016, delta: 0.016, elapsed: 0.016 });

    const points = getRenderedPoints(ps);
    const arr = points.geometry.attributes.position.array as Float32Array;
    const isActive = points.geometry.attributes.isActive;
    let maxLen = 0;
    let count = 0;
    for (let i = 0; i < isActive.count; i++) {
      if (!isActive.getX(i)) continue;
      count++;
      const v = new THREE.Vector3(
        arr[i * 3]!,
        arr[i * 3 + 1]!,
        arr[i * 3 + 2]!
      ).applyMatrix4(points.matrixWorld);
      maxLen = Math.max(maxLen, v.length());
    }
    expect(count).toBeGreaterThan(16);
    // Particles must lie on the scaled sphere surface (r ≈ 3), not r ≈ 1.
    expect(maxLen).toBeGreaterThan(2.5);
    expect(maxLen).toBeLessThan(3.2);

    ps.dispose();
  });

  it('WORLD live particles are unaffected by a parent scale change after spawn', () => {
    const { ps, step, parent } = createBareWorldSystem();
    step(16); // one particle spawned at world origin
    const idx = getActiveIndex(ps);
    const before = getParticleWorldPosition(ps, idx);

    // Double the parent scale after spawn. The live particle must not move.
    parent.scale.setScalar(2);
    step(16);
    const after = getParticleWorldPosition(ps, idx);

    expect(after.distanceTo(before)).toBeLessThan(1e-3);
    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Layer 5 — Sub-emitter freshness
//
// The parent emitter's matrixWorld must be current when sub-emitters read it
// to compute their spawn position. Without an explicit updateMatrixWorld()
// call before localToWorld(), a parent transform change between the last
// scene traversal and the particle death/birth callback would silently
// place the sub-emitter at a stale location.
// ---------------------------------------------------------------------------

describe('Sub-emitter world-matrix freshness', () => {
  it('LOCAL-mode sub-emitter spawns at the current parent world position', () => {
    const scene = new THREE.Scene();
    const parent = new THREE.Group();
    scene.add(parent);
    const ps = createParticleSystem(
      {
        maxParticles: 2,
        duration: 10,
        looping: false,
        startLifetime: 0.05,
        startSpeed: 0,
        startSize: 1,
        startOpacity: 1,
        gravity: 0,
        simulationSpace: SimulationSpace.LOCAL,
        shape: {
          shape: Shape.SPHERE,
          sphere: { radius: 1e-6, radiusThickness: 1, arc: 360 },
        },
        emission: {
          rateOverTime: 0,
          rateOverDistance: 0,
          bursts: [{ time: 0, count: 1 }],
        },
        subEmitters: [
          {
            trigger: SubEmitterTrigger.DEATH,
            config: {
              maxParticles: 2,
              duration: 10,
              looping: false,
              startLifetime: 10,
              startSpeed: 0,
              startSize: 1,
              startOpacity: 1,
              gravity: 0,
              simulationSpace: SimulationSpace.WORLD,
              shape: {
                shape: Shape.SPHERE,
                sphere: { radius: 1e-6, radiusThickness: 1, arc: 360 },
              },
              emission: {
                rateOverTime: 0,
                rateOverDistance: 0,
                bursts: [{ time: 0, count: 1 }],
              },
            },
          },
        ],
      } as unknown as Parameters<typeof createParticleSystem>[0],
      1000
    );
    parent.add(ps.instance);
    scene.updateMatrixWorld(true);

    let elapsedMs = 0;
    const step = (deltaMs = 16) => {
      elapsedMs += deltaMs;
      ps.update({
        now: 1000 + elapsedMs,
        delta: deltaMs / 1000,
        elapsed: elapsedMs / 1000,
      });
    };

    step(16); // spawn parent particle
    // Move the grandparent AFTER the last scene traversal, then step the
    // main system so the parent particle dies and fires the sub-emitter.
    // No scene.updateMatrixWorld — the fix relies on the sub-emitter
    // callback calling updateMatrixWorld itself.
    parent.position.set(10, 5, -3);
    step(100); // parent particle dies (lifetime 50 ms); DEATH fires sub-emitter
    step(16); // sub-emitter t=0 burst resolves
    scene.updateMatrixWorld(true);

    const subInstance = parent.children.find((c) => c !== ps.instance);
    expect(subInstance).toBeInstanceOf(THREE.Points);
    const subPoints = subInstance as THREE.Points;
    const subIsActive = subPoints.geometry.attributes.isActive;
    let firstActive = -1;
    for (let i = 0; i < subIsActive.count; i++) {
      if (subIsActive.getX(i)) {
        firstActive = i;
        break;
      }
    }
    expect(firstActive).toBeGreaterThanOrEqual(0);
    const subArr = subPoints.geometry.attributes.position.array as Float32Array;
    const subWorld = new THREE.Vector3(
      subArr[firstActive * 3]!,
      subArr[firstActive * 3 + 1]!,
      subArr[firstActive * 3 + 2]!
    ).applyMatrix4(subPoints.matrixWorld);

    // Sub-emitter must appear near the parent's CURRENT world position
    // (10, 5, -3), not the stale origin.
    expect(subWorld.distanceTo(new THREE.Vector3(10, 5, -3))).toBeLessThan(0.5);

    ps.dispose();
  });
});

// ---------------------------------------------------------------------------
// Layer 6 — positionNeedsUpdate upload guard
//
// When gravity is 0 and all particles are stationary (velocity = 0), the
// position array is never written, so needsUpdate must stay false to avoid
// a pointless CPU→GPU re-upload every frame when the emitter moves.
// ---------------------------------------------------------------------------

describe('GPU upload guard — stationary particles', () => {
  it('does not bump position attribute version when emitter moves with stationary particles', () => {
    const { ps, step, parent } = createBareWorldSystem();
    step(16); // spawn one particle
    const points = getRenderedPoints(ps);
    const positionAttr = points.geometry.attributes
      .position as THREE.BufferAttribute & { version: number };

    // Move the emitter, then tick. With stationary particles (speed 0, no
    // gravity), the buffer is unchanged — version must not increment.
    const versionBefore = positionAttr.version;
    for (let i = 1; i <= 5; i++) {
      parent.position.set(i * 3, i * 2, i);
      step(16);
    }
    expect(positionAttr.version).toBe(versionBefore);

    ps.dispose();
  });
});
