import { useOccupancyStore } from "@/stores/occupancy";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";

type ViewportLayoutProps = {
  children: React.ReactNode;
};

/** Scene 위 오버레이 — inset shadow·border는 자식(Canvas) 뒤가 아니라 위 레이어에 그려야 보임 */
export default function ViewportLayout({ children }: ViewportLayoutProps) {
  const occupancyMode = useOccupancyStore((s) => s.occupancyMode);
  const showDangerousBlockCards = useViewportStore(
    (s) => s.showDangerousBlockCards,
  );

  return (
    <div className="relative h-full min-h-0 w-full">
      {children}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-10 border border-primary/80",
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
    </div>
  );
}
