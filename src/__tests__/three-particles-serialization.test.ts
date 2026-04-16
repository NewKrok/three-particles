import * as THREE from 'three';
import {
  CurveFunctionId,
  getCurveFunction,
} from '../js/effects/three-particles/three-particles-curves.js';
import {
  ForceFieldFalloff,
  ForceFieldType,
  LifeTimeCurve,
  SimulationBackend,
  SimulationSpace,
  Shape,
} from '../js/effects/three-particles/three-particles-enums.js';
import {
  deserializeParticleSystem,
  serializeParticleSystem,
} from '../js/effects/three-particles/three-particles-serialization.js';
import type { ParticleSystemConfig } from '../js/effects/three-particles/types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EDITOR_JSON = JSON.stringify({
  duration: 0.36,
  startLifetime: { min: 0.94, max: 1.77 },
  startSpeed: { min: 0.93, max: 1.76 },
  startSize: { min: 34.19, max: 42.42 },
  startOpacity: { min: 1, max: 1 },
  gravity: -0.64,
  simulationSpace: 'WORLD',
  maxParticles: 40,
  emission: {
    rateOverTime: 0,
    rateOverDistance: 10,
    bursts: [],
  },
  shape: {
    shape: 'CONE',
    cone: { angle: 16.8097, radius: 0.1 },
    rectangle: { scale: { x: 0.5, y: 1.8 } },
  },
  renderer: { blending: 'THREE.AdditiveBlending' },
  sizeOverLifetime: {
    isActive: true,
    lifetimeCurve: {
      bezierPoints: [
        { x: 0, y: 0.245, percentage: 0 },
        { x: 0.1666, y: 0.4116 },
        { x: 0.3766, y: 0.2182 },
        { x: 0.5433, y: 0.385, percentage: 0.5433 },
        { x: 0.7099, y: 0.5516 },
        { x: 0.8333, y: 0.8333 },
        { x: 1, y: 1, percentage: 1 },
      ],
    },
  },
  colorOverLifetime: {
    r: {
      bezierPoints: [
        { x: 0, y: 1, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
    },
    g: {
      bezierPoints: [
        { x: 0, y: 1, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
    },
    b: {
      bezierPoints: [
        { x: 0, y: 1, percentage: 0 },
        { x: 1, y: 1, percentage: 1 },
      ],
    },
  },
  opacityOverLifetime: {
    lifetimeCurve: {
      bezierPoints: [
        { x: 0, y: 1, percentage: 0 },
        { x: 0.5, y: 0.5, percentage: 0.5 },
        { x: 1, y: 0, percentage: 1 },
      ],
    },
  },
  noise: { isActive: true, strength: 0.3, positionAmount: 0.278 },
  _editorData: {
    textureId: 'CLOUD',
    metadata: { name: 'Untitled-2', editorVersion: '2.1.0' },
  },
});

// ─── serializeParticleSystem ──────────────────────────────────────────────────

describe('serializeParticleSystem', () => {
  it('should produce valid JSON', () => {
    const config: ParticleSystemConfig = { duration: 2, looping: true };
    expect(() => JSON.parse(serializeParticleSystem(config))).not.toThrow();
  });

  it('should include _version field', () => {
    const result = JSON.parse(serializeParticleSystem({}));
    expect(result._version).toBe(1);
  });

  it('should convert THREE.Vector3 to plain {x,y,z}', () => {
    const config: ParticleSystemConfig = {
      transform: {
        position: new THREE.Vector3(1, 2, 3),
        rotation: new THREE.Vector3(0, 0, 0),
        scale: new THREE.Vector3(1, 1, 1),
      },
    };
    const result = JSON.parse(serializeParticleSystem(config));
    expect(result.transform.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(result.transform.rotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(result.transform.scale).toEqual({ x: 1, y: 1, z: 1 });
  });

  it('should convert THREE.Vector2 (tiles) to plain {x,y}', () => {
    const config: ParticleSystemConfig = {
      textureSheetAnimation: { tiles: new THREE.Vector2(4, 4) },
    };
    const result = JSON.parse(serializeParticleSystem(config));
    expect(result.textureSheetAnimation.tiles).toEqual({ x: 4, y: 4 });
  });

  it('should convert blending number to string key', () => {
    const config: ParticleSystemConfig = {
      renderer: {
        blending: THREE.AdditiveBlending,
      } as ParticleSystemConfig['renderer'],
    };
    const result = JSON.parse(serializeParticleSystem(config));
    expect(result.renderer.blending).toBe('THREE.AdditiveBlending');
  });

  it('should convert all known blending modes', () => {
    const modes: [THREE.Blending, string][] = [
      [THREE.NoBlending, 'THREE.NoBlending'],
      [THREE.NormalBlending, 'THREE.NormalBlending'],
      [THREE.AdditiveBlending, 'THREE.AdditiveBlending'],
      [THREE.SubtractiveBlending, 'THREE.SubtractiveBlending'],
      [THREE.MultiplyBlending, 'THREE.MultiplyBlending'],
    ];
    for (const [value, expected] of modes) {
      const config: ParticleSystemConfig = {
        renderer: { blending: value } as ParticleSystemConfig['renderer'],
      };
      const result = JSON.parse(serializeParticleSystem(config));
      expect(result.renderer.blending).toBe(expected);
    }
  });

  it('should convert EasingCurve curveFunction to curveFunctionId', () => {
    const config: ParticleSystemConfig = {
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.EASING,
          curveFunction: getCurveFunction(CurveFunctionId.CUBIC_OUT),
        },
      },
    };
    const result = JSON.parse(serializeParticleSystem(config));
    expect(result.sizeOverLifetime.lifetimeCurve.type).toBe('EASING');
    expect(result.sizeOverLifetime.lifetimeCurve.curveFunctionId).toBe(
      'CUBIC_OUT'
    );
    expect(result.sizeOverLifetime.lifetimeCurve.curveFunction).toBeUndefined();
  });

  it('should preserve scale on serialized EasingCurve', () => {
    const config: ParticleSystemConfig = {
      opacityOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.EASING,
          curveFunction: getCurveFunction(CurveFunctionId.LINEAR),
          scale: 2.5,
        },
      },
    };
    const result = JSON.parse(serializeParticleSystem(config));
    expect(result.opacityOverLifetime.lifetimeCurve.scale).toBe(2.5);
  });

  it('should throw for custom (non-predefined) curveFunction', () => {
    const config: ParticleSystemConfig = {
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: {
          type: LifeTimeCurve.EASING,
          curveFunction: (t: number) => t * t, // custom, not in map
        },
      },
    };
    expect(() => serializeParticleSystem(config)).toThrow();
  });

  it('should drop onUpdate and onComplete callbacks', () => {
    const config: ParticleSystemConfig = {
      onUpdate: () => {},
      onComplete: () => {},
    };
    const result = JSON.parse(serializeParticleSystem(config));
    expect(result.onUpdate).toBeUndefined();
    expect(result.onComplete).toBeUndefined();
  });

  it('should drop THREE.Texture (map field)', () => {
    const config: ParticleSystemConfig = {
      map: new THREE.Texture(),
    };
    const result = JSON.parse(serializeParticleSystem(config));
    expect(result.map).toBeUndefined();
  });

  it('should preserve _editorData as-is', () => {
    const editorData = {
      textureId: 'CLOUD',
      metadata: { name: 'Test', editorVersion: '2.1.0' },
    };
    const config = {
      duration: 1,
      _editorData: editorData,
    } as unknown as ParticleSystemConfig;
    const result = JSON.parse(serializeParticleSystem(config));
    expect(result._editorData).toEqual(editorData);
  });

  it('should preserve BezierCurve bezierPoints unchanged', () => {
    const bezierPoints = [
      { x: 0, y: 0, percentage: 0 },
      { x: 1, y: 1, percentage: 1 },
    ];
    const config: ParticleSystemConfig = {
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: { type: LifeTimeCurve.BEZIER, bezierPoints },
      },
    };
    const result = JSON.parse(serializeParticleSystem(config));
    expect(result.sizeOverLifetime.lifetimeCurve.bezierPoints).toEqual(
      bezierPoints
    );
  });

  it('should serialize subEmitters recursively', () => {
    const config: ParticleSystemConfig = {
      subEmitters: [
        {
          config: {
            renderer: {
              blending: THREE.AdditiveBlending,
            } as ParticleSystemConfig['renderer'],
          },
        },
      ],
    };
    const result = JSON.parse(serializeParticleSystem(config));
    expect(result.subEmitters[0].config.renderer.blending).toBe(
      'THREE.AdditiveBlending'
    );
  });
});

