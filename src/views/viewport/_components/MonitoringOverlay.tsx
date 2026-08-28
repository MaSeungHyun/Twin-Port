import { computeBlockOccupancies, occupancyLevel } from "@/domain/occupancy";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import MonitoringGrid from "@/views/View/content/_components/block/MonitoringGrid";
import LevelFilter from "@/components/LevelFilter";
import {
  DEFAULT_MONITORING_LEVEL_FILTER,
  MONITORING_LEVELS,
  type MonitoringLevelFilterState,
} from "@/components/LevelFilter/constants";
import type { OccupancyLevel } from "@/domain/occupancy";
import gsap from "gsap";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/** 3D Canvas 밖, 화면 위 DOM 그리드. 마운트는 유지하고 표시만 토글 */
export default function MonitoringOverlay() {
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const open = monitorMode;
  const blocks = useYardStore((s) => s.blocks);
  const containers = useYardStore((s) => s.containers);
  const [levelFilter, setLevelFilter] = useState<MonitoringLevelFilterState>(
    DEFAULT_MONITORING_LEVEL_FILTER,
  );

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

  return createPortal(
    <div
      className="fixed inset-x-0 top-20 bottom-0 z-150 flex flex-col bg-background/55"
      hidden={!open}
      aria-hidden={!open}
    >
      <LevelFilter
        ariaLabel="블록 상태 필터"
        levels={MONITORING_LEVELS}
        counts={levelCounts}
        value={levelFilter}
        onChange={toggleLevelFilter}
        className="justify-center px-md pt-md"
      />
      <MonitoringGrid occupancies={occupancies} levelFilter={levelFilter} />
    </div>,
    document.body,
  );
}
