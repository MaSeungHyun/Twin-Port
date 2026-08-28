export type LevelFilterKey = "safe" | "warning" | "danger";

export const LEVEL_FILTER_STYLES: Record<
  LevelFilterKey,
  {
    label: string;
    colorClass: string;
    dotClass: string;
    activeClass: string;
  }
> = {
  safe: {
    label: "안전",
    colorClass: "text-success",
    dotClass: "bg-success",
    activeClass: "border-success/45 bg-success/10 ring-1 ring-success/25",
  },
  warning: {
    label: "경고",
    colorClass: "text-warning",
    dotClass: "bg-warning",
    activeClass: "border-warning/45 bg-warning/10 ring-1 ring-warning/25",
  },
  danger: {
    label: "위험",
    colorClass: "text-danger",
    dotClass: "bg-danger",
    activeClass: "border-danger/45 bg-danger/10 ring-1 ring-danger/25",
  },
};

export const MONITORING_LEVELS = ["safe", "warning", "danger"] as const satisfies readonly LevelFilterKey[];

export const ALARM_LEVELS = ["danger", "warning"] as const satisfies readonly LevelFilterKey[];

export type MonitoringLevelFilterState = Record<
  (typeof MONITORING_LEVELS)[number],
  boolean
>;

export type AlarmLevelFilterState = Record<
  (typeof ALARM_LEVELS)[number],
  boolean
>;

export const DEFAULT_MONITORING_LEVEL_FILTER: MonitoringLevelFilterState = {
  safe: true,
  warning: true,
  danger: true,
};

export const DEFAULT_ALARM_LEVEL_FILTER: AlarmLevelFilterState = {
  danger: true,
  warning: true,
};

export function alarmLevelFromToast(level: string): LevelFilterKey | null {
  if (level === "error") return "danger";
  if (level === "warning") return "warning";
  return null;
}
