import { shipLocalOffset, type ShipLoadOrder } from "./shipCargo";

/** 공통 루프 옵션 */
export const SHIP_TWEEN = {
  enabled: true,
  hiddenScale: 0.0001,
  loadStart: 0.12,
  hideGap: 0.45,
  sidestepEase: "power1.inOut",
  turnEase: "power1.inOut",
  /** 입항 시작 로컬 오프셋. 제자리까지 이만큼만 이동 */
  arriveFromX: -0.6,
  arriveFromY: 0,
  arriveFromZ: 0,
} as const;

export type ShipTweenConfig = {
  label: string;
  /** SHIP_PLACEMENTS.locators와 맞춤 */
  locators: readonly number[];
  /** 출항 전 로컬 X (선수). sidestepSpace가 world면 월드 +X */
  sidestepX: number;
  /** 출항 전 로컬 Y (위) */
  sidestepY: number;
  /** 출항 전 로컬 Z (우현). sidestepSpace가 world면 월드 +Z */
  sidestepZ: number;
  /** local: 선박 로컬 XYZ. world: 월드 XZ(수평) */
  sidestepSpace: "local" | "world";
  /** 있으면 sidestepXYZ 대신 로컬 XZ에서 이 각(도) × sidestepDist */
  sidestepYawDeg: number | null;
  sidestepDist: number;
  sidestepDuration: number;
  /** 사이드스텝 후 추가 회전(도) */
  turnDeg: number;
  turnDuration: number;
  delay: number;
  stagger: number;
  loadDuration: number;
  dropHeight: number;
  loadEase: string;
  loadOrder: ShipLoadOrder;
  departDelay: number;
  departDuration: number;
  departDistance: number;
  departEase: string;
  arriveDuration: number;
  arriveEase: string;
};

