import Easing from 'easing-functions';
import {
  CurveFunctionId,
  getCurveFunction,
} from '../js/effects/three-particles/three-particles-curves.js';

describe('getCurveFunction', () => {
  it('should return the correct easing function for LINEAR', () => {
    const func = getCurveFunction(CurveFunctionId.LINEAR);
    expect(func).toBe(Easing.Linear.None);
  });

  it('should return the original function if passed directly', () => {
    const customFunc = (t: number) => t * t;
    const func = getCurveFunction(customFunc);
    expect(func).toBe(customFunc);
  });

  it('should return undefined for an invalid CurveFunctionId', () => {
    const func = getCurveFunction('INVALID_ID' as any);
    expect(func).toBeUndefined();
  });
});
