import { startFailureScenario } from "@/domain/failureScenario";
import { useViewportStore } from "@/stores/viewport";
import { useEffect } from "react";

/** [failure][monitorgate] 관제 시작 클릭(monitoringStarted) 이후 (startDelayMs 뒤 첫 사이클) 고장 시나리오 루프 실행 — 한 번만 마운트 */
export default function FailureScenarioRunner() {
  const ready = useViewportStore((s) => s.monitoringStarted);
  useEffect(() => {
    if (!ready) return;
    return startFailureScenario();
  }, [ready]);
  return null;
}
