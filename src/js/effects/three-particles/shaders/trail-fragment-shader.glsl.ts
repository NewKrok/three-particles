const TrailFragmentShader = `
  uniform sampler2D map;
  uniform bool useMap;
  uniform bool discardBackgroundColor;
  uniform vec3 backgroundColor;
  uniform float backgroundColorTolerance;

  varying float vAlpha;
  varying vec4 vColor;
  varying vec2 vUv;

  #include <common>
  #include <logdepthbuf_pars_fragment>

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

    if (discardBackgroundColor && abs(length(gl_FragColor.rgb - backgroundColor.rgb)) < backgroundColorTolerance) discard;

    #include <logdepthbuf_fragment>
  }
`;

export default TrailFragmentShader;
