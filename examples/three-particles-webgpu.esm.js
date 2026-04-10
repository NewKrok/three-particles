import { Discard as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__, Fn as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__, If as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__, abs as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_abs__, attribute as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__, cameraPosition as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraPosition__, cameraProjectionMatrix as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraProjectionMatrix__, cameraViewMatrix as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraViewMatrix__, cos as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cos__, cross as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cross__, dot as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_dot__, float as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__, floor as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_floor__, length as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__, max as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_max__, min as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_min__, mix as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mix__, mod as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_mod__, modelViewMatrix as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_modelViewMatrix__, normalLocal as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_normalLocal__, normalize as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_normalize__, pointUV as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_pointUV__, positionLocal as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__, round as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_round__, screenUV as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_screenUV__, sin as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_sin__, smoothstep as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_smoothstep__, texture as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_texture__, uniform as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__, uv as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uv__, varyingProperty as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__, vec2 as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__, vec3 as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__, vec4 as __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__ } from "three/tsl";
import { MeshBasicNodeMaterial as __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_MeshBasicNodeMaterial__, PointsNodeMaterial as __WEBPACK_EXTERNAL_MODULE_three_webgpu_84e9d76f_PointsNodeMaterial__ } from "three/webgpu";
import { DataTexture as __WEBPACK_EXTERNAL_MODULE_three_DataTexture__, DoubleSide as __WEBPACK_EXTERNAL_MODULE_three_DoubleSide__, Vector3 as __WEBPACK_EXTERNAL_MODULE_three_Vector3__ } from "three";
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

;// external "three/tsl"

;// external "three/webgpu"

;// external "three"

;// ./dist/webgpu.js




// src/js/effects/three-particles/webgpu/tsl-instanced-billboard-material.ts
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
      const diff = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(
        texColor.x.sub(uBgColor.x),
        texColor.y.sub(uBgColor.y),
        texColor.z.sub(uBgColor.z),
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0)
      );
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_If__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_abs__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(diff.xyz)).lessThan(uBgTolerance), () => {
        __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__();
      });
    });
  }
);

