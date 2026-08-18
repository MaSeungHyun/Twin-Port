import { useViewportStore } from "@/stores/viewport";
import OccupancyGrid from "@/views/View/content/_components/block/OccupancyGrid";
import gsap from "gsap";
import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";

/** 3D Canvas 밖, 화면 위 DOM 그리드. 마운트는 유지하고 표시만 토글 */
export default function OccupancyOverlay() {
  const occupancyMode = useViewportStore((s) => s.occupancyMode);
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const open = occupancyMode || monitorMode;

  useLayoutEffect(() => {
    if (open) gsap.globalTimeline.pause();
    else gsap.globalTimeline.resume();
  }, [open]);

  return createPortal(
    <div
      className="fixed inset-x-0 top-12 bottom-0 z-150 bg-background/55"
      hidden={!open}
      aria-hidden={!open}
    >
      <OccupancyGrid />
    </div>,
    document.body,
  );
}
