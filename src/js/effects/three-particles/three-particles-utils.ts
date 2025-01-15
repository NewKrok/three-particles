import * as THREE from 'three';

import { EmitFrom, LifeTimeCurve } from './three-particles-enums.js';
import {
  Constant,
  LifetimeCurve,
  MinMaxNumber,
  Point3D,
  RandomBetweenTwoConstants,
} from './types.js';
import { createBezierCurveFunction } from './three-particles-bezier.js';

export const calculateRandomPositionAndVelocityOnSphere = (
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  velocity: THREE.Vector3,
  startSpeed: MinMaxNumber,
  {
    radius,
    radiusThickness,
    arc,
  }: { radius: number; radiusThickness: number; arc: number }
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

  position.applyQuaternion(quaternion);

  const randomizedSpeed = THREE.MathUtils.randFloat(
    startSpeed.min || 0,
    startSpeed.max || 0
  );
  const speedMultiplierByPosition = 1 / position.length();
  velocity.set(
    position.x * speedMultiplierByPosition * randomizedSpeed,
    position.y * speedMultiplierByPosition * randomizedSpeed,
    position.z * speedMultiplierByPosition * randomizedSpeed
  );
  velocity.applyQuaternion(quaternion);
};

export const calculateRandomPositionAndVelocityOnCone = (
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  velocity: THREE.Vector3,
  startSpeed: MinMaxNumber,
  {
    radius,
    radiusThickness,
    arc,
    angle = 90,
  }: {
    radius: number;
    radiusThickness: number;
    arc: number;
    angle?: number;
  }
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

  position.applyQuaternion(quaternion);

  const positionLength = position.length();
  const normalizedAngle = Math.abs(
    (positionLength / radius) * THREE.MathUtils.degToRad(angle)
  );
  const sinNormalizedAngle = Math.sin(normalizedAngle);

  const randomizedSpeed = THREE.MathUtils.randFloat(
    startSpeed.min || 0,
    startSpeed.max || 0
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
  velocity.applyQuaternion(quaternion);
};

export const calculateRandomPositionAndVelocityOnBox = (
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  velocity: THREE.Vector3,
  startSpeed: MinMaxNumber,
  { scale, emitFrom }: { scale: Point3D; emitFrom: EmitFrom }
) => {
  const _scale = scale as Required<Point3D>;
  switch (emitFrom) {
    case EmitFrom.VOLUME:
      position.x = Math.random() * _scale.x - _scale.x / 2;
      position.y = Math.random() * _scale.y - _scale.y / 2;
      position.z = Math.random() * _scale.z - _scale.z / 2;
      break;

    case EmitFrom.SHELL:
      const side = Math.floor(Math.random() * 6);
      const perpendicularAxis = side % 3;
      const shellResult = [];
      shellResult[perpendicularAxis] = side > 2 ? 1 : 0;
      shellResult[(perpendicularAxis + 1) % 3] = Math.random();
      shellResult[(perpendicularAxis + 2) % 3] = Math.random();
      position.x = shellResult[0] * _scale.x - _scale.x / 2;
      position.y = shellResult[1] * _scale.y - _scale.y / 2;
      position.z = shellResult[2] * _scale.z - _scale.z / 2;
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
      position.x = edgeResult[0] * _scale.x - _scale.x / 2;
      position.y = edgeResult[1] * _scale.y - _scale.y / 2;
      position.z = edgeResult[2] * _scale.z - _scale.z / 2;
      break;
  }

  position.applyQuaternion(quaternion);

  const randomizedSpeed = THREE.MathUtils.randFloat(
    startSpeed.min || 0,
    startSpeed.max || 0
  );
  velocity.set(0, 0, randomizedSpeed);
  velocity.applyQuaternion(quaternion);
};

export const calculateRandomPositionAndVelocityOnCircle = (
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  velocity: THREE.Vector3,
  startSpeed: MinMaxNumber,
  {
    radius,
    radiusThickness,
    arc,
  }: { radius: number; radiusThickness: number; arc: number }
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

  position.applyQuaternion(quaternion);

  const randomizedSpeed = THREE.MathUtils.randFloat(
    startSpeed.min || 0,
    startSpeed.max || 0
  );

  const positionLength = position.length();
  const speedMultiplierByPosition = 1 / positionLength;
  velocity.set(
    position.x * speedMultiplierByPosition * randomizedSpeed,
    position.y * speedMultiplierByPosition * randomizedSpeed,
    0
  );
  velocity.applyQuaternion(quaternion);
};

export const calculateRandomPositionAndVelocityOnRectangle = (
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  velocity: THREE.Vector3,
  startSpeed: MinMaxNumber,
  { rotation, scale }: { rotation: Point3D; scale: Point3D }
) => {
  const _scale = scale as Required<Point3D>;
  const _rotation = rotation as Required<Point3D>;

  const xOffset = Math.random() * _scale.x - _scale.x / 2;
  const yOffset = Math.random() * _scale.y - _scale.y / 2;
  const rotationX = THREE.MathUtils.degToRad(_rotation.x);
  const rotationY = THREE.MathUtils.degToRad(_rotation.y);
  position.x = xOffset * Math.cos(rotationY);
  position.y = yOffset * Math.cos(rotationX);
  position.z = xOffset * Math.sin(rotationY) - yOffset * Math.sin(rotationX);

  position.applyQuaternion(quaternion);

  const randomizedSpeed = THREE.MathUtils.randFloat(
    startSpeed.min || 0,
    startSpeed.max || 0
  );
  velocity.set(0, 0, randomizedSpeed);
  velocity.applyQuaternion(quaternion);
};

export const calculateValue = (
  particleSystemId: number,
  value: Constant | RandomBetweenTwoConstants | LifetimeCurve,
  time: number = 0
): number => {
  if (typeof value === 'number') {
    return value; // Constant value
  }

  if ('min' in value && 'max' in value) {
    if (value.min === value.max) {
      return value.min ?? 0; // Constant value
    }
    return THREE.MathUtils.randFloat(value.min ?? 0, value.max ?? 1); // Random range
  }

  const lifeTimeCurve = value as LifetimeCurve;

  if (lifeTimeCurve.type === LifeTimeCurve.BEZIER) {
    return (
      createBezierCurveFunction(
        particleSystemId,
        lifeTimeCurve.bezierPoints
      )(time) * (lifeTimeCurve.scale ?? 1)
    ); // Bézier curve
  }

  if (lifeTimeCurve.type === LifeTimeCurve.EASING) {
    return lifeTimeCurve.curveFunction(time) * (lifeTimeCurve.scale ?? 1); // Easing curve
  }

  throw new Error('Unsupported value type');
};
