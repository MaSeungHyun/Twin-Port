import {
  GROUND_DETAIL_MIX,
  GROUND_DETAIL_ROTATION,
  GROUND_DETAIL_SCALE,
  GROUND_MACRO_MIX,
  GROUND_MACRO_ROTATION,
  GROUND_MACRO_SCALE,
  GROUND_NORMAL_SCALE,
  GROUND_PATTERN_NOISE_FREQUENCY,
  GROUND_WARP_FREQUENCY,
  GROUND_WARP_STRENGTH,
} from "@/constants/ground";
import {
  MeshStandardMaterial,
  Vector2,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";

type GroundMaps = {
  map: Texture;
  normalMap?: Texture;
  roughnessMap?: Texture;
};

/**
 * multi-scale + warp + noise mix
 * — 같은 텍스처를 서로 다른 UV로 3번 샘플해 위치에 따라 비중을 바꿈
 */
function injectGroundDetailPattern(
  shader: WebGLProgramParametersWithUniforms,
) {
  shader.uniforms.groundDetailScale = { value: GROUND_DETAIL_SCALE };
  shader.uniforms.groundDetailMix = { value: GROUND_DETAIL_MIX };
  shader.uniforms.groundDetailRotation = { value: GROUND_DETAIL_ROTATION };
  shader.uniforms.groundMacroScale = { value: GROUND_MACRO_SCALE };
  shader.uniforms.groundMacroMix = { value: GROUND_MACRO_MIX };
  shader.uniforms.groundMacroRotation = { value: GROUND_MACRO_ROTATION };
  shader.uniforms.groundWarpStrength = { value: GROUND_WARP_STRENGTH };
  shader.uniforms.groundWarpFrequency = { value: GROUND_WARP_FREQUENCY };
  shader.uniforms.groundPatternNoiseFrequency = {
    value: GROUND_PATTERN_NOISE_FREQUENCY,
  };

  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      /* glsl */ `
#include <common>
uniform float groundDetailScale;
uniform float groundDetailMix;
uniform float groundDetailRotation;
uniform float groundMacroScale;
uniform float groundMacroMix;
uniform float groundMacroRotation;
uniform float groundWarpStrength;
uniform float groundWarpFrequency;
uniform float groundPatternNoiseFrequency;

float groundHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float groundValueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = groundHash(i);
  float b = groundHash(i + vec2(1.0, 0.0));
  float c = groundHash(i + vec2(0.0, 1.0));
  float d = groundHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec2 groundRotateUv(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  vec2 p = uv - 0.5;
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c) + 0.5;
}

vec2 groundWarpUv(vec2 uv) {
  float f = groundWarpFrequency;
  float n1 = groundValueNoise(uv * f);
  float n2 = groundValueNoise(uv * f + vec2(19.2, 7.1));
  return uv + (vec2(n1, n2) - 0.5) * groundWarpStrength;
}

vec2 groundLayerUv(vec2 uv, float scale, float rotation, vec2 offset) {
  return groundRotateUv(uv * scale + offset, rotation);
}

struct GroundPatternWeights {
  float base;
  float detail;
  float macro;
};

GroundPatternWeights groundPatternWeights(vec2 uv) {
  float n = groundValueNoise(uv * groundPatternNoiseFrequency);
  float n2 = groundValueNoise(uv * groundPatternNoiseFrequency * 1.7 + 3.1);
  float detailW = clamp(groundDetailMix * (0.55 + n * 0.9), 0.0, 0.75);
  float macroW = clamp(groundMacroMix * (0.45 + n2 * 0.95), 0.0, 0.65);
  float sum = detailW + macroW;
  if (sum > 0.92) {
    float s = 0.92 / sum;
    detailW *= s;
    macroW *= s;
  }
  float baseW = 1.0 - detailW - macroW;
  return GroundPatternWeights(baseW, detailW, macroW);
}
`,
    )
    .replace(
      "#include <map_fragment>",
      /* glsl */ `
#ifdef USE_MAP
  vec2 gUv = groundWarpUv(vMapUv);
  GroundPatternWeights gw = groundPatternWeights(vMapUv);
  vec4 baseCol = texture2D(map, gUv);
  vec4 detailCol = texture2D(
    map,
    groundLayerUv(gUv, groundDetailScale, groundDetailRotation, vec2(0.17, 0.31))
  );
  vec4 macroCol = texture2D(
    map,
    groundLayerUv(gUv, groundMacroScale, groundMacroRotation, vec2(-0.23, 0.41))
  );
  vec4 sampledDiffuseColor =
    baseCol * gw.base + detailCol * gw.detail + macroCol * gw.macro;
  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
  #endif
  diffuseColor *= sampledDiffuseColor;
#endif
`,
    )
    .replace(
      "#include <normal_fragment_maps>",
      /* glsl */ `
#ifdef USE_NORMALMAP_OBJECTSPACE
  normal = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
  #ifdef FLIP_SIDED
    normal = -normal;
  #endif
  #ifdef DOUBLE_SIDED
    normal = normal * faceDirection;
  #endif
  normal = normalize(normalMatrix * normal);
#elif defined(USE_NORMALMAP_TANGENTSPACE)
  vec2 gNuv = groundWarpUv(vNormalMapUv);
  GroundPatternWeights gwN = groundPatternWeights(vNormalMapUv);
  vec3 baseN = texture2D(normalMap, gNuv).xyz * 2.0 - 1.0;
  vec3 detailN = texture2D(
    normalMap,
    groundLayerUv(gNuv, groundDetailScale, groundDetailRotation, vec2(0.17, 0.31))
  ).xyz * 2.0 - 1.0;
  vec3 macroN = texture2D(
    normalMap,
    groundLayerUv(gNuv, groundMacroScale, groundMacroRotation, vec2(-0.23, 0.41))
  ).xyz * 2.0 - 1.0;
  #if defined(USE_PACKED_NORMALMAP)
    baseN = vec3(baseN.xy, sqrt(saturate(1.0 - dot(baseN.xy, baseN.xy))));
    detailN = vec3(detailN.xy, sqrt(saturate(1.0 - dot(detailN.xy, detailN.xy))));
    macroN = vec3(macroN.xy, sqrt(saturate(1.0 - dot(macroN.xy, macroN.xy))));
  #endif
  vec3 mapN = normalize(baseN * gwN.base + detailN * gwN.detail + macroN * gwN.macro);
  mapN.xy *= normalScale;
  normal = normalize(tbn * mapN);
#elif defined(USE_BUMPMAP)
  normal = perturbNormalArb(-vViewPosition, normal, dHdxy_fwd(), faceDirection);
#endif
`,
    )
    .replace(
      "#include <roughnessmap_fragment>",
      /* glsl */ `
float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  vec2 gRuv = groundWarpUv(vRoughnessMapUv);
  GroundPatternWeights gwR = groundPatternWeights(vRoughnessMapUv);
  vec4 baseR = texture2D(roughnessMap, gRuv);
  vec4 detailR = texture2D(
    roughnessMap,
    groundLayerUv(gRuv, groundDetailScale, groundDetailRotation, vec2(0.17, 0.31))
  );
  vec4 macroR = texture2D(
    roughnessMap,
    groundLayerUv(gRuv, groundMacroScale, groundMacroRotation, vec2(-0.23, 0.41))
  );
  vec4 texelRoughness = baseR * gwR.base + detailR * gwR.detail + macroR * gwR.macro;
  roughnessFactor *= texelRoughness.g;
#endif
`,
    );
}

export function createGroundSurfaceMaterial({
  map,
  normalMap,
  roughnessMap,
}: GroundMaps) {
  const material = new MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new Vector2(GROUND_NORMAL_SCALE, GROUND_NORMAL_SCALE),
    roughnessMap,
    roughness: 1,
    metalness: 0,
  });

  material.onBeforeCompile = injectGroundDetailPattern;
  material.customProgramCacheKey = () =>
    [
      "ground-pattern-v2",
      GROUND_DETAIL_SCALE,
      GROUND_DETAIL_MIX,
      GROUND_MACRO_SCALE,
      GROUND_MACRO_MIX,
      GROUND_WARP_STRENGTH,
      GROUND_PATTERN_NOISE_FREQUENCY,
    ].join("-");

  return material;
}
