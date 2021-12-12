import * as THREE from "three/build/three.module.js";

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
    -Math.cos(normalizedAngle) * randomizedSpeed
  );
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

  const positionLength = position.length();

  const randomizedSpeed = THREE.MathUtils.randFloat(
    startSpeed.min,
    startSpeed.max
  );
  const speedMultiplierByPosition = 1 / positionLength;
  velocity.set(
    position.x * speedMultiplierByPosition * randomizedSpeed,
    position.y * speedMultiplierByPosition * randomizedSpeed,
    0
  );
};
