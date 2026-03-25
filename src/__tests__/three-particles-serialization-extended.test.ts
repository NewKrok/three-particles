import * as THREE from 'three';
import {
  CurveFunctionId,
  getCurveFunction,
} from '../js/effects/three-particles/three-particles-curves.js';
import {
  ForceFieldFalloff,
  ForceFieldType,
  LifeTimeCurve,
  SimulationSpace,
  Shape,
  SubEmitterTrigger,
} from '../js/effects/three-particles/three-particles-enums.js';
import {
  deserializeParticleSystem,
  serializeParticleSystem,
} from '../js/effects/three-particles/three-particles-serialization.js';
import type { ParticleSystemConfig } from '../js/effects/three-particles/types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const roundTrip = (config: ParticleSystemConfig): ParticleSystemConfig => {
  const json = serializeParticleSystem(config);
  return deserializeParticleSystem(json);
};

// ─── startColor serialization ───────────────────────────────────────────────

describe('Serialization - startColor', () => {
  it('should round-trip startColor with min/max', () => {
    const config: ParticleSystemConfig = {
      startColor: {
        min: { r: 0.2, g: 0.3, b: 0.4 },
        max: { r: 0.8, g: 0.9, b: 1.0 },
      },
    };
    const result = roundTrip(config);
    expect(result.startColor).toEqual(config.startColor);
  });

  it('should round-trip startColor with same min/max', () => {
    const config: ParticleSystemConfig = {
      startColor: {
        min: { r: 1, g: 0, b: 0 },
        max: { r: 1, g: 0, b: 0 },
      },
    };
    const result = roundTrip(config);
    expect(result.startColor!.min).toEqual({ r: 1, g: 0, b: 0 });
    expect(result.startColor!.max).toEqual({ r: 1, g: 0, b: 0 });
  });
});

// ─── Burst serialization ────────────────────────────────────────────────────

describe('Serialization - bursts', () => {
  it('should round-trip emission with bursts', () => {
    const config: ParticleSystemConfig = {
      emission: {
        rateOverTime: 10,
        bursts: [
          { time: 0.5, count: 10, cycles: 3, interval: 0.2, probability: 0.8 },
          { time: 1.0, count: { min: 5, max: 15 } },
        ],
      },
    };
    const result = roundTrip(config);
    expect(result.emission!.bursts).toHaveLength(2);
    expect(result.emission!.bursts![0].time).toBe(0.5);
    expect(result.emission!.bursts![0].count).toBe(10);
    expect(result.emission!.bursts![0].cycles).toBe(3);
    expect(result.emission!.bursts![0].interval).toBe(0.2);
    expect(result.emission!.bursts![0].probability).toBe(0.8);
    expect(result.emission!.bursts![1].count).toEqual({ min: 5, max: 15 });
  });

  it('should handle empty bursts array', () => {
    const config: ParticleSystemConfig = {
      emission: {
        rateOverTime: 10,
        bursts: [],
      },
    };
    const result = roundTrip(config);
    expect(result.emission!.bursts).toEqual([]);
  });

  it('should handle missing bursts field', () => {
    const config: ParticleSystemConfig = {
      emission: {
        rateOverTime: 10,
      },
    };
    const result = roundTrip(config);
    expect(result.emission!.bursts).toEqual([]);
  });
});

// ─── Force fields serialization ─────────────────────────────────────────────

