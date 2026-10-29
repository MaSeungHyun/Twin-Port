import IconButton from "@/components/IconButton";
import { useOccupancyStore } from "@/stores/occupancy";
import { useViewportStore } from "@/stores/viewport";

export default function OccupancyMode() {
  const occupancyMode = useOccupancyStore((s) => s.occupancyMode);
  const toggleOccupancyMode = useOccupancyStore((s) => s.toggleOccupancyMode);
  const monitorMode = useViewportStore((s) => s.monitorMode);

  return (
    <IconButton
      icon="ChartNoAxesColumn"
      label="Occupancy Mode"
      active={occupancyMode}
      disabled={monitorMode}
      onClick={() => toggleOccupancyMode()}
    />
  );
}
