import * as THREE from 'three';
import {
  CurveFunctionId,
  curveFunctionIdMap,
  getCurveFunction,
} from './three-particles-curves.js';
import {
  ForceFieldFalloff,
  ForceFieldType,
  LifeTimeCurve,
} from './three-particles-enums.js';
import { blendingMap } from './three-particles.js';
import type {
  BezierCurve,
  CurveFunction,
  EasingCurve,
  ForceFieldConfig,
  LifetimeCurve,
  ParticleSystemConfig,
} from './types.js';

/** Current serialization format version */
const SERIALIZATION_VERSION = 1;

type BlendingKey = keyof typeof blendingMap;
type RawObject = Record<string, unknown>;

// Reverse blending map: THREE.Blending number → string key
const reverseBlendingMap = new Map<number, BlendingKey>(
  (Object.entries(blendingMap) as [BlendingKey, number][]).map(([k, v]) => [
    v,
    k,
  ])
);

// Reverse curve function map: function reference → CurveFunctionId string
const reverseCurveFunctionMap = new Map<CurveFunction, string>();
for (const [id, fn] of Object.entries(curveFunctionIdMap) as [
  string,
  CurveFunction,
][]) {
  if (fn) reverseCurveFunctionMap.set(fn, id);
}

// ─── SERIALIZATION ───────────────────────────────────────────────────────────

function serializeAny(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof THREE.Vector3)
    return { x: value.x, y: value.y, z: value.z };
  if (value instanceof THREE.Vector2) return { x: value.x, y: value.y };
  if (value instanceof THREE.Texture) return undefined;
  if (typeof value === 'function') return undefined;
  if (Array.isArray(value)) return value.map((item) => serializeAny(item));
  if (typeof value === 'object') {
    const obj = value as RawObject;

    // EasingCurve: replace curveFunction with curveFunctionId
    if (
      obj['type'] === LifeTimeCurve.EASING &&
      typeof obj['curveFunction'] === 'function'
    ) {
      const id = reverseCurveFunctionMap.get(
        obj['curveFunction'] as CurveFunction
      );
      if (!id) {
        throw new Error(
          'Cannot serialize a custom curveFunction. Use a predefined CurveFunctionId instead.'
        );
      }
      return {
        type: LifeTimeCurve.EASING,
        curveFunctionId: id,
        ...(obj['scale'] !== undefined ? { scale: obj['scale'] } : {}),
      };
    }

    const result: RawObject = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'onUpdate' || k === 'onComplete') continue;
      if (k === 'blending' && typeof v === 'number') {
        result[k] = reverseBlendingMap.get(v as THREE.Blending) ?? v;
        continue;
      }
      const serialized = serializeAny(v, k);
      if (serialized !== undefined) result[k] = serialized;
    }
    return result;
  }
  return value;
}

/**
 * Serializes a `ParticleSystemConfig` to a JSON string.
 *
 * - `THREE.Vector3` / `THREE.Vector2` are converted to plain `{x, y, z}` / `{x, y}` objects.
 * - `renderer.blending` is converted to its string identifier (e.g. `"THREE.AdditiveBlending"`).
 * - `EasingCurve.curveFunction` is replaced by a `curveFunctionId` string.
 *   Only predefined `CurveFunctionId` functions can be serialized; custom functions throw.
 * - `THREE.Texture` (`map`), callback fields (`onUpdate`, `onComplete`) are omitted.
 * - An `_editorData` field and other unknown fields are preserved as-is.
 * - A `_version` field is added for forward-compatibility.
 *
 * @param config - The particle system configuration to serialize.
 * @returns A JSON string representation of the config.
 * @throws If the config contains a custom (non-predefined) `curveFunction`.
 *
 * @example
 * ```typescript
 * import { serializeParticleSystem } from '@newkrok/three-particles';
 *
 * const json = serializeParticleSystem(config);
 * localStorage.setItem('myEffect', json);
 * ```
 */
