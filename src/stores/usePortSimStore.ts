import { create } from "zustand";

type PortSimStore = {
  /** 관제 시작 시각(ms). 시작 전 null */
  startedAt: number | null;
  /** 관제 시작 이후 실제 경과 초 */
  elapsedS: number;
  start: (startedAt: number) => void;
  setElapsed: (elapsedS: number) => void;
  reset: () => void;
};

export const usePortSimStore = create<PortSimStore>((set) => ({
  startedAt: null,
  elapsedS: 0,
  start: (startedAt) => set({ startedAt, elapsedS: 0 }),
  setElapsed: (elapsedS) => set({ elapsedS }),
  reset: () => set({ startedAt: null, elapsedS: 0 }),
}));