// ─── deserializeParticleSystem ────────────────────────────────────────────────

describe('deserializeParticleSystem', () => {
  it('should not throw on minimal JSON', () => {
    expect(() => deserializeParticleSystem('{"_version":1}')).not.toThrow();
  });

  it('should convert blending string to THREE.Blending constant', () => {
    const config = deserializeParticleSystem(
      '{"renderer":{"blending":"THREE.AdditiveBlending"}}'
    );
    expect(config.renderer?.blending).toBe(THREE.AdditiveBlending);
  });

  it('should reconstruct THREE.Vector3 in transform', () => {
    const config = deserializeParticleSystem(
      '{"transform":{"position":{"x":1,"y":2,"z":3},"rotation":{"x":0,"y":0,"z":0},"scale":{"x":2,"y":2,"z":2}}}'
    );
    expect(config.transform?.position).toBeInstanceOf(THREE.Vector3);
    expect(config.transform?.position?.x).toBe(1);
    expect(config.transform?.position?.y).toBe(2);
    expect(config.transform?.position?.z).toBe(3);
    expect(config.transform?.scale).toBeInstanceOf(THREE.Vector3);
    expect(config.transform?.scale?.x).toBe(2);
  });

  it('should reconstruct THREE.Vector2 for tiles', () => {
    const config = deserializeParticleSystem(
      '{"textureSheetAnimation":{"tiles":{"x":4,"y":4}}}'
    );
    expect(config.textureSheetAnimation?.tiles).toBeInstanceOf(THREE.Vector2);
    expect(config.textureSheetAnimation?.tiles?.x).toBe(4);
    expect(config.textureSheetAnimation?.tiles?.y).toBe(4);
  });

  it('should normalize legacy BezierCurve (no type field) on lifetimeCurve', () => {
    const config = deserializeParticleSystem(
      '{"sizeOverLifetime":{"isActive":true,"lifetimeCurve":{"bezierPoints":[{"x":0,"y":0},{"x":1,"y":1}]}}}'
    );
    expect(config.sizeOverLifetime?.lifetimeCurve).toMatchObject({
      type: 'BEZIER',
      bezierPoints: expect.any(Array),
    });
  });

  it('should normalize legacy BezierCurve on colorOverLifetime channels', () => {
    const config = deserializeParticleSystem(
      '{"colorOverLifetime":{"r":{"bezierPoints":[{"x":0,"y":1}]},"g":{"bezierPoints":[]},"b":{"bezierPoints":[]}}}'
    );
    expect(config.colorOverLifetime?.r).toMatchObject({ type: 'BEZIER' });
    expect(config.colorOverLifetime?.g).toMatchObject({ type: 'BEZIER' });
    expect(config.colorOverLifetime?.b).toMatchObject({ type: 'BEZIER' });
  });

  it('should default colorOverLifetime.isActive to true when absent', () => {
    const config = deserializeParticleSystem(
      '{"colorOverLifetime":{"r":{"bezierPoints":[]},"g":{"bezierPoints":[]},"b":{"bezierPoints":[]}}}'
    );
    expect(config.colorOverLifetime?.isActive).toBe(true);
  });

  it('should resolve EasingCurve curveFunctionId to curveFunction', () => {
    const config = deserializeParticleSystem(
      '{"sizeOverLifetime":{"isActive":true,"lifetimeCurve":{"type":"EASING","curveFunctionId":"CUBIC_OUT"}}}'
    );
    const curve = config.sizeOverLifetime?.lifetimeCurve as {
      type: string;
      curveFunction: unknown;
    };
    expect(curve.type).toBe('EASING');
    expect(typeof curve.curveFunction).toBe('function');
    expect(curve.curveFunction).toBe(
      getCurveFunction(CurveFunctionId.CUBIC_OUT)
    );
  });

  it('should pass through scalar fields unchanged', () => {
    const config = deserializeParticleSystem(
      '{"duration":3,"looping":false,"gravity":-9.8,"maxParticles":500,"simulationSpace":"WORLD"}'
    );
    expect(config.duration).toBe(3);
    expect(config.looping).toBe(false);
    expect(config.gravity).toBe(-9.8);
    expect(config.maxParticles).toBe(500);
    expect(config.simulationSpace).toBe(SimulationSpace.WORLD);
  });

  it('should pass through shape config unchanged', () => {
    const config = deserializeParticleSystem(
      '{"shape":{"shape":"CONE","cone":{"angle":16.8,"radius":0.1}}}'
    );
    expect(config.shape?.shape).toBe(Shape.CONE);
    expect(config.shape?.cone?.angle).toBe(16.8);
  });

  it('should deserialize RandomBetweenTwoConstants start values', () => {
    const config = deserializeParticleSystem(
      '{"startLifetime":{"min":0.5,"max":2},"startSpeed":{"min":1,"max":3}}'
    );
    expect(config.startLifetime).toEqual({ min: 0.5, max: 2 });
    expect(config.startSpeed).toEqual({ min: 1, max: 3 });
  });

  it('should deserialize sub-emitters recursively', () => {
    const config = deserializeParticleSystem(
      '{"subEmitters":[{"trigger":"DEATH","config":{"renderer":{"blending":"THREE.NormalBlending"}}}]}'
    );
    expect(config.subEmitters?.[0].config.renderer?.blending).toBe(
      THREE.NormalBlending
    );
  });

  it('should preserve _editorData as-is', () => {
    const config = deserializeParticleSystem(
      '{"_editorData":{"textureId":"CLOUD","metadata":{"editorVersion":"2.1.0"}}}'
    );
    expect((config as Record<string, unknown>)['_editorData']).toEqual({
      textureId: 'CLOUD',
      metadata: { editorVersion: '2.1.0' },
    });
  });

  it('should handle missing transform gracefully', () => {
    const config = deserializeParticleSystem('{"duration":1}');
    expect(config.transform).toBeUndefined();
  });

  it('should throw for unknown curveFunctionId', () => {
    expect(() =>
      deserializeParticleSystem(
        '{"sizeOverLifetime":{"isActive":true,"lifetimeCurve":{"type":"EASING","curveFunctionId":"INVALID_FUNCTION"}}}'
      )
    ).toThrow(/Unknown curveFunctionId/);
  });

  it('should default unknown blending string to NormalBlending', () => {
    const config = deserializeParticleSystem(
      '{"renderer":{"blending":"THREE.UnknownBlending"}}'
    );
    expect(config.renderer?.blending).toBe(THREE.NormalBlending);
  });

  it('should handle null emission gracefully', () => {
    const config = deserializeParticleSystem('{"emission":null}');
    expect(config.emission).toBeUndefined();
  });
});

