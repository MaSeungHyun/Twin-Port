/** jeantimex/threejs-water GPU 높이장. https://github.com/jeantimex/threejs-water */

/** 화면에 그리는 수면 평면 한 변 길이 (월드). 클수록 먼 바다까지 물이 보임 */
export const OCEAN_PLANE_SIZE = 60000;
/**
 * 수면 월드 Y. 0이면 원점 높이.
 * 낮출수록 선체에 물이 덜 참. 배 pivot(SHIP_POSITION_Y) 기준 흘수
 */
export const OCEAN_POSITION_Y = -3.759;
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
export const OCEAN_SIM_EXTENT = 2004.8;
/** 동시에 항적을 계산하는 최대 선박 수 */
export const OCEAN_SHIP_MAX = 8;
/** 선체 접촉 거품/물 컷아웃을 그리는 최대 선박 수 (셰이더 루프 상한). 선박 수보다 크거나 같아야 모든 배에 거품이 생김 */
export const OCEAN_HULL_FOAM_MAX = 16;

/** 배 뒤 항적 거품 (속도 0..1 은 Ship.tsx 항적 메시 스케일과 같은 값) */
/** 최고 속도일 때 선미 뒤로 남는 길이(m) */
export const OCEAN_WAKE_LENGTH = 170;
/**
 * 항적 세기 램프 (선미 거품 + 뱃머리 V + 항적 메시 공통).
 * 속도비(현재 속도 / 최고 출항 속도)를 smoothstep(LO, HI)로 0..1 목표값으로 바꾸고,
 * 배마다 세기가 RISE초에 걸쳐 차오르고 멈추면 FALL초에 걸쳐 사라짐.
 */
export const OCEAN_WAKE_SPEED_LO = 0.01;
export const OCEAN_WAKE_SPEED_HI = 0.7;
/** 세기가 목표의 ~63%까지 차오르는 시간(초) */
export const OCEAN_WAKE_RISE_SEC = 2.5;
/** 멈춘 뒤 ~63%까지 줄어드는 시간(초) */
export const OCEAN_WAKE_FALL_SEC = 2.0;
/** 한 프레임 이동 속도가 최고 속도의 이 배수를 넘으면 순간이동(정박지 리셋/재등장)으로 보고 항적을 0으로 */
export const OCEAN_WAKE_TELEPORT_RATIO = 3;
/**
 * 직진(출항) 단계 항적: 직진 시작 순간부터 바로 생기기 시작해 이 시간(초)에 걸쳐 선형으로 최대까지.
 * 실제 세기 = min(1, 경과/RAMP) * (STRAIGHT_BASE + (1-STRAIGHT_BASE)*speed램프) → 속도보다 앞서지 않게.
 * 직진이 끝나거나 숨겨지면 FALL_SEC 로 사라짐. 선미 거품/뱃머리 V 길이는 직진 후 실제 이동 거리로 제한(0에서 자라남).
 */
export const OCEAN_WAKE_RAMP_SEC = 4;
export const OCEAN_WAKE_STRAIGHT_BASE = 0.5;
/** 항적을 거품 무늬(lace) 임계값과 별개로 직접 흰색으로 섞는 세기 (거품 무늬만으로는 세기가 낮을 때 거의 안 보였음) */
export const OCEAN_WAKE_WHITE = 0.9;
/**
 * 선체 옆 물결 (직진 중에는 없음):
 *  - 옆걸음(선박 로컬 Z 이동): 이동하는 쪽(앞서가는 옆면)에만. 세기 = 횡속도비 * SIDE_GAIN
 *  - 제자리 회전: 선체 주변 은은한 물결. 세기 = |yaw 각속도(rad/s)| * TURN_GAIN, 밝기는 TURN_STRENGTH 로 약하게
 * 램프는 위 RISE/FALL 과 같음.
 */
