import IconButton from "@/components/IconButton";
import { useViewportStore } from "@/stores/viewport";

function Monitoring() {
  const monitorMode = useViewportStore((s) => s.monitorMode);
  const setMonitorMode = useViewportStore((s) => s.setMonitorMode);

  return (
    <IconButton
      icon={monitorMode ? "Monitor" : "MonitorOff"}
      label="Monitoring Mode"
      active={monitorMode}
      onClick={() => setMonitorMode(!monitorMode)}
    />
  );
}

export default Monitoring;
