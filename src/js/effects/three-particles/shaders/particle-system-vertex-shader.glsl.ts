const ParticleSystemVertexShader = `
  attribute float size;
  attribute vec4 color;
  attribute float lifetime;
  attribute float startLifetime;
  attribute float rotation;
  attribute float startFrame;

  varying mat4 vPosition;
  varying vec4 vColor;
  varying float vLifetime;
  varying float vStartLifetime;
  varying float vRotation;
  varying float vStartFrame;
  varying float vViewZ;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main()
  {
    vColor = color;
    vLifetime = lifetime;
    vStartLifetime = startLifetime;
    vRotation = rotation;
    vStartFrame = startFrame;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (100.0 / length(mvPosition.xyz));
    vViewZ = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;

    #include <logdepthbuf_vertex>
  }
`;

export default ParticleSystemVertexShader;
