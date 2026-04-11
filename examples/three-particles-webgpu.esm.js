import { DataTexture as __WEBPACK_EXTERNAL_MODULE_three_DataTexture__, DoubleSide as __WEBPACK_EXTERNAL_MODULE_three_DoubleSide__, MathUtils as __WEBPACK_EXTERNAL_MODULE_three_MathUtils__, Vector3 as __WEBPACK_EXTERNAL_MODULE_three_Vector3__ } from "three";
import { Discard as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__, Fn as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__, If as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__, Loop as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Loop__, abs as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_abs__, attribute as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__, cameraPosition as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraPosition__, cameraProjectionMatrix as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraProjectionMatrix__, cameraViewMatrix as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraViewMatrix__, compute as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_compute__, cos as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cos__, cross as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cross__, dot as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__, float as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__, floor as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__, fract as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_fract__, instanceIndex as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_instanceIndex__, length as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__, max as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_max__, min as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_min__, mix as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mix__, mod as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mod__, modelViewMatrix as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_modelViewMatrix__, normalLocal as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_normalLocal__, normalize as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_normalize__, pointUV as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_pointUV__, positionLocal as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__, round as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_round__, screenUV as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_screenUV__, sin as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_sin__, smoothstep as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_smoothstep__, step as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_step__, storage as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_storage__, texture as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_texture__, uniform as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__, uv as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uv__, varyingProperty as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__, vec2 as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__, vec3 as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__, vec4 as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__ } from "three/tsl";
import { MeshBasicNodeMaterial as __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_MeshBasicNodeMaterial__, PointsNodeMaterial as __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_PointsNodeMaterial__, StorageBufferAttribute as __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_StorageBufferAttribute__, StorageInstancedBufferAttribute as __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_StorageInstancedBufferAttribute__ } from "three/webgpu";
/******/ // The require scope
/******/ var __webpack_require__ = {};
/******/ 
/************************************************************************/
/******/ /* webpack/runtime/define property getters */
/******/ (() => {
/******/ 	// define getter functions for harmony exports
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/hasOwnProperty shorthand */
/******/ (() => {
/******/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ })();
/******/ 
/************************************************************************/
var __webpack_exports__ = {};

;// external "three"

;// external "three/tsl"

;// external "three/webgpu"

;// ./dist/webgpu.js





// src/js/effects/three-particles/three-particles-utils.ts

// src/js/effects/three-particles/three-particles-bezier.ts
var cache = [];
var nCr = (n, k) => {
  let z = 1;
  for (let i = 1; i <= k; i++) z *= (n + 1 - i) / i;
  return z;
};
var createBezierCurveFunction = (particleSystemId, bezierPoints) => {
  const cacheEntry = cache.find((item) => item.bezierPoints === bezierPoints);
  if (cacheEntry) {
    if (!cacheEntry.referencedBy.includes(particleSystemId))
      cacheEntry.referencedBy.push(particleSystemId);
    return cacheEntry.curveFunction;
  }
  const entry = {
    referencedBy: [particleSystemId],
    bezierPoints,
    curveFunction: (percentage) => {
      if (percentage < 0) return bezierPoints[0].y;
      if (percentage > 1) return bezierPoints[bezierPoints.length - 1].y;
      let start = 0;
      let stop = bezierPoints.length - 1;
      bezierPoints.find((point, index) => {
        const result = percentage < (point.percentage ?? 0);
        if (result) stop = index;
        else if (point.percentage !== void 0) start = index;
        return result;
      });
      const n = stop - start;
      const calculatedPercentage = (percentage - (bezierPoints[start].percentage ?? 0)) / ((bezierPoints[stop].percentage ?? 1) - (bezierPoints[start].percentage ?? 0));
      let value = 0;
      for (let i = 0; i <= n; i++) {
        const p = bezierPoints[start + i];
        const c = nCr(n, i) * Math.pow(1 - calculatedPercentage, n - i) * Math.pow(calculatedPercentage, i);
        value += c * p.y;
      }
      return value;
    }
  };
  cache.push(entry);
  return entry.curveFunction;
};

// src/js/effects/three-particles/three-particles-utils.ts
var isLifeTimeCurve = (value) => {
  return typeof value !== "number" && "type" in value;
};
var getCurveFunctionFromConfig = (particleSystemId, lifetimeCurve) => {
  if (lifetimeCurve.type === "BEZIER" /* BEZIER */) {
    return createBezierCurveFunction(
      particleSystemId,
      lifetimeCurve.bezierPoints
    );
  }
  if (lifetimeCurve.type === "EASING" /* EASING */) {
    return lifetimeCurve.curveFunction;
  }
  throw new Error(`Unsupported value type: ${lifetimeCurve}`);
};
var calculateValue = (particleSystemId, value, time = 0) => {
  if (typeof value === "number") {
    return value;
  }
  if ("min" in value && "max" in value) {
    if (value.min === value.max) {
      return value.min ?? 0;
    }
    return __WEBPACK_EXTERNAL_MODULE_three_MathUtils__.randFloat(value.min ?? 0, value.max ?? 1);
  }
  const lifetimeCurve = value;
  return getCurveFunctionFromConfig(particleSystemId, lifetimeCurve)(time) * (lifetimeCurve.scale ?? 1);
};
var FIELD_STRIDE = 12;
var MAX_FORCE_FIELDS = 16;
var GPU_INFINITY = 1e10;
function encodeForceFieldsForGPU(forceFields, particleSystemId, systemLifetimePercentage) {
  const data = new Float32Array(MAX_FORCE_FIELDS * FIELD_STRIDE);
  const count = Math.min(forceFields.length, MAX_FORCE_FIELDS);
  for (let i = 0; i < count; i++) {
    const ff = forceFields[i];
    const base = i * FIELD_STRIDE;
    data[base] = ff.isActive ? 1 : 0;
    data[base + 1] = ff.type === "POINT" /* POINT */ ? 0 : 1;
    data[base + 2] = ff.position.x;
    data[base + 3] = ff.position.y;
    data[base + 4] = ff.position.z;
    data[base + 5] = ff.direction.x;
    data[base + 6] = ff.direction.y;
    data[base + 7] = ff.direction.z;
    data[base + 8] = calculateValue(
      particleSystemId,
      ff.strength,
      systemLifetimePercentage
    );
    data[base + 9] = ff.range === Infinity ? GPU_INFINITY : ff.range;
    let falloffCode = 0;
    if (ff.falloff === "LINEAR" /* LINEAR */) falloffCode = 1;
    else if (ff.falloff === "QUADRATIC" /* QUADRATIC */) falloffCode = 2;
    data[base + 10] = falloffCode;
    data[base + 11] = 0;
  }
  return data;
}
function createForceFieldComputeNodes(forceFieldCount) {
  const count = Math.min(forceFieldCount, MAX_FORCE_FIELDS);
  const bufferSize = MAX_FORCE_FIELDS * FIELD_STRIDE;
  const forceFieldBuffer = new __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_StorageBufferAttribute__(
    new Float32Array(bufferSize),
    1
  );
  const sForceFields = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_storage__(forceFieldBuffer, "float", bufferSize);
  const uForceFieldCount = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(count));
  const applyForceFieldsTSL = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(
    ({
      pos,
      vel,
      delta
    }) => {
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Loop__(uForceFieldCount, ({ i }) => {
        const base = i.mul(FIELD_STRIDE);
        const isActive = sForceFields.element(base);
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(isActive.lessThan(0.5), () => {
          return;
        });
        const fieldType = sForceFields.element(base.add(1));
        const fieldPos = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(
          sForceFields.element(base.add(2)),
          sForceFields.element(base.add(3)),
          sForceFields.element(base.add(4))
        );
        const fieldDir = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(
          sForceFields.element(base.add(5)),
          sForceFields.element(base.add(6)),
          sForceFields.element(base.add(7))
        );
        const strength = sForceFields.element(base.add(8));
        const range = sForceFields.element(base.add(9));
        const falloffType = sForceFields.element(base.add(10));
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(strength.equal(0), () => {
          return;
        });
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(fieldType.greaterThan(0.5), () => {
          const force = strength.mul(delta);
          vel.assign(vel.add(fieldDir.mul(force)));
        });
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(fieldType.lessThan(0.5), () => {
          const toField = fieldPos.sub(pos);
          const dist = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(toField);
          __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(dist.greaterThan(1e-4), () => {
            const inRange = dist.lessThan(range);
            __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(inRange, () => {
              const dir = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_normalize__(toField);
              const normDist = dist.div(range);
              const falloffNone = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1);
              const falloffLinear = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1).sub(normDist);
              const falloffQuadratic = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1).sub(normDist.mul(normDist));
              const useLinear = falloffType.greaterThan(0.5);
              const useQuadratic = falloffType.greaterThan(1.5);
              const falloff = useQuadratic.select(
                falloffQuadratic,
                useLinear.select(falloffLinear, falloffNone)
              );
              const force = strength.mul(falloff).mul(delta);
              vel.assign(vel.add(dir.mul(force)));
            });
          });
        });
      });
    }
  );
  return {
    /** Storage buffer for encoded force field data. Updated each frame via encodeForceFieldsForGPU. */
    buffer: forceFieldBuffer,
    /** Uniform for the active force field count. */
    countUniform: uForceFieldCount,
    /** TSL function to call in the compute kernel: applyForceFieldsTSL({ pos, vel, delta }) */
    apply: applyForceFieldsTSL
  };
}
var permute = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(({ x }) => {
  return __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mod__(x.mul(34).add(10).mul(x), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(289));
});
var taylorInvSqrt = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(({ r }) => {
  return __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1.79284291400159).sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.85373472095314).mul(r));
});
var snoise3D = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(
  ({ v }) => {
    const ONE_THIRD = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1 / 3);
    const ONE_SIXTH = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1 / 6);
    const i = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(
      v.add(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(v, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(ONE_THIRD, ONE_THIRD, ONE_THIRD)))
    ).toVar();
    const x0 = v.sub(i).add(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(i, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(ONE_SIXTH, ONE_SIXTH, ONE_SIXTH))).toVar();
    const g = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_step__(x0.yzx, x0.xyz).toVar();
    const l = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1).sub(g).toVar();
    const i1 = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_min__(g.xyz, l.zxy).toVar();
    const i2 = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_max__(g.xyz, l.zxy).toVar();
    const x1 = x0.sub(i1).add(ONE_SIXTH).toVar();
    const x2 = x0.sub(i2).add(ONE_SIXTH.mul(2)).toVar();
    const x3 = x0.sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1)).add(ONE_SIXTH.mul(3)).toVar();
    const iw = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mod__(i, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(289)).toVar();
    const p0_yz = permute({
      x: permute({
        x: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(
          __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(iw.z, iw.z.add(i1.z)),
          __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(iw.z.add(i2.z), iw.z.add(1))
        )
      }).add(
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(iw.y, iw.y.add(i1.y)), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(iw.y.add(i2.y), iw.y.add(1)))
      )
    });
    const p = permute({
      x: p0_yz.add(
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(iw.x, iw.x.add(i1.x)), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(iw.x.add(i2.x), iw.x.add(1)))
      )
    });
    const n_ = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.142857142857142);
    const j = p.sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(49).mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(p.mul(n_).mul(n_)))).toVar();
    const x_ = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(j.mul(n_)).toVar();
    const y_ = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(j.sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(7).mul(x_))).toVar();
    const NS_X = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.285714285714286);
    const NS_Y = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(-0.928571428571429);
    const gx = x_.mul(NS_X).add(NS_Y);
    const gy = y_.mul(NS_X).add(NS_Y);
    const gz = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1).sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_abs__(gx)).sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_abs__(gy)).toVar();
    const gz_neg = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_step__(gz, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(0));
    const ox = gz_neg.mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(gx).add(0.5));
    const oy = gz_neg.mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(gy).add(0.5));
    const gx_final = gx.sub(ox);
    const gy_final = gy.sub(oy);
    const g0 = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(gx_final.x, gy_final.x, gz.x).toVar();
    const g1 = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(gx_final.y, gy_final.y, gz.y).toVar();
    const g2 = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(gx_final.z, gy_final.z, gz.z).toVar();
    const g3 = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(gx_final.w, gy_final.w, gz.w).toVar();
    const norm = taylorInvSqrt({
      r: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(g0, g0), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(g1, g1)), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(g2, g2), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(g3, g3)))
    });
    g0.assign(g0.mul(norm.x));
    g1.assign(g1.mul(norm.y));
    g2.assign(g2.mul(norm.z));
    g3.assign(g3.mul(norm.w));
    const m = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_max__(
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.5).sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(x0, x0)), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.5).sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(x1, x1))),
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.5).sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(x2, x2)), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.5).sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(x3, x3)))
      ),
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0)
    ).toVar();
    const m2 = m.mul(m).toVar();
    const m4 = m2.mul(m2).toVar();
    const gdot = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(g0, x0), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(g1, x1)),
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(g2, x2), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(g3, x3))
    );
    return __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(42).mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(m4, gdot));
  }
);
__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(
  ({ t }) => {
    const noiseX = snoise3D({ v: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(t, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0)) });
    const noiseY = snoise3D({ v: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(t, t, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0)) });
    const noiseZ = snoise3D({ v: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(t, t, t) });
    return __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(noiseX, noiseY, noiseZ);
  }
);

