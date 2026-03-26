const TrailVertexShader = `
  attribute float trailAlpha;
  attribute vec4 trailColor;

  varying float vAlpha;
  varying vec4 vColor;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main()
  {
    vAlpha = trailAlpha;
    vColor = trailColor;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    #include <logdepthbuf_vertex>
  }
`;

export default TrailVertexShader;
