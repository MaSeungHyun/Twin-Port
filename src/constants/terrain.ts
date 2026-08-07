/** 지형 mesh 가로 길이 (월드 단위). heightMap 670×810 비율 유지 */
export const TERRAIN_WIDTH = 2400;
/** 지형 mesh 깊이 (월드 단위). WIDTH × (810/670) */
export const TERRAIN_DEPTH = Math.round(TERRAIN_WIDTH * (810 / 670));

/** heightMap 밝기 1.0일 때 Y 최대 높이 */
export const TERRAIN_MAX_HEIGHT = 250;

/** Plane 가로·세로 분할 수 — 클수록 기복 디테일↑, 정점 수↑ */
export const TERRAIN_SEGMENTS = 192;

/**
 * 텍스처 타일링 (월드 단위, 값이 클수록 한 장이 더 넓게 → 덜 반복)
 *
 * TILE_SIZE (macro)
 *   - 메인 스케일. “이 텍스처 한 장이 월드에서 몇 유닛을 덮나”
 *   - 예: 24면 24m마다 한 번 반복, 168이면 훨씬 덜 반복
 *
 * DETAIL_TILE_SIZE (detail)
 *   - 같은 텍스처를 더 촘촘한 스케일로 한 번 더 샘플해 macro와 섞음
 *   - 격자처럼 보이는 타일 반복을 깨는 보조 레이어
 *   - 보통 TILE_SIZE보다 작게 (더 자주 반복)
 */
/** low macro — forest leaves 저지대 메인 타일 크기 */
export const TERRAIN_LOW_TEXTURE_TILE_SIZE = 24;
/** low detail — 저지대 보조 타일 크기 */
export const TERRAIN_LOW_TEXTURE_DETAIL_TILE_SIZE = 24;

/** mid macro — rocky terrain 중부 메인 타일 */
export const TERRAIN_MID_TEXTURE_TILE_SIZE = 48;
/** mid detail — 중부 보조 타일 */
export const TERRAIN_MID_TEXTURE_DETAIL_TILE_SIZE = 24;

/** high macro — rocks ground 고지대 메인 타일 크기 */
export const TERRAIN_HIGH_TEXTURE_TILE_SIZE = 64;
/** high detail — 고지대 보조 타일 */
export const TERRAIN_HIGH_TEXTURE_DETAIL_TILE_SIZE = 32;

/** bake color map 해상도 (긴 변). 픽셀 수∝시간 — 512~1024 권장 */
export const TERRAIN_BAKE_SIZE = 512;

/** normal bake 해상도 — color와 비슷해야 디테일이 살아남 */
export const TERRAIN_NORMAL_BAKE_SIZE = 512;

/**
 * bake 샘플용 원본 텍스처 최대 변.
 * 파일은 1k여도 읽기 전에 이 크기로 줄여 CPU 부담↓ (파일 자체를 줄일 필요 거의 없음)
 */
export const TERRAIN_SOURCE_MAX_SIZE = 256;

/** 텍스처 anisotropy. 비스듬히 볼 때 선명도. 0이면 GPU 최대 */
export const TERRAIN_TEXTURE_ANISOTROPY = 8;

/** true면 mipmap 사용. false면 가까이서 더 선명, 멀리서 aliasing 가능 */
export const TERRAIN_TEXTURE_USE_MIPMAPS = true;

/** true → low/mid/high 텍스처 bake, false → 높이별 vertex color */
export const TERRAIN_USE_TEXTURE = true;

/** true → low/mid/high normal map bake (PNG) */
export const TERRAIN_USE_NORMAL_MAP = false;

/** normal map 강도 — 1보다 크게 하면 표면 기복이 더 과장됨 */
export const TERRAIN_NORMAL_SCALE = 2.2;

/** low→mid 블렌드 시작 높이 (0~1, heightMap 정규화) */
export const TERRAIN_LOW_BLEND_START = 0.008;
/** low→mid 블렌드 끝 — 이 이상이면 mid 비중 큼 */
export const TERRAIN_LOW_BLEND_END = 0.25;
/**
 * mid→high 블렌드
 * — START를 올리면 high가 더 높은 곳에서만 시작 (high 영역↓)
 * — END를 올리면 완전 high가 되는 지점이 더 정상 쪽으로
 */
export const TERRAIN_MID_BLEND_START = 0.55;
/** mid→high 블렌드 끝 — 이 이상이면 high 비중 큼 */
export const TERRAIN_MID_BLEND_END = 0.85;

/**
 * 텍스처 bake용 노이즈 (타일 격자·단조로움 완화)
 * — UV domain warp + 최종 색 변조에 사용
 */
/** 노이즈 옥타브 횟수 — 클수록 세부 패턴이 쌓임 (1~6) */
export const TERRAIN_NOISE_ITERATIONS = 6;
/** 월드 공간 노이즈 주파수 — 클수록 얼룩이 촘촘 (권장 0.01~0.08) */
export const TERRAIN_POSITION_FREQUENCY = 0.035;
/** 색 노이즈 세기 — RGB에 ±로 곱해짐 (0~0.4) */
export const TERRAIN_STRENGTH = 0.14;
/** domain warp 주파수 배율 — UV 왜곡 밀도 */
export const TERRAIN_WARP_FREQUENCY = 2.4;
/** domain warp 세기 — 월드 좌표 오프셋(유닛). 클수록 타일이 더 구부러짐 */
export const TERRAIN_WARP_STRENGTH = 18;

/** vertex color — 가장 낮은 구간 (모래/평지) */
export const TERRAIN_COLOR_SAND = "#d4c9a0";
/** vertex color — 초지 구간 */
export const TERRAIN_COLOR_GRASS = "#6db33f";
/** vertex color — 정상/설산 구간 (현재 톤은 커스텀 녹색) */
export const TERRAIN_COLOR_SNOW = "#5a6b3a";
/** vertex color — 암반/경사 구간 */
export const TERRAIN_COLOR_ROCK = "#2a3520";

/** sand→grass 전환 시작 높이 (0~1) */
export const TERRAIN_COLOR_GRASS_START = 0.12;
/** grass→rock 전환 시작 높이 */
export const TERRAIN_COLOR_ROCK_START = 0.42;
/** rock→snow 전환 시작 높이 */
export const TERRAIN_COLOR_SNOW_START = 0.72;

/**
 * 항만(+X 해상) 기준 내륙(-X) 배치.
 * 하이트맵 우하단 평지가 항만 쪽에 가깝도록 회전/오프셋.
 */
/** 지형 mesh 월드 위치 [x, y, z] */
export const TERRAIN_POSITION: [number, number, number] = [-228, -0.8, 255];
/** 지형 mesh 스케일 [x, y, z] — y는 높이 압축 */
export const TERRAIN_SCALE: [number, number, number] = [1, 0.5, 1];
/** 지형 Y축 회전 (라디안) */
export const TERRAIN_ROTATION_Y = (Math.PI / 180) * 270;