// src/js/effects/three-particles/webgpu/compute-modifiers.ts
var INIT_STRIDE = 20;
function createModifierStorageBuffers(maxParticles, instanced, curveData) {
  const Cls = instanced ? __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_StorageInstancedBufferAttribute__ : __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_StorageBufferAttribute__;
  const curveLen = Math.max(curveData.length, 1);
  const totalLen = curveLen + maxParticles * INIT_STRIDE;
  const combined = new Float32Array(totalLen);
  combined.set(curveData.length > 0 ? curveData : new Float32Array([0]));
  return {
    // Position and velocity use vec4 (w=padding) to avoid WebGPU vec3→vec4
    // storage buffer alignment conversion that breaks itemSize-based type resolution.
    position: new Cls(new Float32Array(maxParticles * 4), 4),
    velocity: new __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_StorageBufferAttribute__(new Float32Array(maxParticles * 4), 4),
    color: new Cls(new Float32Array(maxParticles * 4), 4),
    // (lifetime, size, rotation, startFrame)
    particleState: new Cls(new Float32Array(maxParticles * 4), 4),
    // (startLifetime, startSize, startOpacity, startColorR)
    startValues: new Cls(new Float32Array(maxParticles * 4), 4),
    // (startColorG, startColorB, rotationSpeed, noiseOffset)
    startColorsExt: new __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_StorageBufferAttribute__(
      new Float32Array(maxParticles * 4),
      4
    ),
    // (orbitalOffset.x, .y, .z, isActive)
    orbitalIsActive: new __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_StorageBufferAttribute__(
      new Float32Array(maxParticles * 4),
      4
    ),
    // Curve data + emit queue tail (single buffer, 8th binding)
    curveData: new __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_StorageBufferAttribute__(combined, 1)
  };
}
var _emitCounts = /* @__PURE__ */ new WeakMap();
var _curveDataLengths = /* @__PURE__ */ new WeakMap();
var _currentEmitIndices = /* @__PURE__ */ new WeakMap();
var _pendingClearIndices = /* @__PURE__ */ new WeakMap();
function writeParticleToModifierBuffers(buffers, index, data) {
  const curveLen = _curveDataLengths.get(buffers.curveData) ?? 0;
  const arr = buffers.curveData.array;
  const base = curveLen + index * INIT_STRIDE;
  arr[base] = data.position.x;
  arr[base + 1] = data.position.y;
  arr[base + 2] = data.position.z;
  arr[base + 3] = 1;
  arr[base + 4] = data.velocity.x;
  arr[base + 5] = data.velocity.y;
  arr[base + 6] = data.velocity.z;
  arr[base + 7] = 0;
  arr[base + 8] = data.colorR;
  arr[base + 9] = data.colorG;
  arr[base + 10] = data.colorB;
  arr[base + 11] = data.colorA;
  arr[base + 12] = 0;
  arr[base + 13] = data.size;
  arr[base + 14] = data.rotation;
  arr[base + 15] = data.startFrame;
  arr[base + 16] = data.orbitalOffset.x;
  arr[base + 17] = data.orbitalOffset.y;
  arr[base + 18] = data.orbitalOffset.z;
  arr[base + 19] = 1;
  _emitCounts.set(
    buffers.curveData,
    (_emitCounts.get(buffers.curveData) ?? 0) + 1
  );
  let indices = _currentEmitIndices.get(buffers.curveData);
  if (!indices) {
    indices = [];
    _currentEmitIndices.set(buffers.curveData, indices);
  }
  indices.push(index);
  const i4 = index * 4;
  const svArr = buffers.startValues.array;
  svArr[i4] = data.startLifetime;
  svArr[i4 + 1] = data.startSize;
  svArr[i4 + 2] = data.startOpacity;
  svArr[i4 + 3] = data.startColorR;
  const sceArr = buffers.startColorsExt.array;
  sceArr[i4] = data.startColorG;
  sceArr[i4 + 1] = data.startColorB;
  sceArr[i4 + 2] = data.rotationSpeed;
  sceArr[i4 + 3] = data.noiseOffset;
}
function registerCurveDataLength(buffers, curveDataLength) {
  _curveDataLengths.set(buffers.curveData, curveDataLength);
}
function flushEmitQueue(buffers) {
  const count = _emitCounts.get(buffers.curveData) ?? 0;
  const curveLen = _curveDataLengths.get(buffers.curveData) ?? 0;
  const arr = buffers.curveData.array;
  const toClear = _pendingClearIndices.get(buffers.curveData);
  if (toClear && toClear.length > 0) {
    for (let j = 0; j < toClear.length; j++) {
      arr[curveLen + toClear[j] * INIT_STRIDE + 3] = 0;
    }
    toClear.length = 0;
  }
  if (count > 0) {
    buffers.curveData.needsUpdate = true;
    buffers.startValues.needsUpdate = true;
    buffers.startColorsExt.needsUpdate = true;
  }
  const current = _currentEmitIndices.get(buffers.curveData);
  if (current && current.length > 0) {
    _pendingClearIndices.set(buffers.curveData, current.slice());
    current.length = 0;
  }
  _emitCounts.set(buffers.curveData, 0);
  return count;
}
function deactivateParticleInModifierBuffers(_buffers, _index) {
}
var CURVE_RESOLUTION = 256;
function createCurveLookup(sCurveData) {
  return __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(
    ({
      curveIndex,
      t
    }) => {
      const clamped = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_min__(t, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1));
      const pos = clamped.mul(CURVE_RESOLUTION - 1);
      const idx0 = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(pos);
      const f = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_fract__(pos);
      const base = curveIndex.mul(CURVE_RESOLUTION);
      const v0 = sCurveData.element(base.add(idx0));
      const v1 = sCurveData.element(
        base.add(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_min__(idx0.add(1), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(CURVE_RESOLUTION - 1)))
      );
      return __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mix__(v0, v1, f);
    }
  );
}
function createModifierComputeUpdate(buffers, maxParticles, curveMap, flags, forceFieldCount = 0) {
  const forceFieldNodes = flags.forceFields ? createForceFieldComputeNodes(forceFieldCount) : null;
  const uDelta = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0));
  const uDeltaMs = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0));
  const uGravityVelocity = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(new __WEBPACK_EXTERNAL_MODULE_three_Vector3__(0, 0, 0));
  const uWorldPositionChange = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(new __WEBPACK_EXTERNAL_MODULE_three_Vector3__(0, 0, 0));
  const uSimSpaceWorld = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0));
  const uNoiseStrength = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0));
  const uNoisePower = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0));
  const uNoiseFrequency = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1));
  const uNoisePosAmount = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0));
  const uNoiseRotAmount = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0));
  const uNoiseSizeAmount = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0));
  const sPosition = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_storage__(buffers.position, "vec4", maxParticles);
  const sVelocity = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_storage__(buffers.velocity, "vec4", maxParticles);
  const sColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_storage__(buffers.color, "vec4", maxParticles);
  const sParticleState = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_storage__(buffers.particleState, "vec4", maxParticles);
  const sStartValues = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_storage__(buffers.startValues, "vec4", maxParticles);
  const sStartColorsExt = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_storage__(buffers.startColorsExt, "vec4", maxParticles);
  const sOrbitalIsActive = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_storage__(
    buffers.orbitalIsActive,
    "vec4",
    maxParticles
  );
  const sCurveData = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_storage__(
    buffers.curveData,
    "float",
    buffers.curveData.array.length
  );
  const curveLen = Math.max(curveMap.data.length, 1);
  const lookupCurve = createCurveLookup(sCurveData);
  const computeKernel = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(() => {
    const i = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_instanceIndex__;
    const initBase = i.mul(INIT_STRIDE).add(curveLen);
    const initFlag = sCurveData.element(initBase.add(3));
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(initFlag.greaterThan(0.5), () => {
      sPosition.element(i).assign(
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(
          sCurveData.element(initBase),
          sCurveData.element(initBase.add(1)),
          sCurveData.element(initBase.add(2)),
          0
        )
      );
      sVelocity.element(i).assign(
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(
          sCurveData.element(initBase.add(4)),
          sCurveData.element(initBase.add(5)),
          sCurveData.element(initBase.add(6)),
          0
        )
      );
      sColor.element(i).assign(
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(
          sCurveData.element(initBase.add(8)),
          sCurveData.element(initBase.add(9)),
          sCurveData.element(initBase.add(10)),
          sCurveData.element(initBase.add(11))
        )
      );
      sParticleState.element(i).assign(
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(
          sCurveData.element(initBase.add(12)),
          sCurveData.element(initBase.add(13)),
          sCurveData.element(initBase.add(14)),
          sCurveData.element(initBase.add(15))
        )
      );
      sOrbitalIsActive.element(i).assign(
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(
          sCurveData.element(initBase.add(16)),
          sCurveData.element(initBase.add(17)),
          sCurveData.element(initBase.add(18)),
          sCurveData.element(initBase.add(19))
        )
      );
      sCurveData.element(initBase.add(3)).assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0));
    });
    const oiaVec = sOrbitalIsActive.element(i).toVar();
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(oiaVec.w.lessThan(0.5), () => {
      return;
    });
    const pos = sPosition.element(i).xyz.toVar();
    const vel = sVelocity.element(i).xyz.toVar();
    const ps = sParticleState.element(i).toVar();
    const sv = sStartValues.element(i);
    ps.x;
    const startLife = sv.x;
    vel.assign(vel.sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(uGravityVelocity).mul(uDelta)));
    if (forceFieldNodes) {
      forceFieldNodes.apply({ pos, vel, delta: uDelta });
    }
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(uSimSpaceWorld.greaterThan(0.5), () => {
      pos.assign(pos.sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(uWorldPositionChange)));
    });
    pos.assign(pos.add(vel.mul(uDelta)));
    const lifePct = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_min__(ps.x.div(startLife), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1));
    ps.x.assign(ps.x.add(uDeltaMs));
    if (flags.linearVelocity) {
      const lvx = curveMap.linearVelX >= 0 ? lookupCurve({
        curveIndex: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(curveMap.linearVelX),
        t: lifePct
      }) : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0);
      const lvy = curveMap.linearVelY >= 0 ? lookupCurve({
        curveIndex: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(curveMap.linearVelY),
        t: lifePct
      }) : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0);
      const lvz = curveMap.linearVelZ >= 0 ? lookupCurve({
        curveIndex: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(curveMap.linearVelZ),
        t: lifePct
      }) : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0);
      pos.assign(pos.add(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(lvx, lvy, lvz).mul(uDelta)));
    }
    if (flags.orbitalVelocity) {
      const offset = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(oiaVec.x, oiaVec.y, oiaVec.z).toVar();
      pos.assign(pos.sub(offset));
      const ovx = curveMap.orbitalVelX >= 0 ? lookupCurve({
        curveIndex: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(curveMap.orbitalVelX),
        t: lifePct
      }) : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0);
      const ovy = curveMap.orbitalVelY >= 0 ? lookupCurve({
        curveIndex: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(curveMap.orbitalVelY),
        t: lifePct
      }) : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0);
      const ovz = curveMap.orbitalVelZ >= 0 ? lookupCurve({
        curveIndex: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(curveMap.orbitalVelZ),
        t: lifePct
      }) : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0);
      const ax = ovx.mul(uDelta);
      const ay = ovy.mul(uDelta);
      const az = ovz.mul(uDelta);
      const cosAx = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cos__(ax);
      const sinAx = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_sin__(ax);
      const ry1 = offset.y.mul(cosAx).sub(offset.z.mul(sinAx));
      const rz1 = offset.y.mul(sinAx).add(offset.z.mul(cosAx));
      offset.assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(offset.x, ry1, rz1));
      const cosAz = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cos__(az);
      const sinAz = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_sin__(az);
      const rx2 = offset.x.mul(cosAz).sub(offset.y.mul(sinAz));
      const ry2 = offset.x.mul(sinAz).add(offset.y.mul(cosAz));
      offset.assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(rx2, ry2, offset.z));
      const cosAy = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cos__(ay);
      const sinAy = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_sin__(ay);
      const rx3 = offset.x.mul(cosAy).add(offset.z.mul(sinAy));
      const rz3 = offset.x.negate().mul(sinAy).add(offset.z.mul(cosAy));
      offset.assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(rx3, offset.y, rz3));
      oiaVec.x.assign(offset.x);
      oiaVec.y.assign(offset.y);
      oiaVec.z.assign(offset.z);
      pos.assign(pos.add(offset));
    }
    if (flags.sizeOverLifetime && curveMap.sizeOverLifetime >= 0) {
      const multiplier = lookupCurve({
        curveIndex: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(curveMap.sizeOverLifetime),
        t: lifePct
      });
      ps.y.assign(sv.y.mul(multiplier));
    }
    if (flags.opacityOverLifetime && curveMap.opacityOverLifetime >= 0) {
      const multiplier = lookupCurve({
        curveIndex: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(curveMap.opacityOverLifetime),
        t: lifePct
      });
      const col = sColor.element(i).toVar();
      col.w.assign(sv.z.mul(multiplier));
      sColor.element(i).assign(col);
    }
    if (flags.colorOverLifetime) {
      const col = sColor.element(i).toVar();
      const sce = sStartColorsExt.element(i);
      if (curveMap.colorR >= 0) {
        const rMul = lookupCurve({
          curveIndex: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(curveMap.colorR),
          t: lifePct
        });
        col.x.assign(sv.w.mul(rMul));
      }
      if (curveMap.colorG >= 0) {
        const gMul = lookupCurve({
          curveIndex: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(curveMap.colorG),
          t: lifePct
        });
        col.y.assign(sce.x.mul(gMul));
      }
      if (curveMap.colorB >= 0) {
        const bMul = lookupCurve({
          curveIndex: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(curveMap.colorB),
          t: lifePct
        });
        col.z.assign(sce.y.mul(bMul));
      }
      sColor.element(i).assign(col);
    }
    if (flags.rotationOverLifetime) {
      const sce = sStartColorsExt.element(i);
      ps.z.assign(ps.z.add(sce.z.mul(uDelta).mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.02))));
    }
    if (flags.noise) {
      const sce = sStartColorsExt.element(i);
      const noisePos = lifePct.add(sce.w).mul(10).mul(uNoiseStrength).mul(uNoiseFrequency);
      const noiseX = snoise3D({ v: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(noisePos, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0)) });
      const noiseY = snoise3D({
        v: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(noisePos, noisePos, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0))
      });
      const noiseZ = snoise3D({
        v: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(noisePos, noisePos, noisePos)
      });
      pos.assign(
        pos.add(
          __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(noiseX, noiseY, noiseZ).mul(uNoisePower).mul(uNoisePosAmount)
        )
      );
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(uNoiseRotAmount.greaterThan(1e-3), () => {
        ps.z.assign(ps.z.add(noiseX.mul(uNoisePower).mul(uNoiseRotAmount)));
      });
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(uNoiseSizeAmount.greaterThan(1e-3), () => {
        ps.y.assign(ps.y.add(noiseX.mul(uNoisePower).mul(uNoiseSizeAmount)));
      });
    }
    sPosition.element(i).assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(pos, 0));
    sVelocity.element(i).assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(vel, 0));
    sParticleState.element(i).assign(ps);
    sOrbitalIsActive.element(i).assign(oiaVec);
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(ps.x.greaterThan(startLife), () => {
      const deadOia = sOrbitalIsActive.element(i).toVar();
      deadOia.w.assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0));
      sOrbitalIsActive.element(i).assign(deadOia);
      sColor.element(i).assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(0));
    });
  });
  const computeNode = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_compute__(computeKernel(), maxParticles);
  return {
    computeNode,
    uniforms: {
      delta: uDelta,
      deltaMs: uDeltaMs,
      gravityVelocity: uGravityVelocity,
      worldPositionChange: uWorldPositionChange,
      simulationSpaceWorld: uSimSpaceWorld,
      noiseStrength: uNoiseStrength,
      noisePower: uNoisePower,
      noiseFrequency: uNoiseFrequency,
      noisePositionAmount: uNoisePosAmount,
      noiseRotationAmount: uNoiseRotAmount,
      noiseSizeAmount: uNoiseSizeAmount
    },
    buffers,
    curveDataLength: curveLen,
    /** Force field buffer and count uniform (null if no force fields). */
    forceFieldNodes: forceFieldNodes ? {
      buffer: forceFieldNodes.buffer,
      countUniform: forceFieldNodes.countUniform
    } : null
  };
}

