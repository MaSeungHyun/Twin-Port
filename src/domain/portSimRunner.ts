import { PORT_SIM } from "@/constants/portSim";
import { getPortSim } from "@/domain/portSim";
import { useDowntimeLogStore } from "@/stores/useDowntimeLogStore";
import type { DowntimeKind } from "@/stores/useDowntimeLogStore";
import { useFailureStore } from "@/stores/useFailureStore";
import { useOpsStore } from "@/stores/useOpsStore";
import { usePortSimStore } from "@/stores/usePortSimStore";

/**
 * 시뮬레이션 스냅샷의 고장(error) 상태를 이력으로 누적한다.
 * error 로 바뀌면 이력을 열고, 벗어나면 종료 시각을 기록한다(복구돼도 남는다).
 */
export function syncDowntimeLog(now = Date.now()) {
  const sim = getPortSim();
  const failures = useFailureStore.getState().active;
  const log = useDowntimeLogStore.getState();
  const open = new Map(log.entries.filter((e) => e.end == null).map((e) => [e.key, e]));
  const seen = new Set<string>();
  const visit = (kind: DowntimeKind, index: number, name: string, status: string, cause?: string) => {
    const key = `${kind}:${index}`;
    if (status !== "error") return;
    seen.add(key);
    const current = open.get(key);
    const label = cause ?? "고장";
    if (!current) {
      log.open({ key, kind, index, name, cause: label, start: failures[key]?.since ?? now });
    } else if (current.cause !== label) {
      log.updateCause(key, label);
    }
  };
  for (const c of sim.cranes) visit("quayCrane", c.index, c.name, c.status, c.cause);
  for (const c of sim.overheadCranes) visit("overheadCrane", c.index, c.name, c.status, c.cause);
  for (const key of open.keys()) if (!seen.has(key)) log.close(key, now);
}

/** 관제 시작 이후 운영 시뮬레이션 시계를 돌린다. UI 갱신만 하므로 3D 렌더와 무관 */
export function startPortSim(): () => void {
  const startedAt = Date.now();
  useDowntimeLogStore.getState().clear();
  usePortSimStore.getState().start(startedAt);
  const sync = () => syncDowntimeLog();
  const unsubFailure = useFailureStore.subscribe(sync);
  const unsubOps = useOpsStore.subscribe(sync);
  sync();
  const id = window.setInterval(() => {
    usePortSimStore.getState().setElapsed((Date.now() - startedAt) / 1000);
    sync();
  }, PORT_SIM.tickMs);
  return () => {
    window.clearInterval(id);
    unsubFailure();
    unsubOps();
    usePortSimStore.getState().reset();
  };
}
