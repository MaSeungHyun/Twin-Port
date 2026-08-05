import { useRef } from "react";
import Scene from "./_components/Scene";
import { useViewportStore } from "@/stores/viewport";

export default function Viewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const occupancyMode = useViewportStore((s) => s.occupancyMode);
  const toggleOccupancyMode = useViewportStore((s) => s.toggleOccupancyMode);

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-0 w-full flex-1 overflow-hidden"
    >
      <button
        type="button"
        onClick={toggleOccupancyMode}
        className={`absolute top-4 left-4 z-30 rounded-lg border px-3 py-2 text-sm font-medium shadow backdrop-blur-md transition-colors ${
          occupancyMode
            ? "border-sky-300/40 bg-sky-500/25 text-sky-50"
            : "border-white/15 bg-black/45 text-white/90 hover:bg-black/60"
        }`}
      >
        {occupancyMode ? "컨테이너 보기" : "Block 점유율"}
      </button>
      <Scene statsParent={containerRef} />
    </div>
  );
}
