import { OPS_SCENARIO, type OpsShareKey } from "@/constants/opsScenario";
import { sampleOpsScenario, type OpsFaultOverride } from "@/domain/opsScenario";
import { equipmentName } from "@/domain/failureScenario";
import { useFailureStore } from "@/stores/useFailureStore";
import { useOpsStore } from "@/stores/useOpsStore";

function faultsNow(): OpsFaultOverride[] {
  const out: OpsFaultOverride[] = [];
  for (const failure of Object.values(useFailureStore.getState().active)) {
    if (failure.state === "safe") continue;
    const state: OpsShareKey = failure.state === "failure" ? "fault" : "wait";
    out.push({
      name: equipmentName(failure.kind, failure.index),
      state,
      cause: failure.cause,
    });
  }
  return out;
}

/** 관제 시작 이후 1초마다 양하 시나리오 스냅샷을 갱신한다 */
export function startOpsScenario(): () => void {
  let stopped = false;
  let elapsedMs = 0;
  const timers = new Set<number>();
  useOpsStore.getState().setRunning(true);

  const publish = () => {
    useOpsStore.getState().setSnapshot(sampleOpsScenario(elapsedMs / 1000, faultsNow()));
  };

  const later = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!stopped) fn();
    }, ms);
    timers.add(id);
  };

  const tick = () => {
    elapsedMs += OPS_SCENARIO.tickMs;
    publish();
    later(OPS_SCENARIO.tickMs, tick);
  };

  later(OPS_SCENARIO.startDelayMs, () => {
    publish();
    later(OPS_SCENARIO.tickMs, tick);
  });

  return () => {
    stopped = true;
    for (const id of timers) window.clearTimeout(id);
    useOpsStore.setState({ running: false, snapshot: null });
  };
}
