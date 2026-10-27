/**
 * 머티리얼 조정값 (기본값 = 현재 GLB 원본값 → 시각 변화 없음)
 * 로드 시 적용. leva "Ship Material" 패널의 Copy values 결과를 그대로 붙여넣으면 됨.
 */

export type MaterialSettings = {
  color: string;
  metalness: number;
  roughness: number;
  envMapIntensity: number;
  emissive: string;
  emissiveIntensity: number;
  opacity: number;
  transparent: boolean;
  /** baseColor 텍스처 사용 여부 (텍스처가 없는 머티리얼은 무시) */
  mapEnabled: boolean;
};

const TEX: MaterialSettings = {
  color: "#ffffff",
  metalness: 1,
  roughness: 1,
  envMapIntensity: 1,
  emissive: "#000000",
  emissiveIntensity: 1,
  opacity: 1,
  transparent: false,
  mapEnabled: true,
};

/** ship.glb "body" 메시의 머티리얼(11개) — 이름 → 값 */
export const SHIP_MATERIAL: Record<string, MaterialSettings> = {
  body_01: { ...TEX, roughness: 0.2 },
  body_02: { ...TEX },
  body_03: { ...TEX },
  fresh: {
    ...TEX,
    color: "#e7e200",
    metalness: 0,
    roughness: 0,
    emissive: "#fff900",
    emissiveIntensity: 8.0015,
    mapEnabled: false,
  },
  gray_metal: { ...TEX, roughness: 0 },
  logo: { ...TEX, metalness: 0, roughness: 0, transparent: true },
  ramp: {
    ...TEX,
    color: "#e15f00",
    metalness: 0,
    roughness: 0,
    emissive: "#e15f00",
    mapEnabled: false,
  },
  red_metal: { ...TEX },
  white_metal: { ...TEX },
  white_paint: { ...TEX },
  window: {
    ...TEX,
    color: "#79a0a0",
    roughness: 0,
    mapEnabled: false,
  },
};

/** busan.glb "sky" 메시 표시 여부 (기본 숨김) */
export const SKY_VISIBLE = true;

/** busan.glb "sky" 메시 머티리얼 adskMatsky */
export const SKY_MATERIAL: MaterialSettings & { toneMapped: boolean } = {
  ...TEX,
  metalness: 0,
  roughness: 0,
  toneMapped: true,
};
