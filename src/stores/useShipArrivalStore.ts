import { create } from "zustand";

export type ShipPhase = "loading" | "departing" | "arriving";

export type ShipMark = {
  index: number;
  name: string;
  phase: ShipPhase;
  /** 적재 진행 0~1. 출항·입항은 0 */
  progress: number;
};

type ShipPhaseStore = {
  marks: ShipMark[];
  set: (index: number, name: string, phase: ShipPhase, progress?: number) => void;
  setProgress: (index: number, progress: number) => void;
  clearIf: (index: number, phase: ShipPhase) => void;
  clearAll: () => void;
};

export const useShipArrivalStore = create<ShipPhaseStore>((set) => ({
  marks: [],
  set: (index, name, phase, progress = 0) =>
    set((state) => ({
      marks: [
        ...state.marks.filter((item) => item.index !== index),
        { index, name, phase, progress },
      ],
    })),
  setProgress: (index, progress) =>
    set((state) => ({
      marks: state.marks.map((item) =>
        item.index === index ? { ...item, progress } : item,
      ),
    })),
  clearIf: (index, phase) =>
    set((state) => ({
      marks: state.marks.filter((item) => item.index !== index || item.phase !== phase),
    })),
  clearAll: () => set({ marks: [] }),
}));
