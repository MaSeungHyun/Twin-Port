import BlockContentAccordion from "./_components/block/BlockContentAccordion";
import ContainerContentAccordion from "./_components/container/ContainerContentAccordion";
import CraneContentPanel from "./_components/crane/CraneContentPanel";
import ShipContentPanel from "./_components/ship/ShipContentPanel";
import CyberPanel from "./_components/cyber/CyberPanel";
import { useContentViewStore } from "@/stores/contentView";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";

export default function ContentPanel() {
  const activeView = useContentViewStore((s) => s.activeView);
  const monitorMode = useViewportStore((s) => s.monitorMode);

  if (monitorMode || !activeView) return null;

  return (
    <CyberPanel
      className={cn(
        "pointer-events-auto absolute top-md bottom-md left-md z-20 flex w-96 flex-col",
        "backdrop-blur-md",
      )}
    >
      {activeView === "block" ? <BlockContentAccordion flat /> : null}
      {activeView === "container" ? <ContainerContentAccordion flat /> : null}
      {activeView === "ship" ? <ShipContentPanel /> : null}
      {activeView === "crane" ? <CraneContentPanel /> : null}
    </CyberPanel>
  );
}
