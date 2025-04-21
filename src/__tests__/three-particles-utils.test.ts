import * as THREE from 'three';
import { LifeTimeCurve } from '../js/effects/three-particles/three-particles-enums.js';
import {
  calculateValue,
  calculateRandomPositionAndVelocityOnSphere,
  getCurveFunctionFromConfig,
  isLifeTimeCurve,
} from '../js/effects/three-particles/three-particles-utils.js';
import {
  BezierCurve,
  EasingCurve,
  Constant,
  RandomBetweenTwoConstants,
  LifetimeCurve,
} from '../js/effects/three-particles/types.js';

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
    expect(() => calculateValue(1, {})).toThrow('Unsupported value type');
  });
});

describe('isLifeTimeCurve function tests', () => {
  it('returns false for number values', () => {
    const result = isLifeTimeCurve(5);
    expect(result).toBe(false);
  });

  it('returns false for RandomBetweenTwoConstants objects', () => {
    const randomValue: RandomBetweenTwoConstants = { min: 1, max: 5 };
    const result = isLifeTimeCurve(randomValue);
    expect(result).toBe(false);
  });

  it('returns true for BezierCurve objects', () => {
    const bezierCurve: BezierCurve = {
      type: LifeTimeCurve.BEZIER,
      bezierPoints: [
        { x: 0, y: 0, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
      scale: 1,
    };
    const result = isLifeTimeCurve(bezierCurve);
    expect(result).toBe(true);
  });

  it('returns true for EasingCurve objects', () => {
    const easingCurve: EasingCurve = {
      type: LifeTimeCurve.EASING,
      curveFunction: (time: number) => time,
      scale: 1,
    };
    const result = isLifeTimeCurve(easingCurve);
    expect(result).toBe(true);
  });
});

describe('getCurveFunctionFromConfig function tests', () => {
  it('returns a Bezier curve function for BEZIER type', () => {
    const bezierCurve: BezierCurve = {
      type: LifeTimeCurve.BEZIER,
      bezierPoints: [
        { x: 0, y: 0, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
      scale: 1,
    };

    const curveFunction = getCurveFunctionFromConfig(1, bezierCurve);

    // Test the returned function
    expect(typeof curveFunction).toBe('function');
    expect(curveFunction(0)).toBeCloseTo(0);
    expect(curveFunction(1)).toBeCloseTo(1);
    expect(curveFunction(0.5)).toBeCloseTo(0.5);
  });

  it('returns the provided curve function for EASING type', () => {
    const testFunction = (time: number) => time * 2;
    const easingCurve: EasingCurve = {
      type: LifeTimeCurve.EASING,
      curveFunction: testFunction,
      scale: 1,
    };

    const curveFunction = getCurveFunctionFromConfig(1, easingCurve);

    // Verify it returns the same function
    expect(curveFunction).toBe(testFunction);
    expect(curveFunction(0.5)).toBe(1); // 0.5 * 2 = 1
  });

  it('throws an error for unsupported curve type', () => {
    // Create a curve with an invalid type that will pass TypeScript but fail at runtime
    const invalidCurve = {
      type: 999 as unknown as LifeTimeCurve, // Invalid enum value
      scale: 1,
      bezierPoints: [], // Add this to satisfy TypeScript
    } as LifetimeCurve;

    expect(() => getCurveFunctionFromConfig(1, invalidCurve)).toThrow(
      'Unsupported value type'
    );
  });
});
