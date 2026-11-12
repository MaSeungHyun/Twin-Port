import { create } from "zustand";

type HudUiState = {
  /** 통합관제 좌측 현황 요약 */
  summaryOpen: boolean;
  /** 우측 그래픽 설정 */
  graphicsOpen: boolean;
  /** 우측 알람 패널 */
  alarmOpen: boolean;
  /** 상세가 열려 토스트로 안 띄운 주의·정보 수 */
  unseenAlarmCount: number;
  /** 오른쪽 상세 패널을 연 화면 수 */
  rightDetailHolders: number;
  toggleSummary: () => void;
  toggleGraphics: () => void;
  setGraphicsOpen: (open: boolean) => void;
  toggleAlarm: () => void;
  setAlarmOpen: (open: boolean) => void;
  bumpUnseenAlarms: (count?: number) => void;
  holdRightDetail: () => void;
  releaseRightDetail: () => void;
};

export const useHudUiStore = create<HudUiState>((set) => ({
  summaryOpen: true,
  graphicsOpen: false,
  alarmOpen: false,
  unseenAlarmCount: 0,
  rightDetailHolders: 0,
  toggleSummary: () => set((s) => ({ summaryOpen: !s.summaryOpen })),
  toggleGraphics: () =>
    set((s) => ({ graphicsOpen: !s.graphicsOpen, alarmOpen: s.graphicsOpen ? s.alarmOpen : false })),
  setGraphicsOpen: (graphicsOpen) => set({ graphicsOpen }),
  toggleAlarm: () =>
    set((s) => {
      const alarmOpen = !s.alarmOpen;
      return {
        alarmOpen,
        graphicsOpen: alarmOpen ? false : s.graphicsOpen,
        unseenAlarmCount: alarmOpen ? 0 : s.unseenAlarmCount,
      };
    }),
  setAlarmOpen: (alarmOpen) =>
    set((s) => ({ alarmOpen, unseenAlarmCount: alarmOpen ? 0 : s.unseenAlarmCount })),
  bumpUnseenAlarms: (count = 1) =>
    set((s) => ({ unseenAlarmCount: s.unseenAlarmCount + count })),
  holdRightDetail: () => set((s) => ({ rightDetailHolders: s.rightDetailHolders + 1 })),
  releaseRightDetail: () =>
    set((s) => ({ rightDetailHolders: Math.max(0, s.rightDetailHolders - 1) })),
}));
