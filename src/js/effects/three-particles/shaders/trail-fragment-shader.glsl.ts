const TrailFragmentShader = `
  uniform sampler2D map;
  uniform bool useMap;
  uniform bool discardBackgroundColor;
  uniform vec3 backgroundColor;
  uniform float backgroundColorTolerance;
  uniform bool softParticlesEnabled;
  uniform float softParticlesIntensity;
  uniform sampler2D sceneDepthTexture;
  uniform vec2 cameraNearFar;

  varying float vAlpha;
  varying vec4 vColor;
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
    // Soft edge: always fade near ribbon edges
    float edgeDist = 1.0 - abs(vUv.x * 2.0 - 1.0);
    float softEdge = smoothstep(0.0, 0.4, edgeDist);

    gl_FragColor = vColor;

    if (useMap) {
      // Use texture luminance as brightness modulation on top of soft edge
      vec4 texColor = texture2D(map, vUv);
      float texBrightness = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
      gl_FragColor.rgb *= (0.5 + texBrightness * 0.5);
      gl_FragColor.a *= texColor.a;
    }

    gl_FragColor.a *= vAlpha * softEdge;

    if (gl_FragColor.a < 0.001) discard;

    if (softParticlesEnabled) {
      vec2 screenUV = gl_FragCoord.xy / vec2(textureSize(sceneDepthTexture, 0));
      float sceneDepthSample = texture2D(sceneDepthTexture, screenUV).r;
      float sceneDepthLinear = linearizeDepth(sceneDepthSample, cameraNearFar.x, cameraNearFar.y);
      float depthDiff = sceneDepthLinear - vViewZ;
      float softFade = smoothstep(0.0, softParticlesIntensity, depthDiff);
      gl_FragColor.a *= softFade;
      if (gl_FragColor.a < 0.001) discard;
    }

    if (discardBackgroundColor && abs(length(gl_FragColor.rgb - backgroundColor.rgb)) < backgroundColorTolerance) discard;

    #include <logdepthbuf_fragment>
  }
`;

export default TrailFragmentShader;
