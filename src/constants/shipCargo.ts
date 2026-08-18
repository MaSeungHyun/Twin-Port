import { CONTAINER_COLORS, CONTAINER_W, type ContainerColorKey } from "./container";
import { SHIP_SCALE } from "./model";

/** 선박 화물창 격자 (bay=길이, row=폭, tier=단) */
export const SHIP_CARGO = {
  bays: 14,
  rows: 6,
  tiers: 6,
  /**
   * 선박 로컬 원점 오프셋 (모델 단위).
   * 베이크 컨테이너 클러스터 중심(~2.23, deck Y, 0) 기준으로 격자 시작.
   */
  originLocal: [-32, 14.5, -5.88] as [number, number, number],
  /** 슬롯 로컬 Yaw (컨테이너 장축을 선박 길이에 맞춤) */
  yawLocal: Math.PI / 2,
} as const;

export type ShipCargoGrid = {
  bays: number;
  rows: number;
  tiers: number;
  originLocal: [number, number, number];
};

/** 선체 스케일에 비례해 갑판을 채우는 격자. 컨테이너 월드 크기는 유지 */
export function shipCargoGrid(scale: number): ShipCargoGrid {
  const ratio = scale / SHIP_SCALE;
  const bays = Math.max(1, Math.round(SHIP_CARGO.bays * ratio));
  const rows = Math.max(1, Math.round(SHIP_CARGO.rows * ratio));
  const tiers = Math.max(1, Math.round(SHIP_CARGO.tiers * ratio));
  const pitch = 1 / scale;
  return {
    bays,
    rows,
    tiers,
    originLocal: [
      SHIP_CARGO.originLocal[0],
      SHIP_CARGO.originLocal[1],
      -(rows * CONTAINER_W * pitch) / 2,
    ],
  };
}

export type ShipLoadOrder = "bay" | "tier" | "row";

/**
 * 선수(+X 로컬)가 월드 (dx,dz)를 향하는 Yaw.
 * 모델: yaw 적용 후 bow ≈ (cos yaw, 0, -sin yaw)
 */
export function yawToward(dx: number, dz: number) {
  return normalizeYaw(Math.atan2(-dz, dx));
}

/** 선수 방향 직선 이동량 */
export function bowOffset(yaw: number, dist: number) {
  return shipLocalOffset(yaw, dist, 0, 0);
}

/** 선박 로컬 (선수 +X, 위 +Y, 우현 +Z) → 월드 이동량 */
export function shipLocalOffset(yaw: number, lx: number, ly: number, lz: number) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return {
    x: lx * c + lz * s,
    y: ly,
    z: -lx * s + lz * c,
  };
}

export function normalizeYaw(yaw: number) {
  let y = yaw;
  while (y > Math.PI) y -= Math.PI * 2;
  while (y <= -Math.PI) y += Math.PI * 2;
  return y;
}

/** from → to 최단 각 보간용 목표 yaw (from 기준 연속값) */
export function yawLerpTarget(from: number, to: number) {
  return from + normalizeYaw(to - from);
}

export function cargoSlotOrder(
  bay: number,
  row: number,
  tier: number,
  order: ShipLoadOrder,
  grid: Pick<ShipCargoGrid, "bays" | "rows" | "tiers"> = SHIP_CARGO,
): number {
  const { bays, rows, tiers } = grid;
  const t = tier - 1;
  switch (order) {
    case "tier":
      return t * bays * rows + bay * rows + row;
    case "row":
      return row * bays * tiers + bay * tiers + t;
    case "bay":
    default:
      return bay * rows * tiers + row * tiers + t;
  }
}

export const SHIP_CARGO_COLOR_CYCLE: readonly ContainerColorKey[] =
  CONTAINER_COLORS.map((c) => c.key);
