/**
 * Interleaved scalar buffer layout constants.
 *
 * All per-particle float attributes (except position and quat) are packed
 * into a single InterleavedBuffer to stay within the WebGPU vertex buffer
 * limit of 8.
 *
 * Buffer layout per particle (stride = 10 floats):
 * ```
 * [isActive, lifetime, startLifetime, startFrame, size, rotation, colorR, colorG, colorB, colorA]
 * ```
 */

/** Number of float32 elements per particle in the interleaved scalar buffer. */
export const SCALAR_STRIDE = 10;

/** Offset for the isActive flag (0 = inactive, 1 = active). */
export const S_IS_ACTIVE = 0;

/** Offset for the current lifetime of the particle in milliseconds. */
export const S_LIFETIME = 1;

/** Offset for the total lifetime of the particle in milliseconds. */
export const S_START_LIFETIME = 2;

/** Offset for the texture sheet animation start frame index. */
export const S_START_FRAME = 3;

/** Offset for the particle size. */
export const S_SIZE = 4;

/** Offset for the particle rotation (radians). */
export const S_ROTATION = 5;

/** Offset for the red color channel (0..1). */
export const S_COLOR_R = 6;

/** Offset for the green color channel (0..1). */
export const S_COLOR_G = 7;

/** Offset for the blue color channel (0..1). */
export const S_COLOR_B = 8;

/** Offset for the alpha (opacity) channel (0..1). */
export const S_COLOR_A = 9;

// ─── Shared rendering constants ─────────────────────────────────────────────

/** Scale factor converting particle size to pixel-equivalent point size. */
export const POINT_SIZE_SCALE = 100.0;

/** Minimum alpha below which fragments are discarded. */
export const ALPHA_DISCARD_THRESHOLD = 0.001;