// src/js/effects/three-particles/webgpu/curve-bake.ts
var CURVE_RESOLUTION2 = 256;
function bakeCurveIntoBuffer(buffer, writeOffset, particleSystemId, curve) {
  const curveFn = getCurveFunctionFromConfig(particleSystemId, curve);
  const lastIndex = CURVE_RESOLUTION2 - 1;
  for (let i = 0; i < CURVE_RESOLUTION2; i++) {
    const t = i / lastIndex;
    buffer[writeOffset + i] = curveFn(t);
  }
  return writeOffset + CURVE_RESOLUTION2;
}
function bakeVelocityAxisIntoBuffer(buffer, writeOffset, particleSystemId, value) {
  if (isLifeTimeCurve(value)) {
    return bakeCurveIntoBuffer(buffer, writeOffset, particleSystemId, value);
  }
  const constantValue = calculateValue(particleSystemId, value, 0.5);
  for (let i = 0; i < CURVE_RESOLUTION2; i++) {
    buffer[writeOffset + i] = constantValue;
  }
  return writeOffset + CURVE_RESOLUTION2;
}
function bakeParticleSystemCurves(normalizedConfig, particleSystemId) {
  let curveCount = 0;
  const {
    sizeOverLifetime,
    opacityOverLifetime,
    colorOverLifetime,
    velocityOverLifetime
  } = normalizedConfig;
  const hasSizeOverLifetime = sizeOverLifetime.isActive;
  const hasOpacityOverLifetime = opacityOverLifetime.isActive;
  const hasColorOverLifetime = colorOverLifetime.isActive;
  const isVelActive = velocityOverLifetime.isActive;
  const hasLinearVelX = isVelActive && velocityOverLifetime.linear.x !== void 0 && velocityOverLifetime.linear.x !== 0;
  const hasLinearVelY = isVelActive && velocityOverLifetime.linear.y !== void 0 && velocityOverLifetime.linear.y !== 0;
  const hasLinearVelZ = isVelActive && velocityOverLifetime.linear.z !== void 0 && velocityOverLifetime.linear.z !== 0;
  const hasOrbitalVelX = isVelActive && velocityOverLifetime.orbital.x !== void 0 && velocityOverLifetime.orbital.x !== 0;
  const hasOrbitalVelY = isVelActive && velocityOverLifetime.orbital.y !== void 0 && velocityOverLifetime.orbital.y !== 0;
  const hasOrbitalVelZ = isVelActive && velocityOverLifetime.orbital.z !== void 0 && velocityOverLifetime.orbital.z !== 0;
  if (hasSizeOverLifetime) curveCount++;
  if (hasOpacityOverLifetime) curveCount++;
  if (hasColorOverLifetime) curveCount += 3;
  if (hasLinearVelX) curveCount++;
  if (hasLinearVelY) curveCount++;
  if (hasLinearVelZ) curveCount++;
  if (hasOrbitalVelX) curveCount++;
  if (hasOrbitalVelY) curveCount++;
  if (hasOrbitalVelZ) curveCount++;
  const data = new Float32Array(curveCount * CURVE_RESOLUTION2);
  let writeOffset = 0;
  let nextIndex = 0;
  let sizeOverLifetimeIdx = -1;
  let opacityOverLifetimeIdx = -1;
  let colorRIdx = -1;
  let colorGIdx = -1;
  let colorBIdx = -1;
  let linearVelXIdx = -1;
  let linearVelYIdx = -1;
  let linearVelZIdx = -1;
  let orbitalVelXIdx = -1;
  let orbitalVelYIdx = -1;
  let orbitalVelZIdx = -1;
  if (hasSizeOverLifetime) {
    sizeOverLifetimeIdx = nextIndex++;
    writeOffset = bakeCurveIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      sizeOverLifetime.lifetimeCurve
    );
  }
  if (hasOpacityOverLifetime) {
    opacityOverLifetimeIdx = nextIndex++;
    writeOffset = bakeCurveIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      opacityOverLifetime.lifetimeCurve
    );
  }
  if (hasColorOverLifetime) {
    colorRIdx = nextIndex++;
    writeOffset = bakeCurveIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      colorOverLifetime.r
    );
    colorGIdx = nextIndex++;
    writeOffset = bakeCurveIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      colorOverLifetime.g
    );
    colorBIdx = nextIndex++;
    writeOffset = bakeCurveIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      colorOverLifetime.b
    );
  }
  if (hasLinearVelX) {
    linearVelXIdx = nextIndex++;
    writeOffset = bakeVelocityAxisIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      velocityOverLifetime.linear.x
    );
  }
  if (hasLinearVelY) {
    linearVelYIdx = nextIndex++;
    writeOffset = bakeVelocityAxisIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      velocityOverLifetime.linear.y
    );
  }
  if (hasLinearVelZ) {
    linearVelZIdx = nextIndex++;
    writeOffset = bakeVelocityAxisIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      velocityOverLifetime.linear.z
    );
  }
  if (hasOrbitalVelX) {
    orbitalVelXIdx = nextIndex++;
    writeOffset = bakeVelocityAxisIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      velocityOverLifetime.orbital.x
    );
  }
  if (hasOrbitalVelY) {
    orbitalVelYIdx = nextIndex++;
    writeOffset = bakeVelocityAxisIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      velocityOverLifetime.orbital.y
    );
  }
  if (hasOrbitalVelZ) {
    orbitalVelZIdx = nextIndex++;
    writeOffset = bakeVelocityAxisIntoBuffer(
      data,
      writeOffset,
      particleSystemId,
      velocityOverLifetime.orbital.z
    );
  }
  return {
    data,
    curveCount,
    sizeOverLifetime: sizeOverLifetimeIdx,
    opacityOverLifetime: opacityOverLifetimeIdx,
    colorR: colorRIdx,
    colorG: colorGIdx,
    colorB: colorBIdx,
    linearVelX: linearVelXIdx,
    linearVelY: linearVelYIdx,
    linearVelZ: linearVelZIdx,
    orbitalVelX: orbitalVelXIdx,
    orbitalVelY: orbitalVelYIdx,
    orbitalVelZ: orbitalVelZIdx
  };
}
var _dummyTexture = null;
function getDummyTexture() {
  if (!_dummyTexture) {
    _dummyTexture = new __WEBPACK_EXTERNAL_MODULE_three_DataTexture__(new Uint8Array([255, 255, 255, 255]), 1, 1);
    _dummyTexture.needsUpdate = true;
  }
  return _dummyTexture;
}
function createParticleUniforms(sharedUniforms) {
  const dummy = getDummyTexture();
  return {
    uMap: sharedUniforms.map.value ?? dummy,
    uElapsed: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(sharedUniforms.elapsed.value)),
    uFps: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(sharedUniforms.fps.value)),
    uUseFPSForFrameIndex: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(sharedUniforms.useFPSForFrameIndex.value ? 1 : 0)
    ),
    uTiles: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(sharedUniforms.tiles.value),
    uDiscardBg: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(sharedUniforms.discardBackgroundColor.value ? 1 : 0)
    ),
    uBgColor: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(
      new __WEBPACK_EXTERNAL_MODULE_three_Vector3__(
        sharedUniforms.backgroundColor.value.r,
        sharedUniforms.backgroundColor.value.g,
        sharedUniforms.backgroundColor.value.b
      )
    ),
    uBgTolerance: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(sharedUniforms.backgroundColorTolerance.value)),
    uSoftEnabled: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(sharedUniforms.softParticlesEnabled.value ? 1 : 0)
    ),
    uSoftIntensity: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(sharedUniforms.softParticlesIntensity.value)),
    uSceneDepthTex: sharedUniforms.sceneDepthTexture.value ?? dummy,
    uCameraNearFar: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(sharedUniforms.cameraNearFar.value)
  };
}
__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(
  ({
    vLifetime,
    vStartLifetime,
    vStartFrame,
    uFps,
    uUseFPSForFrameIndex,
    uTiles
  }) => {
    const totalFrames = uTiles.x.mul(uTiles.y);
    const lifePercent = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_min__(vLifetime.div(vStartLifetime), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1));
    const fpsBased = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_max__(vLifetime.div(1e3).mul(uFps), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0));
    const lifetimeBased = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_max__(
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_min__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(lifePercent.mul(totalFrames)), totalFrames.sub(1)),
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0)
    );
    const fpsResult = uFps.equal(0).select(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0), fpsBased);
    const frameOffset = uUseFPSForFrameIndex.greaterThan(0.5).select(fpsResult, lifetimeBased);
    return __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_round__(vStartFrame).add(frameOffset);
  }
);
__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(
  ({ baseUV, frameIndex, uTiles }) => {
    const spriteX = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mod__(frameIndex, uTiles.x));
    const spriteY = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mod__(frameIndex.div(uTiles.x), uTiles.y));
    return __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(
      baseUV.x.div(uTiles.x).add(spriteX.div(uTiles.x)),
      baseUV.y.div(uTiles.y).add(spriteY.div(uTiles.y))
    );
  }
);
var linearizeDepth = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(
  ({ depthSample, near, far }) => {
    const zNdc = depthSample.mul(2).sub(1);
    return near.mul(2).mul(far).div(far.add(near).sub(zNdc.mul(far.sub(near))));
  }
);
__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(
  ({
    viewZ,
    uSoftEnabled,
    uSoftIntensity,
    uSceneDepthTex,
    uCameraNearFar
  }) => {
    const softFade = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1).toVar();
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(uSoftEnabled.greaterThan(0.5), () => {
      const depthSample = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_texture__(uSceneDepthTex, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_screenUV__).x;
      const sceneDepthLinear = linearizeDepth({
        depthSample,
        near: uCameraNearFar.x,
        far: uCameraNearFar.y
      });
      const depthDiff = sceneDepthLinear.sub(viewZ);
      softFade.assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_smoothstep__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0), uSoftIntensity, depthDiff));
    });
    return softFade;
  }
);
__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(
  ({
    texColor,
    uDiscardBg,
    uBgColor,
    uBgTolerance
  }) => {
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(uDiscardBg.greaterThan(0.5), () => {
      const diff = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(
        texColor.x.sub(uBgColor.x),
        texColor.y.sub(uBgColor.y),
        texColor.z.sub(uBgColor.z)
      );
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_abs__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(diff)).lessThan(uBgTolerance), () => {
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__();
      });
    });
  }
);

