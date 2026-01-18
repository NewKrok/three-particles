/**
 * Defines the coordinate space in which particles are simulated.
 *
 * @enum {string}
 */
export const enum SimulationSpace {
  /**
   * Particles move relative to the emitter's local coordinate system.
   * When the emitter moves or rotates, particles move with it.
   * Ideal for effects attached to moving objects (e.g., engine trails, character auras).
   */
  LOCAL = 'LOCAL',

  /**
   * Particles move in world space and are independent of the emitter's transform.
   * Once emitted, particles remain stationary or move according to their velocity in world coordinates.
   * Ideal for environmental effects (e.g., smoke, explosions, ambient particles).
   */
  WORLD = 'WORLD',
}

/**
 * Defines the geometric shape from which particles are emitted.
 *
 * @enum {string}
 */
export const enum Shape {
  /**
   * Emit particles from a spherical volume or shell.
   * Configure with {@link Sphere} properties (radius, arc, radiusThickness).
   */
  SPHERE = 'SPHERE',

  /**
   * Emit particles from a conical volume or shell.
   * Configure with {@link Cone} properties (angle, radius, arc, radiusThickness).
   * Useful for directional effects like fire, smoke plumes, or spray effects.
   */
  CONE = 'CONE',

  /**
   * Emit particles from a box volume, shell, or edges.
   * Configure with {@link Box} properties (scale, emitFrom).
   * Useful for area-based effects like dust clouds or rain.
   */
  BOX = 'BOX',

  /**
   * Emit particles from a circular area or edge.
   * Configure with {@link Circle} properties (radius, arc, radiusThickness).
   * Useful for ground impacts, rings, or radial effects.
   */
  CIRCLE = 'CIRCLE',

  /**
   * Emit particles from a rectangular area.
   * Configure with {@link Rectangle} properties (scale, rotation).
   * Useful for planar effects like rain on a surface or screen effects.
   */
  RECTANGLE = 'RECTANGLE',
}

/**
 * Defines where on a shape particles are emitted from.
 * Not all shapes support all emit modes.
 *
 * @enum {string}
 */
export const enum EmitFrom {
  /**
   * Emit particles from random positions within the entire volume of the shape.
   * Supported by: SPHERE, CONE, BOX.
   */
  VOLUME = 'VOLUME',

  /**
   * Emit particles from the surface/shell of the shape.
   * Supported by: SPHERE, CONE, BOX.
   */
  SHELL = 'SHELL',

  /**
   * Emit particles from the edges of the shape.
   * Supported by: BOX.
   */
  EDGE = 'EDGE',
}

/**
 * Defines how texture sheet animation is timed.
 *
 * @enum {string}
 */
export const enum TimeMode {
  /**
   * Animation frames are based on the particle's lifetime percentage.
   * The animation completes once over the particle's lifetime.
   */
  LIFETIME = 'LIFETIME',

  /**
   * Animation frames are based on frames per second (FPS).
   * The animation runs at a fixed speed regardless of particle lifetime.
   */
  FPS = 'FPS',
}

/**
 * Defines the type of curve function used for animating values over a particle's lifetime.
 *
 * @enum {string}
 */
export const enum LifeTimeCurve {
  /**
   * Use custom Bezier curves with control points.
   * Provides maximum control over the animation curve shape.
   * See {@link BezierCurve} for configuration.
   */
  BEZIER = 'BEZIER',

  /**
   * Use predefined easing functions (e.g., easeInQuad, easeOutCubic).
   * Convenient for common animation patterns.
   * See {@link EasingCurve} and {@link CurveFunctionId} for available functions.
   */
  EASING = 'EASING',
}
