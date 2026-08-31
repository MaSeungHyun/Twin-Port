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
  /** 목록/상세에서 선택한 선박 */
  selectedShipKey: string | null;
  /** 목록/상세에서 선택한 quay crane 인덱스 */
  selectedCraneIndex: number | null;
  /** 같은 대상 재선택 시에도 카메라 비행이 다시 돌도록 */
  focusNonce: number;
  /** GLB crane index — 상세 화면 outline 전용 (카메라 이동 없음) */
  focusedCraneGlbIndex: number | null;
  /** 상세 화면 outline 전용 (Tracking 해제해도 유지) */
  focusedShipKey: string | null;
  selectContainer: (id: string) => void;
  clearContainerSelection: () => void;
  selectShip: (key: string) => void;
  clearShipSelection: () => void;
  selectCrane: (index: number) => void;
  clearCraneSelection: () => void;
  focusCraneDetail: (glbIndex: number) => void;
  clearCraneDetailFocus: () => void;
  focusShipDetail: (key: string) => void;
  clearShipDetailFocus: () => void;
  /** 헤더 DANGEROUS — 위험 블록 BlockHoverArea 카드 전체 표시 */
  showDangerousBlockCards: boolean;
  toggleShowDangerousBlockCards: () => void;
};

export const useViewportStore = create<ViewportState>((set) => ({
  monitorMode: false,
  setMonitorMode: (enabled) =>
    set({
      monitorMode: enabled,
      ...(enabled
        ? {
            selectedShipKey: null,
            selectedCraneIndex: null,
            selectedContainerId: null,
          }
        : { selectedBlockCode: null }),
    }),
  selectedBlockCode: null,
  selectBlock: (code) =>
    set((state) => ({
      selectedBlockCode: state.selectedBlockCode === code ? null : code,
    })),
  clearBlockSelection: () => set({ selectedBlockCode: null }),
  selectedContainerId: null,
  selectedShipKey: null,
  selectedCraneIndex: null,
  focusedCraneGlbIndex: null,
  focusedShipKey: null,
  focusNonce: 0,
  selectContainer: (id) => {
    set((state) => ({
      selectedContainerId: id,
      selectedShipKey: null,
      selectedCraneIndex: null,
      focusedCraneGlbIndex: null,
      focusedShipKey: null,
      focusNonce: state.focusNonce + 1,
    }));
  },
  clearContainerSelection: () => set({ selectedContainerId: null }),
  selectShip: (key) => {
    set((state) => ({
      selectedShipKey: key,
      focusedShipKey: key,
      selectedContainerId: null,
      selectedCraneIndex: null,
      focusedCraneGlbIndex: null,
      focusNonce: state.focusNonce + 1,
    }));
  },
  clearShipSelection: () => set({ selectedShipKey: null }),
  selectCrane: (index) => {
    set((state) => ({
      selectedCraneIndex: index,
      focusedCraneGlbIndex: index,
      focusedShipKey: null,
      selectedContainerId: null,
      selectedShipKey: null,
      focusNonce: state.focusNonce + 1,
    }));
  },
  clearCraneSelection: () => set({ selectedCraneIndex: null }),
  focusCraneDetail: (glbIndex) =>
    set({
      focusedCraneGlbIndex: glbIndex,
      focusedShipKey: null,
      selectedContainerId: null,
      selectedShipKey: null,
    }),
  clearCraneDetailFocus: () => set({ focusedCraneGlbIndex: null }),
  focusShipDetail: (key) =>
    set({
      focusedShipKey: key,
      focusedCraneGlbIndex: null,
      selectedContainerId: null,
      selectedShipKey: null,
      selectedCraneIndex: null,
    }),
  clearShipDetailFocus: () => set({ focusedShipKey: null }),
  showDangerousBlockCards: false,
  toggleShowDangerousBlockCards: () =>
    set((state) => ({ showDangerousBlockCards: !state.showDangerousBlockCards })),
}));

/** 컨테이너·선박·크레인 Tracking 중 */
export function isViewportTracking(state: ViewportState): boolean {
  return (
    Boolean(state.selectedContainerId) ||
    Boolean(state.selectedShipKey) ||
    state.selectedCraneIndex != null
  );
}

/** outline — Tracking 또는 상세 포커스 */
export function getActiveCraneGlbIndex(state: ViewportState): number | null {
  return state.selectedCraneIndex ?? state.focusedCraneGlbIndex;
}

/** outline — Tracking 또는 상세 포커스 */
export function getActiveShipKey(state: ViewportState): string | null {
  return state.selectedShipKey ?? state.focusedShipKey;
}
