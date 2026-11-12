import { create } from "zustand";

/** 헤더에서 여는 다이얼로그. 알람·그래픽 설정 중 하나만 열린다 */
export type HeaderDialog = "alarm" | "settings" | null;

type HudUiState = {
  /** 통합관제 좌측 현황 요약 */
  summaryOpen: boolean;
  /** 열린 헤더 다이얼로그 (단일 기준). graphicsOpen·alarmOpen 은 여기서 파생해 같이 갱신한다 */
  headerDialog: HeaderDialog;
  /** 그래픽 설정 다이얼로그 = headerDialog === "settings" */
  graphicsOpen: boolean;
  /** 알람 다이얼로그 = headerDialog === "alarm" */
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

/** 다이얼로그 전환. 알람을 열면 안 본 알람 수를 비운다 */
function openDialog(s: HudUiState, next: HeaderDialog) {
  return {
    headerDialog: next,
    alarmOpen: next === "alarm",
    graphicsOpen: next === "settings",
    unseenAlarmCount: next === "alarm" ? 0 : s.unseenAlarmCount,
  };
}

export const useHudUiStore = create<HudUiState>((set) => ({
  summaryOpen: true,
  headerDialog: null,
  graphicsOpen: false,
  alarmOpen: false,
  unseenAlarmCount: 0,
  rightDetailHolders: 0,
  toggleSummary: () => set((s) => ({ summaryOpen: !s.summaryOpen })),
  // 다이얼로그끼리만 서로 닫는다. 오른쪽 패널(상세 등)은 건드리지 않는다
  toggleGraphics: () => set((s) => openDialog(s, s.headerDialog === "settings" ? null : "settings")),
  setGraphicsOpen: (open) =>
    set((s) => (open ? openDialog(s, "settings") : s.headerDialog === "settings" ? openDialog(s, null) : {})),
  toggleAlarm: () => set((s) => openDialog(s, s.headerDialog === "alarm" ? null : "alarm")),
  setAlarmOpen: (open) =>
    set((s) => (open ? openDialog(s, "alarm") : s.headerDialog === "alarm" ? openDialog(s, null) : {})),
  bumpUnseenAlarms: (count = 1) =>
    set((s) => ({ unseenAlarmCount: s.unseenAlarmCount + count })),
  holdRightDetail: () => set((s) => ({ rightDetailHolders: s.rightDetailHolders + 1 })),
  releaseRightDetail: () =>
    set((s) => ({ rightDetailHolders: Math.max(0, s.rightDetailHolders - 1) })),
}));
