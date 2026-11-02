/**
 * 항만 운영 시뮬레이션 — 선박 스케줄·크레인 작업·야드 컨테이너를 하나의 결정적 모델로 만든다.
 * 대시보드 KPI, 선박·크레인 상세 패널, 디테일 그래프, 3D 호버 툴팁이 모두 여기서 값을 읽어
 * 같은 시각에는 항상 같은 숫자를 보여준다.
 *
 * - 선박 수: 씬에서 읽은 선석(useYardStore.ships) 개수
 * - 크레인: 씬의 안벽 크레인을 선석 순서대로 배정
 * - 야드: 실제 야드 컨테이너의 블록별 개수 비율로 오버헤드 크레인 물량 분배
 * - 고장: useFailureStore(고장 시나리오), 양하 시나리오(useOpsStore) 장비 상태를 덮어씀
 */
import { BLOCKS, getBlockSlotGrid, type BlockDefinition } from "@/constants/block";
import { SHIP_PLACEMENTS } from "@/constants/model";
import { PORT_SIM } from "@/constants/portSim";
import type { OpsSnapshot } from "@/domain/opsScenario";
import type { QuayBerth } from "@/domain/extractQuayBerths";
import { getCraneListSource } from "@/domain/cameraFocus";
import {
  baseCraneProfile,
  baseShipProfile,
  type CraneOperationalStatus,
  type ShipOperationalStatus,
  type ShipTwinProfile,
} from "@/domain/portTwinBase";
import type {
  CraneDetailGraphMetrics,
  CraneDowntimeEvent,
  CraneProcessedContainer,
  DetailGraphPoint,
  ShipDetailGraphData,
} from "@/types/detailGraph";
import type { Container } from "@/types/container";
import { isFailed, useFailureStore, type ActiveFailure } from "@/stores/useFailureStore";
import { DOWNTIME_LOG_LIMIT, downtimeFor } from "@/stores/useDowntimeLogStore";
import { useOpsStore } from "@/stores/useOpsStore";
import { usePortSimStore } from "@/stores/usePortSimStore";
import { useYardStore } from "@/stores/yard";

const HOUR_MS = 3_600_000;

