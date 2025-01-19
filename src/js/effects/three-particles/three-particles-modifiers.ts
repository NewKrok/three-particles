import * as THREE from 'three';

import { getCurveFunction } from './three-particles-curves.js';
import {
  CurveFunction,
  Noise,
  NormalizedParticleSystemConfig,
  ParticleSystemConfig,
} from './types.js';

const noiseInput = new THREE.Vector3(0, 0, 0);
const orbitalEuler = new THREE.Euler();

const curveModifiers: Array<{
  key: keyof ParticleSystemConfig;
  attributeKeys: Array<string>;
  startValueKeys: Array<keyof ParticleSystemConfig>;
}> = [
  // {key:"colorOverLifetime", attributeKeys:["colorR", "colorG", "colorB"]},
  {
    key: 'opacityOverLifetime',
    attributeKeys: ['colorA'],
    startValueKeys: ['startOpacity'],
  },
  {
    key: 'sizeOverLifetime',
    attributeKeys: ['size'],
    startValueKeys: ['startSize'],
  },
];

export const applyModifiers = ({
  delta,
  noise,
  startValues,
  lifetimeValues,
  linearVelocityData,
  orbitalVelocityData,
  normalizedConfig,
  attributes,
  particleLifetimePercentage,
  particleIndex,
  forceUpdate = false,
}: {
  delta: number;
  noise: Noise;
  startValues: Record<string, Array<number>>;
  lifetimeValues: Record<string, Array<number>>;
  linearVelocityData?: Array<{
    speed: THREE.Vector3;
    valueModifiers: {
      x?: CurveFunction;
      y?: CurveFunction;
      z?: CurveFunction;
    };
  }>;
  orbitalVelocityData?: Array<{
    speed: THREE.Vector3;
    positionOffset: THREE.Vector3;
    valueModifiers: {
      x?: CurveFunction;
      y?: CurveFunction;
      z?: CurveFunction;
    };
  }>;
  normalizedConfig: NormalizedParticleSystemConfig;
  attributes: THREE.NormalBufferAttributes;
  particleLifetimePercentage: number;
  particleIndex: number;
  forceUpdate?: boolean;
}) => {
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

  curveModifiers.forEach(({ key, attributeKeys, startValueKeys }) => {
    const curveModifier = normalizedConfig[key];
    if (curveModifier.isActive) {
      const multiplier = getCurveFunction(curveModifier!.curveFunction)!(
        particleLifetimePercentage
      );
      attributeKeys.forEach((attributeKey, index) => {
        attributes[attributeKey].array[particleIndex] =
          startValues[startValueKeys[index]][particleIndex] * multiplier;
        attributes[attributeKey].needsUpdate = true;
      });
    } else if (forceUpdate) {
      attributeKeys.forEach((attributeKey, index) => {
        attributes[attributeKey].array[particleIndex] =
          startValues[startValueKeys[index]][particleIndex];
        attributes[attributeKey].needsUpdate = true;
      });
    }
  });

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
