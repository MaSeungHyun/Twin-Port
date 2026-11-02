/** Port Twin — 선박·크레인 고정 제원(시뮬레이션이 상태·수치를 덮어쓴다) */


export type ShipOperationalStatus =
  | "berthed"
  | "loading"
  | "discharging"
  | "departing"
  | "arriving"
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

export const BASE_SHIPS: readonly ShipTwinProfile[] = [
  {
    vesselName: "ONE INTEGRITY",
    imo: "9933119",
    flag: "Liberia",
    operator: "ONE",
    loa: "400 m",
    beam: "61.5 m",
    draft: "—",
    teu: 24_136,
    status: "loading",
    berth: "Berth 1",
    eta: "2026-08-29 06:30",
    etd: "2026-08-31 18:00",
    cargo: "Import containers",
  },
  {
    vesselName: "HMM NURI",
    imo: "9869162",
    flag: "South Korea",
    operator: "HMM",
    loa: "365.2 m",
    beam: "51 m",
    draft: "—",
    teu: 16_010,
    status: "discharging",
    berth: "Berth 2",
    eta: "2026-08-30 11:00",
    etd: "2026-09-01 09:30",
    cargo: "Transshipment",
  },
  {
    vesselName: "MSC SAVONA",
    imo: "9460356",
    flag: "Liberia",
    operator: "MSC",
    loa: "365.8 m",
    beam: "51.2 m",
    draft: "16.0 m",
    teu: 14_000,
    status: "berthed",
    berth: "Berth 3",
    eta: "2026-08-31 04:15",
    etd: "2026-09-02 14:00",
    cargo: "Export containers",
  },
  {
    vesselName: "YM WINNER",
    imo: "9684689",
    flag: "Singapore",
    operator: "Yang Ming",
    loa: "368 m",
    beam: "51 m",
    draft: "15.8 m",
    teu: 13_800,
    status: "departing",
    berth: "Berth 4",
    eta: "2026-08-28 22:40",
    etd: "2026-08-31 13:45",
    cargo: "Mixed",
  },
  {
    vesselName: "ONE SINCERITY",
    imo: "9976185",
    flag: "Singapore",
    operator: "ONE",
    loa: "335.9 m",
    beam: "51 m",
    draft: "—",
    teu: 13_932,
    status: "berthed",
    berth: "Berth 5",
    eta: "",
    etd: "",
    cargo: "Import containers",
  },
  {
    vesselName: "YM TARGET",
    imo: "9860934",
    flag: "Liberia",
    operator: "Yang Ming",
    loa: "332 m",
    beam: "48.2 m",
    draft: "—",
    teu: 12_726,
    status: "berthed",
    berth: "Berth 6",
    eta: "",
    etd: "",
    cargo: "Transshipment",
  },
  {
    vesselName: "MSC LISBON IX",
    imo: "9304459",
    flag: "Cyprus",
    operator: "MSC",
    loa: "336.7 m",
    beam: "45.6 m",
    draft: "—",
    teu: 9_178,
    status: "berthed",
    berth: "Berth 7",
    eta: "",
    etd: "",
    cargo: "Export containers",
  },
  {
    vesselName: "MSC CHANNE",
    imo: "9710438",
    flag: "Portugal",
    operator: "MSC",
    loa: "299 m",
    beam: "48 m",
    draft: "—",
    teu: 8_800,
    status: "berthed",
    berth: "Berth 8",
    eta: "",
    etd: "",
    cargo: "Mixed",
  },
  {
    vesselName: "HMM JADE",
    imo: "9998523",
    flag: "Panama",
    operator: "HMM",
    loa: "274 m",
    beam: "45.6 m",
    draft: "15.0 m",
    teu: 8_688,
    status: "berthed",
    berth: "Berth 9",
    eta: "",
    etd: "",
    cargo: "Transshipment",
  },
  {
    vesselName: "MAERSK LIMA",
    imo: "9526875",
    flag: "Denmark",
    operator: "Maersk",
    loa: "299.9 m",
    beam: "45.9 m",
    draft: "—",
    teu: 7_450,
    status: "berthed",
    berth: "Berth 10",
    eta: "",
    etd: "",
    cargo: "Import containers",
  },
];

export const BASE_CRANES: readonly CraneTwinProfile[] = [
  {
    craneId: "QC-01",
    status: "active",
    containersMoved: 142,
    movesPerHour: 28,
    utilization: 86,
    assignedVessel: "ONE INTEGRITY",
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
    assignedVessel: "HMM NURI",
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
    assignedVessel: "MSC SAVONA",
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
    assignedVessel: "YM WINNER",
    berth: "Berth 4",
    shift: "Day A",
    lastMaintenance: "2026-08-18",
    operator: "PNIT Ops",
  },
];

function pick<T>(list: readonly T[], index: number): T {
  return list[Math.abs(index) % list.length]!;
}

export function baseShipProfile(index: number): ShipTwinProfile {
  const base = pick(BASE_SHIPS, index);
  const lap = Math.floor(Math.abs(index) / BASE_SHIPS.length);
  return lap > 0 ? { ...base, vesselName: `${base.vesselName} ${lap + 1}` } : base;
}

export function baseCraneProfile(index: number): CraneTwinProfile {
  return pick(BASE_CRANES, index);
}
