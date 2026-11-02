/**
 * 모터 과열 감시 — 텔레메트리 온도가 경고/고장 기준을 넘으면 useFailureStore 에 올린다.
 * 고장 시나리오와 같은 경로(고장 → 다운타임 이력·알람 토스트·3D 콜아웃)를 타며, 카메라는 자동으로 움직이지 않는다.
 */
import { toaster } from "@/components/Toaster";
import { CRANE_TELEMETRY as T } from "@/constants/craneTelemetry";
import {
  FAILURE_FOCUS_EVENT,
  FAILURE_SCENARIO,
  type FailureFocusDetail,
  type FailureKind,
} from "@/constants/failureScenario";
import { maxMotorC } from "@/domain/craneTelemetry";
import { equipmentName, focusEquipment } from "@/domain/failureScenario";
import { getPortSim } from "@/domain/portSim";
import { failureKey, useFailureStore } from "@/stores/useFailureStore";

export const OVERHEAT_WARN_CAUSE = "모터 온도 상승 (E-OH01)";
export const OVERHEAT_FAULT_CAUSE = "호이스트 모터 과열 정지 (E-OH02)";

/** 과열 감시가 올린 항목만 관리(고장 시나리오 항목은 건드리지 않음) */
const owned = new Map<string, "warning" | "failure" | "safe">();
const timers = new Set<number>();

function toastOpts(kind: FailureKind, index: number, name: string) {
  return {
    id: `failure-${failureKey(kind, index)}`,
    onClick: () => focusEquipment(kind, index),
    onTrack: () =>
      window.dispatchEvent(
        new CustomEvent<FailureFocusDetail>(FAILURE_FOCUS_EVENT, { detail: { kind, index, label: name } }),
      ),
  };
}

function visit(kind: FailureKind, index: number) {
  const store = useFailureStore.getState();
  const key = failureKey(kind, index);
  const mine = owned.get(key);
  const current = store.active[key];
  if (mine && !current) owned.delete(key);
  else if (!mine && current) return; // 고장 시나리오가 쓰는 중
  const state = owned.get(key);
  const c = maxMotorC(kind, index);
  const name = equipmentName(kind, index);
  const opts = toastOpts(kind, index, name);
  const now = Date.now();

  if (c >= T.faultC && state !== "failure") {
    owned.set(key, "failure");
    store.setActive({ kind, index, state: "failure", cause: OVERHEAT_FAULT_CAUSE, since: now });
    store.pushEvent({ level: "error", title: `${name} 고장`, message: OVERHEAT_FAULT_CAUSE });
    toaster.error(`${name} 고장`, { message: OVERHEAT_FAULT_CAUSE, ...opts });
    return;
  }
  if (state === "failure" && c < T.recoverC) {
    owned.set(key, "safe");
    store.setActive({ kind, index, state: "safe", cause: "냉각 완료 · 정상 가동 재개", since: now });
    store.pushEvent({ level: "success", title: `${name} 복구`, message: "냉각 완료 · 정상 가동 재개" });
    toaster.success(`${name} 복구`, {
      message: "냉각 완료 · 정상 가동 재개",
      id: opts.id,
      onClick: opts.onClick,
      duration: FAILURE_SCENARIO.recoveryToastMs,
    });
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (owned.get(key) === "safe" && useFailureStore.getState().active[key]?.state === "safe") {
        owned.delete(key);
        useFailureStore.getState().clearActive(kind, index);
      }
    }, FAILURE_SCENARIO.recoveryToastMs);
    timers.add(id);
    return;
  }
  if (!state && c >= T.warnC) {
    owned.set(key, "warning");
    store.setActive({ kind, index, state: "warning", cause: OVERHEAT_WARN_CAUSE, since: now });
    store.pushEvent({ level: "warning", title: `${name} 이상 징후`, message: OVERHEAT_WARN_CAUSE });
    toaster.warning(`${name} 이상 징후`, {
      message: OVERHEAT_WARN_CAUSE,
      id: opts.id,
      onClick: opts.onClick,
      duration: FAILURE_SCENARIO.warningToastMs,
    });
    return;
  }
  if (state === "warning" && c < T.warnClearC) {
    owned.delete(key);
    store.clearActive(kind, index);
  }
}

export function checkOverheat() {
  const sim = getPortSim();
  for (const c of sim.cranes) visit("quayCrane", c.index);
  for (const c of sim.overheadCranes) visit("overheadCrane", c.index);
}

export function resetOverheat() {
  for (const id of timers) window.clearTimeout(id);
  timers.clear();
  const store = useFailureStore.getState();
  for (const key of owned.keys()) {
    const [kind, index] = key.split(":");
    store.clearActive(kind as FailureKind, Number(index));
  }
  owned.clear();
}
