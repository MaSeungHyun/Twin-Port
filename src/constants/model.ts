import type { CraneInstance } from "@/views/viewport/_components/Port/Crane";
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

const YAW_180: [number, number, number] = [0, Math.PI, 0];

export type ShipPlacement = {
  label: string;
  /** tween / 화물 매칭 ID */
  locators: readonly number[];
  /** 월드 안벽 위치. Cube 불필요 */
  position: [number, number, number];
  /** 월드 yaw (도). 선수 +X */
  yawDeg: number;
};

/** Ground Y 90° → 0° 보정: x'=-z, z'=x, yaw-90° */
export const SHIP_PLACEMENTS: readonly ShipPlacement[] = [
  {
    label: "Ship",
    locators: [0],
    // 기준 선석: ship.glb busan 원위치 (선체 중심 x,z / 선저 y)
    position: [-5.06, SHIP_POSITION_Y, -158.68],
    yawDeg: 0,
  },
  {
    label: "001",
    locators: [1],
    position: [-218.256, SHIP_POSITION_Y, 83.152],
    yawDeg: -19.736,
  },
  {
    label: "002",
    locators: [2],
    position: [-538.022, SHIP_POSITION_Y, -175.022],
    yawDeg: 0,
  },
  {
    label: "003",
    locators: [3],
    position: [-197.541, SHIP_POSITION_Y, -175.022],
    yawDeg: 0,
  },
  {
    label: "005",
    locators: [5],
    position: [224.227, SHIP_POSITION_Y, -45.823],
    yawDeg: -90,
  },
  {
    label: "006+007",
    locators: [6, 7],
    position: [497.643, SHIP_POSITION_Y, 245.408],
    yawDeg: -28,
  },
  {
    label: "008+009",
    locators: [8, 9],
    position: [958.983, SHIP_POSITION_Y, -136.329],
    yawDeg: -90,
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
