import BlockContent from "./_components/block/BlockContent";
import ContainerContent from "./_components/container/ContainerContent";
import ContentDetailGraphPanel from "./_components/ContentDetailGraphPanel";
import CraneContentPanel from "./_components/crane/CraneContentPanel";
import ShipContentPanel from "./_components/ship/ShipContentPanel";
import CyberPanel from "./_components/cyber/CyberPanel";
import { useContentViewStore } from "@/stores/contentView";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";
import { useEffect } from "react";

export default function ContentPanel() {
  const activeView = useContentViewStore((s) => s.activeView);
  const detailGraphOpen = useContentViewStore((s) => s.detailGraphOpen);
  const detailGraphSubject = useContentViewStore((s) => s.detailGraphSubject);
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const dismissContentPanelLayer = useContentViewStore(
    (s) => s.dismissContentPanelLayer,
  );

  useEffect(() => {
    if (monitorMode || !activeView) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (dismissContentPanelLayer()) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeView, monitorMode, dismissContentPanelLayer]);

  if (monitorMode || !activeView) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto absolute z-20 flex min-w-0 gap-sm",
        detailGraphOpen
          ? "top-md right-md bottom-md left-md"
          : "top-md bottom-md left-md",
      )}
    >
      <CyberPanel className="flex min-h-0 w-96 shrink-0 flex-col backdrop-blur-md">
        {activeView === "block" ? <BlockContent /> : null}
        {activeView === "container" ? (
          <ContainerContent />
        ) : null}
        {activeView === "ship" ? <ShipContentPanel /> : null}
        {activeView === "crane" ? <CraneContentPanel /> : null}
      </CyberPanel>

      {detailGraphOpen && detailGraphSubject ? (
        <ContentDetailGraphPanel
          subject={detailGraphSubject}
          className="min-w-0 flex-1"
        />
      ) : null}
    </div>
  );
}
