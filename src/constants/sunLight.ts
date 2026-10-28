/** Blender Sun Angle(deg) → VSM shadow.radius 경험적 계수 */
export const SUN_SHADOW_ANGLE_TO_RADIUS = 0.8;

/** Blender Sun Angle 슬라이더와 대응하는 기본값(deg) */
export const SUN_SHADOW_ANGLE_DEG = 5;

export function sunShadowRadiusFromAngleDeg(angleDeg: number) {
  return angleDeg * SUN_SHADOW_ANGLE_TO_RADIUS;
}

export const SUN_SHADOW_RADIUS =
  sunShadowRadiusFromAngleDeg(SUN_SHADOW_ANGLE_DEG);

export const SUN_INTENSITY = 9;
export const SUN_COLOR = 0xffffff;

// export const SUN_POSITION: [number, number, number] = [10, 10, 45];
export const SUN_POSITION: [number, number, number] = [3138.6, 1252.8, 5282.66];
export const SUN_TARGET: [number, number, number] = [225.375, -62.85, 897.16];

/** 바닥 radial glow — SUN_TARGET.xz 중심, Sun Angle에 비례 */
export const SUN_GLOW_RADIUS = (6 + SUN_SHADOW_RADIUS * 4) * 62.65;
export const SUN_GLOW_OPACITY = 0.05;
/** deck 위 z-fighting 방지용 미세 오프셋 */
export const SUN_GLOW_Y_OFFSET = -0.376;

/** mapSize는 radius를 키우기 전에 충분히 확보 (2048+) */
export const SUN_SHADOW_MAP_SIZE = 4096;
/** 태양광 그림자 기본 ON */
export const SUN_CAST_SHADOW = true;
export const SUN_SHADOW_BLUR_SAMPLES = 16;

/** VSM은 PCF와 bias 튜닝이 다를 수 있음 */
export const SUN_SHADOW_BIAS = -0.00015;
export const SUN_SHADOW_NORMAL_BIAS = 2.506;

export const SUN_SHADOW_CAMERA = {
  near: 12.53,
  far: 5012,
  left: -1127.7,
  right: 1127.7,
  top: 1754.2,
  bottom: -1754.2,
} as const;