// src/js/effects/three-particles/webgpu/tsl-instanced-billboard-material.ts
function createInstancedBillboardTSLMaterial(sharedUniforms, rendererConfig) {
  const u = createParticleUniforms(sharedUniforms);
  const uViewportHeight = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_uniform__(
    typeof sharedUniforms.viewportHeight?.value === "number" ? sharedUniforms.viewportHeight.value : 1
  );
  sharedUniforms.viewportHeight = uViewportHeight;
  const aInstanceOffset = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceOffset");
  const aInstanceSize = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceSize");
  const aColorR = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceColorR");
  const aColorG = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceColorG");
  const aColorB = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceColorB");
  const aColorA = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceColorA");
  const aLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceLifetime");
  const aStartLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceStartLifetime");
  const aRotation = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceRotation");
  const aStartFrame = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceStartFrame");
  const vColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("vec4", "vColor");
  const vLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vLifetime");
  const vStartLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vStartLifetime");
  const vRotation = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vRotation");
  const vStartFrame = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vStartFrame");
  const vUv = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("vec2", "vUv");
  const vViewZ = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vViewZ");
  const vertexNode = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(() => {
    vColor.assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(aColorR, aColorG, aColorB, aColorA));
    vLifetime.assign(aLifetime);
    vStartLifetime.assign(aStartLifetime);
    vRotation.assign(aRotation);
    vStartFrame.assign(aStartFrame);
    vUv.assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec2__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__.x.add(0.5), __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0.5).sub(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__.y)));
    const mvPosition = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_modelViewMatrix__.mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(aInstanceOffset, 1)).toVar();
    const dist = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(mvPosition.xyz);
    const pointSizePx = aInstanceSize.mul(100).div(dist);
    const projY = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraProjectionMatrix__.element(1).element(1);
    const perspectiveSize = pointSizePx.mul(mvPosition.z.negate()).div(projY.mul(uViewportHeight).mul(0.5));
    mvPosition.x.addAssign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__.x.mul(perspectiveSize));
    mvPosition.y.addAssign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__.y.mul(perspectiveSize));
    vViewZ.assign(mvPosition.z.negate());
    return __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraProjectionMatrix__.mul(mvPosition);
  })();
  const fragmentColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(() => {
    const outColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(vColor).toVar();
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
    const bgDiff = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(
      texColor.x.sub(u.uBgColor.x),
      texColor.y.sub(u.uBgColor.y),
      texColor.z.sub(u.uBgColor.z),
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0)
    );
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__(
      u.uDiscardBg.greaterThan(0.5).and(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_abs__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(bgDiff.xyz)).lessThan(u.uBgTolerance))
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
function createMeshParticleTSLMaterial(sharedUniforms, rendererConfig) {
  const u = createParticleUniforms(sharedUniforms);
  const aInstanceOffset = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceOffset");
  const aInstanceQuat = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceQuat");
  const aInstanceSize = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceSize");
  const aColorR = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceColorR");
  const aColorG = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceColorG");
  const aColorB = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceColorB");
  const aColorA = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceColorA");
  const aLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceLifetime");
  const aStartLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceStartLifetime");
  const aRotation = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceRotation");
  const aStartFrame = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("instanceStartFrame");
  const vColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("vec4", "vColor");
  const vLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vLifetime");
  const vStartLifetime = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vStartLifetime");
  const vStartFrame = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vStartFrame");
  const vRotation = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vRotation");
  const vNormal = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("vec3", "vNormal");
  const vViewZ = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_varyingProperty__("float", "vViewZ");
  const vertexSetup = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(() => {
    vColor.assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(aColorR, aColorG, aColorB, aColorA));
    vLifetime.assign(aLifetime);
    vStartLifetime.assign(aStartLifetime);
    vStartFrame.assign(aStartFrame);
    vRotation.assign(aRotation);
    const rotatedPos = applyQuaternion({
      v: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__),
      q: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(aInstanceQuat)
    });
    const scaledPos = rotatedPos.mul(aInstanceSize);
    const worldPos = scaledPos.add(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(aInstanceOffset));
    const mvPos = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_modelViewMatrix__.mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(worldPos, 1));
    vViewZ.assign(mvPos.z.negate());
    const rotatedNormal = applyQuaternion({
      v: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec3__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_normalLocal__),
      q: __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(aInstanceQuat)
    });
    const mvNormal = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_modelViewMatrix__.mul(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(rotatedNormal, 0)).xyz;
    vNormal.assign(mvNormal.normalize());
    return __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_cameraProjectionMatrix__.mul(mvPos);
  })();
  const fragmentColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(() => {
    const outColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(vColor).toVar();
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
    const bgDiff = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(
      texColor.x.sub(u.uBgColor.x),
      texColor.y.sub(u.uBgColor.y),
      texColor.z.sub(u.uBgColor.z),
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0)
    );
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__(
      u.uDiscardBg.greaterThan(0.5).and(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_abs__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(bgDiff.xyz)).lessThan(u.uBgTolerance))
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
  const aColorR = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("colorR");
  const aColorG = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("colorG");
  const aColorB = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("colorB");
  const aColorA = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_attribute__("colorA");
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
    vColor.assign(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(aColorR, aColorG, aColorB, aColorA));
    vLifetime.assign(aLifetime);
    vStartLifetime.assign(aStartLifetime);
    vRotation.assign(aRotation);
    vStartFrame.assign(aStartFrame);
    vViewZ.assign(mvPos.z.negate());
    return __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_positionLocal__;
  })();
  const fragmentColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Fn__(() => {
    const outColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(vColor).toVar();
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
    const bgDiff = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(
      texColor.x.sub(u.uBgColor.x),
      texColor.y.sub(u.uBgColor.y),
      texColor.z.sub(u.uBgColor.z),
      __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_float__(0)
    );
    __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_Discard__(
      u.uDiscardBg.greaterThan(0.5).and(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_abs__(__WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_length__(bgDiff.xyz)).lessThan(u.uBgTolerance))
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
    const outColor = __WEBPACK_EXTERNAL_MODULE_three_tsl_3a8d0cc7_vec4__(vColor).toVar();
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
function createTSLParticleMaterial(rendererType, sharedUniforms, rendererConfig) {
  switch (rendererType) {
    case "INSTANCED" /* INSTANCED */:
      return createInstancedBillboardTSLMaterial(
        sharedUniforms,
        rendererConfig
      );
    case "MESH" /* MESH */:
      return createMeshParticleTSLMaterial(sharedUniforms, rendererConfig);
    case "POINTS" /* POINTS */:
    default:
      return createPointSpriteTSLMaterial(sharedUniforms, rendererConfig);
  }
}
function createTSLTrailMaterial(trailUniforms, rendererConfig) {
  return createTrailRibbonTSLMaterial(trailUniforms, rendererConfig);
}


//# sourceMappingURL=webgpu.js.map
//# sourceMappingURL=webgpu.js.map
export { createTSLParticleMaterial, createTSLTrailMaterial };
