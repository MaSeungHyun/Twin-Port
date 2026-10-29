import { create } from "zustand";
import { CAMERA_INTRO_START_EVENT } from "@/constants/cameraIntro";
import { SHIP_TWEEN } from "@/constants/tween";

export type ShipGizmoMode = "translate" | "rotate";

export type ShipDebugPose = {
  position: [number, number, number];
  rotation: [number, number, number];
};

type ShipDebugState = {
  /** 선택된 선박 인덱스 (현재 1척만 렌더 → 0) */
  selected: number | null;
  mode: ShipGizmoMode;
  /** 기즈모로 지정한 pose. 있으면 tween보다 우선 (해당 선박 애니메이션 고정) */
  override: ShipDebugPose | null;
  /** 태양광 선택 여부 (기즈모는 동시에 하나만) */
  lightSelected: boolean;
  /** 디버그 설정 "선박 이동 > 이동 애니메이션". 기본 SHIP_TWEEN.shipMotion */
  shipMotion: boolean;
  /** "관제 시작"을 눌렀는지. 그 전에는 선박 적재/이동 루프를 돌리지 않음 */
  controlStarted: boolean;
  setShipMotion: (on: boolean) => void;
  setControlStarted: (on: boolean) => void;
  select: (index: number | null) => void;
  selectLight: (on: boolean) => void;
  clearSelection: () => void;
  setMode: (mode: ShipGizmoMode) => void;
  setOverride: (pose: ShipDebugPose | null) => void;
};

export const useShipDebugStore = create<ShipDebugState>((set) => ({
  selected: null,
  mode: "translate",
  override: null,
  lightSelected: false,
  shipMotion: SHIP_TWEEN.shipMotion,
  controlStarted:
    typeof window !== "undefined" &&
    (window as unknown as { __tpControlStarted?: boolean }).__tpControlStarted === true,
  setShipMotion: (shipMotion) => set({ shipMotion }),
  setControlStarted: (controlStarted) => set({ controlStarted }),
  select: (selected) =>
    set(selected == null ? { selected } : { selected, lightSelected: false }),
  selectLight: (on) =>
    set(on ? { lightSelected: true, selected: null } : { lightSelected: false }),
  clearSelection: () => set({ selected: null, lightSelected: false }),
  setMode: (mode) => set({ mode }),
  setOverride: (override) => set({ override }),
}));

export function formatShipPose(pose: ShipDebugPose) {
  const p = pose.position.map((n) => +n.toFixed(3));
  const yawDeg = +((pose.rotation[1] * 180) / Math.PI).toFixed(3);
  const r = pose.rotation.map((n) => +n.toFixed(5));
  return `position: [${p.join(", ")}], rotation: [${r.join(", ")}], yawDeg: ${yawDeg}`;
}

// "관제 시작" 인트로 버튼(IntroOverlay)이 쏘는 이벤트 → 선박 루프 시작 신호
if (typeof window !== "undefined") {
  // [hmr] 이 모듈이 HMR 로 재실행되면 스토어가 새로 만들어져 false 로 돌아감 → window 플래그로 유지
  window.addEventListener(CAMERA_INTRO_START_EVENT, () => {
    (window as unknown as { __tpControlStarted?: boolean }).__tpControlStarted = true;
    useShipDebugStore.getState().setControlStarted(true);
  });
}
