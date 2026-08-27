import {
  computeBlockOccupancies,
  occupancyLevel,
  type OccupancyLevel,
} from "@/domain/occupancy";
import { useYardStore } from "@/stores/yard";
import { cn } from "@/utils/style";
import { useMemo } from "react";
import type { MonitoringLevelFilterState } from "./monitoringLevelFilter.constants";
import Icon from "@/components/Icon";

const LEVEL_OPTIONS: {
  level: OccupancyLevel;
  label: string;
  colorClass: string;
  dotClass: string;
  activeClass: string;
}[] = [
  {
    level: "safe",
    label: "안전",
    colorClass: "text-success",
    dotClass: "bg-success",
    activeClass: "border-success/45 bg-success/10 ring-1 ring-success/25",
  },
  {
    level: "warning",
    label: "경고",
    colorClass: "text-warning",
    dotClass: "bg-warning",
    activeClass: "border-warning/45 bg-warning/10 ring-1 ring-warning/25",
  },
  {
    level: "danger",
    label: "위험",
    colorClass: "text-danger",
    dotClass: "bg-danger",
    activeClass: "border-danger/45 bg-danger/10 ring-1 ring-danger/25",
  },
];

type MonitoringLevelFilterProps = {
  value: MonitoringLevelFilterState;
  onChange: (level: OccupancyLevel) => void;
};

export default function MonitoringLevelFilter({
  value,
  onChange,
}: MonitoringLevelFilterProps) {
  const blocks = useYardStore((s) => s.blocks);
  const containers = useYardStore((s) => s.containers);

  const levelCounts = useMemo(() => {
    const occupancies = computeBlockOccupancies(containers, blocks);
    const counts: Record<OccupancyLevel, number> = {
      safe: 0,
      warning: 0,
      danger: 0,
    };
    for (const occupancy of occupancies) {
      counts[occupancyLevel(occupancy.ratio)] += 1;
    }
    return counts;
  }, [blocks, containers]);

  return (
    <div
      role="group"
      aria-label="블록 상태 필터"
      className="flex shrink-0 flex-wrap items-center justify-center gap-md px-md pt-md"
    >
      {/* <Icon icon="Funnel" className="size-6 stroke-text-secondary" /> */}
      {LEVEL_OPTIONS.map(
        ({ level, label, colorClass, dotClass, activeClass }) => {
          const active = value[level];
          return (
            <button
              key={level}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(level)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-xs rounded-md border px-sm py-xs text-lg transition-colors",
                "hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                colorClass,
                active
                  ? activeClass
                  : "border-white/10 bg-black/25 opacity-45 line-through decoration-current/35 hover:opacity-70",
              )}
            >
              <span
                className={cn("size-xs shrink-0 rounded-full", dotClass)}
                aria-hidden
              />
              <span className="font-semibold">{label}</span>
              <span className="tabular-nums font-bold">
                {levelCounts[level]}
              </span>
            </button>
          );
        },
      )}
    </div>
  );
}
