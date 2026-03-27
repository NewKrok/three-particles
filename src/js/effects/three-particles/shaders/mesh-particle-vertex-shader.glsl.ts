const MeshParticleVertexShader = `
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
  attribute float instanceQuatX;
  attribute float instanceQuatY;
  attribute float instanceQuatZ;
  attribute float instanceQuatW;

  varying vec4 vColor;
  varying float vLifetime;
  varying float vStartLifetime;
  varying float vStartFrame;
  varying float vRotation;
  varying vec3 vNormal;
  varying vec2 vUv;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  vec3 applyQuaternion(vec3 v, vec4 q) {
    vec3 t = 2.0 * cross(q.xyz, v);
    return v + q.w * t + cross(q.xyz, t);
  }

  void main()
  {
    vColor = vec4(instanceColorR, instanceColorG, instanceColorB, instanceColorA);
    vLifetime = instanceLifetime;
    vStartLifetime = instanceStartLifetime;
    vStartFrame = instanceStartFrame;
    vRotation = instanceRotation;

    // Apply quaternion rotation to the mesh vertex position
    vec4 quat = vec4(instanceQuatX, instanceQuatY, instanceQuatZ, instanceQuatW);
    vec3 rotatedPosition = applyQuaternion(position, quat);

    // Scale mesh by particle size
    vec3 scaledPosition = rotatedPosition * instanceSize;

    // Apply instance offset (particle world position)
    vec3 worldPos = scaledPosition + instanceOffset;

    vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Transform normal by quaternion for lighting
    vNormal = normalize((modelViewMatrix * vec4(applyQuaternion(normal, quat), 0.0)).xyz);

    // Pass through UVs from the mesh geometry
    vUv = uv;

    #include <logdepthbuf_vertex>
  }
`;

export default MeshParticleVertexShader;