export const SHIP_TWEENS: readonly ShipTweenConfig[] = [
  {
    label: "Ship",
    locators: [0],
    sidestepX: 0,
    sidestepY: 0,
    sidestepZ: -0.6,
    sidestepSpace: "local",
    sidestepYawDeg: null,
    sidestepDist: 3,
    sidestepDuration: 5,
    turnDeg: 0,
    turnDuration: 2.2,
    delay: 0,
    stagger: 0.007,
    loadDuration: 0.38,
    dropHeight: 0.5,
    loadEase: "power2.out",
    loadOrder: "tier",
    departDelay: 0.55,
    departDuration: 14,
    departDistance: 5,
    departEase: "power1.in",
    arriveDuration: 12,
    arriveEase: "power2.out",
  },
  {
    label: "001",
    locators: [1],
    sidestepX: 0,
    sidestepY: 0,
    sidestepZ: 0,
    sidestepSpace: "local",
    sidestepYawDeg: null,
    sidestepDist: 3,
    sidestepDuration: 2.4,
    turnDeg: 0,
    turnDuration: 2.2,
    delay: 1.9,
    stagger: 0.01,
    loadDuration: 0.5,
    dropHeight: 2.54,
    loadEase: "power1.inOut",
    loadOrder: "tier",
    departDelay: 0.75,
    departDuration: 16.4,
    departDistance: 4.8,
    departEase: "power1.in",
    arriveDuration: 14.2,
    arriveEase: "power2.out",
  },
  {
    label: "002",
    locators: [2],
    sidestepX: -0,
    sidestepY: 0,
    sidestepZ: 0.4,
    sidestepSpace: "local",
    sidestepYawDeg: null,
    sidestepDist: 3,
    sidestepDuration: 2.4,
    turnDeg: -20,
    turnDuration: 8.2,
    delay: 2.7,
    stagger: 0.013,
    loadDuration: 0.62,
    dropHeight: 4.58,
    loadEase: "power2.out",
    loadOrder: "tier",
    departDelay: 0.95,
    departDuration: 18.8,
    departDistance: 6.6,
    departEase: "power1.in",
    arriveDuration: 16.4,
    arriveEase: "power2.out",
  },
  {
    label: "003",
    locators: [3],
    sidestepX: 0,
    sidestepY: 0,
    sidestepZ: 0.8,
    sidestepSpace: "local",
    sidestepYawDeg: null,
    sidestepDist: 6.4,
    sidestepDuration: 5.4,
    turnDeg: -35,
    turnDuration: 8.2,
    delay: 4.6,
    stagger: 0.016,
    loadDuration: 0.38,
    dropHeight: 0.5,
    loadEase: "power1.inOut",
    loadOrder: "tier",
    departDelay: 0.55,
    departDuration: 14,
    departDistance: 7,
    departEase: "power1.in",
    arriveDuration: 12,
    arriveEase: "power2.out",
  },
  {
    label: "005",
    locators: [5],
    sidestepX: 0,
    sidestepY: 0,
    sidestepZ: 0,
    sidestepSpace: "local",
    sidestepYawDeg: null,
    sidestepDist: 3,
    sidestepDuration: 2.4,
    turnDeg: 0,
    turnDuration: 2.2,
    delay: 7.3,
    stagger: 0.01,
    loadDuration: 0.62,
    dropHeight: 4.58,
    loadEase: "power1.inOut",
    loadOrder: "tier",
    departDelay: 0.95,
    departDuration: 16.4,
    departDistance: 7.2,
    departEase: "power1.in",
    arriveDuration: 16.4,
    arriveEase: "power2.out",
  },
  {
    label: "006+007",
    locators: [6, 7],
    sidestepX: 0.6,
    sidestepY: 0,
    sidestepZ: 0.6,
    sidestepSpace: "world",
    sidestepYawDeg: null,
    sidestepDist: 0.6,
    sidestepDuration: 2.4,
    turnDeg: 0,
    turnDuration: 2.2,
    delay: 8.1,
    stagger: 0.013,
    loadDuration: 0.38,
    dropHeight: 0.5,
    loadEase: "power2.out",
    loadOrder: "tier",
    departDelay: 0.55,
    departDuration: 18.8,
    departDistance: 6,
    departEase: "power1.in",
    arriveDuration: 12,
    arriveEase: "power2.out",
  },
  {
    label: "008+009",
    locators: [8, 9],
    sidestepX: 0,
    sidestepY: 0,
    sidestepZ: -1,
    sidestepSpace: "local",
    sidestepYawDeg: null,
    sidestepDist: 3,
    sidestepDuration: 5,
    turnDeg: 0,
    turnDuration: 2.2,
    delay: 10.8,
    stagger: 0.007,
    loadDuration: 0.5,
    dropHeight: 2.54,
    loadEase: "power2.out",
    loadOrder: "tier",
    departDelay: 0.75,
    departDuration: 14,
    departDistance: 7.6,
    departEase: "power1.in",
    arriveDuration: 14.2,
    arriveEase: "power2.out",
  },
];

export function getShipTween(locatorIndex: number): ShipTweenConfig {
  return (
    SHIP_TWEENS.find((tween) => tween.locators.includes(locatorIndex)) ??
    SHIP_TWEENS[0]!
  );
}

export function resolveSidestep(tween: ShipTweenConfig) {
  if (tween.sidestepYawDeg == null) {
    return { x: tween.sidestepX, y: tween.sidestepY, z: tween.sidestepZ };
  }
  const yaw = (tween.sidestepYawDeg * Math.PI) / 180;
  return {
    x: Math.cos(yaw) * tween.sidestepDist,
    y: tween.sidestepY,
    z: Math.sin(yaw) * tween.sidestepDist,
  };
}

/** 안벽에서 사이드스텝 월드 이동량. world면 XZ를 월드 축 그대로 씀 */
export function sidestepWorldDelta(tween: ShipTweenConfig, berthYaw: number) {
  const local = resolveSidestep(tween);
  if (tween.sidestepSpace === "world") return local;
  return shipLocalOffset(berthYaw, local.x, local.y, local.z);
}
