const ParticleSystemVertexShader = `
  attribute float startSize;
  attribute float colorR;
  attribute float colorG;
  attribute float colorB;
  attribute float colorA;
  attribute float lifeTime;
  attribute float rotation;

  varying mat4 vPosition;
  varying vec4 vColor;
  varying float vLifeTime;
  varying float vRotation;

  void main()
  {
    vColor = vec4(colorR, colorG, colorB, colorA);
    vLifeTime = lifeTime;
    vRotation = rotation;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = startSize * (100.0 / length(mvPosition.xyz));
    gl_Position = projectionMatrix * mvPosition;
  }
`

export default ParticleSystemVertexShader
