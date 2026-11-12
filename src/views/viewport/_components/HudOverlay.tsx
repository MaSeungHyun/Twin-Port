import { occupancyLevel } from "@/domain/occupancy";
import { useContentViewStore } from "@/stores/contentView";
import { useHudUiStore } from "@/stores/hud";
import { useOccupancyStore } from "@/stores/occupancy";
import { usePortSim } from "@/hooks/usePortSim";
import { CAMERA_HOME_EVENT, CAMERA_ZOOM_EVENT } from "@/constants/cameraIntro";
import { useViewportStore } from "@/stores/viewport";
import { AlarmPanel } from "@/views/View/header/Alarm";
import GraphicsSettingsPanel from "@/views/View/header/RenderSettings";
import OccupancyPanels from "@/views/viewport/_components/OccupancyPanels";
import Icon from "@/components/Icon";
import { FrameSlot } from "@/components/ui/PanelFrames";
import ProgressBar from "@/components/ui/ProgressBar";
import Tag from "@/components/ui/Tag";
import { cn } from "@/utils/style";

function zoom(direction: "in" | "out") {
  window.dispatchEvent(new CustomEvent(CAMERA_ZOOM_EVENT, { detail: { direction } }));
}

function KpiCell({
  label,
  value,
  unit,
  valueClass = "text-dt-text",
  bar,
  aside,
}: {
  label: string;
  value: string;
  unit: string;
  valueClass?: string;
  bar?: number;
  aside?: string;
}) {
  const level = bar == null ? null : occupancyLevel(bar / 100);
  const barTone = level === "danger" ? "danger" : level === "warning" ? "warn" : "ok";
  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col justify-center px-5">
      <p className="truncate text-[12px] font-normal text-dt-text-2">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className={cn("text-[28px] leading-none font-light tabular-nums", valueClass)}>
          {value}
          <span className="ml-1 text-[12px] font-normal text-dt-text-3">{unit}</span>
        </p>
        {bar != null ? (
          <ProgressBar
            value={bar}
            tone={barTone}
            className="h-1 w-10 shrink-0"
          />
        ) : null}
      </div>
      {aside ? <p className="absolute top-4 right-4 text-[10px] font-medium text-dt-danger">{aside}</p> : null}
    </div>
  );
}

function SegBar({ parts, className }: { parts: { value: number; color: string }[]; className?: string }) {
  const total = parts.reduce((sum, part) => sum + Math.max(part.value, 0), 0) || 1;
  return (
    <div className={cn("flex h-2 w-full gap-1", className)}>
      {parts.filter((part) => part.value > 0).map((part, index) => (
        <div
          key={index}
          className="h-full rounded-[2px]"
          style={{ width: `${(part.value / total) * 100}%`, background: part.color }}
        />
      ))}
    </div>
  );
}