export function serializeParticleSystem(config: ParticleSystemConfig): string {
  const serialized = serializeAny(config) as RawObject;
  return JSON.stringify({ _version: SERIALIZATION_VERSION, ...serialized });
}

// ─── DESERIALIZATION ──────────────────────────────────────────────────────────

/**
 * Reconstructs a `LifetimeCurve` from its serialized form.
 * Handles:
 *  - Legacy editor format: `{ bezierPoints: [...] }` (no `type` field → treated as BEZIER)
 *  - Normal BEZIER: `{ type: "BEZIER", bezierPoints: [...] }`
 *  - Serialized EASING: `{ type: "EASING", curveFunctionId: "..." }`
 */
function deserializeCurve(raw: unknown): LifetimeCurve {
  const obj = raw as RawObject;

  // Legacy format from editor: bezierPoints present but no type
  if (Array.isArray(obj['bezierPoints']) && !obj['type']) {
    return { type: LifeTimeCurve.BEZIER, ...obj } as BezierCurve;
  }

  if (obj['type'] === LifeTimeCurve.EASING) {
    const id = obj['curveFunctionId'] as CurveFunctionId;
    const fn = getCurveFunction(id);
    if (!fn) {
      throw new Error(
        `Unknown curveFunctionId: "${id}". Use a value from CurveFunctionId.`
      );
    }
    const curve: EasingCurve = {
      type: LifeTimeCurve.EASING,
      curveFunction: fn,
    };
    if (obj['scale'] !== undefined) curve.scale = obj['scale'] as number;
    return curve;
  }

  // BEZIER (explicit type) or passthrough
  return obj as BezierCurve;
}

/**
 * Deserializes a value that can be `Constant | RandomBetweenTwoConstants | LifetimeCurve`.
 * Numbers pass through; objects are inspected for curve shape.
 */
function deserializeCurveOrValue(
  value: unknown
): number | Record<string, unknown> | LifetimeCurve | undefined {
  if (typeof value === 'number') return value;
  if (!value || typeof value !== 'object') return value as undefined;
  const obj = value as RawObject;
  const looksLikeCurve =
    Array.isArray(obj['bezierPoints']) ||
    obj['type'] === LifeTimeCurve.BEZIER ||
    obj['type'] === LifeTimeCurve.EASING ||
    typeof obj['curveFunctionId'] === 'string';
  if (looksLikeCurve) return deserializeCurve(obj);
  return obj; // RandomBetweenTwoConstants or other plain object
}

function deserializeVector3(raw: unknown): THREE.Vector3 | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const { x = 0, y = 0, z = 0 } = raw as { x?: number; y?: number; z?: number };
  return new THREE.Vector3(x, y, z);
}

function deserializeVector2(raw: unknown): THREE.Vector2 | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const { x = 1, y = 1 } = raw as { x?: number; y?: number };
  return new THREE.Vector2(x, y);
}

