import Button from "@/components/Button";
import Icon from "@/components/Icon";
import { useViewportStore } from "@/stores/viewport";
import { cn } from "@/utils/style";

function Monitoring() {
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const setMonitorMode = useViewportStore((s) => s.setMonitorMode);

  return (
    <Button
      type="button"
      onClick={() => setMonitorMode(!monitorMode)}
      aria-label="Monitoring Mode"
      className={cn(
        !monitorMode && "hover:bg-primary/40",
        monitorMode ? "bg-primary/60" : "",
      )}
    >
      <Icon icon={monitorMode ? "Monitor" : "MonitorOff"} />
    </Button>
  );
}

export default Monitoring;
