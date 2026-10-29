import { shipLocalOffset, type ShipLoadOrder } from "./shipCargo";

/** 공통 루프 옵션 */
export const SHIP_TWEEN = {
  enabled: true,
  /** true: 적재 → 유지 → 사이드스텝 → 회전 → 출항(화물 실은 채) → 사라짐 → 빈 배 입항 → 반복 */
  shipMotion: true as boolean,
  /** 적재 완료 후 유지 시간(초). shipMotion=false면 이후 비우고 재적재 */
  loadedHold: 5,
  hiddenScale: 0.0001,
  loadStart: 0.12,
  hideGap: 0.45,
  sidestepEase: "power1.inOut",
  turnEase: "power1.inOut",
  /**
   * 모든 배 공통 루프 길이(초). 타임라인 끝을 여기까지 채워서 배끼리 위상이 고정됨
   * → 아래 delay(충돌 회피용)가 매 루프 그대로 유효. 가장 긴 배(2번 ≈105s)보다 커야 함. delay는 0~83초로 퍼뜨려 출항이 동시에 몰리지 않게 함
   */
  cycle: 160,
} as const;

export type ShipTweenConfig = {
  label: string;
  /** Ship_Point 정렬 순번(0..9). GLB 접미사가 아니라 빈 번호를 당긴 인덱스 */
  locators: readonly number[];
  /** 출항 전 로컬 X (선수). sidestepSpace가 world면 월드 +X */
  sidestepX: number;
  /** 출항 전 로컬 Y (위) */
  sidestepY: number;
  /** 출항 전 로컬 Z (우현 +). 화면(북쪽 위) 기준 방향은 각 항목 주석 참고 */
  sidestepZ: number;
  /** local: 선박 로컬 XYZ. world: 월드 XZ(수평) */
  sidestepSpace: "local" | "world";
  /** 있으면 sidestepXYZ 대신 로컬 XZ에서 이 각(도) × sidestepDist */
  sidestepYawDeg: number | null;
  sidestepDist: number;
  sidestepDuration: number;
  /** 사이드스텝 후 추가 회전(도). + = 좌현(반시계, 위에서 볼 때), − = 우현 */
  turnDeg: number;
  turnDuration: number;
  /** 첫 루프 시작 지연(초). 배끼리 항로가 겹치지 않게 시뮬레이션으로 정한 값 */
  delay: number;
  stagger: number;
  loadDuration: number;
  dropHeight: number;
  loadEase: string;
  loadOrder: ShipLoadOrder;
  departDelay: number;
  departDuration: number;
  /** 회전 후 선수 방향 직진 거리(m). 지형 bbox+75m 밖으로 나갈 때까지 */
  departDistance: number;
  departEase: string;
  arriveDuration: number;
  arriveEase: string;
};

/** 공통값. 배마다 다른 것만 아래 ship()에서 덮어씀 */
const BASE: Omit<ShipTweenConfig, "label" | "locators"> = {
  sidestepX: 0,
  sidestepY: 0,
  sidestepZ: 0,
  sidestepSpace: "local",
  sidestepYawDeg: null,
  sidestepDist: 0,
  sidestepDuration: 15.5, // 1/3 slower than 7s (duration ×1.5)
  turnDeg: 0,
  turnDuration: 15.5, // 1/3 slower than 7s (duration ×1.5)
  delay: 0,
  stagger: 0.007,
  loadDuration: 0.38,
  dropHeight: 31.325,
  loadEase: "power2.out",
  loadOrder: "tier",
  departDelay: 1,
  departDuration: 25,
  departDistance: 450,
  departEase: "power1.in",
  arriveDuration: 8,
  arriveEase: "power2.out",
};

const ship = (
  index: number,
  label: string,
  o: Partial<ShipTweenConfig>,
): ShipTweenConfig => ({ ...BASE, label, locators: [index], ...o });