function deserializeConfig(raw: RawObject): ParticleSystemConfig {
  const config: ParticleSystemConfig = {};

  // transform
  if (raw['transform'] && typeof raw['transform'] === 'object') {
    const t = raw['transform'] as RawObject;
    config.transform = {
      position: deserializeVector3(t['position']),
      rotation: deserializeVector3(t['rotation']),
      scale: deserializeVector3(t['scale']),
    };
  }

  // scalar / enum fields (pass through)
  for (const field of [
    'duration',
    'looping',
    'gravity',
    'simulationSpace',
    'maxParticles',
  ] as const) {
    if (field in raw) (config as RawObject)[field] = raw[field];
  }

  // start value fields (Constant | RandomBetweenTwoConstants | LifetimeCurve)
  for (const field of [
    'startDelay',
    'startLifetime',
    'startSpeed',
    'startSize',
    'startOpacity',
    'startRotation',
  ] as const) {
    if (field in raw)
      (config as RawObject)[field] = deserializeCurveOrValue(raw[field]);
  }

  // startColor (plain MinMaxColor — no reconstruction needed)
  if ('startColor' in raw)
    config.startColor = raw['startColor'] as ParticleSystemConfig['startColor'];

  // emission
  if (raw['emission'] && typeof raw['emission'] === 'object') {
    const e = raw['emission'] as RawObject;
    config.emission = {
      rateOverTime: deserializeCurveOrValue(e['rateOverTime']) as NonNullable<
        ParticleSystemConfig['emission']
      >['rateOverTime'],
      rateOverDistance: deserializeCurveOrValue(
        e['rateOverDistance']
      ) as NonNullable<ParticleSystemConfig['emission']>['rateOverDistance'],
      bursts: Array.isArray(e['bursts'])
        ? (e['bursts'] as NonNullable<
            ParticleSystemConfig['emission']
          >['bursts'])
        : [],
    };
  }

  // shape (plain object with enum string values — no reconstruction needed)
  if ('shape' in raw)
    config.shape = raw['shape'] as ParticleSystemConfig['shape'];

  // renderer: convert blending string → THREE.Blending number
  if (raw['renderer'] && typeof raw['renderer'] === 'object') {
    const r = raw['renderer'] as RawObject;
    const blending =
      typeof r['blending'] === 'string'
        ? (blendingMap[r['blending'] as BlendingKey] ?? THREE.NormalBlending)
        : ((r['blending'] as number | undefined) ?? THREE.NormalBlending);
    config.renderer = { ...r, blending } as ParticleSystemConfig['renderer'];
  }

  // velocityOverLifetime
  if (
    raw['velocityOverLifetime'] &&
    typeof raw['velocityOverLifetime'] === 'object'
  ) {
    const vol = raw['velocityOverLifetime'] as RawObject;
    const deserializeAxis = (
      axis: unknown
    ): { x?: unknown; y?: unknown; z?: unknown } => {
      if (!axis || typeof axis !== 'object') return {};
      const a = axis as RawObject;
      return {
        ...(a['x'] !== undefined ? { x: deserializeCurveOrValue(a['x']) } : {}),
        ...(a['y'] !== undefined ? { y: deserializeCurveOrValue(a['y']) } : {}),
        ...(a['z'] !== undefined ? { z: deserializeCurveOrValue(a['z']) } : {}),
      };
    };
    config.velocityOverLifetime = {
      isActive: (vol['isActive'] as boolean) ?? false,
      linear: deserializeAxis(vol['linear']) as NonNullable<
        ParticleSystemConfig['velocityOverLifetime']
      >['linear'],
      orbital: deserializeAxis(vol['orbital']) as NonNullable<
        ParticleSystemConfig['velocityOverLifetime']
      >['orbital'],
    };
  }

  // sizeOverLifetime / opacityOverLifetime — both have isActive + lifetimeCurve
  for (const field of ['sizeOverLifetime', 'opacityOverLifetime'] as const) {
    if (raw[field] && typeof raw[field] === 'object') {
      const m = raw[field] as RawObject;
      (config as RawObject)[field] = {
        isActive: (m['isActive'] as boolean) ?? false,
        lifetimeCurve: deserializeCurve(m['lifetimeCurve']),
      };
    }
  }

  // colorOverLifetime — r/g/b are LifetimeCurves; isActive defaults to true when present
  if (
    raw['colorOverLifetime'] &&
    typeof raw['colorOverLifetime'] === 'object'
  ) {
    const col = raw['colorOverLifetime'] as RawObject;
    config.colorOverLifetime = {
      isActive: (col['isActive'] as boolean) ?? true,
      r: deserializeCurve(col['r']),
      g: deserializeCurve(col['g']),
      b: deserializeCurve(col['b']),
    };
  }

  // rotationOverLifetime (isActive + RandomBetweenTwoConstants — no curves)
  if (
    raw['rotationOverLifetime'] &&
    typeof raw['rotationOverLifetime'] === 'object'
  ) {
    config.rotationOverLifetime = raw[
      'rotationOverLifetime'
    ] as ParticleSystemConfig['rotationOverLifetime'];
  }

  // noise (NoiseConfig is plain data — no reconstruction needed)
  if (raw['noise'] && typeof raw['noise'] === 'object') {
    config.noise = raw['noise'] as ParticleSystemConfig['noise'];
  }

  // textureSheetAnimation — reconstruct tiles Vector2, deserialize startFrame
  if (
    raw['textureSheetAnimation'] &&
    typeof raw['textureSheetAnimation'] === 'object'
  ) {
    const tsa = raw['textureSheetAnimation'] as RawObject;
    config.textureSheetAnimation = {
      ...(tsa as ParticleSystemConfig['textureSheetAnimation']),
      tiles: deserializeVector2(tsa['tiles']),
      startFrame: deserializeCurveOrValue(tsa['startFrame']) as NonNullable<
        ParticleSystemConfig['textureSheetAnimation']
      >['startFrame'],
    };
  }

  // subEmitters — recursively deserialize nested configs
  if (Array.isArray(raw['subEmitters'])) {
    config.subEmitters = (raw['subEmitters'] as RawObject[]).map((se) => ({
      ...(se as NonNullable<ParticleSystemConfig['subEmitters']>[number]),
      config: deserializeConfig(se['config'] as RawObject),
    }));
  }

  // forceFields — array of ForceFieldConfig objects
  if (Array.isArray(raw['forceFields'])) {
    config.forceFields = (raw['forceFields'] as RawObject[]).map((ff) => {
      const result: ForceFieldConfig = {};
      if ('isActive' in ff) result.isActive = ff['isActive'] as boolean;
      if ('type' in ff) result.type = ff['type'] as ForceFieldType;
      if (ff['position']) result.position = deserializeVector3(ff['position']);
      if (ff['direction'])
        result.direction = deserializeVector3(ff['direction']);
      if ('strength' in ff)
        result.strength = deserializeCurveOrValue(
          ff['strength']
        ) as ForceFieldConfig['strength'];
      if ('range' in ff)
        result.range =
          ff['range'] === null ? Infinity : (ff['range'] as number);
      if ('falloff' in ff) result.falloff = ff['falloff'] as ForceFieldFalloff;
      return result;
    });
  }

  // _editorData and any other unknown fields — preserve as-is
  for (const key of Object.keys(raw)) {
    if (!(key in config) && key !== '_version' && raw[key] !== null) {
      (config as RawObject)[key] = raw[key];
    }
  }

  return config;
}

