/**
 * 안벽 크레인(busan.glb crane.000~) 거리 기반 LOD 설정.
 * 카메라 ↔ 크레인 중심 거리(m)가 distance 이상이면 해당 단계로 교체.
 * ratio = 원본 대비 목표 삼각형 비율, error = 허용 오차(크레인 크기 대비 비율, 0.01 ≈ 1m)
 * 가까운 LOD0는 원본 그대로 (호버 외곽선/선택/카메라 포커스는 항상 원본 기준)
 */
export const CRANE_LOD_LEVELS = [
  { distance: 400, ratio: 0.5, error: 0.005 }, // LOD1: 작은 부품 정리 (~47%)
  { distance: 1000, ratio: 0.3, error: 0.01 }, // LOD2: 중간 거리 (~29%)
  { distance: 2000, ratio: 0.06, error: 0.04 }, // LOD3: 원거리 (~20%)
] as const;

/** 거리 경계 근처에서 깜빡임 방지용 여유(비율). 0.1 = 10% */
export const CRANE_LOD_HYSTERESIS = 0.1;

/** LOD 검사 주기(프레임). 카메라가 안 움직이면 검사 생략 */
export const CRANE_LOD_CHECK_EVERY = 6;

/** 이 삼각형 수 미만인 크레인 하위 메시는 LOD 생략 (작은 부품) */
export const CRANE_LOD_MIN_TRIANGLES = 500;
