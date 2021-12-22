import { getCurveFunction } from "./three-particles-curves.js";

const modifiers = [
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
  startValues,
  normalizedConfig,
  attributes,
  particleLifetimePercentage,
  particleIndex,
  forceUpdate = false,
}) => {
  modifiers.forEach(({ key, attributeKeys, startValueKeys }) => {
    const modifier = normalizedConfig[key];
    if (modifier.isActive) {
      const multiplier = getCurveFunction(modifier.curveFunction)(
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
};
