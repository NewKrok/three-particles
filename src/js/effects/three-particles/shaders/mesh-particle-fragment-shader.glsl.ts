const MeshParticleFragmentShader = `
  uniform sampler2D map;
  uniform float elapsed;
  uniform float fps;
  uniform bool useFPSForFrameIndex;
  uniform vec2 tiles;
  uniform bool discardBackgroundColor;
  uniform vec3 backgroundColor;
  uniform float backgroundColorTolerance;
  uniform bool softParticlesEnabled;
  uniform float softParticlesIntensity;
  uniform sampler2D sceneDepthTexture;
  uniform vec2 cameraNearFar;

  varying vec4 vColor;
  varying float vLifetime;
  varying float vStartLifetime;
  varying float vStartFrame;
  varying float vRotation;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying float vViewZ;

  #include <common>
  #include <logdepthbuf_pars_fragment>

  float linearizeDepth(float depthSample, float near, float far) {
    float z_ndc = 2.0 * depthSample - 1.0;
    return 2.0 * near * far / (far + near - z_ndc * (far - near));
  }

  void main()
  {
    gl_FragColor = vColor;

    // Use mesh UVs directly for texture sampling
    vec2 uvPoint = vUv;

    // Apply texture sheet animation if tiles > 1x1
    if (tiles.x > 1.0 || tiles.y > 1.0) {
      float frameIndex = round(vStartFrame) + (
        useFPSForFrameIndex == true
          ? fps == 0.0
              ? 0.0
              : max((vLifetime / 1000.0) * fps, 0.0)
          : max(min(floor(min(vLifetime / vStartLifetime, 1.0) * (tiles.x * tiles.y)), tiles.x * tiles.y - 1.0), 0.0)
      );

      float spriteXIndex = floor(mod(frameIndex, tiles.x));
      float spriteYIndex = floor(mod(frameIndex / tiles.x, tiles.y));

      uvPoint = vec2(
        vUv.x / tiles.x + spriteXIndex / tiles.x,
        vUv.y / tiles.y + spriteYIndex / tiles.y
      );
    }

    vec4 texColor = texture2D(map, uvPoint);
    gl_FragColor = gl_FragColor * texColor;

    if (discardBackgroundColor && abs(length(texColor.rgb - backgroundColor.rgb)) < backgroundColorTolerance) discard;

    // Simple directional lighting from camera direction
    float lightIntensity = 0.5 + 0.5 * max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
    gl_FragColor.rgb *= lightIntensity;

    if (softParticlesEnabled) {
      vec2 screenUV = gl_FragCoord.xy / vec2(textureSize(sceneDepthTexture, 0));
      float sceneDepthSample = texture2D(sceneDepthTexture, screenUV).r;
      float sceneDepthLinear = linearizeDepth(sceneDepthSample, cameraNearFar.x, cameraNearFar.y);
      float depthDiff = sceneDepthLinear - vViewZ;
      float softFade = smoothstep(0.0, softParticlesIntensity, depthDiff);
      gl_FragColor.a *= softFade;
      if (gl_FragColor.a < 0.001) discard;
    }

    #include <logdepthbuf_fragment>
  }
`;

export default MeshParticleFragmentShader;
