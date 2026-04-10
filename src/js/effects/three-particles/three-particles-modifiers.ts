import * as THREE from 'three';

import {
  SCALAR_STRIDE,
  S_SIZE,
  S_ROTATION,
  S_COLOR_R,
  S_COLOR_G,
  S_COLOR_B,
  S_COLOR_A,
} from './three-particles-constants.js';
import { calculateValue } from './three-particles-utils.js';
import {
  GeneralData,
  MappedAttributes,
  NormalizedParticleSystemConfig,
} from './types.js';

const noiseInput = new THREE.Vector3(0, 0, 0);
const orbitalEuler = new THREE.Euler();

/**
 * Applies all active modifiers to a single particle during the update cycle.
 *
 * This function handles the animation and modification of particle properties over its lifetime,
 * including velocity (linear and orbital), size, opacity, color, rotation, and noise-based effects.
 * It is called once per particle per frame by the {@link updateParticleSystems} function.
 *
 * @param params - Configuration object containing:
 * @param params.delta - Time elapsed since the last frame in seconds. Used for velocity and rotation calculations.
 * @param params.generalData - Internal particle system state and cached values.
 * @param params.normalizedConfig - The normalized particle system configuration with all modifiers.
 * @param params.attributes - Three.js buffer attributes for position, size, rotation, and color.
 * @param params.particleLifetimePercentage - Normalized lifetime of the particle (0.0 to 1.0).
 *   - 0.0 = particle just born
 *   - 1.0 = particle at end of life
 * @param params.particleIndex - Index of the particle in the buffer arrays.
 *
 * @remarks
 * The function modifies the following particle properties based on configuration:
 *
 * - **Linear Velocity**: Moves particles in a straight line (velocityOverLifetime.linear)
 * - **Orbital Velocity**: Rotates particles around their emission point (velocityOverLifetime.orbital)
 * - **Size Over Lifetime**: Scales particle size based on lifetime curve (sizeOverLifetime)
 * - **Opacity Over Lifetime**: Fades particles in/out based on lifetime curve (opacityOverLifetime)
 * - **Color Over Lifetime**: Animates RGB channels independently based on lifetime curves (colorOverLifetime)
 * - **Rotation Over Lifetime**: Rotates particles around their center (rotationOverLifetime)
 * - **Noise**: Adds organic, turbulent motion to position, rotation, and size (noise)
 *
 * Each modifier only runs if it's active in the configuration, optimizing performance for simple effects.
 *
 * @example
 * ```typescript
 * // This function is called internally by updateParticleSystems
 * // You typically don't need to call it directly
 *
 * // However, understanding its behavior helps configure particle systems:
 * const config = {
 *   sizeOverLifetime: {
 *     isActive: true,
 *     lifetimeCurve: {
 *       type: 'BEZIER',
 *       bezierPoints: [
 *         { x: 0, y: 0, percentage: 0 },    // Start at 0% size
 *         { x: 0.5, y: 1, percentage: 0.5 }, // Grow to 100% at midlife
 *         { x: 1, y: 0, percentage: 1 }      // Shrink to 0% at end
 *       ]
 *     }
 *   },
 *   opacityOverLifetime: {
 *     isActive: true,
 *     lifetimeCurve: {
 *       type: 'EASING',
 *       curveFunction: 'easeOutQuad'
 *     }
 *   }
 * };
 * ```
 *
 * @see {@link updateParticleSystems} - Calls this function for each active particle
 * @see {@link VelocityOverLifetime} - Configuration for velocity modifiers
 * @see {@link NoiseConfig} - Configuration for noise-based effects
 */
