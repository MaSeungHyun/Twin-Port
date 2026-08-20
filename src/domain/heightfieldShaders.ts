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
uniform float uWallBounce;
uniform float uDamping;
uniform float uWaveSpeed;

varying vec2 coord;

float landAt(vec2 uv) {
  return step(0.5, texture2D(tLand, clamp(uv, 0.0, 1.0)).r);
}

// 원본 풀 벽(ClampToEdge): 벽 너머 높이를 자기 칸으로 복사 → 파동이 되돌아옴
float heightAt(vec2 uv, float hC) {
  float sampled = texture2D(tInput, uv).r;
  float wall = landAt(uv);
  float reflected = mix(0.0, hC, uWallBounce);
  return mix(sampled, reflected, wall);
}

void main() {
  vec4 info = texture2D(tInput, coord);
  if (landAt(coord) > 0.5) {
    gl_FragColor = vec4(0.0, 0.0, info.ba);
    return;
  }

  vec2 dx = vec2(delta.x, 0.0);
  vec2 dy = vec2(0.0, delta.y);
  float hC = info.r;
  float average = (
    heightAt(coord + dx, hC) +
    heightAt(coord - dx, hC) +
    heightAt(coord + dy, hC) +
    heightAt(coord - dy, hC)
  ) * 0.25;

  info.g += (average - info.r) * uWaveSpeed;
  info.g *= uDamping;
  info.r += info.g;

  float edge =
    smoothstep(0.0, 0.04, coord.x) *
    smoothstep(1.0, 0.96, coord.x) *
    smoothstep(0.0, 0.04, coord.y) *
    smoothstep(1.0, 0.96, coord.y);
  info.r *= edge;
  info.g *= mix(0.96, 1.0, edge);

  gl_FragColor = info;
}
`;

export const WATER_NORMAL_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tInput;
uniform sampler2D tLand;
uniform float poolWidth;
uniform float poolLength;
uniform vec2 delta;

varying vec2 coord;

float heightAt(vec2 uv, float hC) {
  float wall = step(0.5, texture2D(tLand, clamp(uv, 0.0, 1.0)).r);
  return mix(texture2D(tInput, uv).r, hC, wall);
}

void main() {
  vec4 info = texture2D(tInput, coord);
  float hC = info.r;
  vec3 dx = vec3(
    delta.x * 2.0 * poolWidth,
    heightAt(vec2(coord.x + delta.x, coord.y), hC) - hC,
    0.0
  );
  vec3 dy = vec3(
    0.0,
    heightAt(vec2(coord.x, coord.y + delta.y), hC) - hC,
    delta.y * 2.0 * poolLength
  );
  info.ba = normalize(cross(dy, dx)).xz;
  gl_FragColor = info;
}
`;

export const HULL_DISPLACE_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tInput;
uniform sampler2D tLand;
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

float hullSkin(
  vec2 center,
  vec2 fwd,
  float halfLen,
  float halfW
) {
  vec2 world = coord * 2.0 - 1.0;
  vec2 right = vec2(-fwd.y, fwd.x);
  vec2 rel = world - center;
  float along = dot(rel, fwd);
  float across = dot(rel, right);
  float taper = mix(1.12, 0.28, smoothstep(-halfLen, halfLen, along));
  vec2 q = abs(vec2(along, across)) - vec2(halfLen, halfW * taper);
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float band = max(halfW * 0.4, 0.00015);
  float skin = exp(-pow(max(sd, 0.0) / band, 2.0));
  float inside = 1.0 - smoothstep(-band * 0.35, 0.0, sd);
  return skin * (1.0 - inside * 0.82);
}

void main() {
  vec4 info = texture2D(tInput, coord);
  if (texture2D(tLand, coord).r > 0.5) {
    gl_FragColor = vec4(0.0, 0.0, info.ba);
    return;
  }
  vec2 world = coord * 2.0 - 1.0;
  for (int i = 0; i < ${OCEAN_SHIP_MAX}; i++) {
    if (i < uCount && uStrength[i] > 0.0001) {
      vec2 vel = uNewPos[i] - uOldPos[i];
      float speed = length(vel);
      if (speed > 0.00001) {
        vec2 dir = vel / speed;
        vec2 rel = world - uNewPos[i];
        float rlen = length(rel);
        vec2 outward = rlen > 0.00001 ? rel / rlen : uFwd[i];
        vec2 right = vec2(-uFwd[i].y, uFwd[i].x);
        float side = abs(dot(outward, right));
        float skin = hullSkin(
          uNewPos[i], uFwd[i], uHalfLen[i], uHalfWidth[i]
        );
        float push = -dot(dir, outward);
        push *= mix(0.4, 1.0, side);
        info.r += push * speed * skin * uStrength[i] * 28.0;
      }
    }
  }
  gl_FragColor = info;
}
`;
