const InstancedParticleVertexShader = `
  attribute float instanceSize;
  attribute float instanceColorR;
  attribute float instanceColorG;
  attribute float instanceColorB;
  attribute float instanceColorA;
  attribute float instanceLifetime;
  attribute float instanceStartLifetime;
  attribute float instanceRotation;
  attribute float instanceStartFrame;
  attribute vec3 instanceOffset;

  varying vec2 vUv;
  varying vec4 vColor;
  varying float vLifetime;
  varying float vStartLifetime;
  varying float vStartFrame;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main()
  {
    vColor = vec4(instanceColorR, instanceColorG, instanceColorB, instanceColorA);
    vLifetime = instanceLifetime;
    vStartLifetime = instanceStartLifetime;
    vStartFrame = instanceStartFrame;

    // Billboard: rotate the quad vertex to face the camera
    float cosR = cos(instanceRotation);
    float sinR = sin(instanceRotation);
    mat2 rot = mat2(cosR, sinR, -sinR, cosR);
    vec2 rotatedPosition = rot * position.xy;

    vec4 mvPosition = modelViewMatrix * vec4(instanceOffset, 1.0);
    // Scale the quad by instanceSize and apply perspective
    mvPosition.xy += rotatedPosition * instanceSize;

    gl_Position = projectionMatrix * mvPosition;

    // Pass UV for texture sampling (quad ranges from -0.5..0.5, map to 0..1)
    vUv = position.xy + 0.5;

    #include <logdepthbuf_vertex>
  }
`;

export default InstancedParticleVertexShader;
