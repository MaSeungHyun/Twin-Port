import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { useContentViewStore, type ContentView } from "@/stores/contentView";
import { useHudUiStore } from "@/stores/hud";
import { useOccupancyStore } from "@/stores/occupancy";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";
import Alarm from "./Alarm";
import GraphicsSettingsPanel from "./RenderSettings";
import ViewOption from "./ViewOption";

const NAV: { id: "control" | ContentView; label: string }[] = [
  { id: "control", label: "통합관제" },
  { id: "schedule", label: "스케줄" },
  { id: "ship", label: "선박" },
  { id: "crane", label: "크레인" },
  { id: "terminal", label: "블록" },
  { id: "container", label: "컨테이너" },
];

const WEEKDAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const date = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${WEEKDAY[now.getDay()]} KST`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return { date, time };
}

function navActive(id: (typeof NAV)[number]["id"], activeView: ContentView | null) {
  if (id === "control") return activeView == null;
  if (id === "terminal") return activeView === "terminal" || activeView === "block";
  return activeView === id;
}

export default function Header() {
  const activeView = useContentViewStore((s) => s.activeView);
  const setActiveView = useContentViewStore((s) => s.setActiveView);
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const setMonitorMode = useViewportStore((s) => s.setMonitorMode);
  const graphicsOpen = useHudUiStore((s) => s.graphicsOpen);
  const toggleGraphics = useHudUiStore((s) => s.toggleGraphics);
  const setGraphicsOpen = useHudUiStore((s) => s.setGraphicsOpen);
  const occupancyMode = useOccupancyStore((s) => s.occupancyMode);
  const toggleOccupancyMode = useOccupancyStore((s) => s.toggleOccupancyMode);
  const started = useViewportStore((s) => s.monitoringStarted);
  const introOpen = useViewportStore((s) => s.introOpen);
  const live = started && !introOpen;
  const { date, time } = useClock();

  const select = (id: (typeof NAV)[number]["id"]) => {
    if (!live) return;
    setMonitorMode(false);
    if (id === "control") {
      if (activeView) setActiveView(activeView);
      return;
    }
    setActiveView(id);
  };

  return (
    <header className="relative z-[200] flex h-16 w-full shrink-0 items-center pr-6 text-dt-text">
      {/* 배경·흐림은 뒤쪽 층에 둔다. header 자체에 backdrop-filter 를 걸면 그 안의 그래픽 설정 패널 흐림이 헤더 안쪽만 보게 된다(backdrop root) */}
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[#0A121980] shadow-[inset_0_-1px_0_#ffffff14] backdrop-blur-[24px] backdrop-brightness-90" />
      <div className="absolute top-4 left-6 flex h-8 items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-dt-point">
          <Icon icon="Anchor" className="size-4 text-white" />
        </span>
        <span className="leading-none">
          <span className="block text-[14px] font-medium tracking-[0.08em] text-dt-text">GRAPICAR PORT</span>
          <span className="mt-0.5 block text-[10px] tracking-[0.16em] text-dt-text-3">HARBOR DIGITAL TWIN</span>
        </span>
      </div>

      <nav aria-label="관제 메뉴" className="absolute top-4 left-[408px] flex items-center gap-1">
        {NAV.map((item) => {
          const active = item.id === "control"
            ? activeView == null
            : live && navActive(item.id, activeView);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => select(item.id)}
              className={cn(
                "h-8 min-w-[72px] shrink-0 rounded-lg px-2 text-center text-[14px] leading-none transition-colors min-[1600px]:min-w-[88px] min-[1600px]:px-3",
                active
                  ? "dt-active font-medium"
                  : "font-normal text-dt-text-2 hover:bg-white/6 hover:text-dt-text",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <div className="mr-1 hidden items-center min-[1800px]:flex">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-4">
              <Icon icon="Sun" className="size-5 stroke-[#F5C451]" />
              <p className="text-[14px] leading-5 font-normal text-dt-text">맑음 18°C</p>
            </div>
            <p className="text-[10px] leading-[15px] font-medium tracking-[0.1em] text-dt-text-3">
              WIND 4.2 · WAVE 0.6M
            </p>
          </div>
          <span className="ml-4 h-8 w-px bg-white/8" />
        </div>

        <button
          type="button"
          aria-pressed={live && monitorMode}
          onClick={() => { if (live) setMonitorMode(!monitorMode); }}
          className={cn(
            "hidden h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium md:flex",
            live && monitorMode ? "dt-active" : "bg-white/4 text-dt-text hover:bg-white/8",
          )}
        >
          <Icon icon="LayoutDashboard" className="size-4 stroke-current" />
          대시보드
        </button>
        <button
          type="button"
          aria-pressed={live && occupancyMode}
          onClick={() => { if (live) toggleOccupancyMode(); }}
          className={cn(
            "hidden h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium lg:flex",
            live && occupancyMode ? "dt-active" : "bg-white/4 text-dt-text hover:bg-white/8",
          )}
        >
          <Icon icon="ChartNoAxesColumn" className="size-4 stroke-current" />
          야드 점유율
        </button>
        <ViewOption />

        <Alarm />
        <button
          type="button"
          aria-label="그래픽 설정"
          aria-pressed={graphicsOpen}
          onClick={toggleGraphics}
          className={cn(
            "grid size-10 place-items-center rounded-lg text-white/75 hover:bg-[#2A3544]",
            graphicsOpen && "bg-white/10 text-white",
          )}
        >
          <Icon icon="Settings" className="size-5" />
        </button>

        <div className="pl-1 text-right leading-none">
          <p className="text-[20px] font-light tabular-nums tracking-wide text-dt-text">{time}</p>
          <p className="mt-0.5 text-[10px] font-medium tracking-wide text-dt-text-3">{date}</p>
        </div>
      </div>
      {/* 로딩·관제 시작 전에는 HUD 가 없어 헤더(z-200, 로딩 화면 z-100 위)에 직접 띄운다. 관제 중에는 HudOverlay 오른쪽 틀이 같은 패널을 띄운다 */}
      {!live && graphicsOpen ? (
        <div className="hud-glass absolute top-[72px] right-6 w-[360px] rounded-[14px]">
          <GraphicsSettingsPanel onClose={() => setGraphicsOpen(false)} />
        </div>
      ) : null}
    </header>
  );
}
