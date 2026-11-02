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
  {
    vesselName: "ONE INNOVATION",
    imo: "9937236",
    flag: "Japan",
    operator: "ONE",
    loa: "400 m",
    beam: "61 m",
    draft: "16.0 m",
    teu: 24_136,
    status: "berthed",
    berth: "Berth 5",
    eta: "",
    etd: "",
    cargo: "Import containers",
  },
  {
    vesselName: "EVER ACE",
    imo: "9893890",
    flag: "Panama",
    operator: "Evergreen",
    loa: "400 m",
    beam: "61.5 m",
    draft: "16.0 m",
    teu: 23_992,
    status: "berthed",
    berth: "Berth 6",
    eta: "",
    etd: "",
    cargo: "Transshipment",
  },
  {
    vesselName: "MAERSK EINDHOVEN",
    imo: "9456771",
    flag: "Denmark",
    operator: "Maersk",
    loa: "366 m",
    beam: "48 m",
    draft: "15.5 m",
    teu: 13_092,
    status: "berthed",
    berth: "Berth 7",
    eta: "",
    etd: "",
    cargo: "Export containers",
  },
  {
    vesselName: "CMA CGM JACQUES SAADE",
    imo: "9839131",
    flag: "France",
    operator: "CMA CGM",
    loa: "400 m",
    beam: "61.3 m",
    draft: "16.0 m",
    teu: 23_112,
    status: "berthed",
    berth: "Berth 8",
    eta: "",
    etd: "",
    cargo: "Mixed",
  },
];

export const BASE_CRANES: readonly CraneTwinProfile[] = [
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

export function baseShipProfile(index: number): ShipTwinProfile {
  const base = pick(BASE_SHIPS, index);
  const lap = Math.floor(Math.abs(index) / BASE_SHIPS.length);
  return lap > 0 ? { ...base, vesselName: `${base.vesselName} ${lap + 1}` } : base;
}

export function baseCraneProfile(index: number): CraneTwinProfile {
  return pick(BASE_CRANES, index);
}
