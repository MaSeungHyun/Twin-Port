import Icon from "@/components/Icon";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";
import Button from "@/components/Button";

export default function OccupancyMode() {
  const occupancyMode = useViewportStore((s) => s.occupancyMode);
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const toggleOccupancyMode = useViewportStore((s) => s.toggleOccupancyMode);

  return (
    <Button
      type="button"
      disabled={monitorMode}
      aria-disabled={monitorMode}
      className={cn(
        !occupancyMode && "hover:bg-primary/40",
        occupancyMode && "bg-primary/60",
        // monitorMode && "cursor-not-allowed opacity-40",
      )}
      onClick={() => toggleOccupancyMode()}
    >
      <Icon icon="ChartNoAxesColumn" />
    </Button>
  );
}
