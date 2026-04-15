import * as THREE from 'three';
import { applyCollisionPlanes } from '../js/effects/three-particles/three-particles-collision.js';
import {
  S_LIFETIME,
  S_START_LIFETIME,
  SCALAR_STRIDE,
} from '../js/effects/three-particles/three-particles-constants.js';
import { CollisionPlaneMode } from '../js/effects/three-particles/three-particles-enums.js';
import { NormalizedCollisionPlaneConfig } from '../js/effects/three-particles/types.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createPlane(
  overrides: Partial<NormalizedCollisionPlaneConfig> = {}
): NormalizedCollisionPlaneConfig {
  return {
    isActive: true,
    position: new THREE.Vector3(0, 5, 0),
    normal: new THREE.Vector3(0, 1, 0),
    mode: CollisionPlaneMode.KILL,
    dampen: 0.5,
    lifetimeLoss: 0,
    ...overrides,
  };
}

/**
 * Creates a minimal scalar array for one particle with the given lifetime values.
 */
function createScalarArr(
  lifetime: number = 0,
  startLifetime: number = 5000
): { scalarArr: Float32Array; scalarBase: number } {
  const scalarArr = new Float32Array(SCALAR_STRIDE);
  scalarArr[S_LIFETIME] = lifetime;
  scalarArr[S_START_LIFETIME] = startLifetime;
  return { scalarArr, scalarBase: 0 };
}

// ─── KILL Mode ──────────────────────────────────────────────────────────────