export const OCEAN_STIR_SIDE_GAIN = 4;
export const OCEAN_STIR_TURN_GAIN = 15;
/** 물결이 퍼지는 반경(m). 노이즈로 ±40% 불규칙하게 끝남 */
export const OCEAN_STIR_RADIUS = 45;
/** 기본 파수(rad/m)와 바깥으로 퍼지는 속도(rad/s). 노이즈로 파장/위상이 흐트러짐 */
export const OCEAN_STIR_RIPPLE_K = 0.4;
export const OCEAN_STIR_RIPPLE_W = 2.0;
/** 거리 왜곡(m): 클수록 완벽한 동심원에서 멀어짐 */
export const OCEAN_STIR_WARP = 12;
/** 옆걸음 물결 밝기 / 회전 물결 밝기(은은하게) */
export const OCEAN_STIR_STRENGTH = 0.45;
export const OCEAN_STIR_TURN_STRENGTH = 0.18;
/** 회전 항적: 최근 경로 곡률(1/m)로 선미 띠를 휘게 함. 최대 곡률, 스무딩 시간, 곡률 강조 배율 */
export const OCEAN_WAKE_CURVE_MAX = 0.02;
export const OCEAN_WAKE_CURVE_SMOOTH_SEC = 0.8;
export const OCEAN_WAKE_CURVE_GAIN = 1;
/** 곡률이 이 값(1/m) 이상이면 회전 물결을 바깥쪽에만 */
export const OCEAN_WAKE_CURVE_OUTER_K = 0.002;
/** 수선 거품선: 선체 옆 폭(m), 세기, 선수 쪽 배율 */
export const OCEAN_HULL_LINE_WIDTH = 1.6;
export const OCEAN_HULL_LINE_STRENGTH = 0.35;
export const OCEAN_HULL_LINE_BOW = 1.8;
/** 선미 항적 폭: 반폭 = NEAR + 선미 뒤 거리 × WIDEN (점점 넓어짐) + 시작부 HEAD_EXTRA (HEAD_LEN 에 걸쳐 사라짐) */
export const OCEAN_WAKE_NEAR_HALF_WIDTH = 12;
export const OCEAN_WAKE_WIDEN = 0.05;
export const OCEAN_WAKE_HEAD_LEN = 40;
export const OCEAN_WAKE_HEAD_EXTRA = 3.5;
/** 시작부 세기 배율 (선미 바로 뒤 1 + BOOST → HEAD_LEN 에서 1) */
export const OCEAN_WAKE_HEAD_BOOST = 0.6;
/** 선미 항적 시작점: 선미에서 선수 쪽으로 선체 길이의 이 비율만큼 앞(중앙부)에서 시작 */
export const OCEAN_WAKE_START_FORWARD = 0.45;
/** 항적 시작 반폭 = 해당 위치 선체 반폭 + 이 거품 여유(m, 선체 거품 smoothstep(7,..)와 동일) + 수선 거품선 폭 → 배 주변 거품과 이어짐 */
export const OCEAN_WAKE_START_FOAM_MARGIN = 7;
/** 항적 앞머리 둥근 진입 길이(m): 시작점 앞쪽(선체 아래)에서 타원형으로 전체 폭까지 */
export const OCEAN_WAKE_START_RAMP = 18;
/**
 * [wake2] 선미 난류 거품 (프로펠러 wash): 짧고 넓은 흰 띠, 내부는 얼룩/줄무늬 노이즈 (항적 끝 V 제거됨)
 * FADE_POW: 길이방향 감쇠 지수 (클수록 빨리 옅어짐)
 * FROTH_SPEED: 거품 노이즈가 끓는 속도 / FROTH_SCALE: 얼룩 크기(1/m, 클수록 잘게)
 * STREAK_SCALE: 뒤쪽 줄무늬 (x: 진행방향 1/m 작을수록 길게, y: 횡방향 1/m)
 * FROTH_NEAR/FAR: 거품 임계 (낮을수록 빽빽) — 선미 근처 / 끝
 * EDGE_JITTER: 가장자리 반폭 흔들림 비율
 */
