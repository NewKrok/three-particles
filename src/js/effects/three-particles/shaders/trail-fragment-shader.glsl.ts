const TrailFragmentShader = `
  uniform sampler2D map;
  uniform bool discardBackgroundColor;
  uniform vec3 backgroundColor;
  uniform float backgroundColorTolerance;

  varying float vAlpha;
  varying vec4 vColor;

  #include <common>
  #include <logdepthbuf_pars_fragment>

  void main()
  {
    gl_FragColor = vColor;
    gl_FragColor.a *= vAlpha;

    if (gl_FragColor.a < 0.001) discard;

    if (discardBackgroundColor && abs(length(gl_FragColor.rgb - backgroundColor.rgb)) < backgroundColorTolerance) discard;

    #include <logdepthbuf_fragment>
  }
`;

export default TrailFragmentShader;
