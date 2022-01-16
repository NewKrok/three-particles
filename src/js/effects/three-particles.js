import * as THREE from "three/build/three.module.js";

import {
  calculateRandomPositionAndVelocityOnCircle,
  calculateRandomPositionAndVelocityOnCone,
  calculateRandomPositionAndVelocityOnRectangle,
  calculateRandomPositionAndVelocityOnSphere,
  patchObject,
} from "./three-particles/three-particles-utils.js";

import { CurveFunction } from "./three-particles/three-particles-curves.js";
import ParticleSystemFragmentShader from "./three-particles/shaders/particle-system-fragment-shader.glsl.js";
import ParticleSystemVertexShader from "./three-particles/shaders/particle-system-vertex-shader.glsl.js";
import { Perlin } from "three-noise/build/three-noise.module.js";
import { applyModifiers } from "./three-particles/three-particles-modifiers.js";

let createdParticleSystems = [];

export const SimulationSpace = {
  LOCAL: "LOCAL",
  WORLD: "WORLD",
};

export const Shape = {
  SPHERE: "SPHERE",
  CONE: "CONE",
  BOX: "BOX",
  CIRCLE: "CIRCLE",
  RECTANGLE: "RECTANGLE",
};

export const TimeMode = {
  LIFETIME: "LIFETIME",
  FPS: "FPS",
};

export const getDefaultParticleSystemConfig = () =>
  JSON.parse(JSON.stringify(DEFAULT_PARTICLE_SYSTEM_CONFIG));

const DEFAULT_PARTICLE_SYSTEM_CONFIG = {
  transform: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  },
  duration: 5.0,
  looping: true,
  startDelay: { min: 0.0, max: 0.0 },
  startLifetime: { min: 10.0, max: 10.0 }, // { min: 2.0, max: 2.0 },
  startSpeed: { min: 0.0, max: 0.0 }, // { min: 1.0, max: 1.0 },
  startSize: { min: 1.0, max: 1.0 },
  startRotation: { min: 0.0, max: 0.0 },
  startColor: {
    min: { r: 1.0, g: 1.0, b: 1.0 },
    max: { r: 1.0, g: 1.0, b: 1.0 },
  },
  startOpacity: { min: 1.0, max: 1.0 },
  gravity: 0.0,
  simulationSpace: SimulationSpace.LOCAL,
  maxParticles: 40, // 100.0,
  emission: {
    rateOverTime: 10.0,
    rateOverDistance: 0.0,
  },
  shape: {
    shape: Shape.SPHERE,
    sphere: {
      radius: 0.0001, // 1.0,
      radiusThickness: 0.0, // 1.0,
      arc: 360.0,
    },
    cone: {
      angle: 25.0,
      radius: 1.0,
      radiusThickness: 1.0,
      arc: 360.0,
    },
    circle: {
      radius: 1.0,
      radiusThickness: 1.0,
      arc: 360.0,
    },
    rectangle: {
      rotation: { x: 0.0, y: 0.0 }, // TODO: add z rotation
      scale: { x: 1.0, y: 1.0 },
    },
  },
  map: null,
  velocityOverLifetime: {
    isActive: false,
    linear: {
      x: { min: 0, max: 0 },
      y: { min: 0, max: 0 },
      z: { min: 0, max: 0 },
    },
    orbital: {
      x: { min: 0, max: 0 },
      y: { min: 0, max: 0 },
      z: { min: 0, max: 0 },
    },
  },
  sizeOverLifetime: {
    isActive: false,
    curveFunction: CurveFunction.LINEAR,
  },
  /* colorOverLifetime: {
    isActive: false,
    curveFunction: CurveFunction.LINEAR,
  }, */
  opacityOverLifetime: {
    isActive: false,
    curveFunction: CurveFunction.LINEAR,
  },
  rotationOverLifetime: {
    isActive: false,
    min: 0.0,
    max: 0.0,
  },
  noise: {
    isActive: true, // false,
    strength: 1.0,
  },
  textureSheetAnimation: {
    tiles: new THREE.Vector2(1.0, 1.0),
    timeMode: TimeMode.LIFETIME,
    fps: 10.0,
    startFrame: { min: 0.0, max: 0.0 },
  },
};

