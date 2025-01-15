import * as THREE from 'three';
import { calculateValue } from '../js/effects/three-particles/three-particles-utils.js';
import { LifeTimeCurve } from '../js/effects/three-particles/three-particles-enums.js';
import {
  BezierCurve,
  EasingCurve,
} from '../js/effects/three-particles/types.js';
import { calculateRandomPositionAndVelocityOnSphere } from '../js/effects/three-particles/three-particles-utils.js';

describe('calculateRandomPositionAndVelocityOnSphere', () => {
  it('should calculate a random position on a sphere surface', () => {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const velocity = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnSphere(
      position,
      quaternion,
      velocity,
      2,
      { radius: 1, radiusThickness: 0, arc: 360 }
    );

    // The position should be normalized to the sphere radius.
    expect(position.length()).toBeCloseTo(1);
  });

  it('should apply radius thickness correctly', () => {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const velocity = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnSphere(
      position,
      quaternion,
      velocity,
      2,
      { radius: 2, radiusThickness: 0.5, arc: 360 }
    );

    // The position length should be within the expected thickness range.
    expect(position.length()).toBeLessThanOrEqual(2);
    expect(position.length()).toBeGreaterThanOrEqual(1);
  });

  it('should calculate random velocity proportional to position', () => {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const velocity = new THREE.Vector3();

    calculateRandomPositionAndVelocityOnSphere(
      position,
      quaternion,
      velocity,
      2,
      { radius: 1, radiusThickness: 0, arc: 360 }
    );

    // The velocity length should match the configured speed.
    expect(velocity.length()).toBeCloseTo(2);
  });
});

describe('calculateValue function tests', () => {
  it('returns the constant value', () => {
    const result = calculateValue(1, 5);
    expect(result).toBe(5);
  });

  it('returns a random value between min and max', () => {
    jest.spyOn(THREE.MathUtils, 'randFloat').mockReturnValue(2.5);
    const result = calculateValue(1, { min: 1, max: 4 });
    expect(result).toBe(2.5);
  });

  it('returns correct value for min equals max', () => {
    const result = calculateValue(1, { min: 2, max: 2 });
    expect(result).toBe(2); // Should always return 2 when min == max
  });

  it('returns exact Bezier curve value with scaling', () => {
    const bezierCurveMock: BezierCurve = {
      type: LifeTimeCurve.BEZIER,
      bezierPoints: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 1 },
      ],
      scale: 2,
    };

    const result = calculateValue(1, bezierCurveMock, 0.5);
    expect(result).toBeCloseTo(1);
  });

  it('returns correct value for time = 0 and time = 1', () => {
    const bezierCurveMock: BezierCurve = {
      type: LifeTimeCurve.BEZIER,
      bezierPoints: [
        { x: 0, y: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
      scale: 1,
    };

    expect(calculateValue(1, bezierCurveMock, 0)).toBe(0); // Start of the curve
    expect(calculateValue(1, bezierCurveMock, 1)).toBe(1); // End of the curve
  });

  it('throws error for invalid bezierPoints', () => {
    const invalidBezierCurve: BezierCurve = {
      type: LifeTimeCurve.BEZIER,
      bezierPoints: [],
      scale: 1,
    };

    expect(() => calculateValue(1, invalidBezierCurve, 0.5)).toThrowError();
  });

  it('returns Easing curve value with scaling', () => {
    const easingCurveMock: EasingCurve = {
      type: LifeTimeCurve.EASING,
      curveFunction: (time: number) => time * 0.5,
      scale: 2,
    };

    const result = calculateValue(1, easingCurveMock, 0.8);
    expect(result).toBeCloseTo(0.8);
  });

  it('throws an error for unsupported value type', () => {
    expect(() => calculateValue(1, {} as any)).toThrow(
      'Unsupported value type'
    );
  });
});
