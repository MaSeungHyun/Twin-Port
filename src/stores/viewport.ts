import { create } from "zustand";

type ViewportState = {
  /** 관제모드 — Block 전체 마크 + 탑뷰 */
  monitorMode: boolean;
  setMonitorMode: (enabled: boolean) => void;
  /** 모니터링 그리드에서 선택한 블록 */
  selectedBlockCode: string | null;
  selectBlock: (code: string) => void;
  clearBlockSelection: () => void;
  /** 목록에서 선택한 컨테이너 — 하이라이트/카메라 포커스용 */
  selectedContainerId: string | null;
  /** 같은 ID 재선택 시에도 카메라 비행이 다시 돌도록 */
  focusNonce: number;
  selectContainer: (id: string) => void;
  clearContainerSelection: () => void;
  /** 헤더 DANGEROUS — 위험 블록 BlockHoverArea 카드 전체 표시 */
  showDangerousBlockCards: boolean;
  toggleShowDangerousBlockCards: () => void;
};

export const useViewportStore = create<ViewportState>((set) => ({
  monitorMode: false,
  setMonitorMode: (enabled) =>
    set({
      monitorMode: enabled,
      ...(!enabled ? { selectedBlockCode: null } : {}),
    }),
  selectedBlockCode: null,
  selectBlock: (code) =>
    set((state) => ({
      selectedBlockCode: state.selectedBlockCode === code ? null : code,
    })),
  clearBlockSelection: () => set({ selectedBlockCode: null }),
  selectedContainerId: null,
  focusNonce: 0,
  selectContainer: (id) => {
    set((state) => ({
      selectedContainerId: id,
      focusNonce: state.focusNonce + 1,
    }));
  },
  clearContainerSelection: () => set({ selectedContainerId: null }),
  showDangerousBlockCards: false,
  toggleShowDangerousBlockCards: () =>
    set((state) => ({ showDangerousBlockCards: !state.showDangerousBlockCards })),
}));
