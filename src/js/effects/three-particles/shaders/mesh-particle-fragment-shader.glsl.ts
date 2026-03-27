const MeshParticleFragmentShader = `
  uniform sampler2D map;
  uniform float elapsed;
  uniform float fps;
  uniform bool useFPSForFrameIndex;
  uniform vec2 tiles;
  uniform bool discardBackgroundColor;
  uniform vec3 backgroundColor;
  uniform float backgroundColorTolerance;

  varying vec4 vColor;
  varying float vLifetime;
  varying float vStartLifetime;
  varying float vStartFrame;
  varying float vRotation;
  varying vec3 vNormal;
  varying vec2 vUv;

  #include <common>
  #include <logdepthbuf_pars_fragment>

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

    #include <logdepthbuf_fragment>
  }
`;

export default MeshParticleFragmentShader;
