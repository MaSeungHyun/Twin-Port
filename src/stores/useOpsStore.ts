import { create } from "zustand";
import type { OpsSnapshot } from "@/domain/opsScenario";

type OpsStore = {
  /** 관제 시작 이후 시나리오가 돌고 있으면 true */
  running: boolean;
  snapshot: OpsSnapshot | null;
  setRunning: (running: boolean) => void;
  setSnapshot: (snapshot: OpsSnapshot) => void;
};

export const useOpsStore = create<OpsStore>((set) => ({
  running: false,
  snapshot: null,
  setRunning: (running) => set({ running }),
  setSnapshot: (snapshot) => set({ snapshot }),
}));
