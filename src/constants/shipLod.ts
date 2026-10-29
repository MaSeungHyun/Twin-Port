/**
 * 선박(ship.glb, 인스턴스 18척) 거리 기반 LOD. 크레인 LOD(craneLod.ts)와 같은 방식(meshoptimizer simplify).
 * 카메라 ↔ 선박 위치 거리(m)가 distance 이상이면 해당 단계 InstancedMesh로 옮김.
 * ratio = 원본 대비 목표 삼각형 비율, error = 허용 오차(메시 크기 대비 비율)
 * LOD0 = 원본. 호버 외곽선/히트 프록시/화물은 LOD와 무관.
 */
export const SHIP_LOD_ENABLED = true;

export const SHIP_LOD_LEVELS = [
  { distance: 600, ratio: 0.4, error: 0.003 }, // LOD1
  { distance: 1400, ratio: 0.15, error: 0.01 }, // LOD2
  { distance: 2800, ratio: 0.04, error: 0.04 }, // LOD3
] as const;

/** 상세 단계로 돌아올 때 필요한 여유(비율). 0.1 = 10% 더 가까워져야 전환 */
export const SHIP_LOD_HYSTERESIS = 0.1;

/** LOD 검사 주기(프레임) */
export const SHIP_LOD_CHECK_EVERY = 6;

/** 이 삼각형 수 미만인 선박 하위 메시는 LOD 생략 */
export const SHIP_LOD_MIN_TRIANGLES = 500;
