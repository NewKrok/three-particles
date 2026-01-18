import Easing from 'easing-functions';
import { CurveFunction } from './types.js';

/**
 * Predefined easing function identifiers for animating particle properties
 * over their lifetime.
 *
 * These functions control the rate of change and create different animation
 * feels. Each type has three variants:
 * - **IN**: Starts slow, accelerates toward the end
 * - **OUT**: Starts fast, decelerates toward the end
 * - **IN_OUT**: Combines both, slow at start and end, fast in middle
 *
 * @enum {string}
 *
 * @see {@link https://easings.net/} - Visual reference for easing functions
 */
export const enum CurveFunctionId {
  /** Use custom Bezier curve (not an easing function) */
  BEZIER = 'BEZIER',

  /** Linear interpolation with constant rate of change */
  LINEAR = 'LINEAR',

  /** Quadratic (t²) easing - gentle acceleration */
  QUADRATIC_IN = 'QUADRATIC_IN',
  /** Quadratic (t²) easing - gentle deceleration */
  QUADRATIC_OUT = 'QUADRATIC_OUT',
  /** Quadratic (t²) easing - gentle acceleration then deceleration */
  QUADRATIC_IN_OUT = 'QUADRATIC_IN_OUT',

  /** Cubic (t³) easing - moderate acceleration */
  CUBIC_IN = 'CUBIC_IN',
  /** Cubic (t³) easing - moderate deceleration */
  CUBIC_OUT = 'CUBIC_OUT',
  /** Cubic (t³) easing - moderate acceleration then deceleration */
  CUBIC_IN_OUT = 'CUBIC_IN_OUT',

  /** Quartic (t⁴) easing - strong acceleration */
  QUARTIC_IN = 'QUARTIC_IN',
  /** Quartic (t⁴) easing - strong deceleration */
  QUARTIC_OUT = 'QUARTIC_OUT',
  /** Quartic (t⁴) easing - strong acceleration then deceleration */
  QUARTIC_IN_OUT = 'QUARTIC_IN_OUT',

  /** Quintic (t⁵) easing - very strong acceleration */
  QUINTIC_IN = 'QUINTIC_IN',
  /** Quintic (t⁵) easing - very strong deceleration */
  QUINTIC_OUT = 'QUINTIC_OUT',
  /** Quintic (t⁵) easing - very strong acceleration then deceleration */
  QUINTIC_IN_OUT = 'QUINTIC_IN_OUT',

  /** Sinusoidal easing - smooth, natural acceleration */
  SINUSOIDAL_IN = 'SINUSOIDAL_IN',
  /** Sinusoidal easing - smooth, natural deceleration */
  SINUSOIDAL_OUT = 'SINUSOIDAL_OUT',
  /** Sinusoidal easing - smooth acceleration then deceleration */
  SINUSOIDAL_IN_OUT = 'SINUSOIDAL_IN_OUT',

  /** Exponential easing - dramatic, explosive acceleration */
  EXPONENTIAL_IN = 'EXPONENTIAL_IN',
  /** Exponential easing - dramatic, explosive deceleration */
  EXPONENTIAL_OUT = 'EXPONENTIAL_OUT',
  /** Exponential easing - dramatic acceleration then deceleration */
  EXPONENTIAL_IN_OUT = 'EXPONENTIAL_IN_OUT',

  /** Circular easing - sharp acceleration with curved trajectory */
  CIRCULAR_IN = 'CIRCULAR_IN',
  /** Circular easing - sharp deceleration with curved trajectory */
  CIRCULAR_OUT = 'CIRCULAR_OUT',
  /** Circular easing - sharp acceleration then deceleration */
  CIRCULAR_IN_OUT = 'CIRCULAR_IN_OUT',

  /** Elastic easing - oscillates back before accelerating (spring-like) */
  ELASTIC_IN = 'ELASTIC_IN',
  /** Elastic easing - overshoots then oscillates back (spring-like) */
  ELASTIC_OUT = 'ELASTIC_OUT',
  /** Elastic easing - oscillates at both ends (spring-like) */
  ELASTIC_IN_OUT = 'ELASTIC_IN_OUT',

  /** Back easing - pulls back before accelerating forward */
  BACK_IN = 'BACK_IN',
  /** Back easing - overshoots forward then pulls back */
  BACK_OUT = 'BACK_OUT',
  /** Back easing - pulls back, overshoots, then settles */
  BACK_IN_OUT = 'BACK_IN_OUT',

  /** Bounce easing - bounces at the start */
  BOUNCE_IN = 'BOUNCE_IN',
  /** Bounce easing - bounces at the end (like a ball landing) */
  BOUNCE_OUT = 'BOUNCE_OUT',
  /** Bounce easing - bounces at both start and end */
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

/**
 * Resolves a curve function from an identifier or returns the function itself.
 *
 * This utility function allows you to use either a {@link CurveFunctionId} string
 * identifier or a custom function directly.
 *
 * @param curveFunctionId - Either a {@link CurveFunctionId} enum value or a
 *                          custom {@link CurveFunction} implementation
 * @returns The actual easing function that takes a normalized time value (0-1)
 *          and returns the eased value
 *
 * @example
 * ```typescript
 * import { getCurveFunction, CurveFunctionId } from '@newkrok/three-particles';
 *
 * // Using a predefined easing function
 * const easingFunc = getCurveFunction(CurveFunctionId.CUBIC_OUT);
 * console.log(easingFunc(0.5)); // Returns eased value at 50% progress
 *
 * // Using a custom function
 * const customEasing = (t: number) => t * t; // Quadratic
 * const customFunc = getCurveFunction(customEasing);
 * console.log(customFunc(0.5)); // Returns 0.25
 * ```
 */
export const getCurveFunction = (
  curveFunctionId: CurveFunctionId | CurveFunction
): CurveFunction =>
  typeof curveFunctionId === 'function'
    ? curveFunctionId
    : CurveFunctionIdMap[curveFunctionId]!;
