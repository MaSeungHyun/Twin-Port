/** Port Twin UI — 선박·크레인 가상 운영 데이터 */

export type ShipOperationalStatus =
  | "berthed"
  | "loading"
  | "discharging"
  | "departing"
  | "idle";

export type CraneOperationalStatus = "active" | "idle" | "error";

export type CraneOperationalTone = "success" | "error" | "stopped";

export type ShipTwinProfile = {
  vesselName: string;
  imo: string;
  flag: string;
  operator: string;
  loa: string;
  beam: string;
  draft: string;
  teu: number;
  status: ShipOperationalStatus;
  berth: string;
  eta: string;
  etd: string;
  cargo: string;
};

export type CraneTwinProfile = {
  craneId: string;
  status: CraneOperationalStatus;
  containersMoved: number;
  movesPerHour: number;
  utilization: number;
  assignedVessel: string;
  berth: string;
  shift: string;
  lastMaintenance: string;
  operator: string;
};

const SHIP_TWIN: ShipTwinProfile[] = [
  {
    vesselName: "MV PACIFIC STAR",
    imo: "9876543",
    flag: "Panama",
    operator: "Ocean Alliance",
    loa: "366 m",
    beam: "51 m",
    draft: "14.2 m",
    teu: 14_052,
    status: "loading",
    berth: "Berth 1",
    eta: "2026-08-29 06:30",
    etd: "2026-08-31 18:00",
    cargo: "Import containers",
  },
  {
    vesselName: "HMM ALGECIRAS",
    imo: "9863297",
    flag: "South Korea",
    operator: "HMM",
    loa: "399 m",
    beam: "61 m",
    draft: "15.8 m",
    teu: 23_964,
    status: "discharging",
    berth: "Berth 2",
    eta: "2026-08-30 11:00",
    etd: "2026-09-01 09:30",
    cargo: "Transshipment",
  },
  {
    vesselName: "COSCO SHIPPING UNIVERSE",
    imo: "9785769",
    flag: "Hong Kong",
    operator: "COSCO",
    loa: "400 m",
    beam: "58.6 m",
    draft: "16.0 m",
    teu: 21_237,
    status: "berthed",
    berth: "Berth 3",
    eta: "2026-08-31 04:15",
    etd: "2026-09-02 14:00",
    cargo: "Export containers",
  },
  {
    vesselName: "MSC GULSUN",
    imo: "9839430",
    flag: "Liberia",
    operator: "MSC",
    loa: "399.9 m",
    beam: "61 m",
    draft: "16.5 m",
    teu: 23_756,
    status: "departing",
    berth: "Berth 4",
    eta: "2026-08-28 22:40",
    etd: "2026-08-31 13:45",
    cargo: "Mixed",
  },
];

const CRANE_TWIN: CraneTwinProfile[] = [
  {
    craneId: "QC-01",
    status: "active",
    containersMoved: 142,
    movesPerHour: 28,
    utilization: 86,
    assignedVessel: "MV PACIFIC STAR",
    berth: "Berth 1",
    shift: "Day A",
    lastMaintenance: "2026-08-24",
    operator: "PNIT Ops",
  },
  {
    craneId: "QC-02",
    status: "active",
    containersMoved: 118,
    movesPerHour: 24,
    utilization: 79,
    assignedVessel: "HMM ALGECIRAS",
    berth: "Berth 2",
    shift: "Day A",
    lastMaintenance: "2026-08-22",
    operator: "PNIT Ops",
  },
  {
    craneId: "QC-03",
    status: "error",
    containersMoved: 64,
    movesPerHour: 12,
    utilization: 41,
    assignedVessel: "—",
    berth: "Berth 2",
    shift: "Day A",
    lastMaintenance: "2026-08-26",
    operator: "PNIT Ops",
  },
  {
    craneId: "QC-04",
    status: "active",
    containersMoved: 131,
    movesPerHour: 26,
    utilization: 82,
    assignedVessel: "COSCO SHIPPING UNIVERSE",
    berth: "Berth 3",
    shift: "Day A",
    lastMaintenance: "2026-08-20",
    operator: "PNIT Ops",
  },
  {
    craneId: "QC-05",
    status: "idle",
    containersMoved: 0,
    movesPerHour: 0,
    utilization: 0,
    assignedVessel: "—",
    berth: "Berth 3",
    shift: "—",
    lastMaintenance: "2026-08-31",
    operator: "PNIT Ops",
  },
  {
    craneId: "QC-06",
    status: "active",
    containersMoved: 97,
    movesPerHour: 22,
    utilization: 74,
    assignedVessel: "MSC GULSUN",
    berth: "Berth 4",
    shift: "Day A",
    lastMaintenance: "2026-08-18",
    operator: "PNIT Ops",
  },
];

function pick<T>(list: readonly T[], index: number): T {
  return list[Math.abs(index) % list.length]!;
}

export function getShipTwinProfile(index: number): ShipTwinProfile {
  return pick(SHIP_TWIN, index);
}

export function getCraneTwinProfile(index: number): CraneTwinProfile {
  return pick(CRANE_TWIN, index);
}

export function shipStatusLabel(status: ShipOperationalStatus): string {
  const labels: Record<ShipOperationalStatus, string> = {
    berthed: "Berthed",
    loading: "Loading",
    discharging: "Discharging",
    departing: "Departing",
    idle: "Idle",
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
