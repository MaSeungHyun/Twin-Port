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
import type { Texture } from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  Fn,
  clamp,
  cos,
  dot,
  float,
  floor,
  fract,
  max,
  mix,
  normalMap as normalMapNode,
  sin,
  texture,
  uniform,
  uv,
  vec2,
} from "three/tsl";

type GroundMaps = {
  map: Texture;
  normalMap?: Texture;
  roughnessMap?: Texture;
};

/** 런타임 조정용 uniform (구 GLSL uniform 과 동일 이름/의미) */
export const groundPatternUniforms = {
  detailScale: uniform(GROUND_DETAIL_SCALE),
  detailMix: uniform(GROUND_DETAIL_MIX),
  detailRotation: uniform(GROUND_DETAIL_ROTATION),
  macroScale: uniform(GROUND_MACRO_SCALE),
  macroMix: uniform(GROUND_MACRO_MIX),
  macroRotation: uniform(GROUND_MACRO_ROTATION),
  warpStrength: uniform(GROUND_WARP_STRENGTH),
  warpFrequency: uniform(GROUND_WARP_FREQUENCY),
  patternNoiseFrequency: uniform(GROUND_PATTERN_NOISE_FREQUENCY),
};
const U = groundPatternUniforms;

/* eslint-disable @typescript-eslint/no-explicit-any */
const hash = (p: any): any => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
const valueNoise: any = Fn(([p]: [any]) => {
  const i: any = floor(p);
  const f: any = fract(p);
  const u: any = f.mul(f).mul(float(3).sub(f.mul(2)));
  const a = hash(i);
  const b = hash(i.add(vec2(1, 0)));
  const c = hash(i.add(vec2(0, 1)));
  const d = hash(i.add(vec2(1, 1)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
});
const rotateUv = (q: any, angle: any) => {
  const c = cos(angle);
  const s = sin(angle);
  const p = q.sub(0.5);
  return vec2(p.x.mul(c).sub(p.y.mul(s)), p.x.mul(s).add(p.y.mul(c))).add(0.5);
};

/**
 * multi-scale + warp + noise mix (TSL 포팅, 구 onBeforeCompile GLSL 과 동일 수식)
 * — 같은 텍스처를 서로 다른 UV로 3번 샘플해 위치에 따라 비중을 바꿈
 */
function patternSetup() {
  const base = uv();
  const f = U.warpFrequency;
  const n1 = valueNoise(base.mul(f));
  const n2w = valueNoise(base.mul(f).add(vec2(19.2, 7.1)));
  const wuv = base.add(vec2(n1, n2w).sub(0.5).mul(U.warpStrength)).toVar();
  const n = valueNoise(wuv.mul(U.patternNoiseFrequency));
  const n2 = valueNoise(wuv.mul(U.patternNoiseFrequency.mul(1.7)).add(3.1));
  const dW0 = clamp(U.detailMix.mul(n.mul(0.9).add(0.55)), 0, 0.75);
  const mW0 = clamp(U.macroMix.mul(n2.mul(0.95).add(0.45)), 0, 0.65);
  const k = float(0.92).div(max(dW0.add(mW0), 0.92)); // sum>0.92 → 0.92 로 정규화
  const detailW = dW0.mul(k).toVar();
  const macroW = mW0.mul(k).toVar();
  const baseW = float(1).sub(detailW).sub(macroW);
  const detailUv = rotateUv(wuv.mul(U.detailScale).add(vec2(0.17, 0.31)), U.detailRotation);
  const macroUv = rotateUv(wuv.mul(U.macroScale).add(vec2(-0.23, 0.41)), U.macroRotation);
  const blend = (t: Texture) =>
    texture(t, wuv).mul(baseW).add(texture(t, detailUv).mul(detailW)).add(texture(t, macroUv).mul(macroW));
  return blend;
}

export function createGroundSurfaceMaterial({ map, normalMap, roughnessMap }: GroundMaps) {
  const material = new MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
  material.map = map;
  const blend = patternSetup();
  material.colorNode = blend(map);
  if (normalMap) {
    material.normalNode = normalMapNode(blend(normalMap).xyz, vec2(GROUND_NORMAL_SCALE, GROUND_NORMAL_SCALE));
  }
  if (roughnessMap) material.roughnessNode = blend(roughnessMap).g;
  return material;
}
