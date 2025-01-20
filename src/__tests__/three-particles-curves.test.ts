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

  it('should return undefined for an invalid param', () => {
    const funcInvalidString = getCurveFunction('INVALID_ID' as any);
    expect(funcInvalidString).toBeUndefined();

    const funcObject = getCurveFunction({} as any);
    expect(funcObject).toBeUndefined();

    const funcNumber = getCurveFunction(1 as any);
    expect(funcNumber).toBeUndefined();

    const funcBool = getCurveFunction(true as any);
    expect(funcBool).toBeUndefined();

    const funcArr = getCurveFunction([1, 2, 3] as any);
    expect(funcArr).toBeUndefined();
  });
});