describe('Serialization - forceFields', () => {
  it('should round-trip point force field', () => {
    const config: ParticleSystemConfig = {
      forceFields: [
        {
          isActive: true,
          type: ForceFieldType.POINT,
          position: new THREE.Vector3(1, 2, 3),
          direction: new THREE.Vector3(0, 1, 0),
          strength: 5,
          range: 10,
          falloff: ForceFieldFalloff.LINEAR,
        },
      ],
    };
    const result = roundTrip(config);
    expect(result.forceFields).toHaveLength(1);
    const ff = result.forceFields![0];
    expect(ff.isActive).toBe(true);
    expect(ff.type).toBe(ForceFieldType.POINT);
    expect(ff.position).toBeInstanceOf(THREE.Vector3);
    expect(ff.position!.x).toBe(1);
    expect(ff.position!.y).toBe(2);
    expect(ff.position!.z).toBe(3);
    expect(ff.strength).toBe(5);
    expect(ff.range).toBe(10);
    expect(ff.falloff).toBe(ForceFieldFalloff.LINEAR);
  });

  it('should round-trip directional force field', () => {
    const config: ParticleSystemConfig = {
      forceFields: [
        {
          type: ForceFieldType.DIRECTIONAL,
          direction: new THREE.Vector3(0, 0, 1),
          strength: 3,
        },
      ],
    };
    const result = roundTrip(config);
    expect(result.forceFields![0].type).toBe(ForceFieldType.DIRECTIONAL);
    expect(result.forceFields![0].direction).toBeInstanceOf(THREE.Vector3);
  });

  it('should handle force field with null range (Infinity)', () => {
    const json = JSON.stringify({
      _version: 1,
      forceFields: [
        {
          type: ForceFieldType.POINT,
          strength: 1,
          range: null,
        },
      ],
    });
    const result = deserializeParticleSystem(json);
    expect(result.forceFields![0].range).toBe(Infinity);
  });

  it('should round-trip multiple force fields', () => {
    const config: ParticleSystemConfig = {
      forceFields: [
        {
          type: ForceFieldType.POINT,
          position: new THREE.Vector3(0, 0, 0),
          strength: 10,
          range: 5,
          falloff: ForceFieldFalloff.QUADRATIC,
        },
        {
          type: ForceFieldType.DIRECTIONAL,
          direction: new THREE.Vector3(1, 0, 0),
          strength: 2,
        },
        {
          type: ForceFieldType.POINT,
          position: new THREE.Vector3(5, 5, 5),
          strength: -3,
          range: 20,
          falloff: ForceFieldFalloff.NONE,
        },
      ],
    };
    const result = roundTrip(config);
    expect(result.forceFields).toHaveLength(3);
  });

  it('should handle force field with strength as curve', () => {
    const curveFnId = CurveFunctionId.QUADRATIC_IN;
    const config: ParticleSystemConfig = {
      forceFields: [
        {
          type: ForceFieldType.POINT,
          strength: {
            type: LifeTimeCurve.EASING,
            curveFunction: getCurveFunction(curveFnId)!,
            scale: 2,
          } as any,
          range: 10,
        },
      ],
    };
    const result = roundTrip(config);
    const strength = result.forceFields![0].strength;
    expect(typeof strength).toBe('object');
    expect((strength as any).type).toBe(LifeTimeCurve.EASING);
  });
});

// ─── Sub-emitter serialization ──────────────────────────────────────────────

describe('Serialization - subEmitters', () => {
  it('should round-trip sub-emitter configs', () => {
    const config: ParticleSystemConfig = {
      maxParticles: 10,
      subEmitters: [
        {
          trigger: SubEmitterTrigger.DEATH,
          maxInstances: 5,
          inheritVelocity: 0.5,
          config: {
            maxParticles: 3,
            startLifetime: 1,
            emission: { rateOverTime: 10 },
            duration: 0.5,
            looping: false,
          },
        },
      ],
    };
    const result = roundTrip(config);
    expect(result.subEmitters).toHaveLength(1);
    const sub = result.subEmitters![0];
    expect(sub.trigger).toBe(SubEmitterTrigger.DEATH);
    expect(sub.maxInstances).toBe(5);
    expect(sub.inheritVelocity).toBe(0.5);
    expect(sub.config.maxParticles).toBe(3);
    expect(sub.config.startLifetime).toBe(1);
  });

  it('should round-trip birth sub-emitter', () => {
    const config: ParticleSystemConfig = {
      subEmitters: [
        {
          trigger: SubEmitterTrigger.BIRTH,
          config: {
            maxParticles: 5,
            emission: { rateOverTime: 20 },
            looping: false,
            duration: 0.3,
          },
        },
      ],
    };
    const result = roundTrip(config);
    expect(result.subEmitters![0].trigger).toBe(SubEmitterTrigger.BIRTH);
  });

  it('should handle nested sub-emitter configs', () => {
    const config: ParticleSystemConfig = {
      subEmitters: [
        {
          trigger: SubEmitterTrigger.DEATH,
          config: {
            maxParticles: 5,
            emission: { rateOverTime: 10 },
            looping: false,
            duration: 0.5,
            sizeOverLifetime: {
              isActive: true,
              lifetimeCurve: {
                type: LifeTimeCurve.BEZIER,
                bezierPoints: [
                  { x: 0, y: 1, percentage: 0 },
                  { x: 1, y: 0, percentage: 1 },
                ],
              },
            },
          },
        },
      ],
    };
    const result = roundTrip(config);
    expect(result.subEmitters![0].config.sizeOverLifetime!.isActive).toBe(true);
  });
});

