import {
  CONTAINER_COLORS,
  CONTAINER_D,
  CONTAINER_W,
  type ContainerColorKey,
} from "./container";

/**
 * ship.glb 실측 갑판 (Ship.tsx 재정렬 후 로컬: XZ 중심=0, 선저 y=0, 선수 +X, scale 1 기준).
 * 선체 L≈131.2(x ±65.6), B≈19.1(z ±9.57). 선미 브리지 x≈-56~-33(top≈34.5), 선수루 x>34.
 * 화물 구역(해치 커버 상면 y≈16.3)은 x≈-31~+33, 불워크 안쪽 z≈±8.3.
 * 모델 교체 시 이 값만 다시 재면 격자/원점이 자동 계산됨.
 */
export const SHIP_DECK = {
  xMin: -33.5, // ship.glb 재측정: 브리지 앞면 x≈-34 (y 26+)
  xMax: 35.5, // 선수루 시작 x≈36 (y 21.5+). 가용 69m → 12베이(72.8m)는 불가, 11베이 최대
  zHalf: 8.3,
  y: 16.3,
} as const;

/* ───────────── 사용자 조정값 (여기만 바꾸면 됨) ───────────── */

/** 맨 아래 단 높이 오프셋(m). 기준 = 해치 커버 상면(SHIP_DECK.y 16.3). 예) -5 → 5m 아래에서 시작 */
export const SHIP_CARGO_Y_OFFSET = -14.9; // ship.glb 상갑판/코밍 가장자리 높이 ≈14.9 에 맞춤
/** 길이 방향 칸 수(베이). 늘리면 적재 컨테이너 수가 늘어남 (상한 없음, 갑판 중앙 정렬) */
export const SHIP_CARGO_BAYS = 12;
/** 폭 방향 칸 수(줄) */
export const SHIP_CARGO_ROWS = 5;
/** 높이 칸 수(단) */
export const SHIP_CARGO_TIERS = 9;
/** 선박 적재 데모: 아래 단부터 한 층(tier)씩 쌓이는 간격(초). 층 하나가 통째로 나타남 */
export const SHIP_CARGO_TIER_INTERVAL = 0.6;
/** 위치 미세 조정(m, 선박 로컬). X=선수(+)/선미(-), Z=우현(+)/좌현(-) */
export const SHIP_CARGO_OFFSET_X = 0;
export const SHIP_CARGO_OFFSET_Z = 0;

/* ─────────────────────────────────────────────────────────── */

/** 실제 맨 아래 단 높이 = 갑판 기준 + 오프셋 */
export const SHIP_CARGO_BASE_Y = SHIP_DECK.y + SHIP_CARGO_Y_OFFSET;

/** 선박 화물창 격자 (bay=길이, row=폭, tier=단) — 위 사용자 값을 그대로 사용 */
export const SHIP_CARGO = {
  bays: SHIP_CARGO_BAYS,
  rows: SHIP_CARGO_ROWS,
  tiers: SHIP_CARGO_TIERS,
  /** 선박 로컬 격자 시작점 (bay0/row0/tier1 모서리). 갑판 중앙 정렬 */
  originLocal: [
    (SHIP_DECK.xMin + SHIP_DECK.xMax) / 2 -
      (SHIP_CARGO_BAYS * CONTAINER_D) / 2 +
      SHIP_CARGO_OFFSET_X,
    SHIP_CARGO_BASE_Y,
    -(SHIP_CARGO_ROWS * CONTAINER_W) / 2 + SHIP_CARGO_OFFSET_Z,
  ] as [number, number, number],
  /** 슬롯 로컬 Yaw (컨테이너 장축을 선박 길이에 맞춤) */
  yawLocal: Math.PI / 2,
} as const;

export type ShipCargoGrid = {
  bays: number;
  rows: number;
  tiers: number;
  originLocal: [number, number, number];
};

/**
 * 선체 스케일 s일 때 격자. 칸 수는 사용자 값 그대로(자동 상한 없음), 컨테이너는 선박 로컬 실치수(pitch 1, 선박 스케일을 따라감).
 * 갑판 중앙 정렬 + 오프셋. 좌표는 선박 로컬 → 선박 group 변환을 따라감.
 */
// SHIP_DECK는 더 이상 칸 수를 제한하지 않음(중앙 기준점으로만 사용). 길이 = 베이 수 × CONTAINER_D 그대로.
export function shipCargoGrid(_scale: number): ShipCargoGrid {
  const bays = Math.max(1, Math.round(SHIP_CARGO_BAYS));
  const rows = Math.max(1, Math.round(SHIP_CARGO_ROWS));
  const tiers = Math.max(1, Math.round(SHIP_CARGO_TIERS));
  const pitch = 1; // 선박 로컬 실치수 (스케일 보정/축소 없음)
  return {
    bays,
    rows,
    tiers,
    originLocal: [
      (SHIP_DECK.xMin + SHIP_DECK.xMax) / 2 -
        (bays * CONTAINER_D * pitch) / 2 +
        SHIP_CARGO_OFFSET_X,
      SHIP_CARGO_BASE_Y,
      -(rows * CONTAINER_W * pitch) / 2 + SHIP_CARGO_OFFSET_Z,
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
export function shipLocalOffset(
  yaw: number,
  lx: number,
  ly: number,
  lz: number,
) {
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
