/**
 * 펜스 / 도로 / 차선 / 테트라포드. 가까이서 들여다보는 대상이 아니라
 * distance 0 단계부터 단순 메시를 쓴다. error 는 m.
 */
export const GROUND_LOD_LEVELS = [
  { distance: 0, ratio: 0.12, error: 0.5 },
  { distance: 400, ratio: 0.04, error: 1.2 },
  { distance: 900, ratio: 0.015, error: 2.5 },
] as const;

/** 거리 경계 근처 깜빡임 방지. 0.12 = 12% */
export const GROUND_LOD_HYSTERESIS = 0.12;

/** LOD 검사 주기(프레임) */
export const GROUND_LOD_CHECK_EVERY = 6;

/** 이 삼각형 수 미만은 단순화하지 않음 */
export const GROUND_LOD_MIN_TRIANGLES = 48;
