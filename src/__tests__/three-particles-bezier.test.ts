import {
  createBezierCurveFunction,
  getBezierCacheSize,
  removeBezierCurveFunction,
} from '../js/effects/three-particles/three-particles-bezier.js';

describe('createBezierCurveFunction function tests', () => {
  it('should return the same curve function for the same bezierPoints array', () => {
    const bezierPoints = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const curveFunc1 = createBezierCurveFunction(1, bezierPoints);
    const curveFunc2 = createBezierCurveFunction(2, bezierPoints);
    expect(curveFunc1).toBe(curveFunc2);

    removeBezierCurveFunction(1);
    removeBezierCurveFunction(2);
  });

  it('should return the y value of the first point at 0% and the last point at 100%', () => {
    const bezierPoints = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const curveFunc = createBezierCurveFunction(1, bezierPoints);
    expect(curveFunc(0)).toBe(0);
    expect(curveFunc(1)).toBe(1);

    removeBezierCurveFunction(1);
  });

  it('should return interpolated values between points', () => {
    const bezierPoints = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ];
    const curveFunc = createBezierCurveFunction(1, bezierPoints);
    expect(curveFunc(0.5)).toBeCloseTo(0.5);

    removeBezierCurveFunction(1);
  });

  it('should remove the curve function from cache', () => {
    const bezierPoints = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    createBezierCurveFunction(1, bezierPoints);
    removeBezierCurveFunction(1);
    expect(getBezierCacheSize()).toBe(0);
  });

  it('should not increase cache size for identical bezierPoints arrays', () => {
    const bezierPoints = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ];

    createBezierCurveFunction(1, bezierPoints);
    createBezierCurveFunction(2, bezierPoints);

    expect(getBezierCacheSize()).toBe(1);

    removeBezierCurveFunction(2);
    expect(getBezierCacheSize()).toBe(1);

    removeBezierCurveFunction(1);
    expect(getBezierCacheSize()).toBe(0);
  });

  it('should clamp the percentage to 0% and 100%', () => {
    const bezierPoints = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const curveFunc = createBezierCurveFunction(1, bezierPoints);
    expect(curveFunc(-0.1)).toBe(0);
    expect(curveFunc(1.1)).toBe(1);

    removeBezierCurveFunction(1);
  });
});
