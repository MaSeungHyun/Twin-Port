/** DETAIL 그래프 패널 — 시계열·KPI 데이터 타입 */

export type DetailGraphPoint = {
  t: string;
  value: number;
};

export type DetailGraphSeries = {
  id: string;
  label: string;
  unit?: string;
  points: DetailGraphPoint[];
};

export type CraneJobCounts = {
  completed: number;
  inProgress: number;
  waiting: number;
};

export type CraneDowntimeEvent = {
  at: string;
  label: string;
  durationMin: number;
};

export type CraneProcessedContainer = {
  id: string;
  handledAt: string;
  move: "load" | "discharge" | "shift";
};

export type CraneDetailGraphMetrics = {
  craneId: string;
  subjectKey: string;
  /** 처리량 (shift 누적) */
  movesTotal: number;
  mphCurrent: number;
  cycleTimeMin: number;
  utilizationPct: number;
  workingHours: number;
  idleHours: number;
  energyKwh: number;
  jobs: CraneJobCounts;
  movesSeries: DetailGraphSeries;
  mphSeries: DetailGraphSeries;
  cycleTimeSeries: DetailGraphSeries;
  utilizationSeries: DetailGraphSeries;
  idleSeries: DetailGraphSeries;
  energySeries: DetailGraphSeries;
  downtimeEvents: CraneDowntimeEvent[];
  processedContainers: CraneProcessedContainer[];
};

export type ShipLoadedContainerLog = {
  /** 컨테이너 ID */
  id: string;
  /** 적재 시각 */
  loadedAt: string;
};

export type ShipDetailGraphData = {
  subjectKey: string;
  vesselName: string;
  loadedContainers: ShipLoadedContainerLog[];
};

export type DetailGraphData = CraneDetailGraphMetrics | ShipDetailGraphData;
