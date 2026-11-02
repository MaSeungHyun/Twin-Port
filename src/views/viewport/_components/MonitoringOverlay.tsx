import { computeBlockOccupancies, occupancyLevel } from "@/domain/occupancy";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import MonitoringGrid from "@/views/View/content/_components/block/MonitoringGrid";
import {
  BerthTab,
  FaultTab,
  OverviewTab,
  QuayCraneTab,
  ScenarioTab,
  YardSummary,
} from "@/views/viewport/_components/monitoring/OpsDashboard";
import LevelFilter from "@/components/LevelFilter";
import {
  DEFAULT_MONITORING_LEVEL_FILTER,
  MONITORING_LEVELS,
  type MonitoringLevelFilterState,
} from "@/components/LevelFilter/constants";
import type { OccupancyLevel } from "@/domain/occupancy";
import gsap from "gsap";
import { Tabs } from "radix-ui";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";

const MONITOR_TABS = [
  { id: "overview", label: "개요" },
  { id: "berth", label: "선석·선박" },
  { id: "quayCrane", label: "안벽 크레인" },
  { id: "yard", label: "야드·블록" },
  { id: "scenario", label: "컨베이어·양하" },
  { id: "fault", label: "알람·고장" },
] as const;

type MonitorTab = (typeof MONITOR_TABS)[number]["id"];

/** robot_IK 대시보드 탭 스타일 — 하단 primary 밑줄 */
const TAB_TRIGGER =
  "relative h-10 px-md text-lg text-white/60 outline-none transition-colors hover:text-white data-[state=active]:text-white data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary focus-visible:ring-1 focus-visible:ring-primary";

/** 3D Canvas 위 DOM 그리드 — 뷰포트 영역(헤더·좌측 Content 제외) 안에서만 absolute로 그림. 마운트는 유지하고 표시만 토글 */
export default function MonitoringOverlay() {
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const open = monitorMode;
  const blocks = useYardStore((s) => s.blocks);
  const containers = useYardStore((s) => s.containers);
  const [levelFilter, setLevelFilter] = useState<MonitoringLevelFilterState>(
    DEFAULT_MONITORING_LEVEL_FILTER,
  );
  const [tab, setTab] = useState<MonitorTab>("overview");

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
      <Tabs.Root
        value={tab}
        onValueChange={(next) => {
          const item = MONITOR_TABS.find((t) => t.id === next);
          if (item) setTab(item.id);
        }}
        className="flex min-h-0 flex-1 flex-col text-white"
      >
        <Tabs.List
          aria-label="모니터링"
          className="flex shrink-0 border-b border-white/10 px-md"
        >
          {MONITOR_TABS.map((item) => (
            <Tabs.Trigger key={item.id} value={item.id} className={TAB_TRIGGER}>
              {item.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="overview" className="flex min-h-0 flex-1 flex-col outline-none">
          <OverviewTab />
        </Tabs.Content>
        <Tabs.Content value="berth" className="flex min-h-0 flex-1 flex-col outline-none">
          <BerthTab />
        </Tabs.Content>
        <Tabs.Content value="quayCrane" className="flex min-h-0 flex-1 flex-col outline-none">
          <QuayCraneTab />
        </Tabs.Content>
        <Tabs.Content value="yard" className="flex min-h-0 flex-1 flex-col scrollbar-themed overflow-y-auto overscroll-contain outline-none">
          <YardSummary />
          <LevelFilter
            ariaLabel="블록 상태 필터"
            levels={MONITORING_LEVELS}
            counts={levelCounts}
            value={levelFilter}
            onChange={toggleLevelFilter}
            className="justify-center px-md pt-md"
          />
          <div className="flex min-h-[520px] shrink-0 flex-col">
            <MonitoringGrid occupancies={occupancies} levelFilter={levelFilter} />
          </div>
        </Tabs.Content>
        <Tabs.Content value="scenario" className="flex min-h-0 flex-1 flex-col outline-none">
          <ScenarioTab />
        </Tabs.Content>
        <Tabs.Content value="fault" className="flex min-h-0 flex-1 flex-col outline-none">
          <FaultTab />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
