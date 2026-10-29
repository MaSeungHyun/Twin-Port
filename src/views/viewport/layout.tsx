import { useOccupancyStore } from "@/stores/occupancy";
import { useViewportStore } from "@/stores/viewport";
import { useFailureStore } from "@/stores/useFailureStore";
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
  // [failure] 고장 장비가 있으면 DANGEROUS 와 같은 빨강 테두리 (블록 카드는 X)
  const anyFailure = useFailureStore((s) =>
    Object.values(s.active).some((a) => a.state === "failure"),
  );
  const dangerRim = showDangerousBlockCards || anyFailure;

  return (
    <div className="relative h-full min-h-0 w-full">
      {children}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-10 border border-primary/80",
          dangerRim && "border-danger/80",
          dangerRim && "dangerous-rim-pulse",
          occupancyMode && !dangerRim && "occupancy-rim-pulse",
        )}
        style={
          occupancyMode || dangerRim
            ? undefined
            : { boxShadow: "inset 0 0 50px rgba(0,0,0,0.9)" }
        }
      />
    </div>
  );
}
