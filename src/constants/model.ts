import type { ShipInstance } from "@/views/viewport/_components/Port/Ship";

/**
 * overhead_crane.glb 로컬 X 폭(스팬).
 * 인스턴스 스케일 = 블록 sizeX / 이 값.
 */
export const OVERHEAD_CRANE_SPAN_X = 8.53;
/** 수면 기준 선박 pivot Y (GLB 원본 크기, 월드 m) */
export const SHIP_POSITION_Y = 10.36; // ship.glb 기준: 선저 y≈10.36, busan 수면 Plane y≈15.29 (흘수≈5m)

/**
 * 안벽 배 위치 튜닝.
 * - out: 크레인 앞(+ 바깥/바다) / - 안쪽
 * - along: 부두 길이 방향 (+ 선수 쪽)
 * - yaw: 추가 회전(라디안)
 *
 * 콘솔 `[Quay] 0: ...` 번호로 SHIP_BERTH_OFFSETS[번호] 지정.
 */
export const SHIP_BERTH_TUNE = {
  out: 16.916,
  along: 0,
  yaw: 0,
};

export type ShipBerthOffset = {
  out?: number;
  along?: number;
  yaw?: number;
};

export const SHIP_BERTH_OFFSETS: Record<number, ShipBerthOffset> = {
  // 예: 0: { out: -0.8, along: 0.4 },
};

export type CraneInstance = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
};

const YAW_180: [number, number, number] = [0, Math.PI, 0];

export type ShipPlacement = {
  label: string;
  /** tween / 화물 매칭 ID */
  locators: readonly number[];
  /** 월드 안벽 위치. Cube 불필요 */
  position: [number, number, number];
  /** 월드 yaw (도). 선수 +X */
  yawDeg: number;
  /** 접안 크레인 그룹 (AreaCamButtons 3기 묶음 라벨) */
  craneGroup: string;
  /** 그룹 3기 GLB 인덱스 — 화살표 위치에서 가장 가까운 그룹 */
  cranes: readonly number[];
};

/** Ground Y 90° → 0° 보정: x'=-z, z'=x, yaw-90° */
/** 원본 BUSAN.glb(5c90967) Ship_Point.NNN 화살표 Empty 월드 위치·회전 (로컬 +Y = 선수) */
export const SHIP_PLACEMENTS: readonly ShipPlacement[] = [
  {
    label: "000",
    locators: [0],
    position: [-148.544, SHIP_POSITION_Y, 97.492],
    yawDeg: -21.345,
    craneGroup: "A1",
    cranes: [1, 2, 3],
  },
  {
    label: "002",
    locators: [1],
    position: [-413.284, SHIP_POSITION_Y, -1.894],
    yawDeg: -21.345,
    craneGroup: "A3",
    cranes: [10, 11, 12],
  },
  {
    label: "005",
    locators: [2],
    position: [-439.098, SHIP_POSITION_Y, -158.883],
    yawDeg: 0,
    craneGroup: "B2",
    cranes: [25, 26, 27],
  },
  {
    label: "007",
    locators: [3],
    position: [-151.562, SHIP_POSITION_Y, -158.883],
    yawDeg: 0,
    craneGroup: "B4",
    cranes: [31, 32, 33],
  },
  {
    label: "008",
    locators: [4],
    position: [-1.61, SHIP_POSITION_Y, -158.883],
    yawDeg: 0,
    craneGroup: "B5",
    cranes: [34, 35, 36],
  },
  {
    label: "010",
    locators: [5],
    position: [214.32, SHIP_POSITION_Y, 4.734],
    yawDeg: -90,
    craneGroup: "C2",
    cranes: [46, 47, 48],
  },
  {
    label: "011",
    locators: [6],
    position: [445.665, SHIP_POSITION_Y, 214.64],
    yawDeg: -30,
    craneGroup: "D1",
    cranes: [55, 56, 57],
  },
  {
    label: "013",
    locators: [7],
    position: [696.167, SHIP_POSITION_Y, 359.267],
    yawDeg: -30,
    craneGroup: "D3",
    cranes: [61, 62, 63],
  },
  {
    label: "014",
    locators: [8],
    position: [960.037, SHIP_POSITION_Y, 30.763],
    yawDeg: -90,
    craneGroup: "E1",
    cranes: [64, 65, 66],
  },
  {
    label: "016",
    locators: [9],
    position: [960.037, SHIP_POSITION_Y, -191.459],
    yawDeg: -90,
    craneGroup: "E3",
    cranes: [70, 71, 72],
  },
];

export const SHIP_INSTANCES: ShipInstance[] = SHIP_PLACEMENTS.map((ship) => ({
  position: [ship.position[0], ship.position[1], ship.position[2]],
  rotation: [0, (ship.yawDeg * Math.PI) / 180, 0],
  scale: 1,
}));

export const CRANE_INSTANCES: CraneInstance[] = [
  { position: [732.84, -0.2, 834.51] },
  { position: [732.84, -0.2, 959.81] },
  { position: [732.84, -0.2, 1085.11] },

  { position: [-683.05, -0.2, 834.51], rotation: YAW_180 },
  { position: [-683.05, -0.2, 959.81], rotation: YAW_180 },
  { position: [-683.05, -0.2, 1085.11], rotation: YAW_180 },

  { position: [732.84, -0.2, -42.59] },
  { position: [732.84, -0.2, 82.71] },
  { position: [732.84, -0.2, 208.01] },

  { position: [-683.05, -0.2, -42.59], rotation: YAW_180 },
  { position: [-683.05, -0.2, 82.71], rotation: YAW_180 },
  { position: [-683.05, -0.2, 208.01], rotation: YAW_180 },

  { position: [732.84, -0.2, -669.09] },
  { position: [732.84, -0.2, -794.39] },
  { position: [732.84, -0.2, -919.69] },

  { position: [-683.05, -0.2, -669.09], rotation: YAW_180 },
  { position: [-683.05, -0.2, -794.39], rotation: YAW_180 },
  { position: [-683.05, -0.2, -919.69], rotation: YAW_180 },
];

/**
 * Blender "Ship_Point.NNN" Empty(Arrow) → 선박 배치.
 * 선박 메시의 선수(bow)는 로컬 +X. Empty 의 화살표(Blender 로컬 +Z = glTF 로컬 +Y)를
 * 선수 방향으로 간주하고, 그 방향의 수평 성분으로 yaw 만 계산한다(기울기 무시).
 * 배가 반대로 보이면 180, 옆으로 보이면 ±90 으로 보정.
 */
export const SHIP_POINT_YAW_OFFSET_DEG = 0;
