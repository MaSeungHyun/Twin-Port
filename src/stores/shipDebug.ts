import { create } from "zustand";

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