const createFloat32Attributes = ({
  geometry,
  propertyName,
  maxParticles,
  factory,
}) => {
  geometry.setAttribute(
    propertyName,
    new THREE.BufferAttribute(
      new Float32Array(
        Array.from(
          { length: maxParticles },
          typeof factory === "function" ? factory : () => factory
        )
      ),
      1
    )
  );
};

const calculatePositionAndVelocity = (
  { shape, sphere, cone, circle, rectangle },
  startSpeed,
  position,
  velocity,
  velocityOverLifetime
) => {
  switch (shape) {
    case Shape.SPHERE:
      calculateRandomPositionAndVelocityOnSphere(
        position,
        velocity,
        startSpeed,
        sphere
      );
      break;

    case Shape.CONE:
      calculateRandomPositionAndVelocityOnCone(
        position,
        velocity,
        startSpeed,
        cone
      );
      break;

    case Shape.CIRCLE:
      calculateRandomPositionAndVelocityOnCircle(
        position,
        velocity,
        startSpeed,
        circle
      );
      break;

    case Shape.RECTANGLE:
      calculateRandomPositionAndVelocityOnRectangle(
        position,
        velocity,
        startSpeed,
        rectangle
      );
      break;
  }

  if (velocityOverLifetime.isActive) {
    velocity.x += THREE.MathUtils.randFloat(
      velocityOverLifetime.linear.x.min,
      velocityOverLifetime.linear.x.max
    );
    velocity.y += THREE.MathUtils.randFloat(
      velocityOverLifetime.linear.y.min,
      velocityOverLifetime.linear.y.max
    );
    velocity.z += THREE.MathUtils.randFloat(
      velocityOverLifetime.linear.z.min,
      velocityOverLifetime.linear.z.max
    );
  }
};

