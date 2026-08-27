import type { OccupancyLevel } from "@/domain/occupancy";

export type MonitoringLevelFilterState = Record<OccupancyLevel, boolean>;

export const DEFAULT_MONITORING_LEVEL_FILTER: MonitoringLevelFilterState = {
  safe: true,
  warning: true,
  danger: true,
};
