import type {
  CraneDetailGraphMetrics,
  CraneDowntimeEvent,
  CraneProcessedContainer,
  DetailGraphPoint,
  DetailGraphSeries,
} from "@/types/detailGraph";
import { getCraneTwinProfile } from "./portTwinMock";

const DAY_LABELS = [
  "08-25",
  "08-26",
  "08-27",
  "08-28",
  "08-29",
  "08-30",
  "08-31",
] as const;

const HOUR_LABELS = ["06", "08", "10", "12", "14", "16", "18", "20"] as const;

function seeded(index: number, salt: number) {
  return Math.abs(Math.sin(index * 12.989 + salt * 78.233)) % 1;
}

function dayPoints(
  base: number,
  index: number,
  spread: number,
  salt = 0,
): DetailGraphPoint[] {
  return DAY_LABELS.map((t, i) => ({
    t,
    value: Math.round(
      base + i * spread * 0.15 + (seeded(index, salt + i) - 0.5) * spread,
    ),
  }));
}

function hourPoints(
  base: number,
  index: number,
  spread: number,
): DetailGraphPoint[] {
  return HOUR_LABELS.map((t, i) => ({
    t: `${t}:00`,
    value: Math.round(
      base + (seeded(index, i + 10) - 0.5) * spread + (i % 3) * 2,
    ),
  }));
}

function series(
  id: string,
  label: string,
  unit: string,
  points: DetailGraphPoint[],
): DetailGraphSeries {
  return { id, label, unit, points };
}

function downtimeFor(index: number): CraneDowntimeEvent[] {
  if (index % 5 === 4) {
    return [
      { at: "08-31 07:20", label: "Planned maintenance", durationMin: 180 },
      { at: "08-30 14:05", label: "Hydraulic check", durationMin: 45 },
    ];
  }
  if (index % 3 === 2) {
    return [{ at: "08-31 09:10", label: "Spreader fault", durationMin: 22 }];
  }
  return [{ at: "08-29 11:40", label: "Weather hold", durationMin: 35 }];
}

function containersFor(
  index: number,
  count: number,
): CraneProcessedContainer[] {
  const moves: CraneProcessedContainer["move"][] = [
    "load",
    "discharge",
    "shift",
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `CONT-${String(1000 + index * 20 + i).padStart(4, "0")}`,
    handledAt: `${String(13 - Math.floor(i / 2)).padStart(2, "0")}:${String(10 + i * 7).padStart(2, "0")}`,
    move: moves[(i + index) % moves.length]!,
  }));
}

export function getCraneDetailGraphMetrics(
  index: number,
  subjectKey: string,
): CraneDetailGraphMetrics {
  const twin = getCraneTwinProfile(index);
  const movesBase = twin.containersMoved;
  const mphBase = twin.movesPerHour;
  const utilBase = twin.utilization;
  const cycleBase = Math.max(1.8, 4.2 - mphBase * 0.06);
  const working = Math.round((utilBase / 100) * 8 * 10) / 10;
  const idle = Math.round((8 - working) * 10) / 10;

  return {
    craneId: twin.craneId,
    subjectKey,
    movesTotal: movesBase,
    mphCurrent: mphBase,
    cycleTimeMin: Math.round(cycleBase * 10) / 10,
    utilizationPct: utilBase,
    workingHours: working,
    idleHours: idle,
    energyKwh: Math.round(movesBase * 3.2 + index * 18),
    jobs: {
      completed: Math.round(movesBase * 0.88),
      inProgress: twin.status === "active" ? 2 : 0,
      waiting: twin.status === "idle" ? 6 : 3 + (index % 4),
    },
    movesSeries: series(
      "moves",
      "Throughput (Moves)",
      "cnt",
      dayPoints(movesBase * 0.7, index, 28, 1),
    ),
    mphSeries: series("mph", "MPH", "m/h", dayPoints(mphBase, index, 8, 2)),
    cycleTimeSeries: series(
      "cycle",
      "Cycle Time",
      "min",
      dayPoints(cycleBase, index, 0.8, 3).map((p) => ({
        ...p,
        value: Math.round(p.value * 10) / 10,
      })),
    ),
    utilizationSeries: series(
      "util",
      "Utilization",
      "%",
      dayPoints(utilBase, index, 12, 4),
    ),
    idleSeries: series(
      "idle",
      "Idle Time",
      "min",
      hourPoints(idle * 6, index, idle * 4),
    ),
    energySeries: series(
      "energy",
      "Energy",
      "kWh",
      dayPoints(movesBase * 2.5, index, 40, 5),
    ),
    downtimeEvents: downtimeFor(index),
    processedContainers: containersFor(index, 6),
  };
}
