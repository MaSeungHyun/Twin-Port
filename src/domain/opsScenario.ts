import {
  OPS_CONVEYORS,
  OPS_CONVEYOR_KEYS,
  OPS_EQUIPMENT,
  OPS_FAULTS,
  OPS_MOVES,
  OPS_SCENARIO,
  type OpsFaultLevel,
  type OpsConveyorState,
  type OpsMoveStatus,
  type OpsShareKey,
} from "@/constants/opsScenario";

export type OpsMove = {
  id: string;
  /** 시나리오 시작 후 경과 초 */
  t: number;
  container: string;
  conveyorId: string;
  from: string;
  to: string;
  status: OpsMoveStatus;
  equipmentId: string;
};

export type OpsConveyorLive = {
  id: string;
  name: string;
  from: string;
  to: string;
  speed: number;
  queued: number;
  passed: number;
  state: OpsConveyorState;
};

export type OpsEquipmentLive = {
  id: string;
  name: string;
  kind: string;
  state: OpsShareKey;
  /** 고장 시나리오가 덮어쓴 원인. 없으면 스크립트 상태 */
  cause?: string;
  count: number;
  perHour: number;
  utilization: number;
  share: Record<OpsShareKey, number>;
};

export type OpsFault = {
  id: string;
  t: number;
  equipmentId: string;
  name: string;
  level: OpsFaultLevel;
  message: string;
  active: boolean;
};

export type OpsSnapshot = {
  title: string;
  elapsed: number;
  cycle: number;
  phase: number;
  kpi: {
    throughputPerHour: number;
    inbound: number;
    outbound: number;
    utilization: number;
    queued: number;
    leadTimeS: number;
  };
  conveyors: OpsConveyorLive[];
  equipment: OpsEquipmentLive[];
  moves: OpsMove[];
  faults: OpsFault[];
};

export type OpsFaultOverride = {
  /** 장비 표시 이름과 같으면 현재 상태를 덮어쓴다 */
  name: string;
  state: OpsShareKey;
  cause: string;
};

const SHARE_KEYS: OpsShareKey[] = ["run", "move", "wait", "fault"];
const emptyShare = (): Record<OpsShareKey, number> => ({ run: 0, move: 0, wait: 0, fault: 0 });

function equipmentLabel(id: string) {
  return (
    OPS_EQUIPMENT.find((item) => item.id === id)?.name ??
    OPS_CONVEYORS.find((item) => item.id === id)?.name ??
    id
  );
}

function containerId(cycle: number, n: number) {
  return `TCLU${String(1001000 + cycle * 10 + n)}`;
}

function holdAt<T extends { until: number }>(frames: readonly T[], phase: number): T {
  return frames.find((frame) => phase < frame.until) ?? frames[frames.length - 1]!;
}

function stateAt(segments: readonly { until: number; state: OpsShareKey }[], phase: number): OpsShareKey {
  return holdAt(segments, phase).state;
}

function shareInWindow(
  segments: readonly { until: number; state: OpsShareKey }[],
  from: number,
  to: number,
) {
  const share = emptyShare();
  let cursor = 0;
  for (const segment of segments) {
    const start = Math.max(cursor, from);
    const end = Math.min(segment.until, to);
    if (end > start) share[segment.state] += end - start;
    cursor = segment.until;
    if (cursor >= to) break;
  }
  return share;
}

function addShare(a: Record<OpsShareKey, number>, b: Record<OpsShareKey, number>, scale = 1) {
  const out = emptyShare();
  for (const key of SHARE_KEYS) out[key] = a[key] + b[key] * scale;
  return out;
}

function countPassed(conveyorId: string, phase: number) {
  return OPS_MOVES.filter((move) => move.conveyorId === conveyorId && move.at <= phase).length;
}

function countInbound(phase: number) {
  const seen = new Set<number>();
  for (const move of OPS_MOVES) {
    if (move.conveyorId === "cv-01" && move.at <= phase) seen.add(move.n);
  }
  return seen.size;
}

function countOutbound(phase: number) {
  const seen = new Set<number>();
  for (const move of OPS_MOVES) {
    if (move.conveyorId === "cv-03" && move.status === "완료" && move.at <= phase) seen.add(move.n);
  }
  return seen.size;
}

function countMoves(equipmentId: string, phase: number) {
  const seen = new Set<number>();
  for (const move of OPS_MOVES) {
    if (move.equipmentId === equipmentId && move.at <= phase) seen.add(move.n);
  }
  return seen.size;
}

