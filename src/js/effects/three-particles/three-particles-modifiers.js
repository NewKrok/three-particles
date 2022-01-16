import * as THREE from "three/build/three.module.js";

import { getCurveFunction } from "./three-particles-curves.js";

const noiseInput = new THREE.Vector3(0, 0, 0);

const curveModifiers = [
  // {key:"colorOverLifetime", attributeKeys:["colorR", "colorG", "colorB"]},
  {
    key: "opacityOverLifetime",
    attributeKeys: ["colorA"],
    startValueKeys: ["startOpacity"],
  },
  {
    key: "sizeOverLifetime",
    attributeKeys: ["size"],
    startValueKeys: ["startSize"],
  },
];

export const applyModifiers = ({
  delta,
  noise,
  startValues,
  lifetimeValues,
  normalizedConfig,
  attributes,
  particleLifetimePercentage,
  particleIndex,
  forceUpdate = false,
}) => {
  curveModifiers.forEach(({ key, attributeKeys, startValueKeys }) => {
    const curveModifier = normalizedConfig[key];
    if (curveModifier.isActive) {
      const multiplier = getCurveFunction(curveModifier.curveFunction)(
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
    const { sampler, strength, offsets } = noise;
    const positionIndex = particleIndex * 3;
    const positionArr = attributes.position.array;
    let noiseOnPosition;

    const noisePosition =
      (particleLifetimePercentage + (offsets ? offsets[particleIndex] : 0)) *
      10 *
      strength;
    const noisePower = 0.15 * strength;

    noiseInput.set(noisePosition, 0, 0);
    noiseOnPosition = sampler.get3(noiseInput);
    positionArr[positionIndex] += noiseOnPosition * noisePower;

    noiseInput.set(noisePosition, noisePosition, 0);
    noiseOnPosition = sampler.get3(noiseInput);
    positionArr[positionIndex + 1] += noiseOnPosition * noisePower;

    noiseInput.set(noisePosition, noisePosition, noisePosition);
    noiseOnPosition = sampler.get3(noiseInput);
    positionArr[positionIndex + 2] += noiseOnPosition * noisePower;

    attributes.position.needsUpdate = true;
  }
};
