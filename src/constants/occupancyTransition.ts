/** occupancy 모드 전환 — 하늘 페이드 + 중간 오버레이 */
export const OCCUPANCY_TRANSITION = {
  duration: 0.9,
  /** 0~1 블렌드에서 occupancy 룩을 켜는 시점 (오버레이가 가장 어두울 때) */
  lookAt: 0.42,
  overlayPeak: 0.62,
  backgroundFrom: 0.7,
  backgroundTo: 0,
  environmentFrom: 0.7,
  environmentTo: 0.5,
  sunFrom: 1.6,
  sunTo: 0.5,
  ambientFrom: 0.5,
  ambientTo: 0.38,
  fogFrom: 0.0005,
  fogTo: 0.0024,
  waterHideAt: 0.46,
} as const;

export const occupancyDimRef: { current: HTMLDivElement | null } = {
  current: null,
};