/**
 * Deserializes a JSON string produced by `serializeParticleSystem` (or by the
 * three-particles-editor) into a `ParticleSystemConfig` object.
 *
 * - Blending strings (e.g. `"THREE.AdditiveBlending"`) are converted back to
 *   `THREE.Blending` constants.
 * - `{x, y, z}` objects under `transform` are reconstructed as `THREE.Vector3`.
 * - `{x, y}` objects under `textureSheetAnimation.tiles` are reconstructed as `THREE.Vector2`.
 * - Legacy Bézier curves without a `type` field (editor format) are normalized.
 * - Easing curves stored as `{ type: "EASING", curveFunctionId }` have their
 *   `curveFunction` resolved from the predefined map.
 * - `_editorData` and other unknown fields are preserved.
 *
 * @param json - A JSON string produced by `serializeParticleSystem` or the editor.
 * @returns A fully reconstructed `ParticleSystemConfig`.
 *
 * @example
 * ```typescript
 * import { deserializeParticleSystem } from '@newkrok/three-particles';
 *
 * const config = deserializeParticleSystem(localStorage.getItem('myEffect')!);
 * createParticleSystem(config);
 * ```
 */
export function deserializeParticleSystem(json: string): ParticleSystemConfig {
  const parsed = JSON.parse(json) as RawObject & { _version?: number };

  const { _version: _, ...raw } = parsed;
  return deserializeConfig(raw);
}
