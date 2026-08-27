import ToasterTestTrigger from "@/components/Toaster/ToasterTestTrigger";
import { occupancyDimRef } from "@/constants/occupancyTransition";
import { useOccupancyStore } from "@/stores/occupancy";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";
import ContentsLayer from "./_components/ContentsLayer";
import Scene from "./_components/Scene";

/** dangerous/occupancy 상태 구독을 이 레이어에만 두어 Scene(Canvas) 리렌더를 피함 */
function ViewportChrome() {
  const occupancyMode = useOccupancyStore((s) => s.occupancyMode);
  const showDangerousBlockCards = useViewportStore(
    (s) => s.showDangerousBlockCards,
  );

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 border border-primary/80 bg-transparent",
        showDangerousBlockCards && "border-danger/80",
        showDangerousBlockCards && "dangerous-rim-pulse",
        occupancyMode && !showDangerousBlockCards && "occupancy-rim-pulse",
      )}
      style={
        occupancyMode || showDangerousBlockCards
          ? undefined
          : { boxShadow: "inset 0 0 50px rgba(0,0,0,0.9)" }
      }
    />
  );
}

export default function Viewport() {
  return (
    <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Scene />
      </div>
      <div
        ref={(node) => {
          occupancyDimRef.current = node;
        }}
        className="pointer-events-none absolute inset-0 z-1 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.88)_72%)]"
        aria-hidden
      />
      <ContentsLayer />
      <ViewportChrome />
      <ToasterTestTrigger />
    </div>
  );
}
