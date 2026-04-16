const InstancedParticleVertexShader = `
  attribute float instanceSize;
  attribute vec4 instanceColor;
  attribute float instanceLifetime;
  attribute float instanceStartLifetime;
  attribute float instanceRotation;
  attribute float instanceStartFrame;
  attribute vec3 instanceOffset;

  uniform float viewportHeight;

  varying vec2 vUv;
  varying vec4 vColor;
  varying float vLifetime;
  varying float vStartLifetime;
  varying float vStartFrame;
  varying float vRotation;
  varying float vViewZ;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main()
  {
    // Early-out for dead particles: skip all transforms and emit a degenerate
    // position that produces zero-area triangles.
    if (instanceColor.a <= 0.0) {
      gl_Position = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }

    vColor = instanceColor;
    vLifetime = instanceLifetime;
    vStartLifetime = instanceStartLifetime;
    vStartFrame = instanceStartFrame;
    vRotation = instanceRotation;

    vec4 mvPosition = modelViewMatrix * vec4(instanceOffset, 1.0);

    // Match the Points renderer pixel size: gl_PointSize = size * 100.0 / distance.
    // A view-space offset of d produces d * projectionMatrix[1][1] / w * (viewportHeight/2) pixels,
    // where w = -mvPosition.z for perspective.  Solving for d so the result equals
    // the gl_PointSize pixel count:
    //   d = size * 100.0 / distance
    //       * (-mvPosition.z)
    //       / (projectionMatrix[1][1] * viewportHeight * 0.5)
    // Since distance ≈ -mvPosition.z for view-aligned particles the two cancel out,
    // leaving a distance-independent expression.  We keep them explicit so particles
    // off the viewing axis still scale correctly.
    float dist = length(mvPosition.xyz);
    float pointSizePx = instanceSize * 100.0 / dist;
    float perspectiveSize = pointSizePx * (-mvPosition.z)
                          / (projectionMatrix[1][1] * viewportHeight * 0.5);

    // Billboard: offset quad vertices in view space (no rotation here;
    // rotation is applied to UVs in the fragment shader to keep behaviour
    // identical to the Points renderer).
    mvPosition.xy += position.xy * perspectiveSize;

    vViewZ = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;

    // Pass UV for texture sampling (quad ranges from -0.5..0.5, map to 0..1).
    // Flip Y to match gl_PointCoord convention (Y runs top-to-bottom).
    vUv = vec2(position.x + 0.5, 0.5 - position.y);

    #include <logdepthbuf_vertex>
  }
`;

export default InstancedParticleVertexShader;
