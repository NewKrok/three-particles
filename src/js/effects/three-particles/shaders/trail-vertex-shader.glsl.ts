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
    // collapses and the ribbon becomes edge-on (invisible). Use a secondary
    // perpendicular from cross(tangent, up) and blend it in to guarantee
    // a minimum visible width.
    vec3 upPerp = cross(tangent, vec3(0.0, 1.0, 0.0));
    float upPerpLen = length(upPerp);
    if (upPerpLen < 0.0001) {
      upPerp = cross(tangent, vec3(1.0, 0.0, 0.0));
      upPerpLen = length(upPerp);
    }
    upPerp = upPerp / max(upPerpLen, 0.0001);

    if (perpLen < 0.0001) {
      perp = upPerp;
    } else {
      perp = perp / perpLen;
      // Blend in the secondary perp when billboard perp gets weak
      float blendFactor = smoothstep(0.0, 0.5, perpLen);
      perp = normalize(mix(upPerp, perp, blendFactor));
    }

    vec3 offsetPos = position + perp * trailOffset * trailHalfWidth;
    vec4 mvPosition = modelViewMatrix * vec4(offsetPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    #include <logdepthbuf_vertex>
  }
`;

export default TrailVertexShader;
