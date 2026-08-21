import { create } from "zustand";

type OccupancyState = {
  occupancyMode: boolean;
  toggleOccupancyMode: () => void;
  /** occupancy 3D 룩 — 전환 중간 시점에 적용 (하늘이 어두워진 뒤) */
  occupancyLook: boolean;
  setOccupancyLook: (look: boolean) => void;
  /** 3D 블록 호버 — occupancy 그래프와 바닥 마크 카드 공유 */
  hoveredBlockCode: string | null;
  setHoveredBlockCode: (code: string | null) => void;
  exitOccupancy: () => void;
};

export const useOccupancyStore = create<OccupancyState>((set) => ({
  occupancyMode: false,
  occupancyLook: false,
  hoveredBlockCode: null,
  toggleOccupancyMode: () =>
    set((state) => ({ occupancyMode: !state.occupancyMode })),
  setOccupancyLook: (occupancyLook) =>
    set({
      occupancyLook,
      ...(!occupancyLook ? { hoveredBlockCode: null } : {}),
    }),
  setHoveredBlockCode: (hoveredBlockCode) => set({ hoveredBlockCode }),
  exitOccupancy: () =>
    set({
      occupancyMode: false,
      occupancyLook: false,
      hoveredBlockCode: null,
    }),
}));