export default function HudOverlay() {
  const started = useViewportStore((s) => s.monitoringStarted);
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const activeView = useContentViewStore((s) => s.activeView);
  const graphicsOpen = useHudUiStore((s) => s.graphicsOpen);
  const setGraphicsOpen = useHudUiStore((s) => s.setGraphicsOpen);
  const alarmOpen = useHudUiStore((s) => s.alarmOpen);
  const occupancyMode = useOccupancyStore((s) => s.occupancyMode);
  const sim = usePortSim();

  const working = sim.kpi.shipsWorking;
  const arriving = sim.ships.filter((s) => s.status === "arriving").length;
  const departing = sim.ships.filter((s) => s.status === "departing" || s.status === "preparing").length;
  const berthed = sim.ships.filter((s) =>
    s.status === "berthed" || s.status === "loading" || s.status === "discharging" || s.status === "preparing" || s.status === "departing",
  ).length;
  const next = sim.ships.find((s) => s.status === "arriving") ?? sim.ships.find((s) => s.status === "departed");
  const quayError = sim.cranes.filter((c) => c.status === "error");
  const ohcError = sim.overheadCranes.filter((c) => c.status === "error");
  const issues = [
    ...quayError.map((c) => ({ id: `q-${c.index}`, name: c.name, message: c.cause || "이상", level: "error" as const })),
    ...ohcError.map((c) => ({ id: `o-${c.index}`, name: c.name, message: c.cause || "이상", level: "error" as const })),
  ].slice(0, 4);
  const faultCount = quayError.length + ohcError.length;
  const faultLabel = quayError[0]
    ? `QC-${String(quayError[0].index).padStart(2, "0")}`
    : ohcError[0]?.name ?? "—";
  const showSummary = started && activeView == null && !occupancyMode;
  const showOccupancy = started && activeView == null && occupancyMode;
  const hasLeftPanel = showSummary || showOccupancy || (activeView != null && !monitorMode);
  const showKpi = started;
  const renderMode = useViewportStore((s) => s.renderMode);
  const setRenderMode = useViewportStore((s) => s.setRenderMode);
  const clockLabel = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const quayActive = sim.kpi.cranesActive;
  const quayIdle = sim.kpi.cranesIdle;
  const quayErrorCount = quayError.length;
  const ohcActive = sim.overheadCranes.filter((c) => c.status === "active").length;
  const ohcIdle = sim.overheadCranes.filter((c) => c.status === "idle").length;

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      {showKpi ? (
        <div className="hud-kpi hud-in-down absolute top-6 left-[408px] flex h-20 w-[min(924px,calc(100%-792px))] divide-x divide-white/8 rounded-[14px]">
          <KpiCell label="작업 중 선박" value={String(working)} unit="척" />
          <KpiCell label="입항 예정" value={String(arriving)} unit="척" />
          <KpiCell label="출항 예정" value={String(departing)} unit="척" />
          <KpiCell label="야드 적재율" value={sim.kpi.yardPct.toFixed(1)} unit="%" bar={sim.kpi.yardPct} />
          <KpiCell
            label="고장 장비"
            value={String(faultCount)}
            unit="대"
            valueClass={faultCount > 0 ? "text-dt-danger" : "text-dt-text"}
            aside={faultCount > 0 ? faultLabel : undefined}
          />
        </div>
      ) : null}

      <FrameSlot side="left" id="summary" active={showSummary} size={{ width: 360, height: 576 }} rank={1}>
        <section className="pointer-events-auto flex h-full min-h-0 flex-col overflow-y-auto">
          <header className="flex items-center justify-between px-6 pt-6">
            <h2 className="text-[16px] font-medium text-dt-text">현황 요약</h2>
            <span className="text-[10px] font-medium text-dt-text-3">{clockLabel} KST</span>
          </header>
          <div className="flex flex-col gap-4 px-6 pt-4">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-dt-text-2">BERTH · {sim.ships.length}</p>
                <p className="text-[12px] font-normal text-dt-text-2">선석</p>
              </div>
              <p className="mt-2 text-[28px] leading-none font-light text-dt-text tabular-nums">
                {berthed}
                <span className="ml-2 text-[14px] font-normal text-dt-text-2">/ {sim.ships.length} 점유</span>
              </p>
              <SegBar
                className="mt-2"
                parts={[
                  { value: berthed, color: "#3D9BFF" },
                  { value: Math.max(sim.ships.length - berthed, 0), color: "#ffffff14" },
                ]}
              />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[10px] font-medium text-dt-text-2">NEXT ARRIVAL</p>
                <p className="truncate text-[12px] font-normal text-dt-text">{next ? `${next.name} · ${next.eta}` : "예정 없음"}</p>
              </div>
            </div>
            <div className="h-px bg-white/8" />
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-medium text-dt-text-2">CRANE · {sim.kpi.cranesTotal + sim.overheadCranes.length}</p>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-normal text-dt-text">컨테이너 크레인</p>
                  <p className="text-[12px] font-normal text-dt-text-2">{sim.kpi.cranesTotal}대</p>
                </div>
                <SegBar
                  className="mt-1.5"
                  parts={[
                    { value: quayActive, color: "#3D9BFF" },
                    { value: quayIdle, color: "#ffffff24" },
                    { value: quayErrorCount, color: "#F0484A" },
                  ]}
                />
                <div className="mt-2 flex justify-between text-[12px] font-normal text-dt-text-2">
                  <span>가동 {quayActive} · 대기 {quayIdle}</span>
                  <span className="text-dt-danger">고장 {quayErrorCount}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-normal text-dt-text">오버헤드 크레인</p>
                  <p className="text-[12px] font-normal text-dt-text-2">{sim.overheadCranes.length}대</p>
                </div>
                <SegBar
                  className="mt-1.5"
                  parts={[
                    { value: ohcActive, color: "#3D9BFF" },
                    { value: ohcIdle, color: "#ffffff24" },
                    { value: ohcError.length, color: "#F0484A" },
                  ]}
                />
                <div className="mt-2 flex justify-between text-[12px] font-normal text-dt-text-2">
                  <span>가동 {ohcActive} · 대기 {ohcIdle}</span>
                  <span className="text-dt-danger">고장 {ohcError.length}</span>
                </div>
              </div>
            </div>
            <div className="h-px bg-white/8" />
            <div>
              <p className="text-[10px] font-medium text-dt-text-2">ISSUES · {issues.length}</p>
              {issues.length === 0 ? (
                <p className="mt-3 text-[12px] font-normal text-dt-text-3">진행 중인 이상이 없습니다</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {issues.slice(0, 3).map((item) => (
                    <li key={item.id} className="flex items-center gap-3">
                      <Tag tone="danger">고장</Tag>
                      <span className="w-16 shrink-0 truncate text-[14px] font-normal text-dt-text">{item.name}</span>
                      <span className="min-w-0 flex-1 truncate text-right text-[12px] font-normal text-dt-text-2">{item.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </FrameSlot>

      {showOccupancy ? <OccupancyPanels /> : null}

      <FrameSlot side="right" id="settings" active={graphicsOpen && started} size={{ width: 360, height: "auto", lift: true }} rank={3}>
        <GraphicsSettingsPanel onClose={() => setGraphicsOpen(false)} />
      </FrameSlot>

      <FrameSlot side="right" id="alarm" active={alarmOpen && started} size={{ width: 440, height: 642, lift: true }} rank={4}>
        <AlarmPanel />
      </FrameSlot>

      {started ? (
        <div className={cn("pointer-events-none absolute right-0 bottom-6 z-20 flex justify-center", hasLeftPanel ? "left-[calc(24px+360px)]" : "left-0")}>
        <div className="hud-flat hud-in-up pointer-events-auto flex h-10 items-center gap-1 rounded-[20px] px-1">
          <button
            type="button"
            aria-pressed={renderMode === "solid"}
            onClick={() => setRenderMode("solid")}
            className={cn(
              "flex h-8 items-center gap-1 rounded-full px-3 text-[12px]",
              renderMode === "solid" ? "bg-dt-point font-bold text-dt-bg" : "font-medium text-dt-text-2 hover:bg-white/10",
            )}
          >
            <Icon icon="Box" className={cn("size-4", renderMode === "solid" ? "stroke-dt-bg" : "stroke-dt-text-2")} />
            3D
          </button>
          <button
            type="button"
            aria-pressed={renderMode === "wire"}
            onClick={() => setRenderMode("wire")}
            className={cn(
              "flex h-8 items-center gap-1 rounded-full px-3 text-[12px]",
              renderMode === "wire" ? "bg-dt-point font-bold text-dt-bg" : "font-medium text-dt-text-2 hover:bg-white/10",
            )}
          >
            <Icon icon="Grid3x3" className={cn("size-4", renderMode === "wire" ? "stroke-dt-bg" : "stroke-dt-text-2")} />
            와이어
          </button>
          <span className="mx-1 h-6 w-px bg-white/8" />
          <button type="button" aria-label="확대" onClick={() => zoom("in")} className="grid size-8 place-items-center rounded-full text-dt-text hover:bg-white/10">
            <Icon icon="ZoomIn" className="size-4" />
          </button>
          <button type="button" aria-label="축소" onClick={() => zoom("out")} className="grid size-8 place-items-center rounded-full text-dt-text hover:bg-white/10">
            <Icon icon="ZoomOut" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="멀리 보기"
            onClick={() => window.dispatchEvent(new CustomEvent(CAMERA_HOME_EVENT))}
            className="grid size-8 place-items-center rounded-full text-dt-text hover:bg-white/10"
          >
            <Icon icon="RotateCcw" className="size-4" />
          </button>
        </div>
        </div>
      ) : null}
    </div>
  );
}