export const createParticleSystem = (
  config = DEFAULT_PARTICLE_SYSTEM_CONFIG
) => {
  const now = Date.now();
  const generalData = {
    distanceFromLastEmitByDistance: 0,
    lastWorldPosition: new THREE.Vector3(-99999),
    currentWorldPosition: new THREE.Vector3(-99999),
    worldPositionChange: new THREE.Vector3(),
    worldQuaternion: new THREE.Quaternion(),
    lastWorldQuaternion: new THREE.Quaternion(-99999),
    worldEuler: new THREE.Euler(),
    gravityVelocity: new THREE.Vector3(0, 0, 0),
    startValues: {},
    lifetimeValues: {},
    creationTimes: [],
    noise: null,
  };

  const normalizedConfig = patchObject(DEFAULT_PARTICLE_SYSTEM_CONFIG, config);
  const {
    transform,
    duration,
    looping,
    startDelay,
    startLifetime,
    startSpeed,
    startSize,
    startRotation,
    startColor,
    startOpacity,
    gravity,
    simulationSpace,
    maxParticles,
    emission,
    shape,
    map,
    noise,
    velocityOverLifetime,
    onUpdate,
    onComplete,
    textureSheetAnimation,
  } = normalizedConfig;

  const startPositions = Array.from(
    { length: maxParticles },
    () => new THREE.Vector3()
  );
  const velocities = Array.from(
    { length: maxParticles },
    () => new THREE.Vector3()
  );

  generalData.creationTimes = Array.from({ length: maxParticles }, () => 0);

  const startValueKeys = ["startSize", "startOpacity"];
  startValueKeys.forEach((key) => {
    generalData.startValues[key] = Array.from({ length: maxParticles }, () =>
      THREE.MathUtils.randFloat(
        normalizedConfig[key].min,
        normalizedConfig[key].max
      )
    );
  });

  const lifetimeValueKeys = ["rotationOverLifetime"];
  lifetimeValueKeys.forEach((key) => {
    if (normalizedConfig[key].isActive)
      generalData.lifetimeValues[key] = Array.from(
        { length: maxParticles },
        () =>
          THREE.MathUtils.randFloat(
            normalizedConfig[key].min,
            normalizedConfig[key].max
          )
      );
  });

  generalData.noise = {
    ...noise,
    sampler: noise.isActive ? new Perlin(Math.random()) : null,
  };

  const material = new THREE.ShaderMaterial({
    uniforms: {
      elapsed: {
        value: 0.0,
      },
      map: {
        value: map,
      },
      tiles: {
        value: textureSheetAnimation.tiles,
      },
      fps: {
        value: textureSheetAnimation.fps,
      },
      useFPSForFrameIndex: {
        value: textureSheetAnimation.timeMode === TimeMode.FPS,
      },
    },
    vertexShader: ParticleSystemVertexShader,
    fragmentShader: ParticleSystemFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
  });

  const geometry = new THREE.BufferGeometry();

  for (let i = 0; i < maxParticles; i++)
    calculatePositionAndVelocity(
      shape,
      startSpeed,
      startPositions[i],
      velocities[i],
      velocityOverLifetime
    );

  geometry.setFromPoints(
    Array.from({ length: maxParticles }, (_, index) => ({
      ...startPositions[index],
    }))
  );

  const createFloat32AttributesRequest = (propertyName, factory) => {
    createFloat32Attributes({
      geometry,
      propertyName,
      maxParticles,
      factory,
    });
  };

  createFloat32AttributesRequest("isActive", false);
  createFloat32AttributesRequest("lifetime", 0);
  createFloat32AttributesRequest("startLifetime", () =>
    THREE.MathUtils.randFloat(startLifetime.min, startLifetime.max)
  );
  createFloat32AttributesRequest("startFrame", () =>
    THREE.MathUtils.randInt(
      textureSheetAnimation.startFrame.min,
      textureSheetAnimation.startFrame.max
    )
  );

  createFloat32AttributesRequest("opacity", 0);

  createFloat32AttributesRequest("rotation", () =>
    THREE.Math.degToRad(
      THREE.MathUtils.randFloat(startRotation.min, startRotation.max)
    )
  );

  createFloat32AttributesRequest(
    "size",
    (_, index) => generalData.startValues.startSize[index]
  );

  createFloat32AttributesRequest("rotation", 0);

  const colorRandomRatio = Math.random();
  createFloat32AttributesRequest(
    "colorR",
    () =>
      startColor.min.r +
      colorRandomRatio * (startColor.max.r - startColor.min.r)
  );
  createFloat32AttributesRequest(
    "colorG",
    () =>
      startColor.min.g +
      colorRandomRatio * (startColor.max.g - startColor.min.g)
  );
  createFloat32AttributesRequest(
    "colorB",
    () =>
      startColor.min.b +
      colorRandomRatio * (startColor.max.b - startColor.min.b)
  );
  createFloat32AttributesRequest("colorA", 0);

  const deactivateParticle = (particleIndex) => {
    geometry.attributes.isActive.array[particleIndex] = false;
    geometry.attributes.colorA.array[particleIndex] = 0;
    geometry.attributes.colorA.needsUpdate = true;
  };

  const activateParticle = ({ particleIndex, activationTime }) => {
    geometry.attributes.isActive.array[particleIndex] = true;
    generalData.creationTimes[particleIndex] = activationTime;

    const colorRandomRatio = Math.random();

    geometry.attributes.colorR.array[particleIndex] =
      startColor.min.r +
      colorRandomRatio * (startColor.max.r - startColor.min.r);
    geometry.attributes.colorR.needsUpdate = true;

    geometry.attributes.colorG.array[particleIndex] =
      startColor.min.g +
      colorRandomRatio * (startColor.max.g - startColor.min.g);
    geometry.attributes.colorG.needsUpdate = true;

    geometry.attributes.colorB.array[particleIndex] =
      startColor.min.b +
      colorRandomRatio * (startColor.max.b - startColor.min.b);
    geometry.attributes.colorB.needsUpdate = true;

    geometry.attributes.startFrame.array[particleIndex] =
      THREE.MathUtils.randInt(
        textureSheetAnimation.startFrame.min,
        textureSheetAnimation.startFrame.max
      );
    geometry.attributes.startFrame.needsUpdate = true;

    geometry.attributes.startLifetime.array[particleIndex] =
      THREE.MathUtils.randFloat(startLifetime.min, startLifetime.max) * 1000;
    geometry.attributes.startLifetime.needsUpdate = true;

    generalData.startValues.startSize[particleIndex] =
      THREE.MathUtils.randFloat(startSize.min, startSize.max);
    generalData.startValues.startOpacity[particleIndex] =
      THREE.MathUtils.randFloat(startOpacity.min, startOpacity.max);

    geometry.attributes.rotation.array[particleIndex] = THREE.Math.degToRad(
      THREE.MathUtils.randFloat(startRotation.min, startRotation.max)
    );

    if (normalizedConfig.rotationOverLifetime.isActive)
      generalData.lifetimeValues.rotationOverLifetime[particleIndex] =
        THREE.MathUtils.randFloat(
          normalizedConfig.rotationOverLifetime.min,
          normalizedConfig.rotationOverLifetime.max
        );

    geometry.attributes.rotation.needsUpdate = true;
    geometry.attributes.colorB.needsUpdate = true;

    calculatePositionAndVelocity(
      shape,
      startSpeed,
      startPositions[particleIndex],
      velocities[particleIndex],
      velocityOverLifetime
    );
    const positionIndex = Math.floor(particleIndex * 3);
    geometry.attributes.position.array[positionIndex] =
      startPositions[particleIndex].x;
    geometry.attributes.position.array[positionIndex + 1] =
      startPositions[particleIndex].y;
    geometry.attributes.position.array[positionIndex + 2] =
      startPositions[particleIndex].z;

    geometry.attributes.lifetime.array[particleIndex] = 0;
    geometry.attributes.lifetime.needsUpdate = true;

    applyModifiers({
      delta: 0,
      elapsed: 0,
      noise: generalData.noise,
      startValues: generalData.startValues,
      lifetimeValues: generalData.lifetimeValues,
      normalizedConfig,
      attributes: particleSystem.geometry.attributes,
      particleLifetimePercentage: 0,
      particleIndex,
      forceUpdate: true,
    });
  };

  const particleSystem = new THREE.Points(geometry, material);
  particleSystem.sortParticles = true;

  particleSystem.position.copy(transform.position);
  particleSystem.rotation.x = THREE.Math.degToRad(transform.rotation.x);
  particleSystem.rotation.y = THREE.Math.degToRad(transform.rotation.y);
  particleSystem.rotation.z = THREE.Math.degToRad(transform.rotation.z);
  particleSystem.scale.copy(transform.scale);

  const calculatedCreationTime =
    now + THREE.MathUtils.randFloat(startDelay.min, startDelay.max) * 1000;

  createdParticleSystems.push({
    particleSystem,
    generalData,
    onUpdate,
    onComplete,
    creationTime: calculatedCreationTime,
    lastEmissionTime: calculatedCreationTime,
    duration,
    looping,
    simulationSpace,
    gravity,
    emission,
    normalizedConfig,
    iterationCount: 0,
    velocities,
    deactivateParticle,
    activateParticle,
  });
  return particleSystem;
};

