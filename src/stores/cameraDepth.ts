import { create } from "zustand";
import { isViewportTracking, useViewportStore } from "@/stores/viewport";

/** [depth] 카메라 depth 경로. level 0 = 구역(A~D), level 1 = 크레인(추후) … */
export type CameraPose = { p: [number, number, number]; t: [number, number, number] };
export type DepthEntry = { label: string; /** ESC 시 돌아갈 카메라 (이 단계에 들어오기 직전) */ back: CameraPose };

type CameraDepthState = {
  stack: DepthEntry[];
  /** level 에 들어감. 같은 level 의 다른 항목이면 교체 (돌아갈 위치는 원래 것 유지), 더 깊은 단계는 버림 */
  enter: (level: number, label: string, current: CameraPose) => void;
  /** 한 단계 뒤로 — 빠진 항목 반환 (back = 돌아갈 카메라, 없으면 null) */
  pop: () => DepthEntry | null;
  /** [depth] Depth 통째로 나감 — 최상위(첫 단계 진입 전) 카메라 반환 */
  exitAll: () => CameraPose | null;
};

export const useCameraDepthStore = create<CameraDepthState>((set, get) => ({
  stack: [],
  enter: (level, label, current) => {
    const stack = get().stack.slice(0, Math.min(level, get().stack.length) + 1);
    const at = Math.min(level, stack.length);
    stack[at] = { label, back: stack[at]?.back ?? current };
    set({ stack: stack.slice(0, at + 1) });
  },
  pop: () => {
    const stack = get().stack;
    const top = stack[stack.length - 1];
    if (!top) return null;
    set({ stack: stack.slice(0, -1) });
    return top;
  },
  exitAll: () => {
    const root = get().stack[0];
    if (!root) return null;
    set({ stack: [] });
    return root.back;
  },
}));

// [depthtrack] 추적 시작(Track 버튼·토스트 클릭·알람 토스트 추적·자동 알람) → Depth 해제.
// stack 이 비면 AreaCamButtons 기존 경로가 구역/크레인 페이드를 opacity 1 로 복구하고 브레드크럼을 숨김
const trackingOn = (v: ReturnType<typeof useViewportStore.getState>) => isViewportTracking(v) || v.alarmFollow != null;
useViewportStore.subscribe((v, prev) => {
  if (trackingOn(v) && !trackingOn(prev) && useCameraDepthStore.getState().stack.length) useCameraDepthStore.setState({ stack: [] });
});
