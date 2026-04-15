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

/**
 * Defines when a sub-emitter is triggered relative to a particle's lifecycle.
 *
 * @enum {string}
 */
export const enum SubEmitterTrigger {
  /**
   * Trigger the sub-emitter when a particle is born (activated).
   * Useful for trail effects that start immediately with each particle.
   */
  BIRTH = 'BIRTH',

  /**
   * Trigger the sub-emitter when a particle dies (reaches end of lifetime).
   * Useful for cascading effects like explosions spawning smoke.
   */
  DEATH = 'DEATH',
}

/**
 * Defines the type of force field that affects particles.
 *
 * @enum {string}
 */
export const enum ForceFieldType {
  /**
   * Attract or repel particles toward/from a point in space.
   * Positive strength attracts, negative strength repels.
   * Configure with position, strength, range, and falloff.
   */
  POINT = 'POINT',

  /**
   * Apply a constant directional force to all particles (like wind).
   * Configure with direction and strength.
   */
  DIRECTIONAL = 'DIRECTIONAL',
}

/**
 * Defines the rendering technique used for particles.
 *
 * @enum {string}
 */
export const enum RendererType {
  /**
   * Render particles as point sprites using `THREE.Points`.
   * This is the default renderer, efficient for small to medium particle counts.
   * Note: point size is limited by `gl_PointSize` hardware caps (typically 64–256 px).
   */
  POINTS = 'POINTS',

  /**
   * Render particles as camera-facing quads using `THREE.InstancedBufferGeometry`.
   * Removes the `gl_PointSize` hardware limit, supports stretched billboards,
   * and enables batching multiple emitters into fewer draw calls.
   * Recommended for 10 000+ particles or when large on-screen particle sizes are needed.
   */
  INSTANCED = 'INSTANCED',

  /**
   * Render each particle as a ribbon trail connecting its current and previous positions.
   * Each particle stores a configurable number of position history samples, and the
   * renderer builds a camera-facing triangle-strip ribbon through those samples.
   *
   * Trail width and opacity can taper along the ribbon length for effects like
   * sword slashes, magic missiles, comet tails, and speed lines.
   *
   * Configure trail-specific properties via {@link TrailConfig} on the renderer.
   */
  TRAIL = 'TRAIL',

  /**
   * Render each particle as a 3D mesh using GPU instancing (`InstancedBufferGeometry`).
   * Instead of flat billboard sprites, particles are rendered as real 3D geometry
   * (e.g., cubes, spheres, tori, or any custom `THREE.BufferGeometry`).
   *
   * Key differences from billboard renderers:
   * - **3D rotation**: Particles rotate in all three axes (quaternion-based).
   * - **Normals**: Mesh geometry retains normals, enabling basic lighting.
   * - **Arbitrary geometry**: Any `THREE.BufferGeometry` can be used per particle.
   *
   * All existing modifiers (sizeOverLifetime, colorOverLifetime, noise, force fields,
   * sub-emitters) work with mesh particles.
   *
   * Configure mesh-specific properties via {@link MeshConfig} on the renderer.
   */
  MESH = 'MESH',
}

/**
 * Defines how force diminishes with distance from a POINT force field center.
 * Only applicable to {@link ForceFieldType.POINT} force fields.
 *
 * @enum {string}
 */
export const enum ForceFieldFalloff {
  /**
   * No falloff — force is constant within range.
   */
  NONE = 'NONE',

  /**
   * Force decreases linearly with distance: `1 - d/range`.
   */
  LINEAR = 'LINEAR',

  /**
   * Force decreases with the square of distance: `1 - (d/range)²`.
   * More physically realistic than linear fallback.
   */
  QUADRATIC = 'QUADRATIC',
}

/**
 * Defines the behavior when a particle crosses a collision plane.
 *
 * @enum {string}
 */
export const enum CollisionPlaneMode {
  /**
   * Kill the particle immediately when it crosses the plane.
   * The particle is deactivated and returned to the free list.
   * Ideal for boundaries like water surfaces where bubbles pop.
   */
  KILL = 'KILL',

  /**
   * Clamp the particle's position to the plane surface.
   * The velocity component along the plane normal is zeroed.
   * The particle stays alive and slides along the plane.
   */
  CLAMP = 'CLAMP',

  /**
   * Bounce the particle off the plane.
   * The velocity is reflected across the plane normal and dampened.
   * Use `dampen` to control energy loss on bounce.
   */
  BOUNCE = 'BOUNCE',
}

/**
 * Defines the simulation backend used for particle updates.
 *
 * @enum {string}
 */
export const enum SimulationBackend {
  /**
   * Automatically select the best backend based on the renderer type.
   * Uses GPU compute when a WebGPU-capable renderer is detected, otherwise falls back to CPU.
   */
  AUTO = 'AUTO',

  /**
   * Force CPU-based simulation (JavaScript update loop).
   * Always available regardless of renderer type.
   */
  CPU = 'CPU',

  /**
   * Force GPU compute shader simulation.
   * Requires a WebGPU-capable renderer (e.g. `THREE.WebGPURenderer`).
   * Falls back to CPU if the renderer does not support compute.
   */
  GPU = 'GPU',
}
