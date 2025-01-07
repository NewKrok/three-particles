declare module 'three-noise/build/three-noise.module.js' {
  import { Vector2, Vector3 } from 'three';

  export class FBM {
    /**
     * Create an instance of the FBM class.
     * Use this instance to generate fBm noise.
     *
     * @param options - Options for fBm generation.
     * @param options.seed - Seed for the noise generation.
     * @param options.scale - What distance to view the noise map (controls the "zoom level").
     * @param options.persistence - How much each octave contributes to the overall shape.
     * @param options.lacunarity - How much detail is added or removed at each octave.
     * @param options.octaves - Number of noise octaves.
     * @param options.redistribution - Redistribution value to control flatness.
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
     * Generates a 2D noise value at the given position.
     * @param position - A 2D vector (x, y) position.
     */
    get2(position: Vector2): number;

    /**
     * Generates a 3D noise value at the given position.
     * @param position - A 3D vector (x, y, z) position.
     */
    get3(position: Vector3): number;
  }

  export class Perlin {
    /**
     * Create an instance of the Perlin class.
     * Use this instance to generate Perlin noise.
     *
     * @param seed - Seed for the noise generation.
     */
    constructor(seed?: number);

    /**
     * Generates a 2D Perlin noise value at the given position.
     * @param position - A 2D vector (x, y) position.
     */
    get2(position: Vector2): number;

    /**
     * Generates a 3D Perlin noise value at the given position.
     * @param position - A 3D vector (x, y, z) position.
     */
    get3(position: Vector3): number;
  }
}
