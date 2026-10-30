import { create } from "zustand";
import type { FailureKind } from "@/constants/failureScenario";
import { FAILURE_SCENARIO } from "@/constants/failureScenario";
import { useViewportStore } from "@/stores/viewport";

export type FailureState = "warning" | "failure";

export type ActiveFailure = {
  kind: FailureKind;
  /** quayCrane: GLB index (crane.052 → 52), overheadCrane: 인스턴스(블록) index */
  index: number;
  state: FailureState;
  cause: string;
  since: number;
};

export type FailureAlarmEvent = {
  id: string;
  level: "error" | "warning" | "success";
  title: string;
  message?: string;
  createdAt: string;
};

export function failureKey(kind: FailureKind, index: number) {
  return `${kind}:${index}`;
}

type FailureStore = {
  active: Record<string, ActiveFailure>;
  events: FailureAlarmEvent[];
  setActive: (failure: ActiveFailure) => void;
  clearActive: (kind: FailureKind, index: number) => void;
  pushEvent: (event: Omit<FailureAlarmEvent, "id" | "createdAt">) => void;
};

let eventSeq = 0;

export const useFailureStore = create<FailureStore>((set) => ({
  active: {},
  events: [],
  setActive: (failure) =>
    set((s) => ({
      active: { ...s.active, [failureKey(failure.kind, failure.index)]: failure },
    })),
  clearActive: (kind, index) =>
    set((s) => {
      const key = failureKey(kind, index);
      if (!(key in s.active)) return s;
      const next = { ...s.active };
      delete next[key];
      return { active: next };
    }),
  pushEvent: (event) =>
    // [monitorgate] 관제 시작 전 알람 이벤트 무시
    useViewportStore.getState().monitoringStarted && set((s) => ({
      events: [
        { ...event, id: `failure-${++eventSeq}`, createdAt: new Date().toISOString() },
        ...s.events,
      ].slice(0, FAILURE_SCENARIO.maxAlarmEvents),
    })),
}));

/** React 밖(3D useFrame 등)에서 — 고장(failure) 상태인 index 목록 */
export function getFailedIndices(kind: FailureKind): number[] {
  const out: number[] = [];
  for (const f of Object.values(useFailureStore.getState().active)) {
    if (f.kind === kind && f.state === "failure") out.push(f.index);
  }
  return out;
}

export function isFailed(
  active: Record<string, ActiveFailure>,
  kind: FailureKind,
  index: number,
) {
  return active[failureKey(kind, index)]?.state === "failure";
}
