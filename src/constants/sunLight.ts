/** Blender Sun Angle(deg) → VSM shadow.radius 경험적 계수 */
export const SUN_SHADOW_ANGLE_TO_RADIUS = 0.8;

/** Blender Sun Angle 슬라이더와 대응하는 기본값(deg) */
export const SUN_SHADOW_ANGLE_DEG = 5;

export const SUN_INTENSITY = 0.8;
export const SUN_COLOR = 0xcccccc;

/** mapSize는 radius를 키우기 전에 충분히 확보 (2048+) */
export const SUN_SHADOW_MAP_SIZE = 2048;
export const SUN_SHADOW_BLUR_SAMPLES = 16;

/** VSM은 PCF와 bias 튜닝이 다를 수 있음 */
export const SUN_SHADOW_BIAS = -0.00015;
export const SUN_SHADOW_NORMAL_BIAS = 0.04;

export const SUN_SHADOW_CAMERA = {
  near: 0.2,
  far: 80,
  left: -18,
  right: 18,
  top: 28,
  bottom: -28,
} as const;

export function sunShadowRadiusFromAngleDeg(angleDeg: number) {
  return angleDeg * SUN_SHADOW_ANGLE_TO_RADIUS;
}

export const SUN_SHADOW_RADIUS =
  sunShadowRadiusFromAngleDeg(SUN_SHADOW_ANGLE_DEG);
