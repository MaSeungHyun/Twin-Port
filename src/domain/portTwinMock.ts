/** Port Twin UI — 선박·크레인 운영 데이터. 고정 제원(portTwinBase) 위에 시뮬레이션(portSim) 상태를 덮어쓴다 */
import {
  baseCraneProfile,
  baseShipProfile,
  type CraneOperationalStatus,
  type CraneOperationalTone,
  type CraneTwinProfile,
  type ShipOperationalStatus,
  type ShipTwinProfile,
} from "./portTwinBase";
import { getSimCrane, getSimShip } from "./portSim";

export type {
  CraneOperationalStatus,
  CraneOperationalTone,
  CraneTwinProfile,
  ShipOperationalStatus,
  ShipTwinProfile,
};

export function getShipTwinProfile(index: number): ShipTwinProfile {
  const sim = getSimShip(index);
  if (!sim) return baseShipProfile(index);
  return {
    ...sim.profile,
    status: sim.status,
    berth: sim.berth,
    eta: sim.eta,
    etd: sim.etd,
  };
}

export function getCraneTwinProfile(index: number): CraneTwinProfile {
  const base = baseCraneProfile(index);
  const sim = getSimCrane(index);
  if (!sim) return base;
  return {
    ...base,
    craneId: `QC-${String(index).padStart(2, "0")}`,
    status: sim.status,
    containersMoved: sim.moves,
    movesPerHour: sim.mph,
    utilization: sim.utilization,
    assignedVessel: sim.vessel,
    berth: sim.berth,
  };
}

export function shipStatusLabel(status: ShipOperationalStatus): string {
  const labels: Record<ShipOperationalStatus, string> = {
    berthed: "접안·작업 대기",
    loading: "적재 중",
    discharging: "양하 중",
    departing: "출항 중",
    arriving: "입항 중",
    preparing: "출항 준비",
    departed: "출항 완료",
    idle: "대기",
  };
  return labels[status];
}

export function craneStatusLabel(status: CraneOperationalStatus): string {
  const labels: Record<CraneOperationalStatus, string> = {
    active: "Active",
    idle: "Idle",
    error: "Error",
  };
  return labels[status];
}

/** 그래프 패널 status indicator — active=녹색, error=빨강, idle=회색(중지) */
export function craneOperationalTone(
  status: CraneOperationalStatus,
): CraneOperationalTone {
  if (status === "active") return "success";
  if (status === "error") return "error";
  return "stopped";
}

/** 상세 status 텍스트 색 — error=빨강, idle=회색 */
export function craneStatusTextClass(
  status: CraneOperationalStatus,
): string | undefined {
  if (status === "error") return "text-danger [text-shadow:none]";
  if (status === "idle") return "text-text-secondary [text-shadow:none]";
  return undefined;
}

export function shipTwinDetailRows(
  profile: ShipTwinProfile,
): { label: string; value: string }[] {
  return [
    { label: "status", value: shipStatusLabel(profile.status) },
    { label: "vessel", value: profile.vesselName },
    { label: "imo", value: profile.imo },
    { label: "flag", value: profile.flag },
    { label: "operator", value: profile.operator },
    { label: "size", value: `${profile.loa} × ${profile.beam}` },
    { label: "draft", value: profile.draft },
    { label: "capacity", value: `${profile.teu.toLocaleString()} TEU` },
    { label: "berth", value: profile.berth },
    { label: "cargo", value: profile.cargo },
    { label: "eta", value: profile.eta },
    { label: "etd", value: profile.etd },
  ];
}

export function craneTwinDetailRows(
  profile: CraneTwinProfile,
): { label: string; value: string; valueClassName?: string }[] {
  return [
    {
      label: "status",
      value: craneStatusLabel(profile.status),
      valueClassName: craneStatusTextClass(profile.status),
    },
    { label: "crane id", value: profile.craneId },
    { label: "containers moved", value: profile.containersMoved.toLocaleString() },
    { label: "moves / hour", value: String(profile.movesPerHour) },
    { label: "utilization", value: `${profile.utilization}%` },
    { label: "assigned vessel", value: profile.assignedVessel },
    { label: "berth", value: profile.berth },
    { label: "shift", value: profile.shift },
    { label: "last maintenance", value: profile.lastMaintenance },
    { label: "operator", value: profile.operator },
  ];
}

export function resolveShipTwinIndex(key: string): number {
  if (key.startsWith("ship-")) {
    const index = Number.parseInt(key.slice(5), 10);
    return Number.isFinite(index) ? index : 0;
  }
  return 0;
}
