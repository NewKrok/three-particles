const InstancedParticleFragmentShader = `
  uniform sampler2D map;
  uniform float elapsed;
  uniform float fps;
  uniform bool useFPSForFrameIndex;
  uniform vec2 tiles;
  uniform bool discardBackgroundColor;
  uniform vec3 backgroundColor;
  uniform float backgroundColorTolerance;

  varying vec2 vUv;
  varying vec4 vColor;
  varying float vLifetime;
  varying float vStartLifetime;
  varying float vStartFrame;

  #include <common>
  #include <logdepthbuf_pars_fragment>

  void main()
  {
    gl_FragColor = vColor;

    // Discard pixels outside the inscribed circle (same as Points renderer)
    float dist = distance(vUv, vec2(0.5));
    if (dist > 0.5) discard;

    float frameIndex = round(vStartFrame) + (
      useFPSForFrameIndex == true
        ? fps == 0.0
            ? 0.0
            : max((vLifetime / 1000.0) * fps, 0.0)
        : max(min(floor(min(vLifetime / vStartLifetime, 1.0) * (tiles.x * tiles.y)), tiles.x * tiles.y - 1.0), 0.0)
    );

    float spriteXIndex = floor(mod(frameIndex, tiles.x));
    float spriteYIndex = floor(mod(frameIndex / tiles.x, tiles.y));

    vec2 uvPoint = vec2(
      vUv.x / tiles.x + spriteXIndex / tiles.x,
      vUv.y / tiles.y + spriteYIndex / tiles.y
    );

    vec4 rotatedTexture = texture2D(map, uvPoint);

    gl_FragColor = gl_FragColor * rotatedTexture;

    if (discardBackgroundColor && abs(length(rotatedTexture.rgb - backgroundColor.rgb)) < backgroundColorTolerance) discard;

    #include <logdepthbuf_fragment>
  }
`;

export default InstancedParticleFragmentShader;
