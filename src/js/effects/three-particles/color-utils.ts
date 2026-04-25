/**
 * Standard IEC 61966-2-1 sRGB → linear transfer function.
 * Matches `THREE.ColorManagement.SRGBToLinear` and the GLSL
 * `ShaderChunk.colorspace_fragment` implementation, so that user-provided
 * colors go through the exact same conversion the rest of the Three.js
 * pipeline uses for sRGB-tagged inputs.
 *
 * Input: a channel value in [0, 1] interpreted as sRGB.
 * Output: the corresponding linear value in [0, 1].
 */
export const sRGBToLinear = (c: number): number =>
  c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

/**
 * Standard IEC 61966-2-1 linear → sRGB transfer function.
 * Inverse of {@link sRGBToLinear}. Useful for one-shot migration of
 * legacy color values that were authored under the old raw-byte pipeline.
 */
export const linearToSRGB = (c: number): number =>
  c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

/**
 * Converts an sRGB {r, g, b} triplet to linear space.
 * Used when uploading user-authored colors (e.g. `backgroundColor`) as
 * shader uniforms that must match the linear-space texture samples and
 * vertex colors used elsewhere in the pipeline. Missing channels default
 * to 0 to mirror the permissive shape of the `Rgb` config type.
 */
export const rgbSRGBToLinear = (c: {
  r?: number;
  g?: number;
  b?: number;
}): { r: number; g: number; b: number } => ({
  r: sRGBToLinear(c.r ?? 0),
  g: sRGBToLinear(c.g ?? 0),
  b: sRGBToLinear(c.b ?? 0),
});
