export type Point3D = {
  x?: number;
  y?: number;
  z?: number;
};

export type Transform = {
  position?: Point3D;
  rotation?: Point3D;
  scale?: Point3D;
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

export type ParticleSystemConfig = {
  transform?: Transform;
  duration?: number;
  looping?: boolean;
  startDelay?: MinMaxNumber;
  startLifetime?: MinMaxNumber;
  startSpeed?: MinMaxNumber;
  startSize?: MinMaxNumber;
  startRotation?: MinMaxNumber;
  startColor?: MinMaxColor;
  startOpacity?: MinMaxNumber;
  gravity?: number;
  simulationSpace?: "LOCAL" | "WORLD";
  maxParticles?: number;
  emission?: Emission;
  shape?: any;
  map?: THREE.Texture;
  renderer?: any;
  velocityOverLifetime?: any;
  sizeOverLifetime?: any;
  opacityOverLifetime?: any;
  rotationOverLifetime?: any;
  noise?: any;
  textureSheetAnimation?: any;
  _editorData: any;
};

export type ParticleSystem = {
  instance: THREE.Object3D;
  resumeEmitter: () => void;
  pauseEmitter: () => void;
  dispose: () => void;
};

export type CycleData = {
  now: number,
  delta: number,
  elapsed: number,
};

export function createParticleSystem(
  config: ParticleSystemConfig,
  externalNow?: number
): ParticleSystem;

export function updateParticleSystems(cycleData:CycleData): void;