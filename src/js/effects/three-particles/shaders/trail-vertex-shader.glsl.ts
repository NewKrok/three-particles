const TrailVertexShader = `
  attribute float trailAlpha;
  attribute vec4 trailColor;
  attribute float trailOffset;
  attribute float trailHalfWidth;
  attribute vec3 trailNext;
  attribute vec2 trailUV;

  varying float vAlpha;
  varying vec4 vColor;
  varying vec2 vUv;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main()
  {
    vAlpha = trailAlpha;
    vColor = trailColor;
    vUv = trailUV;

    // Compute tangent from current position to next sample
    vec3 tangent = trailNext - position;
    float tangentLen = length(tangent);
    if (tangentLen < 0.0001) {
      tangent = vec3(0.0, 1.0, 0.0);
    } else {
      tangent = tangent / tangentLen;
    }

    // Billboard: perpendicular = cross(tangent, viewDirection)
    vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 viewDir = normalize(cameraPosition - worldPos);
    vec3 perp = cross(tangent, viewDir);
    float perpLen = length(perp);

    // When tangent is nearly parallel to view direction, the cross product
    // collapses and the ribbon becomes edge-on (invisible). Build a stable
    // fallback perpendicular from the camera's right axis — this keeps the
    // ribbon in screen-space and prevents it from flipping into an arbitrary
    // plane when viewed edge-on.
    vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 fallbackPerp = normalize(camRight - tangent * dot(camRight, tangent));

    if (perpLen < 0.0001) {
      perp = fallbackPerp;
    } else {
      perp = perp / perpLen;
      // Smoothly blend toward the fallback when the billboard perp weakens.
      // The wide range (0..0.7) ensures a gradual transition so the ribbon
      // does not snap abruptly when rotating toward edge-on.
      float blendFactor = smoothstep(0.0, 0.7, perpLen);
      perp = normalize(mix(fallbackPerp, perp, blendFactor));
    }

    vec3 offsetPos = position + perp * trailOffset * trailHalfWidth;
    vec4 mvPosition = modelViewMatrix * vec4(offsetPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    #include <logdepthbuf_vertex>
  }
`;

export default TrailVertexShader;
