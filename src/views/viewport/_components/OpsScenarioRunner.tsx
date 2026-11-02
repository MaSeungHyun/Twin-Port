import { startOpsScenario } from "@/domain/opsScenarioRunner";
import { useViewportStore } from "@/stores/viewport";
import { useEffect } from "react";

/** 관제 시작 이후 양하·컨베이어 시나리오를 한 번만 돌린다 */
export default function OpsScenarioRunner() {
  const ready = useViewportStore((s) => s.monitoringStarted);
  useEffect(() => {
    if (!ready) return;
    return startOpsScenario();
  }, [ready]);
  return null;
}