describe('applyCollisionPlanes — KILL mode', () => {
  test('particle on wrong side (crossed plane) returns true and deactivates', () => {
    // Plane at y=5, normal pointing up. Particle at y=3 is below the plane.
    const positionArr = new Float32Array([0, 3, 0]);
    const velocity = new THREE.Vector3(0, -1, 0);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    const killed = applyCollisionPlanes({
      collisionPlanes: [createPlane({ mode: CollisionPlaneMode.KILL })],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 7,
    });

    expect(killed).toBe(true);
    expect(deactivateParticle).toHaveBeenCalledWith(7);
  });

  test('particle on correct side (in front of plane) returns false', () => {
    // Particle at y=10 is above the plane at y=5 with normal pointing up.
    const positionArr = new Float32Array([0, 10, 0]);
    const velocity = new THREE.Vector3(0, 1, 0);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    const killed = applyCollisionPlanes({
      collisionPlanes: [createPlane({ mode: CollisionPlaneMode.KILL })],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    expect(killed).toBe(false);
    expect(deactivateParticle).not.toHaveBeenCalled();
  });

  test('particle exactly on the plane (distance = 0) returns false', () => {
    // Particle at y=5 is exactly on the plane surface.
    const positionArr = new Float32Array([0, 5, 0]);
    const velocity = new THREE.Vector3(0, -1, 0);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    const killed = applyCollisionPlanes({
      collisionPlanes: [createPlane({ mode: CollisionPlaneMode.KILL })],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    expect(killed).toBe(false);
    expect(deactivateParticle).not.toHaveBeenCalled();
  });
});

// ─── CLAMP Mode ─────────────────────────────────────────────────────────────

describe('applyCollisionPlanes — CLAMP mode', () => {
  test('particle crosses plane — position projected back onto plane surface', () => {
    // Plane at y=5 with normal (0,1,0). Particle at y=3 (crossed by 2 units).
    const positionArr = new Float32Array([2, 3, 4]);
    const velocity = new THREE.Vector3(0, -5, 0);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    const killed = applyCollisionPlanes({
      collisionPlanes: [createPlane({ mode: CollisionPlaneMode.CLAMP })],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    expect(killed).toBe(false);
    // Position should be projected onto the plane: y = 3 - (-2)*1 = 5
    expect(positionArr[0]).toBe(2); // x unchanged
    expect(positionArr[1]).toBeCloseTo(5, 10);
    expect(positionArr[2]).toBe(4); // z unchanged
  });

  test('particle crosses plane — velocity component along normal zeroed when moving into plane', () => {
    const positionArr = new Float32Array([0, 3, 0]);
    const velocity = new THREE.Vector3(3, -5, 1);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    applyCollisionPlanes({
      collisionPlanes: [createPlane({ mode: CollisionPlaneMode.CLAMP })],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    // vel dot normal = -5 (negative, moving into plane)
    // velocity along normal removed: vy = -5 - (-5)*1 = 0
    expect(velocity.x).toBe(3); // tangential component preserved
    expect(velocity.y).toBeCloseTo(0, 10);
    expect(velocity.z).toBe(1); // tangential component preserved
  });

  test('particle moving away from plane but position crossed — velocity preserved', () => {
    // Particle is below the plane but velocity is pointing up (away from plane).
    const positionArr = new Float32Array([0, 4.5, 0]);
    const velocity = new THREE.Vector3(1, 2, 0); // moving upward (away from plane)
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    applyCollisionPlanes({
      collisionPlanes: [createPlane({ mode: CollisionPlaneMode.CLAMP })],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    // Position clamped to plane
    expect(positionArr[1]).toBeCloseTo(5, 10);
    // Velocity preserved because vel dot normal = 2 > 0 (moving away)
    expect(velocity.x).toBe(1);
    expect(velocity.y).toBe(2);
    expect(velocity.z).toBe(0);
  });
});

// ─── BOUNCE Mode ────────────────────────────────────────────────────────────

describe('applyCollisionPlanes — BOUNCE mode', () => {
  test('velocity reflected across plane normal with dampen factor', () => {
    // Plane at y=5, normal (0,1,0). Particle at y=3 falling at vy=-10.
    const positionArr = new Float32Array([0, 3, 0]);
    const velocity = new THREE.Vector3(0, -10, 0);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    applyCollisionPlanes({
      collisionPlanes: [
        createPlane({
          mode: CollisionPlaneMode.BOUNCE,
          dampen: 0.5,
        }),
      ],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    // Reflect: v' = (v - 2*dot(v,n)*n) * dampen
    // dot(v,n) = -10, so reflected = (0,-10,0) - 2*(-10)*(0,1,0) = (0,10,0)
    // with dampen 0.5: (0, 5, 0)
    expect(velocity.x).toBeCloseTo(0, 10);
    expect(velocity.y).toBeCloseTo(5, 10);
    expect(velocity.z).toBeCloseTo(0, 10);
  });

  test('position projected back onto plane surface', () => {
    const positionArr = new Float32Array([1, 2, 3]);
    const velocity = new THREE.Vector3(0, -10, 0);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    applyCollisionPlanes({
      collisionPlanes: [
        createPlane({
          mode: CollisionPlaneMode.BOUNCE,
          dampen: 0.8,
        }),
      ],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    // y should be projected back to 5 (the plane surface)
    expect(positionArr[0]).toBe(1);
    expect(positionArr[1]).toBeCloseTo(5, 10);
    expect(positionArr[2]).toBe(3);
  });

  test('dampen factor applied — velocity magnitude halved with dampen=0.5', () => {
    const positionArr = new Float32Array([0, 3, 0]);
    const velocity = new THREE.Vector3(4, -10, 0);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    applyCollisionPlanes({
      collisionPlanes: [
        createPlane({
          mode: CollisionPlaneMode.BOUNCE,
          dampen: 0.5,
        }),
      ],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    // Reflect: dot(v,n) = -10
    // reflected = (4, -10, 0) - 2*(-10)*(0,1,0) = (4, 10, 0)
    // dampened = (2, 5, 0)
    expect(velocity.x).toBeCloseTo(2, 10);
    expect(velocity.y).toBeCloseTo(5, 10);
    expect(velocity.z).toBeCloseTo(0, 10);
  });

  test('lifetimeLoss > 0 increases scalarArr lifetime', () => {
    const positionArr = new Float32Array([0, 3, 0]);
    const velocity = new THREE.Vector3(0, -10, 0);
    const deactivateParticle = jest.fn();
    const startLifetime = 5000;
    const initialLifetime = 1000;
    const { scalarArr, scalarBase } = createScalarArr(
      initialLifetime,
      startLifetime
    );

    applyCollisionPlanes({
      collisionPlanes: [
        createPlane({
          mode: CollisionPlaneMode.BOUNCE,
          dampen: 0.5,
          lifetimeLoss: 0.2,
        }),
      ],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    // lifetime should increase by lifetimeLoss * startLifetime = 0.2 * 5000 = 1000
    expect(scalarArr[S_LIFETIME]).toBeCloseTo(
      initialLifetime + 0.2 * startLifetime,
      5
    );
  });

  test('lifetimeLoss = 0 does not modify lifetime', () => {
    const positionArr = new Float32Array([0, 3, 0]);
    const velocity = new THREE.Vector3(0, -10, 0);
    const deactivateParticle = jest.fn();
    const initialLifetime = 1000;
    const { scalarArr, scalarBase } = createScalarArr(initialLifetime, 5000);

    applyCollisionPlanes({
      collisionPlanes: [
        createPlane({
          mode: CollisionPlaneMode.BOUNCE,
          dampen: 0.5,
          lifetimeLoss: 0,
        }),
      ],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    expect(scalarArr[S_LIFETIME]).toBe(initialLifetime);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('applyCollisionPlanes — edge cases', () => {
  test('inactive plane (isActive=false) is skipped entirely', () => {
    const positionArr = new Float32Array([0, 3, 0]); // below plane at y=5
    const velocity = new THREE.Vector3(0, -5, 0);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    const killed = applyCollisionPlanes({
      collisionPlanes: [
        createPlane({
          mode: CollisionPlaneMode.KILL,
          isActive: false,
        }),
      ],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    expect(killed).toBe(false);
    expect(deactivateParticle).not.toHaveBeenCalled();
    // Position unchanged
    expect(positionArr[1]).toBe(3);
  });

  test('multiple planes — all checked, first KILL wins', () => {
    // First plane: CLAMP at y=5 (particle at y=3 crosses it)
    // Second plane: KILL at y=2 (particle at y=3 does NOT cross it)
    // Third plane: KILL at y=4 (particle at y=3 crosses it)
    const positionArr = new Float32Array([0, 3, 0]);
    const velocity = new THREE.Vector3(0, -5, 0);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    // The CLAMP plane is first and will project position to y=5.
    // After CLAMP, the particle is at y=5, which is above the KILL plane at y=4.
    // But since we iterate all planes, the KILL at y=4 with normal (0,1,0):
    // signed distance = (5 - 4) = 1 > 0, so particle is on the correct side. No kill.
    const killed = applyCollisionPlanes({
      collisionPlanes: [
        createPlane({
          mode: CollisionPlaneMode.CLAMP,
          position: new THREE.Vector3(0, 5, 0),
        }),
        createPlane({
          mode: CollisionPlaneMode.KILL,
          position: new THREE.Vector3(0, 2, 0),
        }),
        createPlane({
          mode: CollisionPlaneMode.KILL,
          position: new THREE.Vector3(0, 4, 0),
        }),
      ],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    // CLAMP processed first, adjusting position to y=5.
    // Second KILL: particle at y=5, plane at y=2, distance=3 > 0 — safe.
    // Third KILL: particle at y=5, plane at y=4, distance=1 > 0 — safe.
    expect(killed).toBe(false);
    expect(positionArr[1]).toBeCloseTo(5, 10);
  });

  test('multiple planes — KILL plane terminates early', () => {
    // First plane: KILL at y=5 (particle at y=3 crosses it)
    // Second plane: CLAMP at y=10 (should never be reached)
    const positionArr = new Float32Array([0, 3, 0]);
    const velocity = new THREE.Vector3(0, -5, 0);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    const killed = applyCollisionPlanes({
      collisionPlanes: [
        createPlane({
          mode: CollisionPlaneMode.KILL,
          position: new THREE.Vector3(0, 5, 0),
        }),
        createPlane({
          mode: CollisionPlaneMode.CLAMP,
          position: new THREE.Vector3(0, 10, 0),
        }),
      ],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    expect(killed).toBe(true);
    expect(deactivateParticle).toHaveBeenCalledTimes(1);
  });

  test('angled plane (non-axis-aligned normal) — correct reflection', () => {
    // Plane with normal at 45 degrees in XY: (0.707, 0.707, 0)
    const sqrt2Over2 = Math.SQRT2 / 2;
    const normal = new THREE.Vector3(sqrt2Over2, sqrt2Over2, 0).normalize();
    // Plane at origin
    const positionArr = new Float32Array([-1, -1, 0]);
    // Particle at (-1,-1,0): distance = dot((-1,-1,0), normal) = -sqrt(2) < 0
    const velocity = new THREE.Vector3(-3, -3, 0);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    applyCollisionPlanes({
      collisionPlanes: [
        createPlane({
          mode: CollisionPlaneMode.BOUNCE,
          position: new THREE.Vector3(0, 0, 0),
          normal,
          dampen: 1.0,
        }),
      ],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    // Position should be projected back onto the plane
    // signedDist = dot((-1,-1,0), (0.707,0.707,0)) = -1.414...
    // projected: (-1,-1,0) - (-1.414)*(0.707,0.707,0) = (0, 0, 0)
    expect(positionArr[0]).toBeCloseTo(0, 4);
    expect(positionArr[1]).toBeCloseTo(0, 4);
    expect(positionArr[2]).toBeCloseTo(0, 4);

    // Reflect velocity: dot((-3,-3,0), n) = -3*0.707 + -3*0.707 = -4.243
    // reflected = (-3,-3,0) - 2*(-4.243)*(0.707,0.707,0) = (-3+6, -3+6, 0) = (3, 3, 0)
    // dampen=1.0, so velocity = (3, 3, 0)
    expect(velocity.x).toBeCloseTo(3, 4);
    expect(velocity.y).toBeCloseTo(3, 4);
    expect(velocity.z).toBeCloseTo(0, 4);
  });

  test('zero velocity particle on wrong side — CLAMP works without division by zero', () => {
    const positionArr = new Float32Array([0, 3, 0]);
    const velocity = new THREE.Vector3(0, 0, 0);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    const killed = applyCollisionPlanes({
      collisionPlanes: [createPlane({ mode: CollisionPlaneMode.CLAMP })],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    expect(killed).toBe(false);
    // Position projected onto plane
    expect(positionArr[1]).toBeCloseTo(5, 10);
    // Velocity unchanged (zero dot normal = 0, not < 0, so no modification)
    expect(velocity.x).toBe(0);
    expect(velocity.y).toBe(0);
    expect(velocity.z).toBe(0);
  });

  test('BOUNCE with dampen=0 — velocity becomes zero after bounce', () => {
    const positionArr = new Float32Array([0, 3, 0]);
    const velocity = new THREE.Vector3(2, -10, 3);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    applyCollisionPlanes({
      collisionPlanes: [
        createPlane({
          mode: CollisionPlaneMode.BOUNCE,
          dampen: 0,
        }),
      ],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    expect(velocity.x).toBeCloseTo(0, 10);
    expect(velocity.y).toBeCloseTo(0, 10);
    expect(velocity.z).toBeCloseTo(0, 10);
  });

  test('BOUNCE with dampen=1 — perfect elastic bounce (velocity magnitude preserved)', () => {
    const positionArr = new Float32Array([0, 3, 0]);
    const originalVelocity = new THREE.Vector3(2, -10, 3);
    const originalMagnitude = originalVelocity.length();
    const velocity = originalVelocity.clone();
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    applyCollisionPlanes({
      collisionPlanes: [
        createPlane({
          mode: CollisionPlaneMode.BOUNCE,
          dampen: 1.0,
        }),
      ],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    // With dampen=1, magnitude should be preserved
    expect(velocity.length()).toBeCloseTo(originalMagnitude, 10);
    // Y component should be reflected (was -10, now +10)
    expect(velocity.y).toBeCloseTo(10, 10);
    // Tangential components preserved
    expect(velocity.x).toBeCloseTo(2, 10);
    expect(velocity.z).toBeCloseTo(3, 10);
  });

  test('empty collision planes array — returns false with no changes', () => {
    const positionArr = new Float32Array([0, 3, 0]);
    const velocity = new THREE.Vector3(0, -5, 0);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    const killed = applyCollisionPlanes({
      collisionPlanes: [],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    expect(killed).toBe(false);
    expect(positionArr[1]).toBe(3);
    expect(velocity.y).toBe(-5);
  });

  test('positionIndex offsets correctly into positionArr for non-first particle', () => {
    // Array with 3 particles: positions at indices 0, 3, 6
    const positionArr = new Float32Array([
      10,
      20,
      30, // particle 0
      0,
      3,
      0, // particle 1 (below plane at y=5)
      50,
      60,
      70, // particle 2
    ]);
    const velocity = new THREE.Vector3(0, -5, 0);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    applyCollisionPlanes({
      collisionPlanes: [createPlane({ mode: CollisionPlaneMode.CLAMP })],
      velocity,
      positionArr,
      positionIndex: 3, // particle 1
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 1,
    });

    // Only particle 1 should be modified
    expect(positionArr[0]).toBe(10);
    expect(positionArr[1]).toBe(20);
    expect(positionArr[2]).toBe(30);
    // Particle 1 projected to y=5
    expect(positionArr[3]).toBe(0);
    expect(positionArr[4]).toBeCloseTo(5, 10);
    expect(positionArr[5]).toBe(0);
    // Particle 2 unchanged
    expect(positionArr[6]).toBe(50);
    expect(positionArr[7]).toBe(60);
    expect(positionArr[8]).toBe(70);
  });

  test('scalarBase offsets correctly into scalarArr for non-first particle', () => {
    const positionArr = new Float32Array([0, 3, 0]);
    const velocity = new THREE.Vector3(0, -10, 0);
    const deactivateParticle = jest.fn();
    // Two particles in the scalar array; we target the second one
    const scalarArr = new Float32Array(SCALAR_STRIDE * 2);
    const scalarBase = SCALAR_STRIDE; // second particle
    scalarArr[scalarBase + S_LIFETIME] = 500;
    scalarArr[scalarBase + S_START_LIFETIME] = 4000;

    applyCollisionPlanes({
      collisionPlanes: [
        createPlane({
          mode: CollisionPlaneMode.BOUNCE,
          dampen: 0.5,
          lifetimeLoss: 0.3,
        }),
      ],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 1,
    });

    // lifetimeLoss * startLifetime = 0.3 * 4000 = 1200
    expect(scalarArr[scalarBase + S_LIFETIME]).toBeCloseTo(500 + 1200, 5);
    // First particle's scalar data should be untouched
    expect(scalarArr[S_LIFETIME]).toBe(0);
  });

  test('BOUNCE with angled velocity and axis-aligned plane preserves tangential component', () => {
    // Plane at y=0 with normal (0,1,0). Particle at y=-1.
    const positionArr = new Float32Array([5, -1, 3]);
    const velocity = new THREE.Vector3(4, -6, 2);
    const deactivateParticle = jest.fn();
    const { scalarArr, scalarBase } = createScalarArr();

    applyCollisionPlanes({
      collisionPlanes: [
        createPlane({
          mode: CollisionPlaneMode.BOUNCE,
          position: new THREE.Vector3(0, 0, 0),
          normal: new THREE.Vector3(0, 1, 0),
          dampen: 1.0,
        }),
      ],
      velocity,
      positionArr,
      positionIndex: 0,
      scalarArr,
      scalarBase,
      deactivateParticle,
      particleIndex: 0,
    });

    // dot(v, n) = -6
    // reflected = (4,-6,2) - 2*(-6)*(0,1,0) = (4, 6, 2)
    // dampen = 1.0
    expect(velocity.x).toBeCloseTo(4, 10);
    expect(velocity.y).toBeCloseTo(6, 10);
    expect(velocity.z).toBeCloseTo(2, 10);
  });
});
