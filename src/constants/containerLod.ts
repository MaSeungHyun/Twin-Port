/**
 * 야드 컨테이너 거리 기반 LOD.
 * 카메라 ↔ 블록 중심 거리(m)가 FAR 이상이면 그 블록은 "스택 기둥"으로 대체:
 *   row×bay 칸마다 박스 1개, 높이 = 그 칸의 실제 적재 단수, 색/텍스처 = 맨 위 컨테이너 색.
 * 컨테이너 선택(검색 하이라이트) 중에는 모든 블록을 원본(개별 컨테이너)으로 표시.
 */
export const CONTAINER_LOD_FAR_DISTANCE = 700;

/** 원본 복귀 여유 비율 (깜빡임 방지). 0.1 = FAR의 90%보다 가까워져야 원본으로 */
export const CONTAINER_LOD_HYSTERESIS = 0.1;

/** LOD 검사 주기(프레임). 카메라가 안 움직였으면 생략 */
export const CONTAINER_LOD_CHECK_EVERY = 6;

/** 카메라가 이 거리(m) 이상 움직였을 때만 재검사 */
export const CONTAINER_LOD_MOVE_EPS = 1;

/** false면 LOD 끄기 (항상 원본) */
export const CONTAINER_LOD_ENABLED = true;