export const OCEAN_WAKE_FADE_POW = 1.6;
export const OCEAN_WAKE_FROTH_SPEED = 0.6;
export const OCEAN_WAKE_FROTH_SCALE = 0.11;
export const OCEAN_WAKE_STREAK_SCALE = { x: 0.035, y: 0.35 } as const;
export const OCEAN_WAKE_FROTH_NEAR = 0.15;
export const OCEAN_WAKE_FROTH_FAR = 0.55;
export const OCEAN_WAKE_EDGE_JITTER = 0.25;
/** 띠 옆 가는 거품 실선: 휨(m), 뒤로 갈수록 바깥 이동(m/m), 간격(m), 두께(m), 퍼지는 범위(반폭 배수), 세기 */
export const OCEAN_WAKE_FILAMENT_WARP = 14;
export const OCEAN_WAKE_FILAMENT_DRIFT = 0.12;
export const OCEAN_WAKE_FILAMENT_SPACING = 7;
export const OCEAN_WAKE_FILAMENT_LINE = 0.6;
export const OCEAN_WAKE_FILAMENT_REACH = 2.6;
export const OCEAN_WAKE_FILAMENT_STRENGTH = 0.45;
/** 뱃머리 V: 팔이 바깥으로 휘는 정도 (반폭에 sqrt(뒤 거리)*CURVE 추가) */
/** 뱃머리 V: 뒤로 1m 갈 때 팔 두께 증가(m) — 멀수록 넓고 부드러워짐 */
/** 뱃머리 V: 선수(stem) 흰 물 부풂 반경(m)과 세기 */
export const OCEAN_BOW_BULGE_RADIUS = 14;
export const OCEAN_BOW_BULGE_STRENGTH = 0.8;
/** 선미 거품 띠: 선미 바로 뒤 반폭(m) */
/** 선미 거품 띠: 뒤로 1m 갈 때 반폭 증가량 (천천히 넓어짐) */
/** 선미 거품 띠: 뒤로 갈수록 줄무늬로 끊어지는 정도 0..1 */
export const OCEAN_WAKE_BREAKUP = 0.85;
/** 뱃머리 V: 반각 tan(10°) — 쾌속정처럼 좁게, 항적과 거의 나란히 */
export const OCEAN_BOW_WAVE_TAN = 0.18;
/** Nested straight bow V lines: main + this many progressively shorter inner Vs. */
export const OCEAN_BOW_WAVE_COUNT = 3;
export const OCEAN_BOW_WAVE_TAN_RATIO = 0.7;
export const OCEAN_BOW_WAVE_LENGTH_RATIO = 0.72;
export const OCEAN_BOW_WAVE_STRENGTH_RATIO = 0.55;
/** 뱃머리 V: 최고 속도일 때 뒤로 뻗는 길이(m) */
export const OCEAN_BOW_WAVE_LENGTH = 400;
/** 뱃머리 V: 선수 근처 팔 두께(m) */
export const OCEAN_BOW_WAVE_LINE = 3;
/** 뱃머리 V: 세기 (은은한 물결선) */
export const OCEAN_BOW_WAVE_STRENGTH = 0.6;
/** 항적 거품 세기 */
export const OCEAN_WAKE_FOAM_STRENGTH = 0.85;
/** 시뮬 높이 → 월드 Y 배율. 클수록 물결이 높게 보임 */
export const OCEAN_HEIGHT_SCALE = 52.626;
/** 항적 주변 거울 반사를 일그러뜨리는 정도. 0이면 일그러짐 없음 */
export const OCEAN_WAKE_DISTORT = 0.35;
/** 잔잔한 수면 잔물결 세기. 지금은 플랫이라 미사용. 다시 쓰려면 Water.tsx distortionScale에 넣으면 됨 */
export const OCEAN_CALM_DISTORT = 2.6;

/** 선체 길이의 절반 (월드). 물이 밀리는 선수~선미 범위 */
export const OCEAN_HULL_HALF_LEN = 85.204;
/** 선체 폭의 절반. 물이 밀리는 좌우 범위 */
export const OCEAN_HULL_HALF_WIDTH = 6.891;
/** 선체 높이의 절반. 흘수(잠긴 깊이)에 해당 */
export const OCEAN_HULL_HALF_HEIGHT = 16.916;
/** 수면(y=0) 기준 선체 중심 높이. 음수면 수면 아래로 잠긴 것 */
export const OCEAN_HULL_Y = -5.638;
/** 배가 한 칸 움직일 때 물을 밀어내는 세기. 클수록 첫 물결이 큼 */
export const OCEAN_WAKE_STRENGTH = 0.55;
/**
 * 파동이 있는 수면을 하얗게 만드는 세기.
 * 0이면 포말 없음 / 0.3 약함 / 1 아주 하얗게
 */
export const OCEAN_WAKE_FOAM = 0.32;
/** 이 거리(월드) 미만 이동은 정지로 보고 항적을 안 만듦 */
export const OCEAN_MOVE_THRESHOLD = 0.188;
/** 한 프레임에 이 거리 넘게 뛰면 텔레포트로 보고 스플래시 생략 */
export const OCEAN_TELEPORT_THRESHOLD = 125.3;
/** 이 스케일보다 작은 배는 항적을 만들지 않음 */
export const OCEAN_WAKE_MIN_SCALE = 0.002;
/**
 * 이 월드 Y보다 아래인 Ground는 육지(벽)로 안 봄.
 * 해저가 항만 전체를 육지로 덮지 않게 함
 */
export const OCEAN_LAND_MIN_Y = -5.838;
/** 이 월드 Y보다 위인 메시는 안벽 마스크에서 제외 */
export const OCEAN_LAND_MAX_Y = 225.34;
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
