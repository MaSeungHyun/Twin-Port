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
import { afterNextFrame } from "@/domain/yieldToMain";
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
  // 카메라 목적지는 먼저 잡고, 상세 패널 마운트는 다음 프레임으로 미룬다.
  useViewportStore.getState().startAlarmFollow(kind, index, auto);
  void afterNextFrame().then(() => {
    const content = useContentViewStore.getState();
    content.closeDetailGraph();
    if (kind === "quayCrane") content.openCraneDetail(`crane-${index}`);
    else content.openOverheadCraneDetail(overheadCraneKey(index));
  });
}

/**
 * 토스트 '추적' — 좌측 크레인 목록 클릭과 같은 경로: 크레인 상세를 열고 카메라 Tracking(selectCrane / selectOverheadCrane).
 */
export function trackEquipment(kind: FailureKind, index: number) {
  const content = useContentViewStore.getState();
  content.closeDetailGraph();
  if (kind === "quayCrane") content.openCraneDetail(`crane-${index}`);
  else content.openOverheadCraneDetail(overheadCraneKey(index));
  const viewport = useViewportStore.getState();
  if (kind === "quayCrane") viewport.selectCrane(index);
  else viewport.selectOverheadCrane(index);
}

/** 알람 토스트 윗줄 분류 */
export const ALARM_TOAST_CATEGORY = "CRANE";

/** 알람 토스트 시각 — 우측 상단 시계·알람 목록과 같은 실제 시각 */
export function alarmToastAt(now = Date.now()) {
  return now;
}

/** 고장 시작(since) ~ now 다운타임 (실제 경과 분, 최소 1분) */
export function alarmDowntimeMinutes(since: number, now = Date.now()) {
  return Math.max(1, Math.round((now - since) / 60000));
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
          toaster.warning(`${name} ${warnCause}`, {
            id: toastId,
            at: alarmToastAt(),
            meta: ALARM_TOAST_CATEGORY,
            duration: cfg.warningToastMs,
            onClick,
          });
          toastIds.add(toastId);
        });
      }

      later(failAt, () => {
        useFailureStore.getState().setActive({ kind, index, state: "failure", cause, since: Date.now() });
        useFailureStore.getState().pushEvent({ level: "error", title: `${name} 고장`, message: cause });
        // [toasttrack] 추적 → 좌측 목록 클릭과 같은 Tracking. 복구 토스트가 같은 id 로 교체할 때까지 유지
        const onTrack = () => trackEquipment(kind, index);
        toaster.error(`${name} ${cause}`, { id: toastId, at: alarmToastAt(), meta: ALARM_TOAST_CATEGORY, onClick, onTrack });
        requestAutoFocus(kind, index, name); // FAILURE_AUTO_FOCUS.enabled=false 면 no-op
        toastIds.add(toastId);
      });

      later(recoverAt, () => {
        const failed = useFailureStore.getState().active[key];
        const downtime = failed?.state === "failure" ? alarmDowntimeMinutes(failed.since) : null;
        useFailureStore.getState().setActive({
          kind,
          index,
          state: "safe",
          cause: "정상 가동 재개",
          since: Date.now(),
        });
        useFailureStore.getState().pushEvent({ level: "success", title: `${name} 복구`, message: "정상 가동 재개" });
        toaster.success(`${name} 정상 복구`, {
          id: toastId,
          at: alarmToastAt(),
          meta: downtime == null ? undefined : `다운타임 ${downtime}분`,
          duration: cfg.recoveryToastMs,
          onClick,
        });
        later(cfg.recoveryToastMs, () => {
          const current = useFailureStore.getState().active[key];
          if (current?.state === "safe") useFailureStore.getState().clearActive(kind, index);
        });
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
