declare module 'three-noise/build/three-noise.module.js' {
  export class FBM {
    /**
     * Create an instance of the FBM class.
     * Use this instance to generate fBm noise.
     *
     * @param options - Options for fBm generation.
     * @param options.seed - Seed for Perlin Noise.
     * @param options.scale - What distance to view the noise map.
     * @param options.persistence - How much each octave contributes to the overall shape.
     * @param options.lacunarity - How much detail is added or removed at each octave.
     * @param options.octaves - Levels of detail you want your Perlin noise to have.
     * @param options.redistribution - Level of flatness within the valleys.
     */
    constructor(options?: {
      seed?: number;
      scale?: number;
      persistence?: number;
      lacunarity?: number;
      octaves?: number;
      redistribution?: number;
    });

    /**
     * Generates a 2D or 3D fBm noise value.
     * @param position - The position to sample the noise at (Vector2 or Vector3).
     */
    get(position: { x: number; y: number; z?: number }): number;
  }

  export class Perlin {
    /**
     * Create an instance of the Perlin class.
     * Use this instance to generate Perlin noise.
     *
     * @param seed - Seed for Perlin Noise.
     */
    constructor(seed?: number);

    /**
     * Generates a 2D Perlin noise value.
     * @param position - The 2D position to sample the noise at.
     */
    get2(position: { x: number; y: number }): number;

    /**
     * Generates a 3D Perlin noise value.
     * @param position - The 3D position to sample the noise at.
     */
    get3(position: { x: number; y: number; z: number }): number;
  }
}