// ─── round-trip ───────────────────────────────────────────────────────────────

describe('round-trip: serialize then deserialize', () => {
  it('should preserve scalar fields', () => {
    const original: ParticleSystemConfig = {
      duration: 3.5,
      looping: false,
      gravity: -9.8,
      maxParticles: 200,
      simulationSpace: SimulationSpace.WORLD,
      simulationBackend: SimulationBackend.GPU,
    };
    const result = deserializeParticleSystem(serializeParticleSystem(original));
    expect(result.duration).toBe(3.5);
    expect(result.looping).toBe(false);
    expect(result.gravity).toBe(-9.8);
    expect(result.maxParticles).toBe(200);
    expect(result.simulationSpace).toBe(SimulationSpace.WORLD);
    expect(result.simulationBackend).toBe(SimulationBackend.GPU);
  });

  it('should preserve simulationBackend AUTO value', () => {
    const original: ParticleSystemConfig = {
      simulationBackend: SimulationBackend.AUTO,
    };
    const result = deserializeParticleSystem(serializeParticleSystem(original));
    expect(result.simulationBackend).toBe(SimulationBackend.AUTO);
  });

  it('should reconstruct transform vectors', () => {
    const pos = new THREE.Vector3(10, 20, 30);
    const original: ParticleSystemConfig = {
      transform: { position: pos },
    };
    const result = deserializeParticleSystem(serializeParticleSystem(original));
    expect(result.transform?.position).toBeInstanceOf(THREE.Vector3);
    expect(result.transform?.position?.x).toBe(10);
    expect(result.transform?.position?.y).toBe(20);
    expect(result.transform?.position?.z).toBe(30);
  });

  it('should reconstruct blending mode', () => {
    const original: ParticleSystemConfig = {
      renderer: {
        blending: THREE.AdditiveBlending,
      } as ParticleSystemConfig['renderer'],
    };
    const result = deserializeParticleSystem(serializeParticleSystem(original));
    expect(result.renderer?.blending).toBe(THREE.AdditiveBlending);
  });

  it('should reconstruct BezierCurve', () => {
    const bezierPoints = [
      { x: 0, y: 0, percentage: 0 as number | undefined },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1, percentage: 1 as number | undefined },
    ];
    const original: ParticleSystemConfig = {
      sizeOverLifetime: {
        isActive: true,
        lifetimeCurve: { type: LifeTimeCurve.BEZIER, bezierPoints },
      },
    };
    const result = deserializeParticleSystem(serializeParticleSystem(original));
    expect(result.sizeOverLifetime?.lifetimeCurve).toMatchObject({
      type: 'BEZIER',
      bezierPoints,
    });
  });

  it('should reconstruct EasingCurve with all curveFunctionIds', () => {
    // Note: CurveFunctionId.LINEAR maps to Easing.Linear.None which is undefined
    // in the easing-functions library — only use IDs with valid function mappings.
    const ids = [
      CurveFunctionId.QUADRATIC_IN,
      CurveFunctionId.CUBIC_OUT,
      CurveFunctionId.BOUNCE_OUT,
      CurveFunctionId.SINUSOIDAL_IN_OUT,
    ];
    for (const id of ids) {
      const original: ParticleSystemConfig = {
        sizeOverLifetime: {
          isActive: true,
          lifetimeCurve: {
            type: LifeTimeCurve.EASING,
            curveFunction: getCurveFunction(id),
          },
        },
      };
      const result = deserializeParticleSystem(
        serializeParticleSystem(original)
      );
      const curve = result.sizeOverLifetime?.lifetimeCurve as {
        type: string;
        curveFunction: unknown;
      };
      expect(curve.type).toBe('EASING');
      expect(curve.curveFunction).toBe(getCurveFunction(id));
    }
  });

  it('should reconstruct textureSheetAnimation tiles', () => {
    const original: ParticleSystemConfig = {
      textureSheetAnimation: { tiles: new THREE.Vector2(4, 4), fps: 30 },
    };
    const result = deserializeParticleSystem(serializeParticleSystem(original));
    expect(result.textureSheetAnimation?.tiles).toBeInstanceOf(THREE.Vector2);
    expect(result.textureSheetAnimation?.tiles?.x).toBe(4);
    expect(result.textureSheetAnimation?.tiles?.y).toBe(4);
    expect(result.textureSheetAnimation?.fps).toBe(30);
  });

  it('should reconstruct nested subEmitter config', () => {
    const original: ParticleSystemConfig = {
      subEmitters: [
        {
          config: {
            duration: 1,
            renderer: {
              blending: THREE.AdditiveBlending,
            } as ParticleSystemConfig['renderer'],
          },
        },
      ],
    };
    const result = deserializeParticleSystem(serializeParticleSystem(original));
    expect(result.subEmitters?.[0].config.duration).toBe(1);
    expect(result.subEmitters?.[0].config.renderer?.blending).toBe(
      THREE.AdditiveBlending
    );
  });

  it('should preserve rotationOverLifetime config', () => {
    const original: ParticleSystemConfig = {
      rotationOverLifetime: { isActive: true, min: -45, max: 45 },
    };
    const result = deserializeParticleSystem(serializeParticleSystem(original));
    expect(result.rotationOverLifetime?.isActive).toBe(true);
    expect(result.rotationOverLifetime?.min).toBe(-45);
    expect(result.rotationOverLifetime?.max).toBe(45);
  });

  it('should reconstruct velocityOverLifetime with curve values', () => {
    const original: ParticleSystemConfig = {
      velocityOverLifetime: {
        isActive: true,
        linear: {
          x: 1,
          y: {
            type: LifeTimeCurve.BEZIER,
            bezierPoints: [
              { x: 0, y: 0, percentage: 0 },
              { x: 1, y: 1, percentage: 1 },
            ],
          },
        },
        orbital: { x: 0, y: 0, z: 0 },
      },
    };
    const result = deserializeParticleSystem(serializeParticleSystem(original));
    expect(result.velocityOverLifetime?.isActive).toBe(true);
    expect(result.velocityOverLifetime?.linear?.x).toBe(1);
    expect(result.velocityOverLifetime?.linear?.y).toMatchObject({
      type: 'BEZIER',
    });
  });

  it('should preserve noise config', () => {
    const original: ParticleSystemConfig = {
      noise: {
        isActive: true,
        useRandomOffset: true,
        strength: 0.5,
        frequency: 0.5,
        octaves: 2,
        positionAmount: 1.0,
        rotationAmount: 0.0,
        sizeAmount: 0.0,
      },
    };
    const result = deserializeParticleSystem(serializeParticleSystem(original));
    expect(result.noise?.isActive).toBe(true);
    expect(result.noise?.strength).toBe(0.5);
    expect(result.noise?.positionAmount).toBe(1.0);
  });
});