export const destroyParticleSystem = (particleSystem) => {
  createdParticleSystems = createdParticleSystems.filter(
    ({ particleSystem: savedParticleSystem }) =>
      savedParticleSystem !== particleSystem
  );

  particleSystem.geometry.dispose();
  particleSystem.material.dispose();
  particleSystem.parent.remove(particleSystem);
};

export const updateParticleSystems = ({ now, delta, elapsed }) => {
  createdParticleSystems.forEach((props) => {
    const {
      onUpdate,
      generalData,
      onComplete,
      particleSystem,
      creationTime,
      lastEmissionTime,
      duration,
      looping,
      emission,
      normalizedConfig,
      iterationCount,
      velocities,
      deactivateParticle,
      activateParticle,
      simulationSpace,
      gravity,
    } = props;

    const {
      lastWorldPosition,
      currentWorldPosition,
      worldPositionChange,
      lastWorldQuaternion,
      worldQuaternion,
      worldEuler,
      gravityVelocity,
    } = generalData;

    const lifetime = now - creationTime;
    particleSystem.material.uniforms.elapsed.value = elapsed;

    particleSystem.getWorldPosition(currentWorldPosition);
    if (lastWorldPosition.x !== -99999)
      worldPositionChange.set(
        currentWorldPosition.x - lastWorldPosition.x,
        currentWorldPosition.y - lastWorldPosition.y,
        currentWorldPosition.z - lastWorldPosition.z
      );
    generalData.distanceFromLastEmitByDistance += worldPositionChange.length();
    particleSystem.getWorldPosition(lastWorldPosition);

    particleSystem.getWorldQuaternion(worldQuaternion);
    if (
      lastWorldQuaternion.x === -99999 ||
      lastWorldQuaternion.x != worldQuaternion.x ||
      lastWorldQuaternion.y != worldQuaternion.y ||
      lastWorldQuaternion.z != worldQuaternion.z
    ) {
      worldEuler.setFromQuaternion(worldQuaternion);
      lastWorldQuaternion.copy(worldQuaternion);

      const tempPosX = particleSystem.position.x;
      const tempPosY = particleSystem.position.y;
      const tempPosZ = particleSystem.position.z;
      gravityVelocity.set(0, gravity, 0);
      particleSystem.position.set(0, 0, 0);
      particleSystem.updateMatrixWorld();
      particleSystem.worldToLocal(gravityVelocity);
      particleSystem.position.set(tempPosX, tempPosY, tempPosZ);
      particleSystem.updateMatrixWorld();
    }

    generalData.creationTimes.forEach((entry, index) => {
      if (particleSystem.geometry.attributes.isActive.array[index]) {
        const particleLifetime = now - entry;
        if (
          particleLifetime >
          particleSystem.geometry.attributes.startLifetime.array[index]
        )
          deactivateParticle(index);
        else {
          const velocity = velocities[index];
          velocity.x -= gravityVelocity.x;
          velocity.y -= gravityVelocity.y;
          velocity.z -= gravityVelocity.z;

          if (
            gravity !== 0 ||
            velocity.x !== 0 ||
            velocity.y !== 0 ||
            velocity.z !== 0
          ) {
            const positionIndex = index * 3;
            const positionArr =
              particleSystem.geometry.attributes.position.array;
            if (simulationSpace === SimulationSpace.WORLD) {
              positionArr[positionIndex] -= worldPositionChange.x;
              positionArr[positionIndex + 1] -= worldPositionChange.y;
              positionArr[positionIndex + 2] -= worldPositionChange.z;
            }
            positionArr[positionIndex] += velocity.x * delta;
            positionArr[positionIndex + 1] += velocity.y * delta;
            positionArr[positionIndex + 2] += velocity.z * delta;
            particleSystem.geometry.attributes.position.needsUpdate = true;
          }

          particleSystem.geometry.attributes.lifetime.array[index] =
            particleLifetime;
          particleSystem.geometry.attributes.lifetime.needsUpdate = true;

          const particleLifetimePercentage =
            particleLifetime /
            particleSystem.geometry.attributes.startLifetime.array[index];
          applyModifiers({
            delta,
            elapsed,
            noise: generalData.noise,
            startValues: generalData.startValues,
            lifetimeValues: generalData.lifetimeValues,
            normalizedConfig,
            attributes: particleSystem.geometry.attributes,
            particleLifetimePercentage,
            particleIndex: index,
          });
        }
      }
    });

    if (looping || lifetime < duration * 1000) {
      const emissionDelta = now - lastEmissionTime;
      const neededParticlesByTime = Math.floor(
        emission.rateOverTime * (emissionDelta / 1000)
      );
      const neededParticlesByDistance =
        emission.rateOverDistance > 0 &&
        generalData.distanceFromLastEmitByDistance > 0
          ? Math.floor(
              generalData.distanceFromLastEmitByDistance /
                (1 / emission.rateOverDistance)
            )
          : 0;
      const neededParticles = neededParticlesByTime + neededParticlesByDistance;

      if (emission.rateOverDistance > 0 && neededParticlesByDistance >= 1)
        generalData.distanceFromLastEmitByDistance = 0;

      if (neededParticles > 0) {
        for (let i = 0; i < neededParticles; i++) {
          let particleIndex = -1;
          particleSystem.geometry.attributes.isActive.array.find(
            (isActive, index) => {
              if (!isActive) {
                particleIndex = index;
                return true;
              }

              return false;
            }
          );

          if (
            particleIndex !== -1 &&
            particleIndex <
              particleSystem.geometry.attributes.isActive.array.length
          ) {
            activateParticle({ particleIndex, activationTime: now });
            props.lastEmissionTime = now;
          }
        }
      }

      if (onUpdate)
        onUpdate({
          particleSystem,
          delta,
          elapsed,
          lifetime,
          iterationCount: iterationCount + 1,
        });
    } else if (onComplete)
      onComplete({
        particleSystem,
      });
  });
};
