/**
 * 크레인 실시간 텔레메트리 — 운영 시뮬레이션(portSim) 스냅샷의 생산성·상태로부터 만든다.
 * 모터 온도만 상태를 가진다(1차 지연, runner tick 마다 advanceTelemetry). 나머지는 시뮬레이션 시각의 결정적 함수.
 */
import { CRANE_TELEMETRY as T } from "@/constants/craneTelemetry";
import { PORT_SIM } from "@/constants/portSim";
import { getPortSim, getSimContainerIds } from "@/domain/portSim";
import type { FailureKind } from "@/constants/failureScenario";

export type TelemetryLevel = "normal" | "warn" | "fault";

export type CraneTelemetry = {
  motion: string;
  hoistSpeed: number;
  trolleySpeed: number;
  gantrySpeed: number;
  loadT: number;
  containerId: string | null;
  spreaderLocked: boolean;
  hoistMotorC: number;
  trolleyMotorC: number;
  gantryMotorC: number;
  inverterC: number;
  powerKw: number;
  windMs: number;
  opHours: number;
  nextMaintH: number;
};

function seeded(index: number, salt: number) {
  return Math.abs(Math.sin(index * 12.989 + salt * 78.233) * 43758.5453) % 1;
}
const frac = (x: number) => x - Math.floor(x);
const r1 = (x: number) => Math.round(x * 10) / 10;

/** 항만 공통 풍속(m/s) — 완만한 변화 + 드문 돌풍 */
export function windAt(h: number) {
  const base = 7 + 3 * Math.sin((h * 2 * Math.PI) / 14) + 1.5 * Math.sin((h * 2 * Math.PI) / 3.3 + 1);
  const gust = 13 * Math.pow(Math.max(0, Math.sin((h * 2 * Math.PI) / 53)), 20);
  return Math.max(0.5, base + gust);
}

/** 장비별 부하 집중 구간(°C) — 일부 장비만 크게 올라 과열 고장까지 갈 수 있다 */
function stressAt(kind: FailureKind, index: number, h: number) {
  const salt = kind === "quayCrane" ? 31 : 37;
  const amp = seeded(index, salt) < T.hotRatio ? T.hotStressC : T.normalStressC;
  const period = 20 + seeded(index, salt + 1) * 20;
  const s = Math.sin((h / period) * 2 * Math.PI + seeded(index, salt + 2) * 6.28);
  return amp * Math.pow(Math.max(0, s), 12);
}

type Thermal = { h: number; hoist: number; trolley: number; gantry: number };
const thermal = new Map<string, Thermal>();

function targets(kind: FailureKind, index: number, h: number, u: number) {
  const a = T.ambientC;
  const st = stressAt(kind, index, h);
  return { hoist: a + 48 * u + st, trolley: a + 38 * u + st * 0.35, gantry: a + 14 * u + 4 };
}

function crew(kind: FailureKind) {
  const sim = getPortSim();
  return kind === "quayCrane" ? sim.cranes : sim.overheadCranes;
}

function utilNow(kind: FailureKind, mph: number, status: string) {
  const ref = kind === "quayCrane" ? T.quay.refMph : T.overhead.refMph;
  return status === "active" && mph > 0 ? Math.min(1, mph / ref) : 0;
}

/** runner tick 마다 호출 — 모터 온도를 시뮬레이션 경과 시간만큼 진행(객체 재사용) */
export function advanceTelemetry(h: number) {
  for (const kind of ["quayCrane", "overheadCrane"] as const) {
    for (const c of crew(kind)) {
      const key = `${kind}:${c.index}`;
      const tg = targets(kind, c.index, h, utilNow(kind, c.mph, c.status));
      const cur = thermal.get(key);
      if (!cur) {
        thermal.set(key, { h, ...tg });
        continue;
      }
      const dt = Math.min(30, Math.max(0, (h - cur.h) * 60));
      const k = 1 - Math.exp(-dt / T.tauMin);
      cur.hoist += (tg.hoist - cur.hoist) * k;
      cur.trolley += (tg.trolley - cur.trolley) * k;
      cur.gantry += (tg.gantry - cur.gantry) * k;
      cur.h = h;
    }
  }
}

export function resetTelemetry() {
  thermal.clear();
}

