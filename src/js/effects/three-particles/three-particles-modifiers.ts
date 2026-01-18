import * as THREE from 'three';

import { calculateValue } from './three-particles-utils.js';
import { GeneralData, NormalizedParticleSystemConfig } from './types.js';

const noiseInput = new THREE.Vector3(0, 0, 0);
const orbitalEuler = new THREE.Euler();

export const applyModifiers = ({
  delta,
  generalData,
  normalizedConfig,
  attributes,
  particleLifetimePercentage,
  particleIndex,
}: {
  delta: number;
  generalData: GeneralData;
  normalizedConfig: NormalizedParticleSystemConfig;
  attributes: THREE.NormalBufferAttributes;
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
    attributes.size.array[particleIndex] =
      startValues.startSize[particleIndex] * multiplier;
    attributes.size.needsUpdate = true;
  }

  if (normalizedConfig.opacityOverLifetime.isActive) {
    const multiplier = calculateValue(
      particleSystemId,
      normalizedConfig.opacityOverLifetime.lifetimeCurve,
      particleLifetimePercentage
    );
    attributes.colorA.array[particleIndex] =
      startValues.startOpacity[particleIndex] * multiplier;
    attributes.colorA.needsUpdate = true;
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

    attributes.colorR.array[particleIndex] =
      startValues.startColorR[particleIndex] * rMultiplier;
    attributes.colorG.array[particleIndex] =
      startValues.startColorG[particleIndex] * gMultiplier;
    attributes.colorB.array[particleIndex] =
      startValues.startColorB[particleIndex] * bMultiplier;

    attributes.colorR.needsUpdate = true;
    attributes.colorG.needsUpdate = true;
    attributes.colorB.needsUpdate = true;
  }

  if (lifetimeValues.rotationOverLifetime) {
    attributes.rotation.array[particleIndex] +=
      lifetimeValues.rotationOverLifetime[particleIndex] * delta * 0.02;
    attributes.rotation.needsUpdate = true;
  }

  if (noise.isActive) {
    const {
      sampler,
      strength,
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
    const noisePower = 0.15 * strength;

    noiseInput.set(noisePosition, 0, 0);
    noiseOnPosition = sampler!.get3(noiseInput);
    positionArr[positionIndex] += noiseOnPosition * noisePower * positionAmount;

    if (rotationAmount !== 0) {
      attributes.rotation.array[particleIndex] +=
        noiseOnPosition * noisePower * rotationAmount;
      attributes.rotation.needsUpdate = true;
    }

    if (sizeAmount !== 0) {
      attributes.size.array[particleIndex] +=
        noiseOnPosition * noisePower * sizeAmount;
      attributes.size.needsUpdate = true;
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
};
