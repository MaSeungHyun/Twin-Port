import Toaster from "@/components/Toaster";
import ToasterTestTrigger from "@/components/Toaster/ToasterTestTrigger";
import { occupancyDimRef } from "@/constants/occupancyTransition";
import { useOccupancyStore } from "@/stores/occupancy";
import { cn } from "@/utils/style";
import ContentsLayer from "./_components/ContentsLayer";
import Scene from "./_components/Scene";

function OccupancyRim() {
  const occupancyMode = useOccupancyStore((s) => s.occupancyMode);
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 bg-transparent",
        occupancyMode && "occupancy-rim-pulse",
      )}
      style={
        occupancyMode
          ? undefined
          : { boxShadow: "inset 0 0 50px rgba(0,0,0,0.9)" }
      }
    />
  );
}

export default function Viewport() {
  return (
    <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden border border-primary/80">
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
      <OccupancyRim />
      <Toaster />
      <ToasterTestTrigger />
    </div>
  );
}
