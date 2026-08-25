import {
  ENVIRONMENT_BACKGROUND_INTENSITY,
  ENVIRONMENT_MESH_INTENSITY,
} from "@/constants/environment";

/** occupancy 모드 전환 — 하늘 페이드 + 중간 오버레이 */
export const OCCUPANCY_TRANSITION = {
  duration: 0.9,
  /** 0~1 블렌드에서 occupancy 룩을 켜는 시점 (오버레이가 가장 어두울 때) */
  lookAt: 0.42,
  overlayPeak: 0.62,
  backgroundFrom: ENVIRONMENT_BACKGROUND_INTENSITY,
  backgroundTo: 0,
  environmentFrom: ENVIRONMENT_MESH_INTENSITY,
  environmentTo: 0.3,
  ambientFrom: 0.5,
  ambientTo: 0.38,
  /** FogExp2 density. 0.0005는 궤도 거리(~280)에서 거의 안 보임 */
  fogFrom: 0.003,
  fogTo: 0.004,
  waterHideAt: 0.46,
} as const;

export const occupancyDimRef: { current: HTMLDivElement | null } = {
  current: null,
};

/** OccupancyTransition gsap 진행도 — SunLight 등이 구독 */
export const occupancyTransitionProgressRef = { current: { t: 0 } };