function seeded(index: number, salt: number) {
  return Math.abs(Math.sin(index * 12.989 + salt * 78.233) * 43758.5453) % 1;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function formatSimClock(ms: number, withDate = true) {
  const d = new Date(ms);
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return withDate ? `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${hm}` : hm;
}

/* ───────────── 모델(입력이 바뀔 때만 다시 만든다) ───────────── */

export type ShipPlan = {
  index: number;
  profile: ShipTwinProfile;
  berthNo: number;
  berthLabel: string;
  /** 이번 기항 양하·적재 물량(개) */
  discharge: number;
  load: number;
  work: number;
  /** 배정 크레인 GLB index */
  cranes: number[];
  craneMph: number;
  /** 선석 전체 생산성(개/h) */
  rate: number;
  /** 작업 시간(h), 한 기항 주기(h), 위상 오프셋(h) */
  workH: number;
  periodH: number;
  offsetH: number;
  fill0: number;
};

export type PortSimModel = {
  ships: ShipPlan[];
  craneIndices: number[];
  /** crane GLB index → [선박 index, 선석 내 순번] */
  craneShip: Map<number, [number, number]>;
  blocks: { code: string; stored: number; capacity: number; share: number }[];
  containerIds: string[];
  totalStored: number;
  totalCapacity: number;
};

function buildModel(
  berths: readonly QuayBerth[],
  craneIndices: number[],
  blocks: readonly BlockDefinition[],
  containers: readonly Container[],
): PortSimModel {
  const shipCount = berths.length > 0 ? berths.length : SHIP_PLACEMENTS.length;
  const sorted = [...craneIndices].sort((a, b) => a - b);

  // 선석별 크레인 수 — 씬 선석의 craneCount 합이 크레인 수 이하면 그대로, 아니면 균등 분배
  const wanted = Array.from({ length: shipCount }, (_, i) => Math.max(1, berths[i]?.craneCount ?? 0));
  const even = Math.max(1, Math.floor(sorted.length / Math.max(1, shipCount)));
  const useWanted =
    berths.length > 0 && wanted.reduce((a, b) => a + b, 0) <= sorted.length;
  // 선석 크레인 그룹(3기) 지정 — 씬에 모두 있으면 해당 그룹을, 아니면 순차 배정
  const available = new Set(sorted);
  const groupOf = (i: number) => {
    if (shipCount !== SHIP_PLACEMENTS.length) return null;
    const g = SHIP_PLACEMENTS[i]?.cranes ?? [];
    return g.length > 0 && g.every((c) => available.has(c)) ? [...g] : null;
  };
  const reserved = new Set<number>();
  for (let i = 0; i < shipCount; i++) groupOf(i)?.forEach((c) => reserved.add(c));
  const free = sorted.filter((c) => !reserved.has(c));
  let cursor = 0;
  const craneShip = new Map<number, [number, number]>();

  const ships: ShipPlan[] = Array.from({ length: shipCount }, (_, i) => {
    const profile = baseShipProfile(i);
    const take = Math.min(PORT_SIM.maxCranesPerShip, useWanted ? wanted[i]! : even);
    const group = groupOf(i);
    const cranes = group ?? free.slice(cursor, cursor + take);
    if (!group) cursor += take;
    cranes.forEach((c, r) => craneShip.set(c, [i, r]));
    const craneMph = Math.round(
      PORT_SIM.craneMphMin + seeded(i, 3) * (PORT_SIM.craneMphMax - PORT_SIM.craneMphMin),
    );
    const rate = Math.max(1, cranes.length) * craneMph;
    // 기항 물량을 배정 크레인 수에 맞춰 목표 작업시간(24~36h) 안에 끝나도록 정함
    const targetH =
      PORT_SIM.callHoursMin + seeded(i, 13) * (PORT_SIM.callHoursMax - PORT_SIM.callHoursMin);
    const work = Math.max(2, Math.round(rate * targetH));
    const discharge = Math.round(
      (work * PORT_SIM.dischargeRatio) / (PORT_SIM.dischargeRatio + PORT_SIM.loadRatio),
    );
    const load = work - discharge;
    const workH = work / rate;
    const arriveH =
      PORT_SIM.arriveHoursMin + seeded(i, 17) * (PORT_SIM.arriveHoursMax - PORT_SIM.arriveHoursMin);
    const periodH = workH + PORT_SIM.departHours + arriveH;
    return {
      index: i,
      profile,
      berthNo: i + 1,
      berthLabel: `${i + 1}선석`,
      discharge,
      load,
      work,
      cranes,
      craneMph,
      rate,
      workH,
      periodH,
      offsetH: seeded(i, 7) * periodH,
      fill0: 0.45 + seeded(i, 11) * 0.2,
    };
  });

  const counts = new Map<string, number>();
  const containerIds: string[] = [];
  for (const c of containers) {
    if (c.status !== "stored") continue;
    counts.set(c.location.block, (counts.get(c.location.block) ?? 0) + 1);
    containerIds.push(c.id);
  }
  const totalStored = [...counts.values()].reduce((a, b) => a + b, 0);
  const blockRows = blocks.map((block) => {
    const stored = counts.get(block.code) ?? 0;
    return {
      code: block.code,
      stored,
      capacity: getBlockSlotGrid(block).capacity,
      share: totalStored > 0 ? stored / totalStored : 1 / Math.max(1, blocks.length),
    };
  });

  return {
    ships,
    craneIndices: sorted,
    craneShip,
    blocks: blockRows,
    containerIds,
    totalStored,
    totalCapacity: blockRows.reduce((a, b) => a + b.capacity, 0),
  };
}

/* ───────────── 선박 스케줄 계산(순수 함수) ───────────── */

type ShipPhase = { status: ShipOperationalStatus; voyage: number; local: number; done: number };

function shipPhase(plan: ShipPlan, h: number): ShipPhase {
  const x = h + plan.offsetH;
  const voyage = Math.floor(x / plan.periodH);
  const local = x - voyage * plan.periodH;
  if (local < plan.workH) {
    const done = Math.floor((local / plan.workH) * plan.work);
    return {
      status: done < plan.discharge ? "discharging" : "loading",
      voyage,
      local,
      done,
    };
  }
  if (local < plan.workH + PORT_SIM.departHours)
    return { status: "departing", voyage, local, done: plan.work };
  return { status: "arriving", voyage, local, done: 0 };
}

/** 시뮬레이션 시각 h 까지 이 선석의 누적 처리 개수(기항을 넘어 이어짐) */
function shipCum(plan: ShipPlan, h: number) {
  const p = shipPhase(plan, h);
  return p.voyage * plan.work + (p.status === "arriving" ? plan.work : p.done);
}

/** [a,b] 시각 동안 선석이 작업 중이던 시간(h) */
function shipBusy(plan: ShipPlan, a: number, b: number) {
  if (b <= a) return 0;
  let busy = 0;
  const v0 = Math.floor((a + plan.offsetH) / plan.periodH) - 1;
  const v1 = Math.floor((b + plan.offsetH) / plan.periodH) + 1;
  for (let v = v0; v <= v1; v += 1) {
    const s = v * plan.periodH - plan.offsetH;
    const e = s + plan.workH;
    busy += Math.max(0, Math.min(e, b) - Math.max(s, a));
  }
  return busy;
}

/** 크레인 r 이 선석 누적 S 개 중 맡은 몫(정확히 합이 S 가 되게) */
function craneShare(total: number, k: number, r: number) {
  if (total <= 0) return 0;
  return Math.floor(total / k) + (r < total % k ? 1 : 0);
}

/* ───────────── 스냅샷 ───────────── */

export type SimShip = {
  index: number;
  key: string;
  name: string;
  profile: ShipTwinProfile;
  berth: string;
  status: ShipOperationalStatus;
  /** 이번 기항 진행률 0~100 */
  progress: number;
  discharged: number;
  dischargeTotal: number;
  loaded: number;
  loadTotal: number;
  teuOnboard: number;
  craneNames: string[];
  activeCranes: number;
  /** 현재 선석 생산성(개/h) — 가동 중 크레인 합 */
  mph: number;
  eta: string;
  etd: string;
  /** 관제 기준 시각 이후 누적 처리 */
  shiftMoves: number;
};

export type SimCrane = {
  index: number;
  name: string;
  status: CraneOperationalStatus;
  cause?: string;
  shipIndex: number | null;
  vessel: string;
  berth: string;
  moves: number;
  mph: number;
  utilization: number;
};

export type SimOverheadCrane = {
  index: number;
  name: string;
  block: string;
  status: CraneOperationalStatus;
  cause?: string;
  moves: number;
  mph: number;
  utilization: number;
  stored: number;
  capacity: number;
};

export type PortSimSnapshot = {
  running: boolean;
  elapsedS: number;
  /** 관제 기준 시각 이후 시뮬레이션 시간(h) */
  simHours: number;
  clock: string;
  shiftStart: string;
  ships: SimShip[];
  cranes: SimCrane[];
  overheadCranes: SimOverheadCrane[];
  kpi: {
    shipsTotal: number;
    shipsWorking: number;
    shiftMoves: number;
    discharged: number;
    loaded: number;
    mph: number;
    cranesTotal: number;
    cranesActive: number;
    cranesIdle: number;
    cranesError: number;
    yardStored: number;
    yardCapacity: number;
    yardPct: number;
    ohcUtilization: number;
  };
};

type Inputs = {
  model: PortSimModel;
  h: number;
  shiftStartMs: number;
  running: boolean;
  elapsedS: number;
  failures: Record<string, ActiveFailure>;
  ops: OpsSnapshot | null;
};

export function quayCraneName(index: number) {
  return `Crane ${pad2(index)}`;
}

function ohcName(code: string) {
  return `오버헤드크레인${code.replace(/\D/g, "")}`;
}

function opsState(ops: OpsSnapshot | null, name: string) {
  return ops?.equipment.find((item) => item.name === name) ?? null;
}

function resolveStatus(
  failures: Record<string, ActiveFailure>,
  kind: "quayCrane" | "overheadCrane",
  index: number,
  ops: OpsSnapshot | null,
  name: string,
  working: boolean,
): { status: CraneOperationalStatus; cause?: string } {
  const failure = failures[`${kind}:${index}`];
  if (isFailed(failures, kind, index)) return { status: "error", cause: failure?.cause };
  const live = opsState(ops, name);
  if (live) {
    if (live.state === "fault") return { status: "error", cause: live.cause };
    if (live.state === "wait") return { status: "idle", cause: live.cause };
    return { status: "active" };
  }
  return { status: working ? "active" : "idle", cause: failure?.cause };
}

function sample(inp: Inputs): PortSimSnapshot {
  const { model, h, shiftStartMs, failures, ops } = inp;
  const wall = (hh: number) => shiftStartMs + hh * HOUR_MS;

  const cranes: SimCrane[] = model.craneIndices.map((index) => {
    const name = quayCraneName(index);
    const link = model.craneShip.get(index);
    if (!link) {
      const st = resolveStatus(failures, "quayCrane", index, ops, name, false);
      return { index, name, ...st, shipIndex: null, vessel: "—", berth: "—", moves: 0, mph: 0, utilization: 0 };
    }
    const plan = model.ships[link[0]]!;
    const phase = shipPhase(plan, h);
    const working = phase.status === "discharging" || phase.status === "loading";
    const st = resolveStatus(failures, "quayCrane", index, ops, name, working);
    const k = Math.max(1, plan.cranes.length);
    const shift = shipCum(plan, h) - shipCum(plan, 0);
    return {
      index,
      name,
      ...st,
      shipIndex: plan.index,
      vessel: plan.profile.vesselName,
      berth: plan.berthLabel,
      moves: craneShare(shift, k, link[1]),
      mph: st.status === "active" && working ? plan.craneMph : 0,
      utilization: h > 0 ? Math.round((shipBusy(plan, 0, h) / h) * 100) : 0,
    };
  });

  const ships: SimShip[] = model.ships.map((plan) => {
    const phase = shipPhase(plan, h);
    const crew = cranes.filter((c) => c.shipIndex === plan.index);
    const discharged = Math.min(phase.done, plan.discharge);
    const loaded = Math.max(0, phase.done - plan.discharge);
    const start = phase.status === "arriving" ? h + (plan.periodH - phase.local) : h - phase.local;
    return {
      index: plan.index,
      key: `ship-${plan.index}`,
      name: plan.profile.vesselName,
      profile: plan.profile,
      berth: plan.berthLabel,
      status: phase.status,
      progress: Math.round((phase.done / plan.work) * 100),
      discharged,
      dischargeTotal: plan.discharge,
      loaded,
      loadTotal: plan.load,
      teuOnboard: Math.round(
        plan.profile.teu * plan.fill0 + (loaded - discharged) * PORT_SIM.teuPerBox,
      ),
      craneNames: crew.map((c) => c.name),
      activeCranes: crew.filter((c) => c.mph > 0).length,
      mph: crew.reduce((sum, c) => sum + c.mph, 0),
      eta: formatSimClock(wall(start)),
      etd: formatSimClock(wall(start + plan.workH)),
      shiftMoves: shipCum(plan, h) - shipCum(plan, 0),
    };
  });

  const berthMph = ships.reduce((sum, s) => sum + s.mph, 0);
  const shiftMoves = ships.reduce((sum, s) => sum + s.shiftMoves, 0);
  const overheadCranes: SimOverheadCrane[] = model.blocks.map((block, index) => {
    const name = ohcName(block.code);
    const mph = Math.min(PORT_SIM.ohcCapacityMph, Math.round(berthMph * block.share * 10) / 10);
    const st = resolveStatus(failures, "overheadCrane", index, ops, name, mph > 0);
    const live = st.status === "active" ? mph : 0;
    return {
      index,
      name,
      block: block.code,
      ...st,
      moves: Math.round(shiftMoves * block.share),
      mph: live,
      utilization: Math.min(100, Math.round((live / PORT_SIM.ohcCapacityMph) * 100)),
      stored: block.stored,
      capacity: block.capacity,
    };
  });

  return {
    running: inp.running,
    elapsedS: inp.elapsedS,
    simHours: h,
    clock: formatSimClock(wall(h)),
    shiftStart: formatSimClock(wall(0)),
    ships,
    cranes,
    overheadCranes,
    kpi: {
      shipsTotal: ships.length,
      shipsWorking: ships.filter((s) => s.status === "discharging" || s.status === "loading").length,
      shiftMoves,
      discharged: ships.reduce((sum, s) => sum + s.discharged, 0),
      loaded: ships.reduce((sum, s) => sum + s.loaded, 0),
      mph: berthMph,
      cranesTotal: cranes.length,
      cranesActive: cranes.filter((c) => c.status === "active").length,
      cranesIdle: cranes.filter((c) => c.status === "idle").length,
      cranesError: cranes.filter((c) => c.status === "error").length,
      yardStored: model.totalStored,
      yardCapacity: model.totalCapacity,
      yardPct: model.totalCapacity > 0 ? Math.round((model.totalStored / model.totalCapacity) * 1000) / 10 : 0,
      ohcUtilization:
        overheadCranes.length > 0
          ? Math.round(overheadCranes.reduce((sum, c) => sum + c.utilization, 0) / overheadCranes.length)
          : 0,
    },
  };
}

/* ───────────── 캐시(스토어 상태가 같으면 한 번만 계산) ───────────── */

let modelCache: { key: unknown[]; model: PortSimModel } | null = null;
let snapCache: { key: unknown[]; inputs: Inputs; snap: PortSimSnapshot } | null = null;
let idleStartedAt: number | null = null;

function sameKey(a: unknown[], b: unknown[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function currentInputs(): Inputs {
  const yard = useYardStore.getState();
  const cranes = yard.quayCranes.length > 0 ? yard.quayCranes : getCraneListSource().placements;
  const blocks = yard.blocks.length > 0 ? yard.blocks : BLOCKS;
  const mKey = [yard.ships, cranes, blocks, yard.containers];
  if (!modelCache || !sameKey(modelCache.key, mKey)) {
    modelCache = {
      key: mKey,
      model: buildModel(yard.ships, cranes.map((c) => c.glbIndex), blocks, yard.containers),
    };
  }
  const sim = usePortSimStore.getState();
  if (sim.startedAt == null && idleStartedAt == null) idleStartedAt = Date.now();
  const startedAt = sim.startedAt ?? idleStartedAt!;
  const h = PORT_SIM.warmHours + (sim.elapsedS * PORT_SIM.speed) / 3600;
  return {
    model: modelCache.model,
    h,
    shiftStartMs: startedAt - PORT_SIM.warmHours * HOUR_MS,
    running: sim.startedAt != null,
    elapsedS: sim.elapsedS,
    failures: useFailureStore.getState().active,
    ops: useOpsStore.getState().snapshot,
  };
}

function cached(): { inputs: Inputs; snap: PortSimSnapshot } {
  const inputs = currentInputs();
  const key = [inputs.model, inputs.h, inputs.shiftStartMs, inputs.failures, inputs.ops, inputs.running];
  if (!snapCache || !sameKey(snapCache.key, key)) {
    snapCache = { key, inputs, snap: sample(inputs) };
  }
  return snapCache;
}

/** 현재 시뮬레이션 스냅샷 — 렌더/콜백 어디서든 호출 가능(같은 tick 이면 캐시) */
export function getPortSim(): PortSimSnapshot {
  return cached().snap;
}

/** 야드 장치 컨테이너 id 목록(텔레메트리 하중 표시용) */
export function getSimContainerIds(): readonly string[] {
  return modelCache?.model.containerIds ?? [];
}

export function getSimShip(index: number): SimShip | null {
  const ships = getPortSim().ships;
  if (ships.length === 0) return null;
  return ships[Math.abs(index) % ships.length] ?? null;
}

export function getSimCrane(index: number): SimCrane | null {
  return getPortSim().cranes.find((c) => c.index === index) ?? null;
}

export function getSimOverheadCrane(index: number): SimOverheadCrane | null {
  return getPortSim().overheadCranes[index] ?? null;
}

/* ───────────── 디테일 그래프 ───────────── */

function containerIdFor(model: PortSimModel, ship: number, voyage: number, move: number) {
  const ids = model.containerIds;
  if (ids.length === 0) return `TCLU${String(1_000_000 + ship * 9973 + voyage * 211 + move).padStart(7, "0")}`;
  const n = (ship * 7919 + voyage * 104_729 + move * 31) % ids.length;
  return ids[(n + ids.length) % ids.length]!;
}

export function getCraneDetailGraph(index: number, subjectKey: string): CraneDetailGraphMetrics {
  const { inputs, snap } = cached();
  const { model, h, shiftStartMs } = inputs;
  const wall = (hh: number) => shiftStartMs + hh * HOUR_MS;
  const crane = snap.cranes.find((c) => c.index === index);
  const link = model.craneShip.get(index);
  const plan = link ? model.ships[link[0]]! : null;
  const k = plan ? Math.max(1, plan.cranes.length) : 1;
  const rank = link?.[1] ?? 0;

  const ends: number[] = [];
  // h 가 정각이면 마지막 완결 시간대는 h-1 (정각 중복·0 구간 방지)
  const last = Math.ceil(h) - 1;
  for (let j = PORT_SIM.seriesHours - 1; j >= 1; j -= 1) ends.push(last - j + 1);
  ends.push(h);
  const hourly = ends.map((e) => {
    const s = e === h ? Math.max(last, h - 1) : e - 1;
    const span = Math.max(1e-6, e - s);
    const moves = plan ? craneShare(shipCum(plan, e), k, rank) - craneShare(shipCum(plan, s), k, rank) : 0;
    const busy = plan ? shipBusy(plan, s, e) / span : 0;
    return { t: e === h ? "now" : `${pad2(new Date(wall(e)).getHours())}:00`, moves, mph: moves / span, busy };
  });
  const pts = (fn: (x: (typeof hourly)[number]) => number): DetailGraphPoint[] =>
    hourly.map((x) => ({ t: x.t, value: Math.round(fn(x) * 10) / 10 }));

  const moves = crane?.moves ?? 0;
  const busyH = plan ? shipBusy(plan, 0, h) : 0;
  const idleH = Math.max(0, h - busyH);
  const mphNow = crane?.mph ?? 0;
  const cycleNow = mphNow > 0 ? Math.round((60 / mphNow) * 10) / 10 : 0;

  const downtime: CraneDowntimeEvent[] = failureHistory(`quayCrane:${index}`);
  if (plan) {
    const gap = Math.round((plan.periodH - plan.workH) * 60);
    const v0 = Math.floor(plan.offsetH / plan.periodH);
    const v1 = Math.floor((h + plan.offsetH) / plan.periodH);
    for (let v = v1; v >= v0 && downtime.length < DOWNTIME_LOG_LIMIT; v -= 1) {
      const gapStart = v * plan.periodH - plan.offsetH + plan.workH;
      if (gapStart > h || gapStart + gap / 60 < 0) continue;
      const gapEnd = gapStart + gap / 60;
      const ongoing = gapEnd > h;
      downtime.push({
        at: formatSimClock(wall(gapStart)),
        endAt: ongoing ? null : formatSimClock(wall(gapEnd)),
        startMs: wall(gapStart),
        label: "선박 입출항 대기",
        durationMin: ongoing ? Math.max(1, Math.round((h - gapStart) * 60)) : gap,
      });
    }
  }
  downtime.sort((a, b) => b.startMs - a.startMs);
  downtime.length = Math.min(downtime.length, DOWNTIME_LOG_LIMIT);

  const processed: CraneProcessedContainer[] = [];
  if (plan) {
    const phase = shipPhase(plan, h);
    const voyageStart = h - phase.local;
    for (let m = phase.done - 1; m >= 0 && processed.length < PORT_SIM.craneLogLimit; m -= 1) {
      if (m % k !== rank) continue;
      processed.push({
        id: containerIdFor(model, plan.index, phase.voyage, m),
        handledAt: formatSimClock(wall(voyageStart + (m / plan.work) * plan.workH), false),
        move: m < plan.discharge ? "discharge" : "load",
      });
    }
  }

  const util = crane?.utilization ?? 0;
  return {
    craneId: baseCraneProfile(index).craneId,
    subjectKey,
    movesTotal: moves,
    mphCurrent: mphNow,
    cycleTimeMin: cycleNow,
    utilizationPct: util,
    workingHours: Math.round(busyH * 10) / 10,
    idleHours: Math.round(idleH * 10) / 10,
    energyKwh: Math.round(moves * PORT_SIM.kwhPerMove + h * PORT_SIM.auxKw),
    jobs: {
      completed: moves,
      inProgress: mphNow > 0 ? 1 : 0,
      waiting: plan ? Math.ceil(Math.max(0, plan.work - shipPhase(plan, h).done) / k) : 0,
    },
    movesSeries: { id: "moves", label: "Throughput (Moves)", unit: "moves", points: pts((x) => x.moves) },
    mphSeries: { id: "mph", label: "MPH", unit: "moves/h", points: pts((x) => x.mph) },
    cycleTimeSeries: {
      id: "cycle",
      label: "Cycle Time",
      unit: "min",
      points: pts((x) => (x.mph > 0 ? 60 / x.mph : 0)),
    },
    utilizationSeries: { id: "util", label: "Utilization", unit: "%", points: pts((x) => x.busy * 100) },
    idleSeries: { id: "idle", label: "Idle Time", unit: "min", points: pts((x) => (1 - x.busy) * 60) },
    energySeries: {
      id: "energy",
      label: "Energy",
      unit: "kWh",
      points: pts((x) => x.moves * PORT_SIM.kwhPerMove + PORT_SIM.auxKw),
    },
    downtimeEvents: downtime,
    processedContainers: processed,
  };
}

/** 고장 이력(복구된 것 포함) — useDowntimeLogStore 에 누적된 세션 기록, 최신 순.
 * 기록은 실제 시각(ms)이므로 시뮬레이션 시각(speed 배속)으로 바꿔 선박 입출항 대기 이력·시계와 맞춘다 */
function failureHistory(key: string): CraneDowntimeEvent[] {
  const now = Date.now();
  const origin = usePortSimStore.getState().startedAt;
  const toSim = (ms: number) => (origin == null ? ms : origin + (ms - origin) * PORT_SIM.speed);
  return downtimeFor(key).map((e) => {
    const start = toSim(e.start);
    const end = e.end == null ? null : toSim(e.end);
    return {
      at: formatSimClock(start),
      endAt: end == null ? null : formatSimClock(end),
      startMs: start,
      label: e.cause,
      durationMin: Math.max(1, Math.round(((end ?? toSim(now)) - start) / 60000)),
    };
  });
}

/** 오버헤드 크레인 상세 그래프 — 블록 물량 비율로 선석 처리량을 나눠 받는다 */
export function getOverheadCraneDetailGraph(index: number, subjectKey: string): CraneDetailGraphMetrics {
  const { inputs, snap } = cached();
  const { model, h, shiftStartMs } = inputs;
  const wall = (hh: number) => shiftStartMs + hh * HOUR_MS;
  const ohc = snap.overheadCranes[index];
  const share = model.blocks[index]?.share ?? 0;
  const totalCum = (t: number) => model.ships.reduce((sum, p) => sum + shipCum(p, t), 0);
  // h 가 정각이면 마지막 완결 시간대는 h-1 (정각 중복·0 구간 방지)
  const last = Math.ceil(h) - 1;
  const ends: number[] = [];
  for (let j = PORT_SIM.seriesHours - 1; j >= 1; j -= 1) ends.push(last - j + 1);
  ends.push(h);
  const hourly = ends.map((e) => {
    const s = e === h ? Math.max(last, h - 1) : e - 1;
    const span = Math.max(1e-6, e - s);
    const moves = Math.round((totalCum(e) - totalCum(s)) * share);
    const mph = Math.min(PORT_SIM.ohcCapacityMph, moves / span);
    return { t: e === h ? "now" : `${pad2(new Date(wall(e)).getHours())}:00`, moves, mph, busy: Math.min(1, mph / PORT_SIM.ohcCapacityMph) };
  });
  const pts = (fn: (x: (typeof hourly)[number]) => number): DetailGraphPoint[] =>
    hourly.map((x) => ({ t: x.t, value: Math.round(fn(x) * 10) / 10 }));
  const moves = ohc?.moves ?? 0;
  // 관제 누적 처리량을 처리 한계로 나눈 시간 = 실제 작업 시간
  const busyH = Math.min(h, (ohc?.moves ?? 0) / PORT_SIM.ohcCapacityMph);
  const idleH = Math.max(0, h - busyH);
  const mphNow = ohc?.mph ?? 0;
  const downtime: CraneDowntimeEvent[] = failureHistory(`overheadCrane:${index}`);
  const processed: CraneProcessedContainer[] = [];
  const ids = model.containerIds;
  for (let i = 0; i < PORT_SIM.craneLogLimit && ids.length > 0 && moves > 0; i += 1) {
    const m = moves - 1 - i;
    if (m < 0) break;
    processed.push({
      id: ids[(index * 7919 + m * 31) % ids.length]!,
      handledAt: formatSimClock(wall(h - (i * 60) / Math.max(1, mphNow || 1) / 60), false),
      move: m % 3 === 2 ? "shift" : m % 2 === 0 ? "discharge" : "load",
    });
  }
  return {
    craneId: `OHC-${ohc?.block ?? index}`,
    subjectKey,
    movesTotal: moves,
    mphCurrent: Math.round(mphNow),
    cycleTimeMin: mphNow > 0 ? Math.round((60 / mphNow) * 10) / 10 : 0,
    utilizationPct: ohc?.utilization ?? 0,
    workingHours: Math.round(busyH * 10) / 10,
    idleHours: Math.round(idleH * 10) / 10,
    energyKwh: Math.round(moves * PORT_SIM.ohcKwhPerMove + h * PORT_SIM.ohcAuxKw),
    jobs: { completed: moves, inProgress: mphNow > 0 ? 1 : 0, waiting: Math.round(mphNow / 6) },
    movesSeries: { id: "moves", label: "Throughput (Moves)", unit: "moves", points: pts((x) => x.moves) },
    mphSeries: { id: "mph", label: "MPH", unit: "moves/h", points: pts((x) => x.mph) },
    cycleTimeSeries: { id: "cycle", label: "Cycle Time", unit: "min", points: pts((x) => (x.mph > 0 ? 60 / x.mph : 0)) },
    utilizationSeries: { id: "util", label: "Utilization", unit: "%", points: pts((x) => x.busy * 100) },
    idleSeries: { id: "idle", label: "Idle Time", unit: "min", points: pts((x) => (1 - x.busy) * 60) },
    energySeries: {
      id: "energy",
      label: "Energy",
      unit: "kWh",
      points: pts((x) => x.moves * PORT_SIM.ohcKwhPerMove + PORT_SIM.ohcAuxKw),
    },
    downtimeEvents: downtime,
    processedContainers: processed,
  };
}

export function getShipDetailGraph(index: number, subjectKey: string): ShipDetailGraphData & {
  ship: SimShip | null;
} {
  const { inputs } = cached();
  const { model, h, shiftStartMs } = inputs;
  const ship = getSimShip(index);
  const plan = ship ? model.ships[ship.index]! : null;
  if (!ship || !plan) {
    return { subjectKey, vesselName: "—", teuCapacity: 1, teuLoaded: 0, loadedContainers: [], ship: null };
  }
  const phase = shipPhase(plan, h);
  const voyageStart = h - phase.local;
  const logs = [];
  for (let m = phase.done - 1; m >= 0 && logs.length < PORT_SIM.shipLogLimit; m -= 1) {
    logs.push({
      id: containerIdFor(model, plan.index, phase.voyage, m),
      loadedAt: formatSimClock(shiftStartMs + (voyageStart + (m / plan.work) * plan.workH) * HOUR_MS),
      move: m < plan.discharge ? ("discharge" as const) : ("load" as const),
    });
  }
  return {
    subjectKey,
    vesselName: ship.name,
    teuCapacity: plan.profile.teu,
    teuLoaded: Math.min(plan.profile.teu, Math.max(0, ship.teuOnboard)),
    loadedContainers: logs,
    ship,
  };
}
