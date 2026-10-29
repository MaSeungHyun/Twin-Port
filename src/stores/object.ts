import { create } from "zustand";

type ObjectState = {
  terrainVisible: boolean;
  setTerrainVisible: (visible: boolean) => void;
  containerVisible: boolean;
  setContainerVisible: (visible: boolean) => void;
  heatmapVisible: boolean;
  setHeatmapVisible: (visible: boolean) => void;
  /** [reflection] 크레인/선박 수면 반사 */
  reflectionVisible: boolean;
  setReflectionVisible: (visible: boolean) => void;
};

export const useObjectStore = create<ObjectState>((set) => ({
  terrainVisible: true,
  setTerrainVisible: (visible) => set({ terrainVisible: visible }),
  containerVisible: true,
  setContainerVisible: (visible) => set({ containerVisible: visible }),
  heatmapVisible: false,
  setHeatmapVisible: (visible) => set({ heatmapVisible: visible }),
  reflectionVisible: true,
  setReflectionVisible: (visible) => set({ reflectionVisible: visible }),
}));
