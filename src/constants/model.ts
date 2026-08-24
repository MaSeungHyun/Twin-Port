import { CONTAINER_SCALE } from "@/constants/container";
import type { CraneInstance } from "@/views/viewport/_components/Port/Crane";
import type { ShipInstance } from "@/views/viewport/_components/Port/Ship";

/** 야드 컨테이너 스케일의 절반 */
export const SHIP_SCALE = CONTAINER_SCALE / 2;
export const CRANE_SCALE = 0.1;
/**
 * overhead_crane.glb 로컬 X 폭(스팬).
 * 인스턴스 스케일 = 블록 sizeX / 이 값.
 */
export const OVERHEAD_CRANE_SPAN_X = 8.53;
/** 1이면 크레인 스팬이 블록 폭과 같음 */
export const OVERHEAD_CRANE_SCALE = 1;
/** 수면(y=0) 기준. 선체 스케일에 비례 */
export const SHIP_POSITION_Y = -8.6 * SHIP_SCALE;

/**
 * 안벽 배 위치 튜닝.
 * - out: 크레인 앞(+ 바깥/바다) / - 안쪽
 * - along: 부두 길이 방향 (+ 선수 쪽)
 * - yaw: 추가 회전(라디안)
 *
 * 콘솔 `[Quay] 0: ...` 번호로 SHIP_BERTH_OFFSETS[번호] 지정.
 */
export const SHIP_BERTH_TUNE = {
  out: 0.27,
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
const MERGED_SHIP_SCALE = SHIP_SCALE * 1.85;

export type ShipPlacement = {
  label: string;
  /** tween / 화물 매칭 ID */
  locators: readonly number[];
  /** 월드 안벽 위치. Cube 불필요 */
  position: [number, number, number];
  /** 월드 yaw (도). 선수 +X */
  yawDeg: number;
  scale: number;
};

export const SHIP_PLACEMENTS: readonly ShipPlacement[] = [
  {
    label: "Ship",
    locators: [0],
    position: [0.37198, SHIP_POSITION_Y, 8.46598],
    yawDeg: 70.264,
    scale: SHIP_SCALE,
  },
  {
    label: "001",
    locators: [1],
    position: [2.00706, SHIP_POSITION_Y, 3.5811],
    yawDeg: 70.264,
    scale: SHIP_SCALE,
  },
  {
    label: "002",
    locators: [2],
    position: [-2.11384, SHIP_POSITION_Y, 8.6851],
    yawDeg: 90,
    scale: SHIP_SCALE,
  },
  {
    label: "003",
    locators: [3],
    position: [-2.11384, SHIP_POSITION_Y, 3.25046],
    yawDeg: 90,
    scale: SHIP_SCALE,
  },
  {
    label: "005",
    locators: [5],
    position: [-0.0516, SHIP_POSITION_Y, -3.48168],
    yawDeg: 0,
    scale: SHIP_SCALE,
  },
  {
    label: "006+007",
    locators: [6, 7],
    position: [4.59694, SHIP_POSITION_Y, -7.84586],
    yawDeg: 62,
    scale: MERGED_SHIP_SCALE,
  },
  {
    label: "008+009",
    locators: [8, 9],
    position: [-1.49624, SHIP_POSITION_Y, -15.20962],
    yawDeg: 0,
    scale: MERGED_SHIP_SCALE,
  },
];

export const SHIP_INSTANCES: ShipInstance[] = SHIP_PLACEMENTS.map((ship) => ({
  position: [ship.position[0], ship.position[1], ship.position[2]],
  rotation: [0, (ship.yawDeg * Math.PI) / 180, 0],
  scale: ship.scale,
}));

export const CRANE_INSTANCES: CraneInstance[] = [
  { position: [11.6, 0, 14], scale: CRANE_SCALE },
  { position: [11.6, 0, 16], scale: CRANE_SCALE },
  { position: [11.6, 0, 18], scale: CRANE_SCALE },

  { position: [-11, 0, 14], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-11, 0, 16], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-11, 0, 18], rotation: YAW_180, scale: CRANE_SCALE },

  { position: [11.6, 0, 0], scale: CRANE_SCALE },
  { position: [11.6, 0, 2], scale: CRANE_SCALE },
  { position: [11.6, 0, 4], scale: CRANE_SCALE },

  { position: [-11, 0, 0], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-11, 0, 2], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-11, 0, 4], rotation: YAW_180, scale: CRANE_SCALE },

  { position: [11.6, 0, -10], scale: CRANE_SCALE },
  { position: [11.6, 0, -12], scale: CRANE_SCALE },
  { position: [11.6, 0, -14], scale: CRANE_SCALE },

  { position: [-11, 0, -10], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-11, 0, -12], rotation: YAW_180, scale: CRANE_SCALE },
  { position: [-11, 0, -14], rotation: YAW_180, scale: CRANE_SCALE },
];