export function maxMotorC(kind: FailureKind, index: number) {
  const t = thermal.get(`${kind}:${index}`);
  return t ? Math.max(t.hoist, t.trolley, t.gantry) : T.ambientC;
}

export function tempLevel(c: number): TelemetryLevel {
  return c >= T.faultC ? "fault" : c >= T.warnC ? "warn" : "normal";
}

export function windLevel(ms: number): TelemetryLevel {
  return ms >= T.windStopMs ? "fault" : ms >= T.windWarnMs ? "warn" : "normal";
}

/** 한 사이클 구간: [끝 위치, 라벨, 호이스트/트롤리 사용, 적재 여부, 전력 계수] */
const SEGMENTS = [
  [0.2, "권상(적재)", "hoistLoaded", true, 2.2],
  [0.45, "횡행(적재)", "trolley", true, 0.8],
  [0.55, "권하(적재)", "hoistLoaded", true, 0.4],
  [0.7, "권상(공차)", "hoistEmpty", false, 1.0],
  [0.9, "횡행(공차)", "trolley", false, 0.6],
  [1, "권하(공차)", "hoistEmpty", false, 0.3],
] as const;

export function getCraneTelemetry(kind: FailureKind, index: number): CraneTelemetry | null {
  const sim = getPortSim();
  const c = crew(kind).find((x) => x.index === index);
  if (!c) return null;
  const h = sim.simHours;
  const spec = kind === "quayCrane" ? T.quay : T.overhead;
  const kwh = kind === "quayCrane" ? PORT_SIM.kwhPerMove : PORT_SIM.ohcKwhPerMove;
  const aux = kind === "quayCrane" ? PORT_SIM.auxKw : PORT_SIM.ohcAuxKw;
  const salt = kind === "quayCrane" ? 41 : 43;
  const th = thermal.get(`${kind}:${index}`) ?? { h, ...targets(kind, index, h, utilNow(kind, c.mph, c.status)) };

  let motion = c.status === "error" ? "정지(고장)" : "대기";
  let hoistSpeed = 0;
  let trolleySpeed = 0;
  let gantrySpeed = 0;
  let loadT = 0;
  let containerId: string | null = null;
  let spreaderLocked = false;
  let factor = 0;

  if (c.status === "active" && c.mph > 0) {
    const cycleMin = 60 / c.mph;
    const t = h * 60 + seeded(index, salt) * cycleMin;
    const n = Math.floor(t / cycleMin);
    const p = frac(t / cycleMin);
    // 약 1.5h 마다 베이 변경 — 잠시 갠트리 주행
    if (frac(h / 1.5 + seeded(index, salt + 1)) < 0.03) {
      motion = "주행(베이 변경)";
      gantrySpeed = spec.gantry;
      factor = 0.5;
    } else {
      const seg = SEGMENTS.find((s) => p < s[0]) ?? SEGMENTS[SEGMENTS.length - 1]!;
      motion = seg[1];
      if (seg[2] === "trolley") trolleySpeed = spec.trolley;
      else hoistSpeed = spec[seg[2]];
      factor = seg[4];
      if (seg[3]) {
        spreaderLocked = true;
        loadT = r1(9 + seeded(n, index + salt) * 21);
        const ids = getSimContainerIds();
        containerId =
          ids.length > 0
            ? ids[(index * 7919 + n * 31) % ids.length]!
            : `TCLU${String(1_000_000 + ((index * 9973 + n * 211) % 8_999_999)).padStart(7, "0")}`;
      }
    }
  }

  const utilization = c.utilization / 100;
  const base = 8000 + seeded(index, salt + 3) * 30000;
  const opHours = base + utilization * h;
  return {
    motion,
    hoistSpeed,
    trolleySpeed,
    gantrySpeed,
    loadT,
    containerId,
    spreaderLocked,
    hoistMotorC: r1(th.hoist),
    trolleyMotorC: r1(th.trolley),
    gantryMotorC: r1(th.gantry),
    inverterC: r1(T.ambientC + 0.6 * (Math.max(th.hoist, th.trolley) - T.ambientC) + 3),
    powerKw: Math.round(aux + kwh * c.mph * factor),
    windMs: r1(windAt(h)),
    opHours: Math.round(opHours),
    nextMaintH: Math.round(T.maintIntervalH - (opHours % T.maintIntervalH)),
  };
}
