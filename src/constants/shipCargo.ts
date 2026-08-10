import { CONTAINER_COLORS, type ContainerColorKey } from "./container";
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
  /** 선박 스케일 적용 전 로컬 피치 = 월드 CONTAINER_* / SHIP_SCALE */
  pitchScale: 1 / SHIP_SCALE,
} as const;

export type ShipLoadOrder = "bay" | "tier" | "row";

export type ShipLoadProfile = {
  /** 첫 사이클 적재 시작 지연 */
  delay: number;
  stagger: number;
  duration: number;
  dropHeight: number;
  ease: string;
  order: ShipLoadOrder;
  /** 적재 완료 후 출항까지 대기 */
  departDelay: number;
  departDuration: number;
  /** 출항 대각선 |ΔX|·|ΔZ| */
  departDistance: number;
  /** 입항 시간 */
  arriveDuration: number;
  arriveEase: string;
};

export const SHIP_CARGO_ANIM = {
  ease: "power2.out",
  departEase: "power1.in",
  hiddenScale: 0.0001,
} as const;

/** 선박마다 다른 적재·출항 프로파일 (적재 방향은 전 선박 bay→row→tier 고정) */
export function getShipLoadProfile(shipIndex: number): ShipLoadProfile {
  return {
    delay: shipIndex * 1.35 + (shipIndex % 2) * 0.55,
    stagger: 0.007 + (shipIndex % 4) * 0.003,
    duration: 0.38 + (shipIndex % 3) * 0.12,
    dropHeight: 2.5 + (shipIndex % 3) * 1.2,
    ease: shipIndex % 2 === 0 ? "power2.out" : "power1.inOut",
    order: "bay",
    departDelay: 0.55 + (shipIndex % 3) * 0.2,
    departDuration: 14 + (shipIndex % 4) * 2.4,
    departDistance: 110 + (shipIndex % 3) * 18,
    arriveDuration: 12 + (shipIndex % 3) * 2.2,
    arriveEase: "power2.out",
  };
}

/** 출항 대각선: X는 안벽 바깥(좌−/우+), Z는 공통 −Z */
export function getShipDepartSigns(berthX: number) {
  return {
    sx: Math.sign(berthX || 1) || 1,
    sz: -1,
  };
}

/**
 * 선수(+X 로컬)가 월드 (dx,dz)를 향하는 Yaw.
 * 모델: yaw 적용 후 bow ≈ (cos yaw, 0, -sin yaw)
 */
export function yawToward(dx: number, dz: number) {
  return normalizeYaw(Math.atan2(-dz, dx));
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
): number {
  const { bays, rows, tiers } = SHIP_CARGO;
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