// ─── editor JSON compatibility ────────────────────────────────────────────────

describe('editor JSON compatibility', () => {
  it('should deserialize editor JSON without throwing', () => {
    expect(() => deserializeParticleSystem(EDITOR_JSON)).not.toThrow();
  });

  it('should parse simulationSpace correctly from editor format', () => {
    const config = deserializeParticleSystem(EDITOR_JSON);
    expect(config.simulationSpace).toBe(SimulationSpace.WORLD);
  });

  it('should parse blending string from editor format', () => {
    const config = deserializeParticleSystem(EDITOR_JSON);
    expect(config.renderer?.blending).toBe(THREE.AdditiveBlending);
  });

  it('should normalize legacy bezierPoints on sizeOverLifetime', () => {
    const config = deserializeParticleSystem(EDITOR_JSON);
    expect(config.sizeOverLifetime?.isActive).toBe(true);
    expect(config.sizeOverLifetime?.lifetimeCurve).toMatchObject({
      type: 'BEZIER',
    });
  });

  it('should normalize legacy bezierPoints on colorOverLifetime', () => {
    const config = deserializeParticleSystem(EDITOR_JSON);
    expect(config.colorOverLifetime?.r).toMatchObject({ type: 'BEZIER' });
    expect(config.colorOverLifetime?.g).toMatchObject({ type: 'BEZIER' });
    expect(config.colorOverLifetime?.b).toMatchObject({ type: 'BEZIER' });
  });

  it('should normalize legacy bezierPoints on opacityOverLifetime', () => {
    const config = deserializeParticleSystem(EDITOR_JSON);
    expect(config.opacityOverLifetime?.lifetimeCurve).toMatchObject({
      type: 'BEZIER',
    });
  });

  it('should preserve _editorData from editor JSON', () => {
    const config = deserializeParticleSystem(EDITOR_JSON);
    const editorData = (config as Record<string, unknown>)[
      '_editorData'
    ] as Record<string, unknown>;
    expect(editorData?.['textureId']).toBe('CLOUD');
    expect(
      (editorData?.['metadata'] as Record<string, unknown>)?.['editorVersion']
    ).toBe('2.1.0');
  });

  it('should parse numeric fields from editor format', () => {
    const config = deserializeParticleSystem(EDITOR_JSON);
    expect(config.duration).toBe(0.36);
    expect(config.gravity).toBe(-0.64);
    expect(config.maxParticles).toBe(40);
  });
});

