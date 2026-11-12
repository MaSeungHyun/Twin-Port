import { create } from "zustand";
import type { PortCallScenario } from "@/constants/portCall";

type PortCallState = {
  scenario: PortCallScenario;
  offsetH: number;
  setScenario: (scenario: PortCallScenario) => void;
  advance: () => void;
  reset: () => void;
};

export const usePortCallStore = create<PortCallState>((set) => ({
  scenario: "normal",
  offsetH: 0,
  setScenario: (scenario) => set({ scenario }),
  advance: () => set((state) => ({ offsetH: state.offsetH + 1 })),
  reset: () => set({ scenario: "normal", offsetH: 0 }),
}));
