import Icon from "@/components/Icon";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";
import Button from "@/components/Button";

export default function OccupnacyMode() {
  const occupancyMode = useViewportStore((s) => s.occupancyMode);
  const toggleOccupancyMode = useViewportStore((s) => s.toggleOccupancyMode);
  return (
    <Button
      type="button"
      className={cn(
        !occupancyMode && "hover:bg-primary/40",
        occupancyMode ? "bg-primary/60" : "",
      )}
      onClick={toggleOccupancyMode}
    >
      <Icon icon="ChartNoAxesColumn" />
    </Button>
  );
}
