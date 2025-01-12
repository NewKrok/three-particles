import * as THREE from 'three';
import { Gyroscope } from 'three/examples/jsm/misc/Gyroscope.js';
import {
  EmitFrom,
  Shape,
  SimulationSpace,
  TimeMode,
} from './three-particles-enums.js';
import { FBM } from 'three-noise/build/three-noise.module.js';

/**
 * A fixed numerical value.
 * Used for properties that require a constant value.
 *
 * @example
 * const delay: Constant = 2; // Fixed delay of 2 seconds.
 */
export type Constant = number;

/**
 * An object that defines a range for random number generation.
 * Contains `min` and `max` properties.
 *
 * @property min - The minimum value for the random range.
 * @property max - The maximum value for the random range.
 *
 * @example
 * const randomDelay: RandomBetweenTwoConstants = { min: 0.5, max: 2 }; // Random delay between 0.5 and 2 seconds.
 */
export type RandomBetweenTwoConstants = {
  min?: number;
  max?: number;
};

export type Point3D = {
  x?: number;
  y?: number;
  z?: number;
};

export type Transform = {
  position?: THREE.Vector3;
  rotation?: THREE.Vector3;
  scale?: THREE.Vector3;
};

export type MinMaxNumber = {
  min?: number;
  max?: number;
};

export type Rgb = {
  r?: number;
  g?: number;
  b?: number;
};

export type MinMaxColor = {
  min?: Rgb;
  max?: Rgb;
};

export type Emission = {
  rateOverTime?: number;
  rateOverDistance?: number;
};

export type ShapeConfig = {
  shape?: Shape;
  sphere?: {
    radius?: number;
    radiusThickness?: number;
    arc?: number;
  };
  cone?: {
    angle?: number;
    radius?: number;
    radiusThickness?: number;
    arc?: number;
  };
  circle?: {
    radius?: number;
    radiusThickness?: number;
    arc?: number;
  };
  rectangle?: {
    rotation?: Point3D;
    scale?: Point3D;
  };
  box?: {
    scale?: Point3D;
    emitFrom?: EmitFrom;
  };
};

export type TextureSheetAnimation = {
  tiles?: THREE.Vector2;
  timeMode?: TimeMode;
  fps?: number;
  startFrame?: MinMaxNumber;
};

export type Renderer = {
  blending: THREE.Blending;
  discardBackgroundColor: boolean;
  backgroundColorTolerance: 1.0;
  backgroundColor: Rgb;
  transparent: boolean;
  depthTest: boolean;
  depthWrite: boolean;
};

export type Noise = {
  isActive: boolean;
  strength: number;
  positionAmount: number;
  rotationAmount: number;
  sizeAmount: number;
  sampler?: FBM;
  offsets?: Array<number>;
};

/**
 * Configuration object for the particle system.
 *
 * @property transform - Defines the position, rotation, and scale of the system.
 * @property duration - Duration of the particle system in seconds. Must be a positive value.
 * @default 0.5
 * @property looping - Indicates whether the system should loop after finishing.
 * @default true
 * @property startDelay - The delay before the system starts emitting particles.
 * @default 0
 */
export type ParticleSystemConfig = {
  transform?: Transform;
  /**
   * Duration of the particle system in seconds.
   * Only positive values are valid.
   * Defines how long the system emits particles before stopping.
   */
  duration?: number;
  /**
   * Determines if the particle system should loop after finishing.
   * - `true`: The system restarts after the `duration` ends.
   * - `false`: Plays once and stops.
   */
  looping?: boolean;
  /**
   * Delay before the particle system starts emitting particles.
   * - `Constant`: A fixed delay in seconds.
   * - `RandomBetweenTwoConstants`: Generates a random delay between `min` and `max` values.
   * @example
   * ```typescript
   * startDelay: 2; // Fixed 2-second delay
   * startDelay: { min: 0.5, max: 2 }; // Random delay between 0.5 and 2 seconds
   * ```
   */
  startDelay?: Constant | RandomBetweenTwoConstants;
  startLifetime?: MinMaxNumber;
  startSpeed?: MinMaxNumber;
  startSize?: MinMaxNumber;
  startRotation?: MinMaxNumber;
  startColor?: MinMaxColor;
  startOpacity?: MinMaxNumber;
  gravity?: number;
  simulationSpace?: SimulationSpace;
  maxParticles?: number;
  emission?: Emission;
  shape?: ShapeConfig;
  map?: THREE.Texture;
  renderer?: Renderer;
  velocityOverLifetime?: any;
  sizeOverLifetime?: any;
  opacityOverLifetime?: any;
  rotationOverLifetime?: any;
  noise?: any;
  textureSheetAnimation?: TextureSheetAnimation;
  onUpdate?: (data: {
    particleSystem: THREE.Points;
    delta: number;
    elapsed: number;
    lifetime: number;
    iterationCount: number;
  }) => void;
  onComplete?: () => void;
};

export type NormalizedParticleSystemConfig = Required<ParticleSystemConfig>;

export type GeneralData = {
  creationTimes: Array<number>;
  distanceFromLastEmitByDistance: number;
  lastWorldPosition: THREE.Vector3;
  currentWorldPosition: THREE.Vector3;
  worldPositionChange: THREE.Vector3;
  wrapperQuaternion: THREE.Quaternion;
  lastWorldQuaternion: THREE.Quaternion;
  worldQuaternion: THREE.Quaternion;
  worldEuler: THREE.Euler;
  gravityVelocity: THREE.Vector3;
  startValues: Record<string, Array<number>>;
  hasOrbitalVelocity: boolean;
  orbitalVelocityData: Array<{
    speed: THREE.Vector3;
    positionOffset: THREE.Vector3;
  }>;
  lifetimeValues: Record<string, Array<number>>;
  noise: Noise;
  isEnabled: boolean;
};

export type ParticleSystemInstance = {
  particleSystem: THREE.Points;
  wrapper?: Gyroscope;
  generalData: GeneralData;
  onUpdate: (data: {
    particleSystem: THREE.Points;
    delta: number;
    elapsed: number;
    lifetime: number;
    iterationCount: number;
  }) => void;
  onComplete: (data: { particleSystem: THREE.Points }) => void;
  creationTime: number;
  lastEmissionTime: number;
  duration: number;
  looping: boolean;
  simulationSpace: SimulationSpace;
  gravity: number;
  emission: Emission;
  normalizedConfig: NormalizedParticleSystemConfig;
  iterationCount: number;
  velocities: Array<THREE.Vector3>;
  deactivateParticle: (particleIndex: number) => void;
  activateParticle: (data: {
    particleIndex: number;
    activationTime: number;
    position: Required<Point3D>;
  }) => void;
};

export type ParticleSystem = {
  instance: THREE.Points | Gyroscope;
  resumeEmitter: () => void;
  pauseEmitter: () => void;
  dispose: () => void;
};

export type CycleData = {
  now: number;
  delta: number;
  elapsed: number;
};