export const applyModifiers = ({
  delta,
  generalData,
  normalizedConfig,
  attributes,
  scalarArray,
  particleLifetimePercentage,
  particleIndex,
}: {
  delta: number;
  generalData: GeneralData;
  normalizedConfig: NormalizedParticleSystemConfig;
  attributes: MappedAttributes;
  scalarArray: Float32Array;
  particleLifetimePercentage: number;
  particleIndex: number;
}) => {
  const {
    particleSystemId,
    startValues,
    lifetimeValues,
    linearVelocityData,
    orbitalVelocityData,
    noise,
  } = generalData;

  const positionIndex = particleIndex * 3;
  const positionArr = attributes.position.array;
  const base = particleIndex * SCALAR_STRIDE;

  if (linearVelocityData) {
    const { speed, valueModifiers } = linearVelocityData[particleIndex];

    const normalizedXSpeed = valueModifiers.x
      ? valueModifiers.x(particleLifetimePercentage)
      : speed.x;

    const normalizedYSpeed = valueModifiers.y
      ? valueModifiers.y(particleLifetimePercentage)
      : speed.y;

    const normalizedZSpeed = valueModifiers.z
      ? valueModifiers.z(particleLifetimePercentage)
      : speed.z;

    positionArr[positionIndex] += normalizedXSpeed * delta;
    positionArr[positionIndex + 1] += normalizedYSpeed * delta;
    positionArr[positionIndex + 2] += normalizedZSpeed * delta;

    attributes.position.needsUpdate = true;
  }

  if (orbitalVelocityData) {
    const { speed, positionOffset, valueModifiers } =
      orbitalVelocityData[particleIndex];

    positionArr[positionIndex] -= positionOffset.x;
    positionArr[positionIndex + 1] -= positionOffset.y;
    positionArr[positionIndex + 2] -= positionOffset.z;

    const normalizedXSpeed = valueModifiers.x
      ? valueModifiers.x(particleLifetimePercentage)
      : speed.x;

    const normalizedYSpeed = valueModifiers.y
      ? valueModifiers.y(particleLifetimePercentage)
      : speed.y;

    const normalizedZSpeed = valueModifiers.z
      ? valueModifiers.z(particleLifetimePercentage)
      : speed.z;

    orbitalEuler.set(
      normalizedXSpeed * delta,
      normalizedZSpeed * delta,
      normalizedYSpeed * delta
    );
    positionOffset.applyEuler(orbitalEuler);

    positionArr[positionIndex] += positionOffset.x;
    positionArr[positionIndex + 1] += positionOffset.y;
    positionArr[positionIndex + 2] += positionOffset.z;

    attributes.position.needsUpdate = true;
  }

  if (normalizedConfig.sizeOverLifetime.isActive) {
    const multiplier = calculateValue(
      particleSystemId,
      normalizedConfig.sizeOverLifetime.lifetimeCurve,
      particleLifetimePercentage
    );
    scalarArray[base + S_SIZE] =
      startValues.startSize[particleIndex] * multiplier;
  }

  if (normalizedConfig.opacityOverLifetime.isActive) {
    const multiplier = calculateValue(
      particleSystemId,
      normalizedConfig.opacityOverLifetime.lifetimeCurve,
      particleLifetimePercentage
    );
    scalarArray[base + S_COLOR_A] =
      startValues.startOpacity[particleIndex] * multiplier;
  }

  if (normalizedConfig.colorOverLifetime.isActive) {
    const rMultiplier = calculateValue(
      particleSystemId,
      normalizedConfig.colorOverLifetime.r,
      particleLifetimePercentage
    );
    const gMultiplier = calculateValue(
      particleSystemId,
      normalizedConfig.colorOverLifetime.g,
      particleLifetimePercentage
    );
    const bMultiplier = calculateValue(
      particleSystemId,
      normalizedConfig.colorOverLifetime.b,
      particleLifetimePercentage
    );

    scalarArray[base + S_COLOR_R] =
      startValues.startColorR[particleIndex] * rMultiplier;
    scalarArray[base + S_COLOR_G] =
      startValues.startColorG[particleIndex] * gMultiplier;
    scalarArray[base + S_COLOR_B] =
      startValues.startColorB[particleIndex] * bMultiplier;
  }

  if (lifetimeValues.rotationOverLifetime) {
    scalarArray[base + S_ROTATION] +=
      lifetimeValues.rotationOverLifetime[particleIndex] * delta * 0.02;
  }

  if (noise.isActive) {
    const {
      sampler,
      strength,
      noisePower,
      offsets,
      positionAmount,
      rotationAmount,
      sizeAmount,
    } = noise;
    let noiseOnPosition;

    const noisePosition =
      (particleLifetimePercentage + (offsets ? offsets[particleIndex] : 0)) *
      10 *
      strength;

    noiseInput.set(noisePosition, 0, 0);
    noiseOnPosition = sampler!.get3(noiseInput);
    positionArr[positionIndex] += noiseOnPosition * noisePower * positionAmount;

    if (rotationAmount !== 0) {
      scalarArray[base + S_ROTATION] +=
        noiseOnPosition * noisePower * rotationAmount;
    }

    if (sizeAmount !== 0) {
      scalarArray[base + S_SIZE] += noiseOnPosition * noisePower * sizeAmount;
    }

    noiseInput.set(noisePosition, noisePosition, 0);
    noiseOnPosition = sampler!.get3(noiseInput);
    positionArr[positionIndex + 1] +=
      noiseOnPosition * noisePower * positionAmount;

    noiseInput.set(noisePosition, noisePosition, noisePosition);
    noiseOnPosition = sampler!.get3(noiseInput);
    positionArr[positionIndex + 2] +=
      noiseOnPosition * noisePower * positionAmount;

    attributes.position.needsUpdate = true;
  }

  // Sync packed quaternion vec4 from scalar rotation for mesh particles.
  // This runs after noise so the quaternion reflects the final rotation value.
  if (attributes.quat) {
    const rotZ = scalarArray[base + S_ROTATION];
    const halfZ = rotZ * 0.5;
    const qi = particleIndex * 4;
    attributes.quat.array[qi] = 0;
    attributes.quat.array[qi + 1] = 0;
    attributes.quat.array[qi + 2] = Math.sin(halfZ);
    attributes.quat.array[qi + 3] = Math.cos(halfZ);
    attributes.quat.needsUpdate = true;
  }
};