/**
 * delay 결정 규칙 (오프라인 충돌 시뮬레이션으로 미리 계산해 고정, 결정적):
 *  1) 원하는 출항 시각(분산 배치)에서 시작
 *  2) 원점(0,0,0)에 가까운 정박지 순서로 배치: 4 → 0 → 5 → 3 → 1 → 2 → 6 → 7 → 8 → 9
 *  3) 앞서 배치된 배와 항로가 겹치면(131×19m 선체 + 12m 여유) 나중 배가 정박지에서 대기:
 *     그 배의 delay+1초부터 1초씩 늦춰 겹치지 않는 첫 시각을 씀
 *  대기 결과: 5번 → 4번 대기(32s), 1번 → 0번 대기(34s), 7번 → 1번 대기(83s)
 *  시뮬레이터: C:\Users\Public\busanopt\sim.cjs
 *
 * 배별 이동. 인덱스 = Ship_Point 정렬 순번(괄호 = GLB 접미사).
 * 직진 속도는 대략 18m/s 평균 (departDuration = departDistance / 18).
 * 사이드스텝 방향은 위에서 본 화면(북쪽 위) 기준, 모두 땅에서 멀어지는 쪽.
 */
export const SHIP_TWEENS: readonly ShipTweenConfig[] = [
  // 0 (000): 화면 위로 45m → 우현 18° → 동쪽 직진 (7번 정박 위치를 넉넉히 비켜감)
  ship(0, "0 (000)", {
    sidestepZ: -30,
    turnDeg: -18,
    departDistance: 640,
    departDuration: 35.6,
    delay: 12,
  }),
  // 1 (002): 화면 위로 45m → 회전 없이 동북동 직진 (우현으로 틀면 0번 정박 위치/육지와 겹침)
  ship(1, "1 (002)", {
    sidestepZ: -30,
    departDistance: 1380,
    departDuration: 76.7,
    delay: 34,
  }),
  // 2 (005): 화면 아래로 75m → 우현 25° (남동 출구 쪽) → 직진. 3·4번 뒤에 출발
  ship(2, "2 (005)", {
    sidestepZ: 50,
    turnDeg: -25,
    departDistance: 1280,
    departDuration: 71.1,
    delay: 60,
  }),
  // 3 (007): 화면 아래로 75m → 우현 35° → 직진
  ship(3, "3 (007)", {
    sidestepZ: 50,
    turnDeg: -35,
    departDistance: 950,
    departDuration: 52.8,
    delay: 36,
  }),
  // 4 (008): 화면 아래로 75m → 우현 50° → 직진
  ship(4, "4 (008)", {
    sidestepZ: 50,
    turnDeg: -50,
    departDistance: 710,
    departDuration: 39.4,
    delay: 0,
  }),
  // 5 (010): 화면 왼쪽으로 45m → 회전 없이 남쪽 직진
  ship(5, "5 (010)", {
    sidestepZ: 45,
    departDistance: 460,
    departDuration: 25.6,
    delay: 32,
  }),
  // 6 (011): 화면 아래로 45m → 직진
  ship(6, "6 (011)", { sidestepZ: 45, delay: 5 }),
  // 7 (013): 화면 아래로 45m → 직진
  ship(7, "7 (013)", { sidestepZ: 45, delay: 83 }),
  // 8 (014): 화면 오른쪽으로 45m → 남쪽 직진
  ship(8, "8 (014)", { sidestepZ: -45, delay: 18 }),
  // 9 (016): 화면 오른쪽으로 45m → 남쪽 직진
  ship(9, "9 (016)", { sidestepZ: -45, delay: 60 }),
];
export function getShipTween(locatorIndex: number): ShipTweenConfig {
  return (
    SHIP_TWEENS.find((tween) => tween.locators.includes(locatorIndex)) ??
    SHIP_TWEENS[0]!
  );
}

/** 항적 scale 1 = 기본 출항(power1.in) 피크 속도. 더 빠르면 1로 클램프 */
export const WATERWAY_FULL_SPEED =
  (2 * SHIP_TWEENS[0]!.departDistance) /
  Math.max(SHIP_TWEENS[0]!.departDuration, 1e-6);

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
