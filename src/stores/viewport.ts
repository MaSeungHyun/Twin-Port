import { create } from "zustand";

type ViewportState = {
  occupancyMode: boolean;
  toggleOccupancyMode: () => void;
  terrainVisible: boolean;
  setTerrainVisible: (visible: boolean) => void;
  /** Block 정보 창 상시 표시 (호버 없이) */
  blockStatusVisible: boolean;
  setBlockStatusVisible: (visible: boolean) => void;
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
    set((state) => ({ occupancyMode: !state.occupancyMode })),
  terrainVisible: true,
  setTerrainVisible: (visible) => set({ terrainVisible: visible }),
  blockStatusVisible: false,
  setBlockStatusVisible: (visible) => set({ blockStatusVisible: visible }),
  selectedContainerId: null,
  focusNonce: 0,
  selectContainer: (id) =>
    set((state) => ({
      selectedContainerId: id,
      focusNonce: state.focusNonce + 1,
      occupancyMode: false,
    })),
  clearContainerSelection: () => set({ selectedContainerId: null }),
}));
