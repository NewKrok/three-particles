import * as THREE from 'three';

import { S_LIFETIME, S_START_LIFETIME } from './three-particles-constants.js';
import { CollisionPlaneMode } from './three-particles-enums.js';
import { NormalizedCollisionPlaneConfig } from './types.js';

// Pre-allocated vectors to avoid GC pressure in the hot loop
const _planeToParticle = new THREE.Vector3();
const _normalComponent = new THREE.Vector3();

/**
 * Applies all active collision planes to a single particle.
 *
 * Collision planes define infinite surfaces in 3D space. When a particle's
 * signed distance to the plane becomes negative (i.e., it crosses from the
 * front side to the back side), the configured response mode is triggered:
 *
 * - **KILL**: Deactivate the particle immediately.
 * - **CLAMP**: Project the particle back onto the plane surface and zero the
 *   velocity component along the plane normal.
 * - **BOUNCE**: Reflect the velocity across the plane normal, apply damping,
 *   project the position back onto the plane, and optionally reduce lifetime.
 *
 * Called once per active particle per frame in the update loop,
 * after position update and before modifiers.
 *
 * @returns `true` if the particle was killed (caller should skip remaining processing).
 */
export const applyCollisionPlanes = ({
  collisionPlanes,
  velocity,
  positionArr,
  positionIndex,
  scalarArr,
  scalarBase,
  deactivateParticle,
  particleIndex,
}: {
  collisionPlanes: ReadonlyArray<NormalizedCollisionPlaneConfig>;
  velocity: THREE.Vector3;
  positionArr: THREE.TypedArray;
  positionIndex: number;
  scalarArr: Float32Array;
  scalarBase: number;
  deactivateParticle: (particleIndex: number) => void;
  particleIndex: number;
}): boolean => {
  for (let i = 0; i < collisionPlanes.length; i++) {
    const plane = collisionPlanes[i];
    if (!plane.isActive) continue;

    const normal = plane.normal;
    const planePos = plane.position;

    // Vector from plane position to particle position
    _planeToParticle.set(
      (positionArr[positionIndex] as number) - planePos.x,
      (positionArr[positionIndex + 1] as number) - planePos.y,
      (positionArr[positionIndex + 2] as number) - planePos.z
    );

    // Signed distance: positive = front side, negative = crossed the plane
    const signedDistance = _planeToParticle.dot(normal);

    if (signedDistance >= 0) continue;

    // Particle has crossed the plane — apply response
    switch (plane.mode) {
      case CollisionPlaneMode.KILL:
        deactivateParticle(particleIndex);
        return true;

      case CollisionPlaneMode.CLAMP:
        // Project position back onto the plane surface
        positionArr[positionIndex] =
          (positionArr[positionIndex] as number) - signedDistance * normal.x;
        positionArr[positionIndex + 1] =
          (positionArr[positionIndex + 1] as number) -
          signedDistance * normal.y;
        positionArr[positionIndex + 2] =
          (positionArr[positionIndex + 2] as number) -
          signedDistance * normal.z;

        // Remove velocity component along the plane normal
        const velDotNormal =
          velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z;
        if (velDotNormal < 0) {
          velocity.x -= velDotNormal * normal.x;
          velocity.y -= velDotNormal * normal.y;
          velocity.z -= velDotNormal * normal.z;
        }
        break;

      case CollisionPlaneMode.BOUNCE: {
        // Project position back onto the plane surface
        positionArr[positionIndex] =
          (positionArr[positionIndex] as number) - signedDistance * normal.x;
        positionArr[positionIndex + 1] =
          (positionArr[positionIndex + 1] as number) -
          signedDistance * normal.y;
        positionArr[positionIndex + 2] =
          (positionArr[positionIndex + 2] as number) -
          signedDistance * normal.z;

        // Reflect velocity: v' = v - 2 * dot(v, n) * n
        const vDotN =
          velocity.x * normal.x + velocity.y * normal.y + velocity.z * normal.z;
        _normalComponent.set(
          2 * vDotN * normal.x,
          2 * vDotN * normal.y,
          2 * vDotN * normal.z
        );
        velocity.x = (velocity.x - _normalComponent.x) * plane.dampen;
        velocity.y = (velocity.y - _normalComponent.y) * plane.dampen;
        velocity.z = (velocity.z - _normalComponent.z) * plane.dampen;

        // Apply lifetime loss
        if (plane.lifetimeLoss > 0) {
          const startLifetime = scalarArr[scalarBase + S_START_LIFETIME];
          scalarArr[scalarBase + S_LIFETIME] +=
            plane.lifetimeLoss * startLifetime;
        }
        break;
      }
    }
  }

  return false;
};
