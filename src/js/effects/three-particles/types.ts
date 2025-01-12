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
 */
export type ParticleSystemConfig = {
  /**
   * Defines the position, rotation, and scale of the particle system.
   */
  transform?: Transform;

  /**
   * Duration of the particle system in seconds.
   * Must be a positive value.
   * @default 5.0
   * @example
   * const duration: number = 5; // System runs for 5 seconds.
   */
  duration?: number;

  /**
   * Indicates whether the system should loop after finishing.
   * @default true
   * @example
   * looping: true; // System loops continuously.
   */
  looping?: boolean;

  /**
   * Delay before the particle system starts emitting particles.
   * Supports a fixed value (`Constant`) or a random range (`RandomBetweenTwoConstants`).
   * @default 0
   * @example
   * startDelay: 2; // Fixed 2-second delay.
   * startDelay: { min: 0.5, max: 2 }; // Random delay between 0.5 and 2 seconds.
   */
  startDelay?: Constant | RandomBetweenTwoConstants;

  /**
   * Initial lifetime of the particles in seconds.
   * @default 1
   */
  startLifetime?: MinMaxNumber;

  /**
   * Initial speed of the particles.
   * @default 1
   */
  startSpeed?: MinMaxNumber;

  /**
   * Initial size of the particles.
   * @default 1
   */
  startSize?: MinMaxNumber;

  /**
   * Initial rotation of the particles in degrees.
   * @default 0
   */
  startRotation?: MinMaxNumber;

  /**
   * Initial color of the particles.
   */
  startColor?: MinMaxColor;

  /**
   * Initial opacity of the particles.
   * @default 1
   */
  startOpacity?: MinMaxNumber;

  /**
   * Gravity affecting the particle system.
   * @default 0
   */
  gravity?: number;

  /**
   * Space where the simulation occurs (local or world).
   */
  simulationSpace?: SimulationSpace;

  /**
   * Maximum number of particles in the system.
   */
  maxParticles?: number;

  /**
   * Emission configuration for rate over time and distance.
   */
  emission?: Emission;

  /**
   * Shape configuration for the particle emitter.
   */
  shape?: ShapeConfig;

  /**
   * Texture for the particles.
   */
  map?: THREE.Texture;

  /**
   * Renderer configuration for blending, transparency, and depth testing.
   */
  renderer?: Renderer;

  /**
   * Defines how particle velocity changes over their lifetime.
   */
  velocityOverLifetime?: any;

  /**
   * Defines how particle size changes over their lifetime.
   */
  sizeOverLifetime?: any;

  /**
   * Defines how particle opacity changes over their lifetime.
   */
  opacityOverLifetime?: any;

  /**
   * Defines how particle rotation changes over their lifetime.
   */
  rotationOverLifetime?: any;

  /**
   * Noise configuration affecting position, rotation, and size.
   */
  noise?: any;

  /**
   * Animation configuration for texture sheets.
   */
  textureSheetAnimation?: TextureSheetAnimation;

  /**
   * Called on every update frame with data.
   */
  onUpdate?: (data: {
    particleSystem: THREE.Points;
    delta: number;
    elapsed: number;
    lifetime: number;
    iterationCount: number;
  }) => void;

  /**
   * Called when the system completes an iteration.
   */
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
