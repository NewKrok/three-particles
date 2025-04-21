import * as THREE from 'three';

import { createBezierCurveFunction } from './three-particles-bezier.js';
import { EmitFrom, LifeTimeCurve } from './three-particles-enums.js';
import {
  Constant,
  LifetimeCurve,
  Point3D,
  RandomBetweenTwoConstants,
} from './types.js';

export const calculateRandomPositionAndVelocityOnSphere = (
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  velocity: THREE.Vector3,
  speed: number,
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

  const speedMultiplierByPosition = 1 / position.length();
  velocity.set(
    position.x * speedMultiplierByPosition * speed,
    position.y * speedMultiplierByPosition * speed,
    position.z * speedMultiplierByPosition * speed
  );
  velocity.applyQuaternion(quaternion);
};

export const calculateRandomPositionAndVelocityOnCone = (
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  velocity: THREE.Vector3,
  speed: number,
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

  const speedMultiplierByPosition = 1 / positionLength;
  velocity.set(
    position.x * sinNormalizedAngle * speedMultiplierByPosition * speed,
    position.y * sinNormalizedAngle * speedMultiplierByPosition * speed,
    Math.cos(normalizedAngle) * speed
  );
  velocity.applyQuaternion(quaternion);
};

export const calculateRandomPositionAndVelocityOnBox = (
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  velocity: THREE.Vector3,
  speed: number,
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

  velocity.set(0, 0, speed);
  velocity.applyQuaternion(quaternion);
};

export const calculateRandomPositionAndVelocityOnCircle = (
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  velocity: THREE.Vector3,
  speed: number,
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

  const positionLength = position.length();
  const speedMultiplierByPosition = 1 / positionLength;
  velocity.set(
    position.x * speedMultiplierByPosition * speed,
    position.y * speedMultiplierByPosition * speed,
    0
  );
  velocity.applyQuaternion(quaternion);
};

export const calculateRandomPositionAndVelocityOnRectangle = (
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  velocity: THREE.Vector3,
  speed: number,
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

  velocity.set(0, 0, speed);
  velocity.applyQuaternion(quaternion);
};

/**
 * Creates a default white circle texture using CanvasTexture.
 * @returns {THREE.CanvasTexture | null} The generated texture or null if context fails.
 */
export const createDefaultParticleTexture = (): THREE.CanvasTexture | null => {
  try {
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (context) {
      const centerX = size / 2;
      const centerY = size / 2;
      const radius = size / 2 - 2; // Small padding

      context.beginPath();
      context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
      context.fillStyle = 'white';
      context.fill();
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    } else {
      console.warn(
        'Could not get 2D context to generate default particle texture.'
      );
      return null;
    }
  } catch (error) {
    // Handle potential errors (e.g., document not available in non-browser env)
    console.warn('Error creating default particle texture:', error);
    return null;
  }
};

export const isLifeTimeCurve = (
  value: Constant | RandomBetweenTwoConstants | LifetimeCurve
): value is LifetimeCurve => {
  return typeof value !== 'number' && 'type' in value;
};

export const getCurveFunctionFromConfig = (
  particleSystemId: number,
  lifetimeCurve: LifetimeCurve
) => {
  if (lifetimeCurve.type === LifeTimeCurve.BEZIER) {
    return createBezierCurveFunction(
      particleSystemId,
      lifetimeCurve.bezierPoints
    ); // Bézier curve
  }

  if (lifetimeCurve.type === LifeTimeCurve.EASING) {
    return lifetimeCurve.curveFunction; // Easing curve
  }

  throw new Error(`Unsupported value type: ${lifetimeCurve}`);
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

  const lifetimeCurve = value as LifetimeCurve;
  return (
    getCurveFunctionFromConfig(particleSystemId, lifetimeCurve)(time) *
    (lifetimeCurve.scale ?? 1)
  );
};
