/** jeantimex/threejs-water GPU 높이장. https://github.com/jeantimex/threejs-water */

/** 화면에 그리는 수면 평면 한 변 길이 (월드). 클수록 먼 바다까지 물이 보임 */
export const OCEAN_PLANE_SIZE = 1000;
/**
 * 수면 월드 Y. 0이면 원점 높이.
 * 낮출수록 선체에 물이 덜 참. 배 pivot(SHIP_POSITION_Y) 기준 흘수
 */
export const OCEAN_POSITION_Y = -0.06;
/**
 * 수면 메시 가로·세로 분할 수.
 * 클수록 물결·안벽 반사가 잘 보임. 격자 간격 ≈ OCEAN_PLANE_SIZE / 이 값
 */
export const OCEAN_PLANE_SEGMENTS = 220;
/**
 * 파동 시뮬 텍스처 한 변 픽셀 수 (정사각).
 * 클수록 물결이 섬세함. 계산량은 제곱으로 늘어남
 */
export const OCEAN_SIM_SIZE = 2048;
/**
 * 파동 시뮬이 돌아가는 월드 반경.
 * 이 원 안의 배만 물을 밀 수 있음. 시뮬 영역 한 변 ≈ 이 값 × 2
 */
export const OCEAN_SIM_EXTENT = 32;
/** 동시에 항적을 계산하는 최대 선박 수 */
export const OCEAN_SHIP_MAX = 8;
/** 시뮬 높이 → 월드 Y 배율. 클수록 물결이 높게 보임 */
export const OCEAN_HEIGHT_SCALE = 0.84;
/** 항적 주변 거울 반사를 일그러뜨리는 정도. 0이면 일그러짐 없음 */
export const OCEAN_WAKE_DISTORT = 0.35;
/** 잔잔한 수면 잔물결 세기. 지금은 플랫이라 미사용. 다시 쓰려면 Water.tsx distortionScale에 넣으면 됨 */
export const OCEAN_CALM_DISTORT = 2.6;

/** 선체 길이의 절반 (월드). 물이 밀리는 선수~선미 범위 */
export const OCEAN_HULL_HALF_LEN = 1.36;
/** 선체 폭의 절반. 물이 밀리는 좌우 범위 */
export const OCEAN_HULL_HALF_WIDTH = 0.11;
/** 선체 높이의 절반. 흘수(잠긴 깊이)에 해당 */
export const OCEAN_HULL_HALF_HEIGHT = 0.27;
/** 수면(y=0) 기준 선체 중심 높이. 음수면 수면 아래로 잠긴 것 */
export const OCEAN_HULL_Y = -0.09;
/** 배가 한 칸 움직일 때 물을 밀어내는 세기. 클수록 첫 물결이 큼 */
export const OCEAN_WAKE_STRENGTH = 0.55;
/**
 * 파동이 있는 수면을 하얗게 만드는 세기.
 * 0이면 포말 없음 / 0.3 약함 / 1 아주 하얗게
 */
export const OCEAN_WAKE_FOAM = 0.32;
/** 이 거리(월드) 미만 이동은 정지로 보고 항적을 안 만듦 */
export const OCEAN_MOVE_THRESHOLD = 0.003;
/** 한 프레임에 이 거리 넘게 뛰면 텔레포트로 보고 스플래시 생략 */
export const OCEAN_TELEPORT_THRESHOLD = 2;
/** 이 스케일보다 작은 배는 항적을 만들지 않음 */
export const OCEAN_WAKE_MIN_SCALE = 0.002;
/**
 * 이 월드 Y보다 아래인 Ground는 육지(벽)로 안 봄.
 * 해저가 항만 전체를 육지로 덮지 않게 함
 */
export const OCEAN_LAND_MIN_Y = -0.09;
/** 이 월드 Y보다 위인 메시는 안벽 마스크에서 제외 */
export const OCEAN_LAND_MAX_Y = 3.6;
/** 물결이 안벽에 닿을 때 Ground 위 흰 포말 세기. 0이면 없음 */
export const OCEAN_SHORE_FOAM = 1;
/** 수변 Ground를 어둡게 젖은 느낌으로 만드는 세기 */
export const OCEAN_SHORE_WET = 0.62;
/** 수변 Ground에 물결 하이라이트를 더하는 세기 */
export const OCEAN_SHORE_REFLECT = 0.7;
/** 수변 효과가 안벽에서 안쪽으로 퍼지는 폭 (시뮬 텍셀) */
export const OCEAN_SHORE_WIDTH = 6;
/**
 * Ground를 벽으로 보고 물결을 되돌려 보내는 비율.
 * 1 = 전반사, 0 = 흡수
 */
export const OCEAN_WALL_BOUNCE = 1;
/**
 * 매 스텝 속도에 곱하는 값. 물결이 얼마나 멀리 가는지.
 * 1에 가까울수록 멀리 퍼짐 / 0.99 근처만 / 0.95 선체 주변만
 */
export const OCEAN_WAVE_DAMPING = 0.945;
/**
 * 파동이 퍼지는 속도. 원본 풀은 2.
 * 낮출수록 링이 천천히, 선체 가까이 붙음
 */
export const OCEAN_WAVE_SPEED = 0.95;
/** 프레임당 파동을 몇 번 진행할지. 클수록 퍼짐이 빠르고 반사도 빨리 보임 */
export const OCEAN_SIM_STEPS = 1;
/**
 * 육지 마스크를 이 픽셀만큼 부두 쪽으로 불림.
 * 틈으로 파동이 새는 걸 막음. 너무 크면 수면과 Ground 사이가 빔
 */
export const OCEAN_LAND_DILATE = 2;
