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
  varying float vRotation;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main()
  {
    vColor = vec4(instanceColorR, instanceColorG, instanceColorB, instanceColorA);
    vLifetime = instanceLifetime;
    vStartLifetime = instanceStartLifetime;
    vStartFrame = instanceStartFrame;
    vRotation = instanceRotation;

    vec4 mvPosition = modelViewMatrix * vec4(instanceOffset, 1.0);

    // Perspective-correct size: match Points renderer behaviour
    // (size * 100.0 / distance) so particles shrink with distance.
    float perspectiveSize = instanceSize * (100.0 / length(mvPosition.xyz));

    // Billboard: offset quad vertices in view space (no rotation here;
    // rotation is applied to UVs in the fragment shader to keep behaviour
    // identical to the Points renderer).
    mvPosition.xy += position.xy * perspectiveSize;

    gl_Position = projectionMatrix * mvPosition;

    // Pass UV for texture sampling (quad ranges from -0.5..0.5, map to 0..1)
    vUv = position.xy + 0.5;

    #include <logdepthbuf_vertex>
  }
`;

export default InstancedParticleVertexShader;
