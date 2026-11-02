import { computeBlockOccupancies, occupancyLevel } from "@/domain/occupancy";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import MonitoringGrid from "@/views/View/content/_components/block/MonitoringGrid";
import OpsDashboard from "@/views/viewport/_components/monitoring/OpsDashboard";
import LevelFilter from "@/components/LevelFilter";
import {
  DEFAULT_MONITORING_LEVEL_FILTER,
  MONITORING_LEVELS,
  type MonitoringLevelFilterState,
} from "@/components/LevelFilter/constants";
import type { OccupancyLevel } from "@/domain/occupancy";
import { cn } from "@/utils/style";
import gsap from "gsap";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";

type MonitorTab = "blocks" | "ops";

/** 3D Canvas 위 DOM 그리드 — 뷰포트 영역(헤더·좌측 Content 제외) 안에서만 absolute로 그림. 마운트는 유지하고 표시만 토글 */
export default function MonitoringOverlay() {
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const open = monitorMode;
  const blocks = useYardStore((s) => s.blocks);
  const containers = useYardStore((s) => s.containers);
  const [levelFilter, setLevelFilter] = useState<MonitoringLevelFilterState>(
    DEFAULT_MONITORING_LEVEL_FILTER,
  );
  const [tab, setTab] = useState<MonitorTab>("ops");

  const occupancies = useMemo(
    () => computeBlockOccupancies(containers, blocks),
    [blocks, containers],
  );

  const levelCounts = useMemo(() => {
    const counts: Record<(typeof MONITORING_LEVELS)[number], number> = {
      safe: 0,
      warning: 0,
      danger: 0,
    };
    for (const occupancy of occupancies) {
      counts[occupancyLevel(occupancy.ratio)] += 1;
    }
    return counts;
  }, [occupancies]);

  const toggleLevelFilter = useCallback((level: OccupancyLevel) => {
    setLevelFilter((prev) => ({ ...prev, [level]: !prev[level] }));
  }, []);

  useLayoutEffect(() => {
    if (open) gsap.globalTimeline.pause();
    else gsap.globalTimeline.resume();
  }, [open]);

  return (
    <div
      className="absolute inset-0 z-150 flex flex-col bg-background/95"
      hidden={!open}
      aria-hidden={!open}
    >
      <div
        role="tablist"
        aria-label="모니터링"
        className="flex shrink-0 gap-sm px-md pt-md"
      >
        {(
          [
            ["ops", "운영"],
            ["blocks", "블록"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-md border px-md py-xs text-lg",
              tab === id
                ? "border-primary text-text-primary"
                : "border-white/10 text-text-secondary hover:border-white/25",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "blocks" ? (
        <>
          <LevelFilter
            ariaLabel="블록 상태 필터"
            levels={MONITORING_LEVELS}
            counts={levelCounts}
            value={levelFilter}
            onChange={toggleLevelFilter}
            className="justify-center px-md pt-md"
          />
          <MonitoringGrid occupancies={occupancies} levelFilter={levelFilter} />
        </>
      ) : (
        <OpsDashboard />
      )}
    </div>
  );
}
