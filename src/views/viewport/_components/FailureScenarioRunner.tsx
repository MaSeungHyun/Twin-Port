import { startFailureScenario } from "@/domain/failureScenario";
import { useViewportStore } from "@/stores/viewport";
import { useEffect } from "react";

/** [failure] 관제 시작(interactionReady) 이후 고장 시나리오 루프 실행 — 한 번만 마운트 */
export default function FailureScenarioRunner() {
  const ready = useViewportStore((s) => s.interactionReady);
  useEffect(() => {
    if (!ready) return;
    return startFailureScenario();
  }, [ready]);
  return null;
}
