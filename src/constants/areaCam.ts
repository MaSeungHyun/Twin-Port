/**
 * [areacam] Area_Cam.glb: area_point_X (버튼 위치, empty) → 클릭 시 CAM_X 위치/방향으로 카메라 이동.
 * 노드 이름은 대소문자 무시. 나중에 크레인별 버튼은 AREA_CAM_TARGETS 처럼 { id, label, point, cam } 를 추가하면 됨.
 */
/** glb 가 있으면 Area_Cam.glb 노드 사용, 없으면 코드로 만든 구역(C: 블록+크레인 프레이밍) */
export type AreaCamTarget = { id: string; key: string; label: string; glb?: { point: string; cam: string } };

/** [areagroup] 구역별 크레인 번호 범위 [시작, 끝] (GLB crane.NNN 의 NNN). 범위 안의 실제 존재하는 크레인만 사용 */
export const AREA_CRANE_RANGES: Record<string, [number, number]> = {
  A: [1, 15],
  B: [19, 42],
  C: [43, 48],
  D: [55, 63],
  E: [64, 75],
};

/** [areamap] 표시 구역 ↔ Area_Cam.glb 노드. GLB 의 기존 C → D구역, 기존 D → E구역, C 는 코드로 생성 (노드 없으면 버튼 생략) */
const glb = (k: string) => ({ point: `area_point_${k}`, cam: `CAM_${k}` });
export const AREA_CAM_TARGETS: AreaCamTarget[] = [
  { id: "area-A", key: "A", label: "A구역", glb: glb("A") },
  { id: "area-B", key: "B", label: "B구역", glb: glb("B") },
  { id: "area-C", key: "C", label: "C구역" },
  { id: "area-D", key: "D", label: "D구역", glb: glb("C") },
  { id: "area-E", key: "E", label: "E구역", glb: glb("D") },
];

/** 카메라 이동 시간(s), easeInOutCubic (CameraSlots 트윈) */
export const AREA_CAM_MOVE_DURATION = 1.6;
/** CAM_X 전방(-Z) 방향으로 OrbitControls target 을 둘 거리(m). area_point 가 카메라 앞에 있으면 그 투영 거리 우선 */
export const AREA_CAM_TARGET_DISTANCE = 300;
/** 투영 거리 하한(m) — 너무 가까우면 오빗 회전이 튐 */
export const AREA_CAM_TARGET_MIN_DISTANCE = 20;
/** 버튼을 area_point 위로 띄울 높이(m) */
export const AREA_CAM_BUTTON_LIFT = 0;

/** window event: 버튼 → CameraSlots 트윈 (detail: { p, t, duration }) */
/** [depth] Depth 안에서 휠로 멀리 빠지면(타깃 거리 > 진입 거리 × 이 값) Depth 를 통째로 나가 최상위 시점으로 */
export const DEPTH_EXIT_ZOOM_FACTOR = 1.8;
/** [depth] 위 판정은 마지막 휠 아웃 입력 후 이 시간(ms) 안에서만 (프로그램 카메라 이동 제외) */
export const DEPTH_EXIT_WHEEL_WINDOW_MS = 800;
export const CAMERA_FLY_TO_EVENT = "tp:camera-fly-to";
/** depth: 이동과 함께 depth 경로에 들어감 (level 0 = 구역, 1 = 크레인 …). 없으면 depth 변화 없음 */
export type CameraFlyToDetail = { p: [number, number, number]; t: [number, number, number]; duration?: number; depth?: { level: number; label: string } };

/** [areagroup] 구역 안 크레인 그룹 크기 (연속 3대 → A1, A2 …) */
export const CRANE_GROUP_SIZE = 3;
/** 그룹 버튼을 가운데 크레인(트래킹 타깃) 위로 띄울 높이(m) */
export const CRANE_GROUP_BUTTON_LIFT = 40;
/** 그룹 클릭 시 카메라: 그룹 중심에서 크레인 줄 수직 방향(현재 카메라 쪽) 수평 거리(m) */
export const CRANE_GROUP_CAM_DISTANCE = 420;

/** C구역 버튼 위치 = 야드 블록 코드(B21 … B27) 범위 블록들의 합친 footprint 중심 위 */
export const AREA_C_BLOCK_RANGE: [number, number] = [21, 27];
/** 야드 블록 코드 → 번호 (B21, B021, B.021, B_21 …) */
export const AREA_C_BLOCK_CODE_PATTERN = /^B[._-]?0*(\d+)$/i;
/** C구역 fallback 카메라: 거리 = max(최소, 프레이밍 폭 × 배율), 높이 = 거리 × 비율 */
export const AREA_C_CAM_MIN_DISTANCE = 500;
export const AREA_C_CAM_SPAN_FACTOR = 1.1;
export const AREA_C_CAM_HEIGHT_RATIO = 0.6;
/** 그룹 클릭 시 카메라 높이(그룹 중심 기준, m) */
export const CRANE_GROUP_CAM_HEIGHT = 260;
/** 바다(정박 선박) 쪽 판정: 그룹 중심에서 이 거리(m) 안의 가장 가까운 선박 쪽을 바다로 봄 */
export const CRANE_GROUP_SHIP_SEARCH_RADIUS = 600;
/** 바라보는 지점을 크레인 → 선박 쪽으로 옮기는 비율(0 = 크레인 중심, 1 = 선박) / 최대 이동(m) */
export const CRANE_GROUP_TARGET_SHIP_BLEND = 0.5;
export const CRANE_GROUP_TARGET_SHIP_MAX_SHIFT = 120;
/** 크레인 그룹 depth level */
export const CRANE_GROUP_DEPTH_LEVEL = 1;

/** [camslots] Shift+숫자 저장 알림 표시 시간(ms) / 화면 하단에서의 위치(px, breadcrumb 위) */
export const CAM_SLOT_NOTICE_MS = 1500;
export const CAM_SLOT_NOTICE_BOTTOM_PX = 90;

/** 하단 breadcrumb 구분자 */
export const DEPTH_BREADCRUMB_SEPARATOR = ">";
/** 마지막에도 구분자 표시 ("A >") */
export const DEPTH_BREADCRUMB_TRAILING = true;
/** 구역 버튼 depth level */
export const AREA_DEPTH_LEVEL = 0;
