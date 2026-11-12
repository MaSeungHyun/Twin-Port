import { useEffect } from "react";
import { useContentViewStore, type ContentView } from "@/stores/contentView";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";
import BlockHud from "./_components/block/BlockHud";
import ContainerHud from "./_components/container/ContainerHud";
import CraneHud from "./_components/crane/CraneHud";
import ContentDetailGraphPanel from "./_components/ContentDetailGraphPanel";
import CyberPanel from "./_components/cyber/CyberPanel";
import ScheduleContent from "./_components/ship/ScheduleContent";
import ShipHud from "./_components/ship/ShipHud";
import BerthContent from "./_components/terminal/BerthContent";

const LIST_VIEWS = new Set<ContentView>(["schedule", "ship", "crane", "container", "terminal", "block"]);

function isList(view: ContentView | null): view is ContentView {
  return view != null && LIST_VIEWS.has(view);
}

function ListView({ view }: { view: ContentView }) {
  if (view === "schedule") return <ScheduleContent />;
  if (view === "ship") return <ShipHud />;
  if (view === "crane") return <CraneHud />;
  if (view === "container") return <ContainerHud />;
  return <BlockHud />;
}

export default function ContentPanel() {
  const activeView = useContentViewStore((s) => s.activeView);
  const detailGraphOpen = useContentViewStore((s) => s.detailGraphOpen);
  const detailGraphSubject = useContentViewStore((s) => s.detailGraphSubject);
  const dismissContentPanelLayer = useContentViewStore((s) => s.dismissContentPanelLayer);
  const monitorMode = useViewportStore((s) => s.monitorMode);

  useEffect(() => {
    if (monitorMode || !activeView) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (dismissContentPanelLayer()) event.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeView, monitorMode, dismissContentPanelLayer]);

  if (monitorMode || !activeView) return null;

  if (isList(activeView)) {
    return (
      <div className="pointer-events-none absolute inset-0 z-40">
        <ListView view={activeView} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-auto absolute z-40 flex min-w-0 gap-sm",
        detailGraphOpen
          ? "top-md right-md bottom-md left-md"
          : "top-md bottom-md left-md",
      )}
    >
      <CyberPanel className="flex min-h-0 w-96 shrink-0 flex-col backdrop-blur-md">
        {activeView === "berth" ? <BerthContent /> : null}
      </CyberPanel>

      {detailGraphOpen && detailGraphSubject ? (
        <ContentDetailGraphPanel subject={detailGraphSubject} className="min-w-0 flex-1" />
      ) : null}
    </div>
  );
}
