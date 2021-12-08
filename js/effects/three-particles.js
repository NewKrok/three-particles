import * as THREE from "../../../node_modules/three/build/three.module.js";

import ParticleSystemFragmentShader from "./shaders/particle-system-fragment-shader.glsl.js";
import ParticleSystemVertexShader from "./shaders/particle-system-vertex-shader.glsl.js";

// Float32Array is not enough accurate when we are storing timestamp in it so we just remove unnecessary time
const float32Helper = 1638200000000;

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

const defaultTextureSheetAnimation = {
  tiles: new THREE.Vector2(1.0, 1.0),
  fps: 30.0,
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

const getRandomStartPositionByShape = ({ shape, radius, radiusThickness }) => {
  const position = new THREE.Vector3();
  switch (shape) {
    case Shape.SPHERE: {
      const u = Math.random();
      const v = Math.random();
      const randomizedDistanceRatio = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const xDirection = Math.sin(phi) * Math.cos(theta);
      const yDirection = Math.sin(phi) * Math.sin(theta);
      const zDirection = Math.cos(phi);
      const normalizedThickness = 1 - radiusThickness;

      position.x =
        radius * normalizedThickness * xDirection +
        radius * radiusThickness * randomizedDistanceRatio * xDirection;
      position.y =
        radius * normalizedThickness * yDirection +
        radius * radiusThickness * randomizedDistanceRatio * yDirection;
      position.z =
        radius * normalizedThickness * zDirection +
        radius * radiusThickness * randomizedDistanceRatio * zDirection;
      break;
    }
  }

  return position;
};

export const createParticleSystem = ({
  duration = 5.0,
  looping = true,
  startDelay = { min: 0.0, max: 0.0 },
  startLifeTime = { min: 5.0, max: 5.0 },
  startSpeed = { min: 5.0, max: 5.0 },
  startSize = { min: 1.0, max: 1.0 },
  startRotation = { min: 0.0, max: 0.0 },
  startColor = {
    min: { r: 1.0, g: 1.0, b: 1.0 },
    max: { r: 1.0, g: 1.0, b: 1.0 },
  },
  startOpacity = { min: 1.0, max: 1.0 },
  gravity = 0.0,
  simulationSpace = SimulationSpace.LOCAL,
  maxParticles = 100,
  emission = {
    rateOverTime: 10.0,
    rateOverDistance: 0.0,
  },
  shape = {
    shape: Shape.SPHERE,
    radius: 1.0,
    radiusThickness: 1.0,
    arc: 360.0,
  },
  map,
  onUpdate = null,
  onComplete = null,
  textureSheetAnimation = defaultTextureSheetAnimation,
}) => {
  const now = Date.now();
  const lastWorldPosition = new THREE.Vector3(-99999, -99999, -99999);
  const worldPositionChange = new THREE.Vector3();
  const generalData = { distanceFromLastEmitByDistance: 0 };

  const normalizedStartDelay = { min: 0.0, max: 0.0, ...startDelay };
  const normalizedStartLifeTime = { min: 5.0, max: 5.0, ...startLifeTime };
  const normalizedStartSpeed = { min: 5.0, max: 5.0, ...startSpeed };
  const normalizedStartSize = { min: 1.0, max: 1.0, ...startSize };
  const normalizedStartRotation = { min: 0.0, max: 0.0, ...startRotation };
  const normalizedStartColor = {
    min: { r: 1.0, g: 1.0, b: 1.0, ...startColor.min },
    max: { r: 1.0, g: 1.0, b: 1.0, ...startColor.max },
  };
  const normalizedStartOpacity = { min: 0.0, max: 0.0, ...startOpacity };
  const normalizedEmission = {
    rateOverTime: 10.0,
    rateOverDistance: 0.0,
    ...emission,
  };
  const normalizedShape = {
    shape: Shape.SPHERE,
    radius: 1.0,
    radiusThickness: 1.0,
    arc: 360.0,
    ...shape,
  };

  const rawUniforms = {
    ...defaultTextureSheetAnimation,
    ...textureSheetAnimation,
  };
  rawUniforms.tiles = rawUniforms.tiles
    ? rawUniforms.tiles
    : defaultTextureSheetAnimation.tiles;

  const uniforms = Object.keys(rawUniforms).reduce(
    (prev, key) => ({
      ...prev,
      [key]: { value: rawUniforms[key] },
    }),
    {}
  );

  const material = new THREE.ShaderMaterial({
    uniforms: {
      elapsed: {
        value: 0.0,
      },
      map: {
        value: map,
      },
      ...uniforms,
    },
    vertexShader: ParticleSystemVertexShader,
    fragmentShader: ParticleSystemFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
  });

  const geometry = new THREE.BufferGeometry();

  const startPosition = getRandomStartPositionByShape(normalizedShape);
  geometry.setFromPoints(
    Array.from({ length: maxParticles }, () => ({ ...startPosition }))
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
  createFloat32AttributesRequest("creationTime", 0);
  createFloat32AttributesRequest("lifeTime", 0);
  createFloat32AttributesRequest("startLifeTime", () =>
    THREE.MathUtils.randFloat(
      normalizedStartLifeTime.min,
      normalizedStartLifeTime.max
    )
  );
  const randomizedSpeed = THREE.MathUtils.randFloat(
    normalizedStartSpeed.min,
    normalizedStartSpeed.max
  );
  const speedMultiplierByPosition = startPosition.length() / 1;
  createFloat32AttributesRequest(
    "velocityX",
    () => startPosition.x * speedMultiplierByPosition * randomizedSpeed
  );
  createFloat32AttributesRequest(
    "velocityY",
    () => startPosition.y * speedMultiplierByPosition * randomizedSpeed
  );
  createFloat32AttributesRequest(
    "velocityZ",
    () => startPosition.z * speedMultiplierByPosition * randomizedSpeed
  );

  createFloat32AttributesRequest("opacity", 0);

  createFloat32Attributes({
    geometry,
    propertyName: "rotation",
    maxParticles,
    factory: () =>
      THREE.Math.degToRad(
        THREE.MathUtils.randFloat(
          normalizedStartRotation.min,
          normalizedStartRotation.max
        )
      ),
  });

  createFloat32Attributes({
    geometry,
    propertyName: "startSize",
    maxParticles,
    factory: () =>
      THREE.MathUtils.randFloat(
        normalizedStartSize.min,
        normalizedStartSize.max
      ),
  });

  createFloat32AttributesRequest("rotation", 0);

  const colorRandomRatio = Math.random();
  createFloat32AttributesRequest(
    "colorR",
    () =>
      normalizedStartColor.min.r +
      colorRandomRatio *
        (normalizedStartColor.max.r - normalizedStartColor.min.r)
  );
  createFloat32AttributesRequest(
    "colorG",
    () =>
      normalizedStartColor.min.g +
      colorRandomRatio *
        (normalizedStartColor.max.g - normalizedStartColor.min.g)
  );
  createFloat32AttributesRequest(
    "colorB",
    () =>
      normalizedStartColor.min.b +
      colorRandomRatio *
        (normalizedStartColor.max.b - normalizedStartColor.min.b)
  );
  createFloat32AttributesRequest("colorA", 0);

  const deactivateParticle = (particleIndex) => {
    geometry.attributes.isActive.array[particleIndex] = false;
    geometry.attributes.lifeTime.array[particleIndex] = 0;
    geometry.attributes.lifeTime.needsUpdate = true;
    geometry.attributes.colorA.array[particleIndex] = 0;
    geometry.attributes.colorA.needsUpdate = true;
  };

  const activateParticle = ({ particleIndex, activationTime }) => {
    geometry.attributes.isActive.array[particleIndex] = true;
    geometry.attributes.creationTime.array[particleIndex] =
      activationTime - float32Helper;

    const colorRandomRatio = Math.random();

    geometry.attributes.colorR.array[particleIndex] =
      normalizedStartColor.min.r +
      colorRandomRatio *
        (normalizedStartColor.max.r - normalizedStartColor.min.r);
    geometry.attributes.colorR.needsUpdate = true;

    geometry.attributes.colorG.array[particleIndex] =
      normalizedStartColor.min.g +
      colorRandomRatio *
        (normalizedStartColor.max.g - normalizedStartColor.min.g);
    geometry.attributes.colorG.needsUpdate = true;

    geometry.attributes.colorB.array[particleIndex] =
      normalizedStartColor.min.b +
      colorRandomRatio *
        (normalizedStartColor.max.b - normalizedStartColor.min.b);
    geometry.attributes.colorB.needsUpdate = true;

    geometry.attributes.colorA.array[particleIndex] = THREE.MathUtils.randFloat(
      normalizedStartOpacity.min,
      normalizedStartOpacity.max
    );
    geometry.attributes.colorA.needsUpdate = true;

    geometry.attributes.startLifeTime.array[particleIndex] =
      THREE.MathUtils.randFloat(
        normalizedStartLifeTime.min,
        normalizedStartLifeTime.max
      ) * 1000;
    geometry.attributes.startLifeTime.needsUpdate = true;

    geometry.attributes.startSize.array[particleIndex] =
      THREE.MathUtils.randFloat(
        normalizedStartSize.min,
        normalizedStartSize.max
      );
    geometry.attributes.startSize.needsUpdate = true;

    geometry.attributes.rotation.array[particleIndex] = THREE.Math.degToRad(
      THREE.MathUtils.randFloat(
        normalizedStartRotation.min,
        normalizedStartRotation.max
      )
    );
    geometry.attributes.rotation.needsUpdate = true;

    const startPosition = getRandomStartPositionByShape(normalizedShape);
    geometry.attributes.position.array[Math.floor(particleIndex * 3)] =
      startPosition.x;
    geometry.attributes.position.array[Math.floor(particleIndex * 3) + 1] =
      startPosition.y;
    geometry.attributes.position.array[Math.floor(particleIndex * 3) + 2] =
      startPosition.z;
    particleSystem.geometry.attributes.position.needsUpdate = true;

    const randomizedSpeed = THREE.MathUtils.randFloat(
      normalizedStartSpeed.min,
      normalizedStartSpeed.max
    );
    const speedMultiplierByPosition = 1 / startPosition.length();
    geometry.attributes.velocityX.array[particleIndex] =
      startPosition.x * speedMultiplierByPosition * randomizedSpeed;
    geometry.attributes.velocityY.array[particleIndex] =
      startPosition.y * speedMultiplierByPosition * randomizedSpeed;
    geometry.attributes.velocityZ.array[particleIndex] =
      startPosition.z * speedMultiplierByPosition * randomizedSpeed;

    geometry.attributes.lifeTime.array[particleIndex] = 0;
    geometry.attributes.lifeTime.needsUpdate = true;
  };

  const particleSystem = new THREE.Points(geometry, material);
  particleSystem.sortParticles = true;

  const calculatedCreationTime =
    now +
    THREE.MathUtils.randFloat(
      normalizedStartDelay.min,
      normalizedStartDelay.max
    ) *
      1000;

  createdParticleSystems.push({
    particleSystem,
    generalData,
    lastWorldPosition,
    worldPositionChange,
    onUpdate,
    onComplete,
    creationTime: calculatedCreationTime,
    lastEmissionTime: calculatedCreationTime,
    duration,
    looping,
    simulationSpace,
    gravity,
    emission: normalizedEmission,
    iterationCount: 0,
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

export const updateParticleSystems = ({ delta, elapsed }) => {
  const now = Date.now();
  createdParticleSystems.forEach((props) => {
    const {
      onUpdate,
      generalData,
      lastWorldPosition,
      worldPositionChange,
      onComplete,
      particleSystem,
      creationTime,
      lastEmissionTime,
      duration,
      looping,
      emission,
      iterationCount,
      deactivateParticle,
      activateParticle,
      simulationSpace,
      gravity,
    } = props;
    const lifeTime = now - creationTime;
    particleSystem.material.uniforms.elapsed.value = elapsed;

    if (
      lastWorldPosition.x !== -99999 &&
      lastWorldPosition.y !== -99999 &&
      lastWorldPosition.z !== -99999
    )
      worldPositionChange.set(
        particleSystem.position.x - lastWorldPosition.x,
        particleSystem.position.y - lastWorldPosition.y,
        particleSystem.position.z - lastWorldPosition.z
      );
    generalData.distanceFromLastEmitByDistance += worldPositionChange.length();
    lastWorldPosition.copy(particleSystem.position);

    particleSystem.geometry.attributes.creationTime.array.forEach(
      (entry, index) => {
        if (particleSystem.geometry.attributes.isActive.array[index]) {
          const particleLifeTime = now - float32Helper - entry;
          if (
            particleLifeTime >
            particleSystem.geometry.attributes.startLifeTime.array[index]
          )
            deactivateParticle(index);
          else {
            const accelerationX =
              particleSystem.geometry.attributes.velocityX.array[index];

            const accelerationY =
              particleSystem.geometry.attributes.velocityY.array[index] -
              gravity;
            particleSystem.geometry.attributes.velocityY.array[index] =
              accelerationY;

            const accelerationZ =
              particleSystem.geometry.attributes.velocityZ.array[index];

            if (gravity !== 0 || accelerationX !== 0 || accelerationY !== 0) {
              const positionArr =
                particleSystem.geometry.attributes.position.array;
              if (simulationSpace === SimulationSpace.WORLD) {
                positionArr[index * 3] -= worldPositionChange.x;
                positionArr[index * 3 + 1] -= worldPositionChange.y;
                positionArr[index * 3 + 2] -= worldPositionChange.z;
              }
              positionArr[index * 3] += accelerationX * delta;
              positionArr[index * 3 + 1] += accelerationY * delta;
              positionArr[index * 3 + 2] += accelerationZ * delta;
              particleSystem.geometry.attributes.position.needsUpdate = true;
            }

            particleSystem.geometry.attributes.lifeTime.array[index] =
              particleLifeTime;
            particleSystem.geometry.attributes.lifeTime.needsUpdate = true;

            // TEMP
            particleSystem.geometry.attributes.colorA.array[index] =
              1 -
              particleLifeTime /
                particleSystem.geometry.attributes.startLifeTime.array[index];
            particleSystem.geometry.attributes.colorA.needsUpdate = true;
          }
        }
      }
    );

    if (looping || lifeTime < duration * 1000) {
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
          lifeTime,
          iterationCount: iterationCount + 1,
        });
    } else if (onComplete)
      onComplete({
        particleSystem,
      });
  });
};
