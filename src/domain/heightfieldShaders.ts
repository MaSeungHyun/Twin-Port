import { OCEAN_SHIP_MAX } from "@/constants/ocean";

/** jeantimex/threejs-water 시뮬 패스. MIT. https://github.com/jeantimex/threejs-water */

export const SIM_QUAD_VERT = /* glsl */ `
varying vec2 coord;

void main() {
  coord = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xyz, 1.0);
}
`;

export const WAVE_SIM_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tInput;
uniform sampler2D tLand;
uniform vec2 delta;
uniform float poolWidth;
uniform float poolLength;

varying vec2 coord;

float landAt(vec2 uv) {
  return texture2D(tLand, clamp(uv, 0.0, 1.0)).r;
}

void main() {
  vec4 info = texture2D(tInput, coord);
  float land = landAt(coord);
  vec2 dx = vec2(delta.x, 0.0);
  vec2 dy = vec2(0.0, delta.y);
  float hC = info.r;
  float hE = mix(texture2D(tInput, coord + dx).r, hC, landAt(coord + dx));
  float hW = mix(texture2D(tInput, coord - dx).r, hC, landAt(coord - dx));
  float hN = mix(texture2D(tInput, coord + dy).r, hC, landAt(coord + dy));
  float hS = mix(texture2D(tInput, coord - dy).r, hC, landAt(coord - dy));

  float d2h_dx2 = hE + hW - 2.0 * hC;
  float d2h_dz2 = hN + hS - 2.0 * hC;

  float stabilityScale = min(1.0, min(poolWidth * poolWidth, poolLength * poolLength));
  info.g += 0.5 * stabilityScale * (
    d2h_dx2 / (poolWidth * poolWidth) + d2h_dz2 / (poolLength * poolLength)
  );
  info.g *= 0.995;
  info.r += info.g;

  float edge =
    smoothstep(0.0, 0.04, coord.x) *
    smoothstep(1.0, 0.96, coord.x) *
    smoothstep(0.0, 0.04, coord.y) *
    smoothstep(1.0, 0.96, coord.y);
  info.r *= edge * (1.0 - land);
  info.g *= edge * (1.0 - land);

  gl_FragColor = info;
}
`;

export const WATER_NORMAL_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tInput;
uniform float poolWidth;
uniform float poolLength;
uniform vec2 delta;

varying vec2 coord;

void main() {
  vec4 info = texture2D(tInput, coord);
  vec3 dx = vec3(
    delta.x * 2.0 * poolWidth,
    texture2D(tInput, vec2(coord.x + delta.x, coord.y)).r - info.r,
    0.0
  );
  vec3 dy = vec3(
    0.0,
    texture2D(tInput, vec2(coord.x, coord.y + delta.y)).r - info.r,
    delta.y * 2.0 * poolLength
  );
  info.ba = normalize(cross(dy, dx)).xz;
  gl_FragColor = info;
}
`;

export const HULL_DISPLACE_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tInput;
uniform vec2 uOldPos[${OCEAN_SHIP_MAX}];
uniform vec2 uNewPos[${OCEAN_SHIP_MAX}];
uniform vec2 uFwd[${OCEAN_SHIP_MAX}];
uniform float uHalfLen[${OCEAN_SHIP_MAX}];
uniform float uHalfWidth[${OCEAN_SHIP_MAX}];
uniform float uCenterY[${OCEAN_SHIP_MAX}];
uniform float uHalfH[${OCEAN_SHIP_MAX}];
uniform float uStrength[${OCEAN_SHIP_MAX}];
uniform int uCount;

varying vec2 coord;

float volumeInHull(
  vec2 center,
  vec2 fwd,
  float halfLen,
  float halfW,
  float centerY,
  float halfH
) {
  vec2 world = coord * 2.0 - 1.0;
  vec2 right = vec2(-fwd.y, fwd.x);
  vec2 rel = world - center;
  float along = dot(rel, fwd);
  float across = dot(rel, right);
  vec3 p = vec3(along, -centerY, across);
  vec3 halfSize = vec3(halfLen, halfH, halfW);
  vec3 d = abs(p) - halfSize;
  float signedDistance =
    length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
  float scale = max(max(halfSize.x, halfSize.y), halfSize.z);
  float t = max(signedDistance, 0.0) / max(scale, 0.0001);
  float dy = exp(-pow(t * 1.5, 6.0));
  float ymin = min(0.0, centerY - dy);
  float ymax = min(max(0.0, centerY + dy), ymin + 2.0 * dy);
  return (ymax - ymin) * 0.1;
}

void main() {
  vec4 info = texture2D(tInput, coord);
  for (int i = 0; i < ${OCEAN_SHIP_MAX}; i++) {
    if (i < uCount && uStrength[i] > 0.0001) {
      float oldV = volumeInHull(
        uOldPos[i], uFwd[i], uHalfLen[i], uHalfWidth[i], uCenterY[i], uHalfH[i]
      );
      float newV = volumeInHull(
        uNewPos[i], uFwd[i], uHalfLen[i], uHalfWidth[i], uCenterY[i], uHalfH[i]
      );
      info.r += (oldV - newV) * uStrength[i];
    }
  }
  gl_FragColor = info;
}
`;
