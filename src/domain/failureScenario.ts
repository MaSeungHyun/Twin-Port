import { toaster } from "@/components/Toaster";
import {
  FAILURE_AUTO_FOCUS,
  FAILURE_CAUSES,
  FAILURE_FOCUS_EVENT,
  type FailureFocusDetail,
  FAILURE_SCENARIO,
  FAILURE_WARNING_CAUSES,
  type FailureKind,
} from "@/constants/failureScenario";
import { overheadCraneKey, overheadCraneTitle } from "@/domain/overheadCraneTwin";
import { useContentViewStore } from "@/stores/contentView";
import { failureKey, useFailureStore } from "@/stores/useFailureStore";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pickOne = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;

export function equipmentName(kind: FailureKind, index: number) {
  return kind === "quayCrane"
    ? `Crane ${String(index).padStart(2, "0")}`
    : overheadCraneTitle(index);
}

/**
 * 토스트 클릭 → 크레인 상세 패널 + 알람 follow (Track 버튼 Tracking 과 별개 상태).
 * 선택 outline 없음, Track 버튼 비활성, 카메라는 Tracking 과 같은 비행 + 따라가기.
 */
export function focusEquipment(kind: FailureKind, index: number, auto = false) {
  const content = useContentViewStore.getState();
  content.closeDetailGraph();
  if (kind === "quayCrane") content.openCraneDetail(`crane-${index}`);
  else content.openOverheadCraneDetail(overheadCraneKey(index));
  // 버튼 Tracking 중이었다면 여기서 해제되고 alarm follow 로 전환
  useViewportStore.getState().startAlarmFollow(kind, index, auto);
}

// [autofocus] 고장 알람 → 카메라 자동 이동 (debounce + 최소 간격, 최신 고장 우선)
let autoFocusTimer = 0;
let lastAutoFocusAt = 0;
function requestAutoFocus(kind: FailureKind, index: number, label: string) {
  const cfg = FAILURE_AUTO_FOCUS;
  if (!cfg.enabled || !useViewportStore.getState().monitoringStarted) return;
  window.clearTimeout(autoFocusTimer);
  const wait = Math.max(cfg.debounceMs, lastAutoFocusAt + cfg.minIntervalMs - Date.now());
  autoFocusTimer = window.setTimeout(() => {
    if (!useViewportStore.getState().monitoringStarted) return;
    if (useFailureStore.getState().active[failureKey(kind, index)]?.state !== "failure") return; // 이미 복구됨
    const f = useViewportStore.getState().alarmFollow;
    if (f && f.kind === kind && f.index === index) return; // 이미 보고 있음
    lastAutoFocusAt = Date.now();
    window.dispatchEvent(new CustomEvent<FailureFocusDetail>(FAILURE_FOCUS_EVENT, { detail: { kind, index, label } }));
  }, wait);
}

function candidates(kind: FailureKind): number[] {
  if (kind === "quayCrane") return useYardStore.getState().quayCranes.map((c) => c.glbIndex);
  return useYardStore.getState().blocks.map((_, i) => i);
}

function pickKind(exclude?: FailureKind): FailureKind {
  if (exclude) return exclude === "quayCrane" ? "overheadCrane" : "quayCrane";
  const w = FAILURE_SCENARIO.kindWeights;
  return Math.random() * (w.quayCrane + w.overheadCrane) < w.quayCrane
    ? "quayCrane"
    : "overheadCrane";
}

/** 60초 사이클 무한 반복. stop 함수 반환 */
export function startFailureScenario(): () => void {
  const timers = new Set<number>();
  const toastIds = new Set<string>();
  let previous = new Set<string>();
  let stopped = false;

  const later = (ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!stopped) fn();
    }, Math.max(0, ms));
    timers.add(id);
  };

  const runCycle = () => {
    const cfg = FAILURE_SCENARIO;
    const used = new Set<string>();
    let lastKind: FailureKind | undefined;

    for (const slot of cfg.slots) {
      if (Math.random() > slot.probability) continue;
      const kind = pickKind(lastKind);
      const pool = candidates(kind).filter((i) => {
        const key = failureKey(kind, i);
        if (used.has(key)) return false;
        if (cfg.avoidPreviousTargets && previous.has(key)) return false;
        return !(key in useFailureStore.getState().active);
      });
      if (pool.length === 0) continue;
      const index = pickOne(pool);
      const key = failureKey(kind, index);
      used.add(key);
      lastKind = kind;

      const failAt = rand(...slot.failAt);
      const maxEnd = cfg.cycleMs - cfg.recoverBeforeCycleEndMs;
      const recoverAt = Math.min(failAt + rand(...slot.duration), maxEnd);
      const name = equipmentName(kind, index);
      const cause = pickOne(FAILURE_CAUSES[kind]);
      const onClick = () => focusEquipment(kind, index);
      // [toastid] 장비별 하나의 토스트 id — 이상 징후 → 고장 → 복구가 서로 교체됨
      const toastId = `failure-${key}`;

      if (Math.random() < slot.warningProbability) {
        const warnCause = pickOne(FAILURE_WARNING_CAUSES);
        later(failAt - rand(...slot.warningLead), () => {
          useFailureStore.getState().setActive({ kind, index, state: "warning", cause: warnCause, since: Date.now() });
          useFailureStore.getState().pushEvent({ level: "warning", title: `${name} 이상 징후`, message: warnCause });
          toaster.warning(`${name} 이상 징후`, { message: warnCause, id: toastId, duration: cfg.warningToastMs, onClick });
          toastIds.add(toastId);
        });
      }

      later(failAt, () => {
        useFailureStore.getState().setActive({ kind, index, state: "failure", cause, since: Date.now() });
        useFailureStore.getState().pushEvent({ level: "error", title: `${name} 고장`, message: cause });
        // [toasttrack] 추적 → 위험 알람 추적(모드 2). 복구 토스트가 같은 id 로 교체할 때까지 유지
        const onTrack = () => window.dispatchEvent(new CustomEvent<FailureFocusDetail>(FAILURE_FOCUS_EVENT, { detail: { kind, index, label: name } }));
        toaster.error(`${name} 고장`, { message: cause, id: toastId, onClick, onTrack });
        requestAutoFocus(kind, index, name); // FAILURE_AUTO_FOCUS.enabled=false 면 no-op
        toastIds.add(toastId);
      });

      later(recoverAt, () => {
        useFailureStore.getState().clearActive(kind, index);
        useFailureStore.getState().pushEvent({ level: "success", title: `${name} 복구`, message: "정상 가동 재개" });
        toaster.success(`${name} 복구`, { message: "정상 가동 재개", id: toastId, duration: cfg.recoveryToastMs, onClick });
      });
    }

    previous = used;
    later(cfg.cycleMs, runCycle);
  };

  later(FAILURE_SCENARIO.startDelayMs, runCycle);

  return () => {
    stopped = true;
    window.clearTimeout(autoFocusTimer);
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
    for (const id of toastIds) toaster.dismiss(id);
    useFailureStore.setState({ active: {} });
  };
}
