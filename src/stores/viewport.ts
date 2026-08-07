import { create } from "zustand";

type ViewportState = {
  occupancyMode: boolean;
  toggleOccupancyMode: () => void;
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
  occupancyMode: false,
  toggleOccupancyMode: () =>
    set((state) => {
      // 모니터모드 중에는 occupancy 전환 불가
      if (state.monitorMode) return state;
      return { occupancyMode: !state.occupancyMode };
    }),
  monitorMode: false,
  setMonitorMode: (enabled) =>
    set({
      monitorMode: enabled,
      // 모니터모드 켜면 occupancy 강제 해제
      ...(enabled ? { occupancyMode: false } : {}),
    }),
  selectedContainerId: null,
  focusNonce: 0,
  selectContainer: (id) =>
    set((state) => ({
      selectedContainerId: id,
      focusNonce: state.focusNonce + 1,
      occupancyMode: false,
      monitorMode: false,
    })),
  clearContainerSelection: () => set({ selectedContainerId: null }),
}));