// ─── velocityOverLifetime serialization ─────────────────────────────────────

describe('Serialization - velocityOverLifetime', () => {
  it('should round-trip velocity with constant values', () => {
    const config: ParticleSystemConfig = {
      velocityOverLifetime: {
        isActive: true,
        linear: { x: 1, y: 2, z: 3 },
        orbital: { x: 0.5, y: 0.5, z: 0.5 },
      },
    };
    const result = roundTrip(config);
    expect(result.velocityOverLifetime!.isActive).toBe(true);
    expect(result.velocityOverLifetime!.linear.x).toBe(1);
    expect(result.velocityOverLifetime!.linear.y).toBe(2);
    expect(result.velocityOverLifetime!.linear.z).toBe(3);
    expect(result.velocityOverLifetime!.orbital.x).toBe(0.5);
  });

  it('should round-trip velocity with random range values', () => {
    const config: ParticleSystemConfig = {
      velocityOverLifetime: {
        isActive: true,
        linear: {
          x: { min: 0, max: 5 },
          y: 0,
          z: 0,
        },
        orbital: { x: 0, y: 0, z: 0 },
      },
    };
    const result = roundTrip(config);
    expect(result.velocityOverLifetime!.linear.x).toEqual({ min: 0, max: 5 });
  });

  it('should round-trip velocity with bezier curves', () => {
    const config: ParticleSystemConfig = {
      velocityOverLifetime: {
        isActive: true,
        linear: {
          x: {
            type: LifeTimeCurve.BEZIER,
            scale: 2,
            bezierPoints: [
              { x: 0, y: 0, percentage: 0 },
              { x: 1, y: 1, percentage: 1 },
            ],
          },
          y: 0,
          z: 0,
        },
        orbital: { x: 0, y: 0, z: 0 },
      },
    };
    const result = roundTrip(config);
    const xCurve = result.velocityOverLifetime!.linear.x as any;
    expect(xCurve.type).toBe(LifeTimeCurve.BEZIER);
    expect(xCurve.bezierPoints).toHaveLength(2);
  });
});

// ─── Easing curve serialization ─────────────────────────────────────────────

describe('Serialization - easing curves', () => {
  it('should serialize and deserialize easing curve with predefined function', () => {
    const curveFnId = CurveFunctionId.QUADRATIC_IN;
    const config: ParticleSystemConfig = {
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.EASING,
          curveFunction: getCurveFunction(curveFnId)!,
          scale: 2,
        },
      },
    };
    const result = roundTrip(config);
    expect(result.sizeOverLifetime!.isActive).toBe(true);
    const curve = result.sizeOverLifetime!.lifetimeCurve as any;
    expect(curve.type).toBe(LifeTimeCurve.EASING);
    expect(typeof curve.curveFunction).toBe('function');
    expect(curve.scale).toBe(2);
  });

  it('should throw when serializing custom (non-predefined) curveFunction', () => {
    const config: ParticleSystemConfig = {
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.EASING,
          curveFunction: (t: number) => t * t * t,
          scale: 1,
        },
      },
    };
    expect(() => serializeParticleSystem(config)).toThrow(
      'Cannot serialize a custom curveFunction'
    );
  });

  it('should throw when deserializing unknown curveFunctionId', () => {
    const json = JSON.stringify({
      _version: 1,
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.EASING,
          curveFunctionId: 'UNKNOWN_FUNCTION',
        },
      },
    });
    expect(() => deserializeParticleSystem(json)).toThrow(
      'Unknown curveFunctionId'
    );
  });
});

// ─── Texture sheet animation serialization ──────────────────────────────────

