import * as THREE from "three/build/three.module.js";

import { EmitFrom } from "@newkrok/three-particles/src/js/effects/three-particles";

export const patchObject = (
  objectA,
  objectB,
  config = { skippedProperties: [], applyToFirstObject: false }
) => {
  const result = {};
  Object.keys(objectA).forEach((key) => {
    if (!config.skippedProperties || !config.skippedProperties.includes(key)) {
      if (
        typeof objectA[key] === "object" &&
        objectA[key] &&
        objectB[key] &&
        !Array.isArray(objectA[key])
      ) {
        result[key] = patchObject(objectA[key], objectB[key], config);
      } else {
        result[key] =
          objectB[key] === 0
            ? 0
            : objectB[key] === false
            ? false
            : objectB[key] || objectA[key];
        if (config.applyToFirstObject) objectA[key] = result[key];
      }
    }
  });
  return result;
};

export const calculateRandomPositionAndVelocityOnSphere = (
  position,
  velocity,
  startSpeed,
  { radius, radiusThickness, arc }
) => {
  const u = Math.random() * (arc / 360);
  const v = Math.random();
  const randomizedDistanceRatio = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const sinPhi = Math.sin(phi);

  const xDirection = sinPhi * Math.cos(theta);
  const yDirection = sinPhi * Math.sin(theta);
  const zDirection = Math.cos(phi);
  const normalizedThickness = 1 - radiusThickness;

  position.x =
    radius * normalizedThickness * xDirection +
    radius * radiusThickness * randomizedDistanceRatio * xDirection;
  position.y =
    radius * normalizedThickness * yDirection +
    radius * radiusThickness * randomizedDistanceRatio * yDirection;
  position.z =
    radius * normalizedThickness * zDirection +
    radius * radiusThickness * randomizedDistanceRatio * zDirection;

  const randomizedSpeed = THREE.MathUtils.randFloat(
    startSpeed.min,
    startSpeed.max
  );
  const speedMultiplierByPosition = 1 / position.length();
  velocity.set(
    position.x * speedMultiplierByPosition * randomizedSpeed,
    position.y * speedMultiplierByPosition * randomizedSpeed,
    position.z * speedMultiplierByPosition * randomizedSpeed
  );
};

export const calculateRandomPositionAndVelocityOnCone = (
  position,
  velocity,
  startSpeed,
  { radius, radiusThickness, arc, angle = 90 }
) => {
  const theta = 2 * Math.PI * Math.random() * (arc / 360);
  const randomizedDistanceRatio = Math.random();

  const xDirection = Math.cos(theta);
  const yDirection = Math.sin(theta);
  const normalizedThickness = 1 - radiusThickness;

  position.x =
    radius * normalizedThickness * xDirection +
    radius * radiusThickness * randomizedDistanceRatio * xDirection;
  position.y =
    radius * normalizedThickness * yDirection +
    radius * radiusThickness * randomizedDistanceRatio * yDirection;
  position.z = 0;

  const positionLength = position.length();
  const normalizedAngle = Math.abs(
    (positionLength / radius) * THREE.Math.degToRad(angle)
  );
  const sinNormalizedAngle = Math.sin(normalizedAngle);

  const randomizedSpeed = THREE.MathUtils.randFloat(
    startSpeed.min,
    startSpeed.max
  );
  const speedMultiplierByPosition = 1 / positionLength;
  velocity.set(
    position.x *
      sinNormalizedAngle *
      speedMultiplierByPosition *
      randomizedSpeed,
    position.y *
      sinNormalizedAngle *
      speedMultiplierByPosition *
      randomizedSpeed,
    Math.cos(normalizedAngle) * randomizedSpeed
  );
};

export const calculateRandomPositionAndVelocityOnBox = (
  position,
  velocity,
  startSpeed,
  { scale, emitFrom }
) => {
  switch (emitFrom) {
    case EmitFrom.VOLUME:
      position.x = Math.random() * scale.x - scale.x / 2;
      position.y = Math.random() * scale.y - scale.y / 2;
      position.z = Math.random() * scale.z - scale.z / 2;
      break;

    case EmitFrom.SHELL:
      const side = Math.floor(Math.random() * 6);
      const perpendicularAxis = side % 3;
      const shellResult = [];
      shellResult[perpendicularAxis] = side > 2 ? 1 : 0;
      shellResult[(perpendicularAxis + 1) % 3] = Math.random();
      shellResult[(perpendicularAxis + 2) % 3] = Math.random();
      position.x = shellResult[0] * scale.x - scale.x / 2;
      position.y = shellResult[1] * scale.y - scale.y / 2;
      position.z = shellResult[2] * scale.z - scale.z / 2;
      break;

    case EmitFrom.EDGE:
      const side2 = Math.floor(Math.random() * 6);
      const perpendicularAxis2 = side2 % 3;
      const edge = Math.floor(Math.random() * 4);
      const edgeResult = [];
      edgeResult[perpendicularAxis2] = side2 > 2 ? 1 : 0;
      edgeResult[(perpendicularAxis2 + 1) % 3] =
        edge < 2 ? Math.random() : edge - 2;
      edgeResult[(perpendicularAxis2 + 2) % 3] =
        edge < 2 ? edge : Math.random();
      position.x = edgeResult[0] * scale.x - scale.x / 2;
      position.y = edgeResult[1] * scale.y - scale.y / 2;
      position.z = edgeResult[2] * scale.z - scale.z / 2;
      break;
  }

  const randomizedSpeed = THREE.MathUtils.randFloat(
    startSpeed.min,
    startSpeed.max
  );
  velocity.set(0, 0, randomizedSpeed);
};

export const calculateRandomPositionAndVelocityOnCircle = (
  position,
  velocity,
  startSpeed,
  { radius, radiusThickness, arc }
) => {
  const theta = 2 * Math.PI * Math.random() * (arc / 360);
  const randomizedDistanceRatio = Math.random();

  const xDirection = Math.cos(theta);
  const yDirection = Math.sin(theta);
  const normalizedThickness = 1 - radiusThickness;

  position.x =
    radius * normalizedThickness * xDirection +
    radius * radiusThickness * randomizedDistanceRatio * xDirection;
  position.y =
    radius * normalizedThickness * yDirection +
    radius * radiusThickness * randomizedDistanceRatio * yDirection;
  position.z = 0;

  const randomizedSpeed = THREE.MathUtils.randFloat(
    startSpeed.min,
    startSpeed.max
  );

  const positionLength = position.length();
  const speedMultiplierByPosition = 1 / positionLength;
  velocity.set(
    position.x * speedMultiplierByPosition * randomizedSpeed,
    position.y * speedMultiplierByPosition * randomizedSpeed,
    0
  );
};

export const calculateRandomPositionAndVelocityOnRectangle = (
  position,
  velocity,
  startSpeed,
  { rotation, scale }
) => {
  const xOffset = Math.random() * scale.x - scale.x / 2;
  const yOffset = Math.random() * scale.y - scale.y / 2;
  const rotationX = THREE.Math.degToRad(rotation.x);
  const rotationY = THREE.Math.degToRad(rotation.y);
  position.x = xOffset * Math.cos(rotationY);
  position.y = yOffset * Math.cos(rotationX);
  position.z = xOffset * Math.sin(rotationY) - yOffset * Math.sin(rotationX);

  const randomizedSpeed = THREE.MathUtils.randFloat(
    startSpeed.min,
    startSpeed.max
  );
  velocity.set(0, 0, randomizedSpeed);
};
