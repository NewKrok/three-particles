const ParticleSystemFragmentShader = `
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
  varying float vRotation;
  varying float vStartFrame;
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
    float mid = 0.5;

    float frameIndex = round(vStartFrame) + (
      useFPSForFrameIndex == true
        ? fps == 0.0
            ? 0.0
            : max((vLifetime / 1000.0) * fps, 0.0)
        : max(min(floor(min(vLifetime / vStartLifetime, 1.0) * (tiles.x * tiles.y)), tiles.x * tiles.y - 1.0), 0.0)
    );
        
    float spriteXIndex = floor(mod(frameIndex, tiles.x));
    float spriteYIndex = floor(mod(frameIndex / tiles.x, tiles.y));

    vec2 frameUV = vec2(
      gl_PointCoord.x / tiles.x + spriteXIndex / tiles.x,
      gl_PointCoord.y / tiles.y + spriteYIndex / tiles.y);

    vec2 center = vec2(0.5, 0.5);
    vec2 centeredPoint = gl_PointCoord - center;

    mat2 rotation = mat2(
      cos(vRotation), sin(vRotation),
      -sin(vRotation), cos(vRotation)
    );

    centeredPoint = rotation * centeredPoint;
    vec2 centeredMiddlePoint = vec2(
      centeredPoint.x + center.x,
      centeredPoint.y + center.y
    );

    float dist = distance(centeredMiddlePoint, center);
    if (dist > 0.5) discard;

    vec2 uvPoint = vec2(
      centeredMiddlePoint.x / tiles.x + spriteXIndex / tiles.x,
      centeredMiddlePoint.y / tiles.y + spriteYIndex / tiles.y
    );

    vec4 rotatedTexture = texture2D(map, uvPoint);

    gl_FragColor = gl_FragColor * rotatedTexture;

    if (discardBackgroundColor && abs(length(rotatedTexture.rgb - backgroundColor.rgb)) < backgroundColorTolerance) discard;

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
    #include <colorspace_fragment>
  }
`;

export default ParticleSystemFragmentShader;
