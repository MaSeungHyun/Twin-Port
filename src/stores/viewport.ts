import { create } from "zustand";

type ViewportState = {
  occupancyMode: boolean;
  toggleOccupancyMode: () => void;
};

export const useViewportStore = create<ViewportState>((set) => ({
  occupancyMode: false,
  toggleOccupancyMode: () =>
    set((state) => ({ occupancyMode: !state.occupancyMode })),
}));
