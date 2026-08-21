import { create } from "zustand";

type ViewportState = {
  occupancyMode: boolean;
  toggleOccupancyMode: () => void;
  /** occupancy 3D 룩 — 전환 중간 시점에 적용 (하늘이 어두워진 뒤) */
  occupancyLook: boolean;
  setOccupancyLook: (look: boolean) => void;
  /** 3D 블록 호버 — occupancy 그래프와 바닥 마크 카드 공유 */
  hoveredBlockCode: string | null;
  setHoveredBlockCode: (code: string | null) => void;
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
  occupancyLook: false,
  setOccupancyLook: (occupancyLook) =>
    set({
      occupancyLook,
      ...(!occupancyLook ? { hoveredBlockCode: null } : {}),
    }),
  hoveredBlockCode: null,
  setHoveredBlockCode: (hoveredBlockCode) => set({ hoveredBlockCode }),
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
      ...(enabled
        ? { occupancyMode: false, occupancyLook: false, hoveredBlockCode: null }
        : {}),
    }),
  selectedContainerId: null,
  focusNonce: 0,
  selectContainer: (id) =>
    set((state) => ({
      selectedContainerId: id,
      focusNonce: state.focusNonce + 1,
      occupancyMode: false,
      occupancyLook: false,
      hoveredBlockCode: null,
      monitorMode: false,
    })),
  clearContainerSelection: () => set({ selectedContainerId: null }),
}));