// src/js/effects/three-particles/webgpu/tsl-instanced-billboard-material.ts
function createInstancedBillboardTSLMaterial(sharedUniforms, rendererConfig, gpuCompute = false) {
  const u = createParticleUniforms(sharedUniforms);
  const uViewportHeight = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(
    typeof sharedUniforms.viewportHeight?.value === "number" ? sharedUniforms.viewportHeight.value : 1
  );
  sharedUniforms.viewportHeight = uViewportHeight;
  const aInstanceOffset = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceOffset");
  const aColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceColor");
  const aParticleState = gpuCompute ? __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceParticleState") : null;
  const aStartValues = gpuCompute ? __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceStartValues") : null;
  const aSize = gpuCompute ? null : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceSize");
  const aLifetime = gpuCompute ? null : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceLifetime");
  const aStartLifetime = gpuCompute ? null : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceStartLifetime");
  const aRotation = gpuCompute ? null : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceRotation");
  const aStartFrame = gpuCompute ? null : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceStartFrame");
  const vColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("vec4", "vColor");
  const vLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vLifetime");
  const vStartLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vStartLifetime");
  const vRotation = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vRotation");
  const vStartFrame = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vStartFrame");
  const vUv = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("vec2", "vUv");
  const vViewZ = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vViewZ");
  const vertexNode = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(() => {
    vColor.assign(aColor.toVar());
    if (gpuCompute) {
      vLifetime.assign(aParticleState.x);
      vStartLifetime.assign(aStartValues.x);
      vRotation.assign(aParticleState.z);
      vStartFrame.assign(aParticleState.w);
    } else {
      vLifetime.assign(aLifetime);
      vStartLifetime.assign(aStartLifetime);
      vRotation.assign(aRotation);
      vStartFrame.assign(aStartFrame);
    }
    vUv.assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__.x.add(0.5), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.5).sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__.y)));
    const mvPosition = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_modelViewMatrix__.mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(aInstanceOffset.xyz, 1)).toVar();
    const dist = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(mvPosition.xyz);
    const sizeVal = gpuCompute ? aParticleState.y : aSize;
    const pointSizePx = sizeVal.mul(100).div(dist);
    const projY = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraProjectionMatrix__.element(1).element(1);
    const perspectiveSize = pointSizePx.mul(mvPosition.z.negate()).div(projY.mul(uViewportHeight).mul(0.5));
    mvPosition.x.addAssign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__.x.mul(perspectiveSize));
    mvPosition.y.addAssign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__.y.mul(perspectiveSize));
    vViewZ.assign(mvPosition.z.negate());
    return __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraProjectionMatrix__.mul(mvPosition);
  })();
  const fragmentColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(() => {
    const outColor = vColor.toVar();
    const center = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(0.5, 0.5);
    const centered = vUv.sub(center);
    const cosR = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cos__(vRotation);
    const sinR = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_sin__(vRotation);
    const rotated = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(
      centered.x.mul(cosR).add(centered.y.mul(sinR)),
      centered.x.mul(sinR).negate().add(centered.y.mul(cosR))
    );
    const rotatedUV = rotated.add(center);
    const dist = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(rotatedUV.sub(center));
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(dist.greaterThan(0.5), () => {
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__();
    });
    const totalFrames = u.uTiles.x.mul(u.uTiles.y);
    const lifePercent = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_min__(vLifetime.div(vStartLifetime), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1));
    const fpsBased = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_max__(vLifetime.div(1e3).mul(u.uFps), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0));
    const lifetimeBased = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_max__(
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_min__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(lifePercent.mul(totalFrames)), totalFrames.sub(1)),
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0)
    );
    const fpsResult = u.uFps.equal(0).select(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0), fpsBased);
    const frameOffset = u.uUseFPSForFrameIndex.greaterThan(0.5).select(fpsResult, lifetimeBased);
    const frameIndex = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_round__(vStartFrame).add(frameOffset);
    const spriteX = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mod__(frameIndex, u.uTiles.x));
    const spriteY = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mod__(frameIndex.div(u.uTiles.x), u.uTiles.y));
    const uvPoint = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(
      rotatedUV.x.div(u.uTiles.x).add(spriteX.div(u.uTiles.x)),
      rotatedUV.y.div(u.uTiles.y).add(spriteY.div(u.uTiles.y))
    );
    const texColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_texture__(u.uMap, uvPoint);
    outColor.assign(outColor.mul(texColor));
    const bgDiff = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(
      texColor.x.sub(u.uBgColor.x),
      texColor.y.sub(u.uBgColor.y),
      texColor.z.sub(u.uBgColor.z)
    );
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__(
      u.uDiscardBg.greaterThan(0.5).and(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_abs__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(bgDiff)).lessThan(u.uBgTolerance))
    );
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(u.uSoftEnabled.greaterThan(0.5), () => {
      const depthSample = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_texture__(u.uSceneDepthTex, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_screenUV__).x;
      const sceneDepthLinear = linearizeDepth({
        depthSample,
        near: u.uCameraNearFar.x,
        far: u.uCameraNearFar.y
      });
      const depthDiff = sceneDepthLinear.sub(vViewZ);
      const softFade = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_smoothstep__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0), u.uSoftIntensity, depthDiff);
      outColor.assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(outColor.xyz, outColor.w.mul(softFade)));
    });
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__(outColor.w.lessThan(1e-3));
    return outColor;
  })();
  const material = new __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_MeshBasicNodeMaterial__();
  material.transparent = rendererConfig.transparent;
  material.blending = rendererConfig.blending;
  material.depthTest = rendererConfig.depthTest;
  material.depthWrite = rendererConfig.depthWrite;
  material.vertexNode = vertexNode;
  material.colorNode = fragmentColor;
  return material;
}
var applyQuaternion = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(
  ({ v, q }) => {
    const t = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cross__(q.xyz, v).mul(2);
    return v.add(t.mul(q.w)).add(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cross__(q.xyz, t));
  }
);
function createMeshParticleTSLMaterial(sharedUniforms, rendererConfig, gpuCompute = false) {
  const u = createParticleUniforms(sharedUniforms);
  const aInstanceOffset = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceOffset");
  const aColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceColor");
  const aParticleState = gpuCompute ? __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceParticleState") : null;
  const aStartValues = gpuCompute ? __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceStartValues") : null;
  const aInstanceQuat = gpuCompute ? null : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceQuat");
  const aSize = gpuCompute ? null : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceSize");
  const aLifetime = gpuCompute ? null : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceLifetime");
  const aStartLifetime = gpuCompute ? null : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceStartLifetime");
  const aRotation = gpuCompute ? null : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceRotation");
  const aStartFrame = gpuCompute ? null : __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceStartFrame");
  const vColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("vec4", "vColor");
  const vLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vLifetime");
  const vStartLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vStartLifetime");
  const vStartFrame = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vStartFrame");
  const vRotation = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vRotation");
  const vNormal = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("vec3", "vNormal");
  const vViewZ = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vViewZ");
  const vertexSetup = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(() => {
    vColor.assign(aColor.toVar());
    if (gpuCompute) {
      vLifetime.assign(aParticleState.x);
      vStartLifetime.assign(aStartValues.x);
      vStartFrame.assign(aParticleState.w);
      vRotation.assign(aParticleState.z);
    } else {
      vLifetime.assign(aLifetime);
      vStartLifetime.assign(aStartLifetime);
      vStartFrame.assign(aStartFrame);
      vRotation.assign(aRotation);
    }
    let quat;
    if (gpuCompute) {
      const halfZ = aParticleState.z.mul(0.5);
      quat = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(0, 0, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_sin__(halfZ), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cos__(halfZ));
    } else {
      quat = aInstanceQuat;
    }
    const rotatedPos = applyQuaternion({
      v: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__,
      q: quat
    });
    const scaledPos = rotatedPos.mul(gpuCompute ? aParticleState.y : aSize);
    const worldPos = scaledPos.add(aInstanceOffset.xyz);
    const mvPos = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_modelViewMatrix__.mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(worldPos, 1));
    vViewZ.assign(mvPos.z.negate());
    const rotatedNormal = applyQuaternion({
      v: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_normalLocal__,
      q: quat
    });
    const mvNormal = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_modelViewMatrix__.mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(rotatedNormal, 0)).xyz;
    vNormal.assign(mvNormal.normalize());
    return __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraProjectionMatrix__.mul(mvPos);
  })();
  const fragmentColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(() => {
    const outColor = vColor.toVar();
    const uvPoint = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uv__()).toVar();
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(u.uTiles.x.greaterThan(1).or(u.uTiles.y.greaterThan(1)), () => {
      const totalFrames = u.uTiles.x.mul(u.uTiles.y);
      const lifePercent = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_min__(vLifetime.div(vStartLifetime), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1));
      const fpsBased = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_max__(vLifetime.div(1e3).mul(u.uFps), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0));
      const lifetimeBased = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_max__(
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_min__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(lifePercent.mul(totalFrames)), totalFrames.sub(1)),
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0)
      );
      const fpsResult = u.uFps.equal(0).select(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0), fpsBased);
      const frameOffset = u.uUseFPSForFrameIndex.greaterThan(0.5).select(fpsResult, lifetimeBased);
      const frameIndex = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_round__(vStartFrame).add(frameOffset);
      const spriteX = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mod__(frameIndex, u.uTiles.x));
      const spriteY = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mod__(frameIndex.div(u.uTiles.x), u.uTiles.y));
      uvPoint.assign(
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(
          __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uv__().x.div(u.uTiles.x).add(spriteX.div(u.uTiles.x)),
          __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uv__().y.div(u.uTiles.y).add(spriteY.div(u.uTiles.y))
        )
      );
    });
    const texColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_texture__(u.uMap, uvPoint);
    outColor.assign(outColor.mul(texColor));
    const bgDiff = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(
      texColor.x.sub(u.uBgColor.x),
      texColor.y.sub(u.uBgColor.y),
      texColor.z.sub(u.uBgColor.z)
    );
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__(
      u.uDiscardBg.greaterThan(0.5).and(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_abs__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(bgDiff)).lessThan(u.uBgTolerance))
    );
    const lightIntensity = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.5).add(
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.5).mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_max__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(vNormal, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(0, 0, 1)), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0)))
    );
    outColor.assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(outColor.xyz.mul(lightIntensity), outColor.w));
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(u.uSoftEnabled.greaterThan(0.5), () => {
      const depthSample = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_texture__(u.uSceneDepthTex, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_screenUV__).x;
      const sceneDepthLinear = linearizeDepth({
        depthSample,
        near: u.uCameraNearFar.x,
        far: u.uCameraNearFar.y
      });
      const depthDiff = sceneDepthLinear.sub(vViewZ);
      const softFade = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_smoothstep__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0), u.uSoftIntensity, depthDiff);
      outColor.assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(outColor.xyz, outColor.w.mul(softFade)));
    });
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__(outColor.w.lessThan(1e-3));
    return outColor;
  })();
  const material = new __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_MeshBasicNodeMaterial__();
  material.transparent = rendererConfig.transparent;
  material.blending = rendererConfig.blending;
  material.depthTest = rendererConfig.depthTest;
  material.depthWrite = rendererConfig.depthWrite;
  material.vertexNode = vertexSetup;
  material.colorNode = fragmentColor;
  return material;
}
function createPointSpriteTSLMaterial(sharedUniforms, rendererConfig) {
  const u = createParticleUniforms(sharedUniforms);
  const aSize = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("size");
  const aColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("color");
  const aLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("lifetime");
  const aStartLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("startLifetime");
  const aRotation = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("rotation");
  const aStartFrame = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("startFrame");
  const mvPos = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_modelViewMatrix__.mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__, 1));
  const sizeNode = aSize.mul(100).div(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(mvPos.xyz));
  const vColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("vec4", "vColor");
  const vLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vLifetime");
  const vStartLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vStartLifetime");
  const vRotation = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vRotation");
  const vStartFrame = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vStartFrame");
  const vViewZ = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vViewZ");
  const vertexSetup = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(() => {
    vColor.assign(aColor.toVar());
    vLifetime.assign(aLifetime);
    vStartLifetime.assign(aStartLifetime);
    vRotation.assign(aRotation);
    vStartFrame.assign(aStartFrame);
    vViewZ.assign(mvPos.z.negate());
    return __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__;
  })();
  const fragmentColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(() => {
    const outColor = vColor.toVar();
    const totalFrames = u.uTiles.x.mul(u.uTiles.y);
    const lifePercent = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_min__(vLifetime.div(vStartLifetime), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1));
    const fpsBased = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_max__(vLifetime.div(1e3).mul(u.uFps), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0));
    const lifetimeBased = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_max__(
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_min__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(lifePercent.mul(totalFrames)), totalFrames.sub(1)),
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0)
    );
    const fpsResult = u.uFps.equal(0).select(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0), fpsBased);
    const frameOffset = u.uUseFPSForFrameIndex.greaterThan(0.5).select(fpsResult, lifetimeBased);
    const frameIndex = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_round__(vStartFrame).add(frameOffset);
    const spriteX = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mod__(frameIndex, u.uTiles.x));
    const spriteY = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mod__(frameIndex.div(u.uTiles.x), u.uTiles.y));
    const center = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(0.5, 0.5);
    const centered = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_pointUV__.sub(center);
    const cosR = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cos__(vRotation);
    const sinR = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_sin__(vRotation);
    const rotated = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(
      centered.x.mul(cosR).add(centered.y.mul(sinR)),
      centered.x.mul(sinR).negate().add(centered.y.mul(cosR))
    );
    const rotatedUV = rotated.add(center);
    const dist = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(rotatedUV.sub(center));
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__(dist.greaterThan(0.5));
    const uvPoint = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(
      rotatedUV.x.div(u.uTiles.x).add(spriteX.div(u.uTiles.x)),
      rotatedUV.y.div(u.uTiles.y).add(spriteY.div(u.uTiles.y))
    );
    const texColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_texture__(u.uMap, uvPoint);
    outColor.assign(outColor.mul(texColor));
    const bgDiff = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(
      texColor.x.sub(u.uBgColor.x),
      texColor.y.sub(u.uBgColor.y),
      texColor.z.sub(u.uBgColor.z)
    );
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__(
      u.uDiscardBg.greaterThan(0.5).and(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_abs__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(bgDiff)).lessThan(u.uBgTolerance))
    );
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(u.uSoftEnabled.greaterThan(0.5), () => {
      const depthSample = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_texture__(u.uSceneDepthTex, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_screenUV__).x;
      const sceneDepthLinear = linearizeDepth({
        depthSample,
        near: u.uCameraNearFar.x,
        far: u.uCameraNearFar.y
      });
      const depthDiff = sceneDepthLinear.sub(vViewZ);
      const softFade = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_smoothstep__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0), u.uSoftIntensity, depthDiff);
      outColor.assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(outColor.xyz, outColor.w.mul(softFade)));
    });
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__(outColor.w.lessThan(1e-3));
    return outColor;
  })();
  const material = new __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_PointsNodeMaterial__();
  material.transparent = rendererConfig.transparent;
  material.blending = rendererConfig.blending;
  material.depthTest = rendererConfig.depthTest;
  material.depthWrite = rendererConfig.depthWrite;
  material.sizeNode = sizeNode;
  material.positionNode = vertexSetup;
  material.colorNode = fragmentColor;
  return material;
}
function createTrailUniforms(trailUniforms) {
  const dummy = getDummyTexture();
  return {
    uMap: trailUniforms.map.value ?? dummy,
    uUseMap: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(trailUniforms.useMap.value ? 1 : 0)),
    uDiscardBg: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(trailUniforms.discardBackgroundColor.value ? 1 : 0)
    ),
    uBgColor: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(
      new trailUniforms.cameraNearFar.value.constructor(
        trailUniforms.backgroundColor.value.r,
        trailUniforms.backgroundColor.value.g,
        trailUniforms.backgroundColor.value.b
      )
    ),
    uBgTolerance: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(trailUniforms.backgroundColorTolerance.value)),
    uSoftEnabled: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(trailUniforms.softParticlesEnabled.value ? 1 : 0)
    ),
    uSoftIntensity: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(trailUniforms.softParticlesIntensity.value)),
    uSceneDepthTex: trailUniforms.sceneDepthTexture.value ?? dummy,
    uCameraNearFar: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(trailUniforms.cameraNearFar.value)
  };
}
function createTrailRibbonTSLMaterial(trailUniforms, rendererConfig) {
  const u = createTrailUniforms(trailUniforms);
  const aTrailAlpha = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("trailAlpha");
  const aTrailColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("trailColor", "vec4");
  const aTrailOffset = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("trailOffset");
  const aTrailHalfWidth = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("trailHalfWidth");
  const aTrailNext = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("trailNext", "vec3");
  const aTrailUV = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("trailUV", "vec2");
  const vAlpha = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vAlpha");
  const vColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("vec4", "vColor");
  const vUv = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("vec2", "vUv");
  const vViewZ = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vViewZ");
  const positionNode = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(() => {
    vAlpha.assign(aTrailAlpha);
    vColor.assign(aTrailColor);
    vUv.assign(aTrailUV);
    const current = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__);
    const next = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(aTrailNext);
    const rawTangent = next.sub(current);
    const tangentLen = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(rawTangent);
    const tangent = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_normalize__(
      tangentLen.lessThan(1e-4).select(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(0, 1, 0), rawTangent)
    );
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_modelViewMatrix__.mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(current, 1));
    const viewDir = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_normalize__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraPosition__.sub(current));
    const rawPerp = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cross__(tangent, viewDir);
    const perpLen = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(rawPerp);
    const camRight = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraViewMatrix__.element(0).element(0),
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraViewMatrix__.element(1).element(0),
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraViewMatrix__.element(2).element(0)
    );
    const camRightDotTangent = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(camRight, tangent);
    const fallbackPerp = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_normalize__(
      camRight.sub(tangent.mul(camRightDotTangent))
    );
    const perp = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_normalize__(
      perpLen.lessThan(1e-4).select(
        fallbackPerp,
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_normalize__(
          __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mix__(
            fallbackPerp,
            __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_normalize__(rawPerp),
            __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_smoothstep__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.7), perpLen)
          )
        )
      )
    );
    const offsetPos = current.add(perp.mul(aTrailOffset).mul(aTrailHalfWidth));
    const mvOffset = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_modelViewMatrix__.mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(offsetPos, 1));
    vViewZ.assign(mvOffset.z.negate());
    return offsetPos;
  })();
  const colorNode = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(() => {
    const outColor = vColor.toVar();
    const edgeDist = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(1).sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_abs__(vUv.x.mul(2).sub(1)));
    const edgeFade = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_smoothstep__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.4), edgeDist);
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(u.uUseMap.greaterThan(0.5), () => {
      const texColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_texture__(u.uMap, vUv);
      const texBrightness = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__(texColor.rgb, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(0.299, 0.587, 0.114));
      outColor.rgb.assign(
        outColor.rgb.mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.5).add(texBrightness.mul(0.5)))
      );
      outColor.a.assign(outColor.a.mul(texColor.a));
    });
    outColor.a.assign(outColor.a.mul(vAlpha).mul(edgeFade));
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__(outColor.a.lessThan(1e-3));
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(u.uSoftEnabled.greaterThan(0.5), () => {
      const depthSample = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_texture__(u.uSceneDepthTex, __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_screenUV__).x;
      const sceneDepthLinear = linearizeDepth({
        depthSample,
        near: u.uCameraNearFar.x,
        far: u.uCameraNearFar.y
      });
      const depthDiff = sceneDepthLinear.sub(vViewZ);
      const softFade = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_smoothstep__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0), u.uSoftIntensity, depthDiff);
      outColor.a.assign(outColor.a.mul(softFade));
    });
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__(outColor.a.lessThan(1e-3));
    const diff = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(
      outColor.r.sub(u.uBgColor.x),
      outColor.g.sub(u.uBgColor.y),
      outColor.b.sub(u.uBgColor.z)
    );
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__(
      u.uDiscardBg.greaterThan(0.5).and(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_abs__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(diff)).lessThan(u.uBgTolerance))
    );
    return outColor;
  })();
  const material = new __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_MeshBasicNodeMaterial__();
  material.transparent = rendererConfig.transparent;
  material.blending = rendererConfig.blending;
  material.depthTest = rendererConfig.depthTest;
  material.depthWrite = rendererConfig.depthWrite;
  material.side = __WEBPACK_EXTERNAL_MODULE_three_DoubleSide__;
  material.positionNode = positionNode;
  material.colorNode = colorNode;
  return material;
}