/** 경과 초로 스냅샷을 만든다. 같은 시각이면 항상 같은 결과 */
export function sampleOpsScenario(elapsedS: number, faults: readonly OpsFaultOverride[] = []): OpsSnapshot {
  const cycleS = OPS_SCENARIO.cycleS;
  const elapsed = Math.max(0, elapsedS);
  const cycle = Math.floor(elapsed / cycleS);
  const phase = elapsed - cycle * cycleS;
  const hours = Math.max(elapsed / 3600, 1 / 3600);

  const moves: OpsMove[] = [];
  const firstCycle = Math.max(0, cycle - 1);
  for (let c = firstCycle; c <= cycle; c += 1) {
    const until = c === cycle ? phase : cycleS;
    for (const move of OPS_MOVES) {
      if (move.at > until) continue;
      moves.push({
        id: `${c}-${move.at}-${move.n}-${move.conveyorId}`,
        t: c * cycleS + move.at,
        container: containerId(c, move.n),
        conveyorId: move.conveyorId,
        from: move.from,
        to: move.to,
        status: move.status,
        equipmentId: move.equipmentId,
      });
    }
  }
  moves.sort((a, b) => b.t - a.t);

  const inbound = cycle * countInbound(OPS_SCENARIO.cycleS) + countInbound(phase);
  const outbound = cycle * countOutbound(OPS_SCENARIO.cycleS) + countOutbound(phase);

  const conveyors: OpsConveyorLive[] = OPS_CONVEYORS.map((conveyor) => {
    const frame = holdAt(OPS_CONVEYOR_KEYS[conveyor.id]!, phase);
    const perCycle = countPassed(conveyor.id, cycleS);
    return {
      ...conveyor,
      speed: frame.speed,
      queued: frame.queued,
      passed: cycle * perCycle + countPassed(conveyor.id, phase),
      state: frame.state,
    };
  });

  const equipment: OpsEquipmentLive[] = OPS_EQUIPMENT.map((item) => {
    const full = shareInWindow(item.segments, 0, cycleS);
    const part = shareInWindow(item.segments, 0, phase);
    const share = addShare(part, full, cycle);
    const tracked = SHARE_KEYS.reduce((sum, key) => sum + share[key], 0);
    const active = share.run + share.move;
    const fault = faults.find((entry) => entry.name === item.name);
    const scripted = OPS_FAULTS.find(
      (event) =>
        event.equipmentId === item.id &&
        event.level !== "recovery" &&
        event.at <= phase &&
        phase < event.until,
    );
    const count = cycle * item.movesPerCycle + countMoves(item.id, phase);
    return {
      id: item.id,
      name: item.name,
      kind: item.kind,
      state: fault?.state ?? (scripted?.level === "error" ? "fault" : stateAt(item.segments, phase)),
      cause: fault?.cause ?? scripted?.message,
      count,
      perHour: count / hours,
      utilization: tracked > 0 ? (active / tracked) * 100 : 0,
      share,
    };
  });

  const utilization = equipment.reduce((sum, item) => sum + item.utilization, 0) / equipment.length;
  const queued = conveyors.reduce((sum, item) => sum + item.queued, 0);
  const leadTimeS = phase >= 48 && phase < 66 ? 46 : phase >= 22 && phase < 48 ? 38 : 28;

  return {
    title: OPS_SCENARIO.title,
    elapsed,
    cycle: cycle + 1,
    phase,
    kpi: {
      throughputPerHour: outbound / hours,
      inbound,
      outbound,
      utilization,
      queued,
      leadTimeS,
    },
    conveyors,
    equipment,
    moves: moves.slice(0, OPS_SCENARIO.moveLimit),
    faults: faultLog(cycle, phase),
  };
}

function faultLog(cycle: number, phase: number): OpsFault[] {
  const cycleS = OPS_SCENARIO.cycleS;
  const out: OpsFault[] = [];
  const firstCycle = Math.max(0, cycle - 1);
  for (let c = firstCycle; c <= cycle; c += 1) {
    const until = c === cycle ? phase : cycleS;
    for (const event of OPS_FAULTS) {
      if (event.at > until) continue;
      out.push({
        id: `${c}-${event.at}-${event.equipmentId}-${event.level}`,
        t: c * cycleS + event.at,
        equipmentId: event.equipmentId,
        name: equipmentLabel(event.equipmentId),
        level: event.level,
        message: event.message,
        active: c === cycle && event.at <= phase && phase < event.until,
      });
    }
  }
  out.sort((a, b) => b.t - a.t);
  return out.slice(0, OPS_SCENARIO.moveLimit);
}
