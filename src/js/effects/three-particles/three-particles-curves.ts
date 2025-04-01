import Easing from 'easing-functions';
import { CurveFunction } from './types.js';

export const enum CurveFunctionId {
  BEZIER = 'BEZIER',
  LINEAR = 'LINEAR',
  QUADRATIC_IN = 'QUADRATIC_IN',
  QUADRATIC_OUT = 'QUADRATIC_OUT',
  QUADRATIC_IN_OUT = 'QUADRATIC_IN_OUT',
  CUBIC_IN = 'CUBIC_IN',
  CUBIC_OUT = 'CUBIC_OUT',
  CUBIC_IN_OUT = 'CUBIC_IN_OUT',
  QUARTIC_IN = 'QUARTIC_IN',
  QUARTIC_OUT = 'QUARTIC_OUT',
  QUARTIC_IN_OUT = 'QUARTIC_IN_OUT',
  QUINTIC_IN = 'QUINTIC_IN',
  QUINTIC_OUT = 'QUINTIC_OUT',
  QUINTIC_IN_OUT = 'QUINTIC_IN_OUT',
  SINUSOIDAL_IN = 'SINUSOIDAL_IN',
  SINUSOIDAL_OUT = 'SINUSOIDAL_OUT',
  SINUSOIDAL_IN_OUT = 'SINUSOIDAL_IN_OUT',
  EXPONENTIAL_IN = 'EXPONENTIAL_IN',
  EXPONENTIAL_OUT = 'EXPONENTIAL_OUT',
  EXPONENTIAL_IN_OUT = 'EXPONENTIAL_IN_OUT',
  CIRCULAR_IN = 'CIRCULAR_IN',
  CIRCULAR_OUT = 'CIRCULAR_OUT',
  CIRCULAR_IN_OUT = 'CIRCULAR_IN_OUT',
  ELASTIC_IN = 'ELASTIC_IN',
  ELASTIC_OUT = 'ELASTIC_OUT',
  ELASTIC_IN_OUT = 'ELASTIC_IN_OUT',
  BACK_IN = 'BACK_IN',
  BACK_OUT = 'BACK_OUT',
  BACK_IN_OUT = 'BACK_IN_OUT',
  BOUNCE_IN = 'BOUNCE_IN',
  BOUNCE_OUT = 'BOUNCE_OUT',
  BOUNCE_IN_OUT = 'BOUNCE_IN_OUT',
}

const CurveFunctionIdMap: Partial<Record<CurveFunctionId, CurveFunction>> = {
  [CurveFunctionId.LINEAR]: Easing.Linear.None,
  [CurveFunctionId.QUADRATIC_IN]: Easing.Quadratic.In,
  [CurveFunctionId.QUADRATIC_OUT]: Easing.Quadratic.Out,
  [CurveFunctionId.QUADRATIC_IN_OUT]: Easing.Quadratic.InOut,
  [CurveFunctionId.CUBIC_IN]: Easing.Cubic.In,
  [CurveFunctionId.CUBIC_OUT]: Easing.Cubic.Out,
  [CurveFunctionId.CUBIC_IN_OUT]: Easing.Cubic.InOut,
  [CurveFunctionId.QUARTIC_IN]: Easing.Quartic.In,
  [CurveFunctionId.QUARTIC_OUT]: Easing.Quartic.Out,
  [CurveFunctionId.QUARTIC_IN_OUT]: Easing.Quartic.InOut,
  [CurveFunctionId.QUINTIC_IN]: Easing.Quintic.In,
  [CurveFunctionId.QUINTIC_OUT]: Easing.Quintic.Out,
  [CurveFunctionId.QUINTIC_IN_OUT]: Easing.Quintic.InOut,
  [CurveFunctionId.SINUSOIDAL_IN]: Easing.Sinusoidal.In,
  [CurveFunctionId.SINUSOIDAL_OUT]: Easing.Sinusoidal.Out,
  [CurveFunctionId.SINUSOIDAL_IN_OUT]: Easing.Sinusoidal.InOut,
  [CurveFunctionId.EXPONENTIAL_IN]: Easing.Exponential.In,
  [CurveFunctionId.EXPONENTIAL_OUT]: Easing.Exponential.Out,
  [CurveFunctionId.EXPONENTIAL_IN_OUT]: Easing.Exponential.InOut,
  [CurveFunctionId.CIRCULAR_IN]: Easing.Circular.In,
  [CurveFunctionId.CIRCULAR_OUT]: Easing.Circular.Out,
  [CurveFunctionId.CIRCULAR_IN_OUT]: Easing.Circular.InOut,
  [CurveFunctionId.ELASTIC_IN]: Easing.Elastic.In,
  [CurveFunctionId.ELASTIC_OUT]: Easing.Elastic.Out,
  [CurveFunctionId.ELASTIC_IN_OUT]: Easing.Elastic.InOut,
  [CurveFunctionId.BACK_IN]: Easing.Back.In,
  [CurveFunctionId.BACK_OUT]: Easing.Back.Out,
  [CurveFunctionId.BACK_IN_OUT]: Easing.Back.InOut,
  [CurveFunctionId.BOUNCE_IN]: Easing.Bounce.In,
  [CurveFunctionId.BOUNCE_OUT]: Easing.Bounce.Out,
  [CurveFunctionId.BOUNCE_IN_OUT]: Easing.Bounce.InOut,
};

export const getCurveFunction = (
  curveFunctionId: CurveFunctionId | CurveFunction
): CurveFunction =>
  typeof curveFunctionId === 'function'
    ? curveFunctionId
    : CurveFunctionIdMap[curveFunctionId]!;
