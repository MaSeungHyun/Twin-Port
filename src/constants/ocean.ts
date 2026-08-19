/** jeantimex/threejs-water GPU 높이장. https://github.com/jeantimex/threejs-water */

/** 시각 수면 크기 (월드) */
export const OCEAN_PLANE_SIZE = 1000;
/** 수면 메시 분할. 높낮이가 보일 밀도 */
export const OCEAN_PLANE_SEGMENTS = 220;
/** 파동 격자 */
export const OCEAN_SIM_SIZE = 1024;
/**
 * 시뮬이 덮는 월드 반경.
 * 안벽·출항 선박이 이 안에 있어야 물이 밀린다.
 */
export const OCEAN_SIM_EXTENT = 160;
export const OCEAN_SHIP_MAX = 8;
/** 높이 텍스처 → 월드 Y. 낮출수록 물결이 작아 보임 */
export const OCEAN_HEIGHT_SCALE = 7.2;
/** 항적 부근 반사 일그러짐 */
export const OCEAN_WAKE_DISTORT = 0.35;

/** SHIP_SCALE 기준 선체 (월드) */
export const OCEAN_HULL_HALF_LEN = 6.8;
export const OCEAN_HULL_HALF_WIDTH = 1.25;
export const OCEAN_HULL_HALF_HEIGHT = 1.35;
/** 수면(y=0) 기준 선체 중심 Y */
export const OCEAN_HULL_Y = -0.45;
/** 배가 물을 미는 힘. 낮출수록 첫 물결이 약함 */
export const OCEAN_WAKE_STRENGTH = 1.35;
/** 이 거리 이상이면 변위 적용 */
export const OCEAN_MOVE_THRESHOLD = 0.015;
/** 이보다 크면 텔레포트로 보고 스플래시 생략 */
export const OCEAN_TELEPORT_THRESHOLD = 10;
export const OCEAN_WAKE_MIN_SCALE = 0.01;
/** 이 높이 아래 Ground는 육지 마스크에서 제외 (해저·수면 아래 바닥) */
export const OCEAN_LAND_MIN_Y = -0.45;
/** 이 높이 위는 안벽 마스크에서 제외 */
export const OCEAN_LAND_MAX_Y = 18;
/** 안벽에서 물결이 부딪힐 때 Ground 포말 */
export const OCEAN_SHORE_FOAM = 1;
/** 수변 젖음(어둡게) */
export const OCEAN_SHORE_WET = 0.62;
/** 수변 반사 하이라이트 */
export const OCEAN_SHORE_REFLECT = 0.7;
/** 수변 폭 (시뮬 텍셀). 클수록 안벽에서 더 넓게 보임 */
export const OCEAN_SHORE_WIDTH = 6;
/** Ground 안벽 반사. 1이면 전반사, 0이면 흡수 */
export const OCEAN_WALL_BOUNCE = 1;
/**
 * 항만 안 속도 감쇠. 1에 가까울수록 멀리 퍼짐.
 * 0.9992 ≈ 거의 안 죽음 / 0.99 ≈ 근처만 / 0.98 ≈ 바로 사그라짐
 */
export const OCEAN_WAVE_DAMPING = 0.9692;
/** 프레임당 파동 적분 횟수. 클수록 더 빠르고 멀리 퍼짐 */
export const OCEAN_SIM_STEPS = 1;
/** 육지 마스크를 이 텍셀만큼 불려 안벽 틈으로 파동이 새지 않게 함 */
export const OCEAN_LAND_DILATE = 2;