// src/js/effects/three-particles/webgpu/tsl-materials.ts
function createTSLParticleMaterial(rendererType, sharedUniforms, rendererConfig, gpuCompute = false) {
  switch (rendererType) {
    case "INSTANCED" /* INSTANCED */:
      return createInstancedBillboardTSLMaterial(
        sharedUniforms,
        rendererConfig,
        gpuCompute
      );
    case "MESH" /* MESH */:
      return createMeshParticleTSLMaterial(
        sharedUniforms,
        rendererConfig,
        gpuCompute
      );
    case "POINTS" /* POINTS */:
    default:
      return createPointSpriteTSLMaterial(sharedUniforms, rendererConfig);
  }
}
function createTSLTrailMaterial(trailUniforms, rendererConfig) {
  return createTrailRibbonTSLMaterial(trailUniforms, rendererConfig);
}
function createComputePipeline(maxParticles, instanced, normalizedConfig, particleSystemId, forceFieldCount) {
  const bakedCurves = bakeParticleSystemCurves(
    normalizedConfig,
    particleSystemId
  );
  const { velocityOverLifetime } = normalizedConfig;
  const flags = {
    sizeOverLifetime: normalizedConfig.sizeOverLifetime.isActive,
    opacityOverLifetime: normalizedConfig.opacityOverLifetime.isActive,
    colorOverLifetime: normalizedConfig.colorOverLifetime.isActive,
    rotationOverLifetime: normalizedConfig.rotationOverLifetime.isActive,
    linearVelocity: velocityOverLifetime.isActive && (isLifeTimeCurve(velocityOverLifetime.linear.x ?? 0) || isLifeTimeCurve(velocityOverLifetime.linear.y ?? 0) || isLifeTimeCurve(velocityOverLifetime.linear.z ?? 0) || velocityOverLifetime.linear.x !== 0 || velocityOverLifetime.linear.y !== 0 || velocityOverLifetime.linear.z !== 0),
    orbitalVelocity: velocityOverLifetime.isActive && (isLifeTimeCurve(velocityOverLifetime.orbital.x ?? 0) || isLifeTimeCurve(velocityOverLifetime.orbital.y ?? 0) || isLifeTimeCurve(velocityOverLifetime.orbital.z ?? 0) || velocityOverLifetime.orbital.x !== 0 || velocityOverLifetime.orbital.y !== 0 || velocityOverLifetime.orbital.z !== 0),
    noise: normalizedConfig.noise.isActive,
    forceFields: forceFieldCount > 0
  };
  const buffers = createModifierStorageBuffers(
    maxParticles,
    instanced,
    bakedCurves.data
  );
  return createModifierComputeUpdate(
    buffers,
    maxParticles,
    bakedCurves,
    flags,
    forceFieldCount
  );
}


//# sourceMappingURL=webgpu.js.map
//# sourceMappingURL=webgpu.js.map
export { createComputePipeline, createTSLParticleMaterial, createTSLTrailMaterial, deactivateParticleInModifierBuffers, encodeForceFieldsForGPU, flushEmitQueue, registerCurveDataLength, writeParticleToModifierBuffers };
