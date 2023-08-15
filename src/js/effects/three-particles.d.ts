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

export const enum SimulationSpace {
  LOCAL = "LOCAL",
  WORLD = "WORLD",
}

export const enum Shape {
  SPHERE = "SPHERE",
  CONE = "CONE",
  BOX = "BOX",
  CIRCLE = "CIRCLE",
  RECTANGLE = "RECTANGLE",
}

export const enum EmitFrom {
  VOLUME = "VOLUME",
  SHELL = "SHELL",
  EDGE = "EDGE",
}

export const enum TimeMode {
  LIFETIME = "LIFETIME",
  FPS = "FPS",
}

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
  simulationSpace?: SimulationSpace;
  maxParticles?: number;
  emission?: Emission;
  shape?: ShapeConfig;
  map?: THREE.Texture;
  renderer?: any;
  velocityOverLifetime?: any;
  sizeOverLifetime?: any;
  opacityOverLifetime?: any;
  rotationOverLifetime?: any;
  noise?: any;
  textureSheetAnimation?: TextureSheetAnimation;
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