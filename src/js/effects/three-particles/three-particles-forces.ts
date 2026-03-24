import * as THREE from 'three';

import { ForceFieldFalloff, ForceFieldType } from './three-particles-enums.js';
import { calculateValue } from './three-particles-utils.js';
import { NormalizedForceFieldConfig } from './types.js';

// Pre-allocated vector to avoid GC pressure in the hot loop
const _forceDirection = new THREE.Vector3();

const applyPointForce = (
  field: NormalizedForceFieldConfig,
  strength: number,
  velocity: THREE.Vector3,
  positionArr: THREE.TypedArray,
  positionIndex: number,
  delta: number
): void => {
  _forceDirection.set(
    field.position.x - (positionArr[positionIndex] as number),
    field.position.y - (positionArr[positionIndex + 1] as number),
    field.position.z - (positionArr[positionIndex + 2] as number)
  );

  const distance = _forceDirection.length();

  if (distance < 0.0001) return;
  if (field.range !== Infinity && distance > field.range) return;

  _forceDirection.divideScalar(distance);

  let falloffMultiplier = 1.0;
  if (field.range !== Infinity) {
    const normalizedDistance = distance / field.range;
    switch (field.falloff) {
      case ForceFieldFalloff.LINEAR:
        falloffMultiplier = 1.0 - normalizedDistance;
        break;
      case ForceFieldFalloff.QUADRATIC:
        falloffMultiplier = 1.0 - normalizedDistance * normalizedDistance;
        break;
      case ForceFieldFalloff.NONE:
        falloffMultiplier = 1.0;
        break;
    }
  }

  const force = strength * falloffMultiplier * delta;
  velocity.x += _forceDirection.x * force;
  velocity.y += _forceDirection.y * force;
  velocity.z += _forceDirection.z * force;
};

const applyDirectionalForce = (
  field: NormalizedForceFieldConfig,
  strength: number,
  velocity: THREE.Vector3,
  delta: number
): void => {
  const force = strength * delta;
  velocity.x += field.direction.x * force;
  velocity.y += field.direction.y * force;
  velocity.z += field.direction.z * force;
};

/**
 * Applies all active force fields to a single particle's velocity.
 *
 * Force fields modify particle velocity (not position directly), matching
 * the gravity application pattern. This preserves momentum and integrates
 * naturally with the existing velocity system.
 *
 * Called once per active particle per frame in the update loop,
 * after gravity and before position update.
 *
 * @param params - Configuration object containing:
 * @param params.particleSystemId - Unique ID for the particle system (used by calculateValue).
 * @param params.forceFields - Array of normalized force field configurations.
 * @param params.velocity - The particle's current velocity vector (modified in place).
 * @param params.positionArr - The position buffer array for all particles.
 * @param params.positionIndex - The index into positionArr for this particle's X coordinate.
 * @param params.delta - Time elapsed since last frame in seconds.
 * @param params.systemLifetimePercentage - Normalized system lifetime (0.0 to 1.0) for curve evaluation.
 *
 * @example
 * ```typescript
 * // This function is called internally by updateParticleSystems
 * // You typically don't need to call it directly
 *
 * // Configure force fields in your particle system:
 * const config = {
 *   forceFields: [
 *     {
 *       type: ForceFieldType.POINT,
 *       position: new THREE.Vector3(0, 5, 0),
 *       strength: 3.0,
 *       range: 10,
 *       falloff: ForceFieldFalloff.LINEAR,
 *     },
 *   ],
 * };
 * ```
 *
 * @see {@link ForceFieldConfig} - User-facing configuration type
 * @see {@link ForceFieldType} - Available force field types
 * @see {@link ForceFieldFalloff} - Available falloff modes
 */
export const applyForceFields = ({
  particleSystemId,
  forceFields,
  velocity,
  positionArr,
  positionIndex,
  delta,
  systemLifetimePercentage,
}: {
  particleSystemId: number;
  forceFields: Array<NormalizedForceFieldConfig>;
  velocity: THREE.Vector3;
  positionArr: THREE.TypedArray;
  positionIndex: number;
  delta: number;
  systemLifetimePercentage: number;
}): void => {
  for (let i = 0; i < forceFields.length; i++) {
    const field = forceFields[i];
    if (!field.isActive) continue;

    const strength = calculateValue(
      particleSystemId,
      field.strength,
      systemLifetimePercentage
    );

    if (strength === 0) continue;

    if (field.type === ForceFieldType.POINT) {
      applyPointForce(
        field,
        strength,
        velocity,
        positionArr,
        positionIndex,
        delta
      );
    } else if (field.type === ForceFieldType.DIRECTIONAL) {
      applyDirectionalForce(field, strength, velocity, delta);
    }
  }
};