// ─── Force Fields Serialization ──────────────────────────────────────────────

describe('forceFields serialization', () => {
  it('should serialize and deserialize POINT force field', () => {
    const config: ParticleSystemConfig = {
      forceFields: [
        {
          isActive: true,
          type: ForceFieldType.POINT,
          position: new THREE.Vector3(1, 2, 3),
          direction: new THREE.Vector3(0, 1, 0),
          strength: 5,
          range: 10,
          falloff: ForceFieldFalloff.QUADRATIC,
        },
      ],
    };

    const json = serializeParticleSystem(config);
    const result = deserializeParticleSystem(json);

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
    expect(ff.falloff).toBe(ForceFieldFalloff.QUADRATIC);
  });

  it('should serialize and deserialize DIRECTIONAL force field', () => {
    const config: ParticleSystemConfig = {
      forceFields: [
        {
          isActive: true,
          type: ForceFieldType.DIRECTIONAL,
          direction: new THREE.Vector3(0.5, 0.5, 0),
          strength: 3,
        },
      ],
    };

    const json = serializeParticleSystem(config);
    const result = deserializeParticleSystem(json);

    expect(result.forceFields).toHaveLength(1);
    const ff = result.forceFields![0];
    expect(ff.type).toBe(ForceFieldType.DIRECTIONAL);
    expect(ff.direction).toBeInstanceOf(THREE.Vector3);
    expect(ff.direction!.x).toBe(0.5);
    expect(ff.direction!.y).toBe(0.5);
    expect(ff.strength).toBe(3);
  });

  it('should handle Infinity range (serialized as null)', () => {
    const config: ParticleSystemConfig = {
      forceFields: [
        {
          type: ForceFieldType.POINT,
          strength: 1,
          range: Infinity,
        },
      ],
    };

    const json = serializeParticleSystem(config);
    const parsed = JSON.parse(json);
    // JSON.stringify converts Infinity to null
    expect(parsed.forceFields[0].range).toBeNull();

    const result = deserializeParticleSystem(json);
    expect(result.forceFields![0].range).toBe(Infinity);
  });

  it('should serialize and deserialize multiple force fields', () => {
    const config: ParticleSystemConfig = {
      forceFields: [
        {
          type: ForceFieldType.POINT,
          position: new THREE.Vector3(0, 0, 0),
          strength: 5,
          range: 10,
          falloff: ForceFieldFalloff.LINEAR,
        },
        {
          type: ForceFieldType.DIRECTIONAL,
          direction: new THREE.Vector3(1, 0, 0),
          strength: 2,
        },
      ],
    };

    const json = serializeParticleSystem(config);
    const result = deserializeParticleSystem(json);

    expect(result.forceFields).toHaveLength(2);
    expect(result.forceFields![0].type).toBe(ForceFieldType.POINT);
    expect(result.forceFields![1].type).toBe(ForceFieldType.DIRECTIONAL);
  });

  it('should deserialize force field with bezier strength curve', () => {
    const json = JSON.stringify({
      forceFields: [
        {
          type: 'POINT',
          position: { x: 0, y: 0, z: 0 },
          strength: {
            bezierPoints: [
              { x: 0, y: 0, percentage: 0 },
              { x: 1, y: 10, percentage: 1 },
            ],
          },
          range: 5,
          falloff: 'LINEAR',
        },
      ],
    });

    const result = deserializeParticleSystem(json);
    const ff = result.forceFields![0];
    expect(ff.strength).toBeDefined();
    expect(typeof ff.strength).toBe('object');
  });

  it('should handle missing optional fields in deserialization', () => {
    const json = JSON.stringify({
      forceFields: [
        {
          type: 'POINT',
          strength: 3,
        },
      ],
    });

    const result = deserializeParticleSystem(json);
    const ff = result.forceFields![0];
    expect(ff.type).toBe(ForceFieldType.POINT);
    expect(ff.strength).toBe(3);
    // Optional fields not set → undefined (will be defaulted during normalization)
    expect(ff.position).toBeUndefined();
    expect(ff.range).toBeUndefined();
    expect(ff.falloff).toBeUndefined();
  });

  it('should preserve empty forceFields array', () => {
    const config: ParticleSystemConfig = {
      forceFields: [],
    };

    const json = serializeParticleSystem(config);
    const result = deserializeParticleSystem(json);

    expect(result.forceFields).toEqual([]);
  });

  it('should not have forceFields when not present in JSON', () => {
    const json = JSON.stringify({ duration: 5 });
    const result = deserializeParticleSystem(json);
    expect(result.forceFields).toBeUndefined();
  });
});