describe('Serialization - textureSheetAnimation', () => {
  it('should round-trip texture sheet animation', () => {
    const config: ParticleSystemConfig = {
      textureSheetAnimation: {
        tiles: new THREE.Vector2(4, 4),
        timeMode: 'LIFETIME' as any,
        fps: 30,
        startFrame: 0,
      },
    };
    const result = roundTrip(config);
    expect(result.textureSheetAnimation!.tiles).toBeInstanceOf(THREE.Vector2);
    expect(result.textureSheetAnimation!.tiles!.x).toBe(4);
    expect(result.textureSheetAnimation!.tiles!.y).toBe(4);
    expect(result.textureSheetAnimation!.fps).toBe(30);
    expect(result.textureSheetAnimation!.startFrame).toBe(0);
  });

  it('should round-trip texture sheet animation with random startFrame', () => {
    const config: ParticleSystemConfig = {
      textureSheetAnimation: {
        tiles: new THREE.Vector2(8, 8),
        timeMode: 'FPS' as any,
        fps: 24,
        startFrame: { min: 0, max: 63 },
      },
    };
    const result = roundTrip(config);
    expect(result.textureSheetAnimation!.startFrame).toEqual({
      min: 0,
      max: 63,
    });
  });
});

// ─── Renderer serialization ─────────────────────────────────────────────────

describe('Serialization - renderer', () => {
  it('should round-trip all blending modes', () => {
    const modes = [
      THREE.NoBlending,
      THREE.NormalBlending,
      THREE.AdditiveBlending,
      THREE.SubtractiveBlending,
      THREE.MultiplyBlending,
    ];

    for (const blending of modes) {
      const config: ParticleSystemConfig = {
        renderer: {
          blending,
          transparent: true,
          depthTest: true,
          depthWrite: false,
        },
      };
      const result = roundTrip(config);
      expect(result.renderer!.blending).toBe(blending);
    }
  });

  it('should handle string blending mode from editor', () => {
    const json = JSON.stringify({
      _version: 1,
      renderer: {
        blending: 'THREE.AdditiveBlending',
        transparent: true,
        depthTest: false,
        depthWrite: false,
      },
    });
    const result = deserializeParticleSystem(json);
    expect(result.renderer!.blending).toBe(THREE.AdditiveBlending);
  });

  it('should round-trip discardBackgroundColor settings', () => {
    const config: ParticleSystemConfig = {
      renderer: {
        blending: THREE.NormalBlending,
        discardBackgroundColor: true,
        backgroundColorTolerance: 0.5,
        backgroundColor: { r: 0, g: 0, b: 0 },
        transparent: true,
        depthTest: true,
        depthWrite: false,
      },
    };
    const result = roundTrip(config);
    expect(result.renderer!.discardBackgroundColor).toBe(true);
    expect(result.renderer!.backgroundColorTolerance).toBe(0.5);
  });
});

// ─── Transform serialization ────────────────────────────────────────────────

describe('Serialization - transform', () => {
  it('should round-trip transform with Vector3 values', () => {
    const config: ParticleSystemConfig = {
      transform: {
        position: new THREE.Vector3(1, 2, 3),
        rotation: new THREE.Vector3(45, 90, 180),
        scale: new THREE.Vector3(2, 2, 2),
      },
    };
    const result = roundTrip(config);
    expect(result.transform!.position).toBeInstanceOf(THREE.Vector3);
    expect(result.transform!.position!.x).toBe(1);
    expect(result.transform!.position!.y).toBe(2);
    expect(result.transform!.position!.z).toBe(3);
    expect(result.transform!.rotation!.x).toBe(45);
    expect(result.transform!.scale!.x).toBe(2);
  });
});

// ─── Noise serialization ────────────────────────────────────────────────────

describe('Serialization - noise', () => {
  it('should round-trip noise configuration', () => {
    const config: ParticleSystemConfig = {
      noise: {
        isActive: true,
        useRandomOffset: true,
        strength: 2,
        frequency: 0.5,
        octaves: 3,
        positionAmount: 1,
        rotationAmount: 0.5,
        sizeAmount: 0.3,
      },
    };
    const result = roundTrip(config);
    expect(result.noise!.isActive).toBe(true);
    expect(result.noise!.useRandomOffset).toBe(true);
    expect(result.noise!.strength).toBe(2);
    expect(result.noise!.frequency).toBe(0.5);
    expect(result.noise!.octaves).toBe(3);
  });
});

// ─── rotationOverLifetime serialization ─────────────────────────────────────

