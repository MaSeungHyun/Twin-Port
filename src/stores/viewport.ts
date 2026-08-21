import { create } from "zustand";
import { useOccupancyStore } from "./occupancy";

type ViewportState = {
  /** 관제모드 — Block 전체 마크 + 탑뷰 */
  monitorMode: boolean;
  setMonitorMode: (enabled: boolean) => void;
  /** 목록에서 선택한 컨테이너 — 하이라이트/카메라 포커스용 */
  selectedContainerId: string | null;
  /** 같은 ID 재선택 시에도 카메라 비행이 다시 돌도록 */
  focusNonce: number;
  selectContainer: (id: string) => void;
  clearContainerSelection: () => void;
};

export const useViewportStore = create<ViewportState>((set) => ({
  monitorMode: false,
  setMonitorMode: (enabled) => set({ monitorMode: enabled }),
  selectedContainerId: null,
  focusNonce: 0,
  selectContainer: (id) => {
    useOccupancyStore.getState().exitOccupancy();
    set((state) => ({
      selectedContainerId: id,
      focusNonce: state.focusNonce + 1,
      monitorMode: false,
    }));
  },
  clearContainerSelection: () => set({ selectedContainerId: null }),
}));
