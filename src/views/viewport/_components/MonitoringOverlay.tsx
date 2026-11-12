import { computeBlockOccupancies, occupancyLevel } from "@/domain/occupancy";
import { usePortSim } from "@/hooks/usePortSim";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import MonitoringGrid from "@/views/View/content/_components/block/MonitoringGrid";
import PortCallTab from "./monitoring/PortCallTab";
import {
  BerthTab,
  FaultTab,
  OverviewTab,
  QuayCraneTab,
  ScenarioTab,
  YardSummary,
} from "@/views/viewport/_components/monitoring/OpsDashboard";
import LevelFilter from "@/components/LevelFilter";
import Icon from "@/components/Icon";
import { usePresencePhase } from "@/components/ui/Presence";
import { cn } from "@/utils/style";
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
  { id: "portCall", label: "운영 시나리오" },
  { id: "overview", label: "개요" },
  { id: "berth", label: "선석·선박" },
  { id: "quayCrane", label: "안벽 크레인" },
  { id: "yard", label: "야드·블록" },
  { id: "scenario", label: "컨베이어·양하" },
  { id: "fault", label: "알람·고장" },
] as const;

type MonitorTab = (typeof MONITOR_TABS)[number]["id"];

const TAB_TRIGGER =
  "relative h-10 px-3 text-[14px] font-normal text-dt-text-2 outline-none transition-colors hover:text-dt-text data-[state=active]:font-medium data-[state=active]:text-dt-text data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-dt-point";

function DashboardCaption() {
  const sim = usePortSim();
  return (
    <p className="text-[12px] leading-4 font-normal text-dt-text-3">
      {sim.clock} · 관제 기준 {sim.shiftStart} · 3D 일시정지
    </p>
  );
}

/** 헤더 아래를 덮는 운영 대시보드. 마운트는 유지하고 표시만 토글 */
export default function MonitoringOverlay() {
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const setMonitorMode = useViewportStore((s) => s.setMonitorMode);
  const open = monitorMode;
  const phase = usePresencePhase();
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
      className={cn(
        "absolute inset-0 z-150 bg-dt-bg/80",
        // Presence 래퍼가 pointer-events-none 이라 상속된다 → 열려 있을 때는 다시 켠다 (대시보드 클릭 불가 수정)
        phase === "out" ? "presence-overlay-out pointer-events-none" : "presence-overlay-in pointer-events-auto",
      )}
      aria-hidden={phase === "out"}
    >
      <section className={cn(
        "absolute top-6 left-1/2 flex h-[min(944px,calc(100dvh-112px))] w-[min(1680px,calc(100vw-48px))] flex-col overflow-hidden rounded-[14px] bg-dt-bg text-dt-text shadow-[inset_0_0_0_2px_#ffffff14]",
        phase === "out" ? "presence-dash-out" : "presence-dash-in",
      )}>
        <header className="flex items-start justify-between px-6 pt-4">
          <div>
            <h2 className="text-[20px] leading-7 font-medium text-dt-text">운영 대시보드</h2>
            <DashboardCaption />
          </div>
          <button
            type="button"
            aria-label="대시보드 닫기"
            onClick={() => setMonitorMode(false)}
            className="grid size-6 place-items-center text-dt-text-2 hover:text-dt-text"
          >
            <Icon icon="X" className="size-4" />
          </button>
        </header>
        <Tabs.Root
          value={tab}
          onValueChange={(next) => {
            const item = MONITOR_TABS.find((t) => t.id === next);
            if (item) setTab(item.id);
          }}
          className="mt-3 flex min-h-0 flex-1 flex-col"
        >
          <Tabs.List
            aria-label="모니터링"
            className="flex shrink-0 gap-1 px-6 shadow-[inset_0_-1px_0_#ffffff14]"
          >
            {MONITOR_TABS.map((item) => (
              <Tabs.Trigger key={item.id} value={item.id} className={TAB_TRIGGER}>
                {item.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tabs.Content value="portCall" className="flex min-h-0 flex-1 flex-col outline-none">
            <PortCallTab />
          </Tabs.Content>
          <Tabs.Content value="overview" className="scrollbar-themed flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-4 pb-4 outline-none">
            <OverviewTab />
          </Tabs.Content>
          <Tabs.Content value="berth" className="flex min-h-0 flex-1 flex-col outline-none">
            <BerthTab />
          </Tabs.Content>
          <Tabs.Content value="quayCrane" className="flex min-h-0 flex-1 flex-col outline-none">
            <QuayCraneTab />
          </Tabs.Content>
          <Tabs.Content value="yard" className="scrollbar-themed flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain outline-none">
            <YardSummary />
            <LevelFilter
              ariaLabel="블록 상태 필터"
              levels={MONITORING_LEVELS}
              counts={levelCounts}
              value={levelFilter}
              onChange={toggleLevelFilter}
              className="justify-center px-6 pt-4"
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
      </section>
    </div>
  );
}