describe('Serialization - rotationOverLifetime', () => {
  it('should round-trip rotationOverLifetime', () => {
    const config: ParticleSystemConfig = {
      rotationOverLifetime: {
        isActive: true,
        min: -180,
        max: 180,
      },
    };
    const result = roundTrip(config);
    expect(result.rotationOverLifetime!.isActive).toBe(true);
    expect(result.rotationOverLifetime!.min).toBe(-180);
    expect(result.rotationOverLifetime!.max).toBe(180);
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe('Serialization - edge cases', () => {
  it('should preserve _editorData and unknown fields', () => {
    const config = {
      duration: 1,
      _editorData: { someField: 'value' },
      customField: 42,
    } as any;
    const result = roundTrip(config);
    expect((result as any)._editorData).toEqual({ someField: 'value' });
    expect((result as any).customField).toBe(42);
  });

  it('should omit Texture (map) from serialization', () => {
    const config: ParticleSystemConfig = {
      map: new THREE.Texture(),
      maxParticles: 10,
    };
    const json = serializeParticleSystem(config);
    const parsed = JSON.parse(json);
    expect(parsed.map).toBeUndefined();
  });

  it('should omit onUpdate and onComplete callbacks', () => {
    const config: ParticleSystemConfig = {
      onUpdate: () => {},
      onComplete: () => {},
      maxParticles: 10,
    };
    const json = serializeParticleSystem(config);
    const parsed = JSON.parse(json);
    expect(parsed.onUpdate).toBeUndefined();
    expect(parsed.onComplete).toBeUndefined();
  });

  it('should handle legacy bezier format without type field', () => {
    const json = JSON.stringify({
      _version: 1,
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          bezierPoints: [
            { x: 0, y: 0, percentage: 0 },
            { x: 1, y: 1, percentage: 1 },
          ],
        },
      },
    });
    const result = deserializeParticleSystem(json);
    const curve = result.sizeOverLifetime!.lifetimeCurve as any;
    expect(curve.type).toBe(LifeTimeCurve.BEZIER);
    expect(curve.bezierPoints).toHaveLength(2);
  });

  it('should handle deserializing config with minimal fields', () => {
    const json = JSON.stringify({ _version: 1, duration: 3 });
    const result = deserializeParticleSystem(json);
    expect(result.duration).toBe(3);
  });

  it('should handle serializing empty config', () => {
    const json = serializeParticleSystem({});
    const result = deserializeParticleSystem(json);
    expect(result).toBeDefined();
  });

  it('should include _version in serialized output', () => {
    const json = serializeParticleSystem({ duration: 1 });
    const parsed = JSON.parse(json);
    expect(parsed._version).toBe(1);
  });

  it('should handle null values in serialization', () => {
    const config = {
      duration: 1,
      someNull: null,
    } as any;
    const json = serializeParticleSystem(config);
    const parsed = JSON.parse(json);
    expect(parsed.someNull).toBeNull();
  });

  it('should handle unknown blending number fallback', () => {
    // A blending number not in the blending map should be preserved as-is
    const config: ParticleSystemConfig = {
      renderer: {
        blending: 999 as any,
        transparent: true,
        depthTest: true,
        depthWrite: false,
      },
    };
    const json = serializeParticleSystem(config);
    const parsed = JSON.parse(json);
    expect(parsed.renderer.blending).toBe(999);
  });

  it('should handle deserialization with no blending in renderer', () => {
    const json = JSON.stringify({
      _version: 1,
      renderer: {
        transparent: true,
        depthTest: true,
        depthWrite: false,
      },
    });
    const result = deserializeParticleSystem(json);
    expect(result.renderer!.blending).toBe(THREE.NormalBlending);
  });

  it('should handle unknown blending string fallback in deserialization', () => {
    const json = JSON.stringify({
      _version: 1,
      renderer: {
        blending: 'THREE.UnknownBlending',
        transparent: true,
      },
    });
    const result = deserializeParticleSystem(json);
    expect(result.renderer!.blending).toBe(THREE.NormalBlending);
  });

  it('should handle velocity axis as non-object (falsy)', () => {
    const json = JSON.stringify({
      _version: 1,
      velocityOverLifetime: {
        isActive: true,
        linear: null,
        orbital: 0,
      },
    });
    const result = deserializeParticleSystem(json);
    expect(result.velocityOverLifetime!.linear).toEqual({});
    expect(result.velocityOverLifetime!.orbital).toEqual({});
  });

  it('should handle velocity axis with partial axes', () => {
    const json = JSON.stringify({
      _version: 1,
      velocityOverLifetime: {
        isActive: true,
        linear: { x: 5 },
        orbital: { z: 3 },
      },
    });
    const result = deserializeParticleSystem(json);
    expect(result.velocityOverLifetime!.linear.x).toBe(5);
    expect(result.velocityOverLifetime!.orbital.z).toBe(3);
  });

  it('should handle deserializing array at top level', () => {
    const config: ParticleSystemConfig = {
      emission: {
        rateOverTime: 10,
        bursts: [
          { time: 0.1, count: 5 },
          { time: 0.5, count: { min: 3, max: 10 } },
        ],
      },
    };
    const result = roundTrip(config);
    expect(result.emission!.bursts).toHaveLength(2);
  });

  it('should handle force field with minimal fields', () => {
    const json = JSON.stringify({
      _version: 1,
      forceFields: [{}],
    });
    const result = deserializeParticleSystem(json);
    expect(result.forceFields).toHaveLength(1);
    expect(result.forceFields![0].isActive).toBeUndefined();
  });

  it('should handle force field without position/direction', () => {
    const json = JSON.stringify({
      _version: 1,
      forceFields: [
        {
          type: ForceFieldType.POINT,
          strength: 5,
          range: 10,
        },
      ],
    });
    const result = deserializeParticleSystem(json);
    expect(result.forceFields![0].position).toBeUndefined();
    expect(result.forceFields![0].direction).toBeUndefined();
  });

  it('should handle deserializeVector3 with partial values', () => {
    const json = JSON.stringify({
      _version: 1,
      transform: {
        position: { x: 5 },
        rotation: { y: 90 },
        scale: {},
      },
    });
    const result = deserializeParticleSystem(json);
    expect(result.transform!.position!.x).toBe(5);
    expect(result.transform!.position!.y).toBe(0);
    expect(result.transform!.position!.z).toBe(0);
    expect(result.transform!.rotation!.y).toBe(90);
    expect(result.transform!.scale!.x).toBe(0);
  });

  it('should handle deserializeVector3 with non-object input', () => {
    const json = JSON.stringify({
      _version: 1,
      transform: {
        position: null,
        rotation: 'invalid',
        scale: undefined,
      },
    });
    const result = deserializeParticleSystem(json);
    expect(result.transform!.position).toBeUndefined();
    expect(result.transform!.rotation).toBeUndefined();
  });

  it('should handle serializing config with standalone function values', () => {
    const config = {
      duration: 1,
      someFunction: () => 42,
    } as any;
    const json = serializeParticleSystem(config);
    const parsed = JSON.parse(json);
    // Functions should be omitted
    expect(parsed.someFunction).toBeUndefined();
  });

  it('should handle deserializeVector2 with partial values', () => {
    const json = JSON.stringify({
      _version: 1,
      textureSheetAnimation: {
        tiles: { x: 4 },
        fps: 10,
      },
    });
    const result = deserializeParticleSystem(json);
    // tiles.y should default to 1
    expect(result.textureSheetAnimation!.tiles!.x).toBe(4);
    expect(result.textureSheetAnimation!.tiles!.y).toBe(1);
  });

  it('should handle deserializeVector2 with null', () => {
    const json = JSON.stringify({
      _version: 1,
      textureSheetAnimation: {
        tiles: null,
        fps: 10,
      },
    });
    const result = deserializeParticleSystem(json);
    expect(result.textureSheetAnimation!.tiles).toBeUndefined();
  });

  it('should handle velocityOverLifetime isActive defaulting to false', () => {
    const json = JSON.stringify({
      _version: 1,
      velocityOverLifetime: {
        linear: { x: 1 },
        orbital: { y: 2 },
      },
    });
    const result = deserializeParticleSystem(json);
    // isActive should be falsy (undefined ?? false → false)
    expect(result.velocityOverLifetime!.isActive).toBeFalsy();
  });

  it('should handle easing curve without scale', () => {
    const curveFnId = CurveFunctionId.QUADRATIC_IN;
    const config: ParticleSystemConfig = {
      opacityOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.EASING,
          curveFunction: getCurveFunction(curveFnId)!,
        },
      },
    };
    const result = roundTrip(config);
    const curve = result.opacityOverLifetime!.lifetimeCurve as any;
    expect(curve.type).toBe(LifeTimeCurve.EASING);
    expect(typeof curve.curveFunction).toBe('function');
    // Scale should be undefined when not provided
    expect(curve.scale).toBeUndefined();
  });
});
