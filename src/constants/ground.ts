export const GROUND_X = 120;
export const GROUND_Y = 3;
export const GROUND_Z = 400;

/** asphalt_02 1타일 월드 크기 (클수록 덜 반복) */
export const TILE_SIZE = 12;

/** asphalt normal 강도 */
export const GROUND_NORMAL_SCALE = 1.4;

/**
 * 패턴 다양화 — multi-scale + UV warp + 노이즈 믹스
 * (격자처럼 일정한 타일 반복을 깨기 위함)
 */
/** 보조(촘촘) 타일 배율 */
export const GROUND_DETAIL_SCALE = 2.85;
/** 넓은(매크로) 타일 배율 — 1보다 작으면 더 큰 무늬 */
export const GROUND_MACRO_SCALE = 0.42;
/** 보조 레이어 기본 비중 */
export const GROUND_DETAIL_MIX = 0.42;
/** 매크로 레이어 기본 비중 */
export const GROUND_MACRO_MIX = 0.32;
/** 보조/매크로 UV 회전(라디안) */
export const GROUND_DETAIL_ROTATION = 1.1;
export const GROUND_MACRO_ROTATION = -0.55;
/** UV domain warp — 클수록 타일이 더 구부러짐 */
export const GROUND_WARP_STRENGTH = 0.12;
export const GROUND_WARP_FREQUENCY = 5.5;
/** 공간 노이즈 주파수 — 믹스 비중을 위치에 따라 흔듦 */
export const GROUND_PATTERN_NOISE_FREQUENCY = 2.8;

/** road.png 원본 기준 UV repeat [가로(U), 세로(V)] */
export const ROAD_TEXTURE_REPEAT: [number, number] = [3, 40];
