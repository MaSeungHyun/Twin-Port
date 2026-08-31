import { create } from "zustand";
import { resolveCraneIndex } from "@/domain/cameraFocus";
import { isViewportTracking, useViewportStore } from "@/stores/viewport";

export type ContentView = "block" | "container" | "ship" | "crane";

export type DetailGraphSubject = {
  kind: "ship" | "crane";
  key: string;
  index: number;
};

type ContentViewState = {
  activeView: ContentView | null;
  setActiveView: (view: ContentView) => void;
  /** 3D·목록 공통 — 선박 상세 키 */
  detailShipKey: string | null;
  /** 3D·목록 공통 — 크레인 상세 키 */
  detailCraneKey: string | null;
  /** 컨테이너 상세 ID */
  detailContainerId: string | null;
  openShipDetail: (key: string) => void;
  openCraneDetail: (key: string) => void;
  clearContentDetail: () => void;
  setDetailContainerId: (id: string | null) => void;
  detailGraphOpen: boolean;
  detailGraphSubject: DetailGraphSubject | null;
  toggleDetailGraph: (subject: DetailGraphSubject) => void;
  closeDetailGraph: () => void;
  /** ESC — 그래프 → 상세 → 목록 순으로 한 단계 닫기 */
  dismissContentPanelLayer: () => boolean;
};

export const useContentViewStore = create<ContentViewState>((set, get) => ({
  activeView: null,
  setActiveView: (view) =>
    set((state) => {
      const next = state.activeView === view ? null : view;
      const viewport = useViewportStore.getState();

      if (next !== "ship" && state.detailShipKey) {
        viewport.clearShipDetailFocus();
        viewport.clearShipSelection();
      }
      if (next !== "crane" && state.detailCraneKey) {
        viewport.clearCraneDetailFocus();
        viewport.clearCraneSelection();
      }
      if (next !== "container" && state.detailContainerId) {
        viewport.clearContainerSelection();
      }
      if (next == null) {
        viewport.clearShipSelection();
        viewport.clearCraneSelection();
        viewport.clearContainerSelection();
      }

      return {
        activeView: next,
        detailGraphOpen: false,
        detailGraphSubject: null,
        detailShipKey: next === "ship" ? state.detailShipKey : null,
        detailCraneKey: next === "crane" ? state.detailCraneKey : null,
        detailContainerId: next === "container" ? state.detailContainerId : null,
      };
    }),
  detailShipKey: null,
  detailCraneKey: null,
  detailContainerId: null,
  setDetailContainerId: (id) => {
    if (id == null) {
      useViewportStore.getState().clearContainerSelection();
    }
    set({ detailContainerId: id });
  },
  openShipDetail: (key) => {
    const viewport = useViewportStore.getState();
    set({
      activeView: "ship",
      detailShipKey: key,
      detailCraneKey: null,
      detailContainerId: null,
      detailGraphOpen: false,
      detailGraphSubject: null,
    });
    if (isViewportTracking(viewport)) {
      viewport.selectShip(key);
    } else {
      viewport.focusShipDetail(key);
    }
  },
  openCraneDetail: (key) => {
    const index = resolveCraneIndex(key);
    if (index == null) return;

    const viewport = useViewportStore.getState();
    set({
      activeView: "crane",
      detailCraneKey: key,
      detailShipKey: null,
      detailContainerId: null,
      detailGraphOpen: false,
      detailGraphSubject: null,
    });
    if (isViewportTracking(viewport)) {
      viewport.selectCrane(index);
    } else {
      viewport.focusCraneDetail(index);
    }
  },
  clearContentDetail: () => {
    const viewport = useViewportStore.getState();
    viewport.clearShipDetailFocus();
    viewport.clearCraneDetailFocus();
    viewport.clearShipSelection();
    viewport.clearCraneSelection();
    viewport.clearContainerSelection();
    set({ detailShipKey: null, detailCraneKey: null, detailContainerId: null });
  },
  detailGraphOpen: false,
  detailGraphSubject: null,
  toggleDetailGraph: (subject) => {
    const { detailGraphOpen, detailGraphSubject } = get();
    const sameSubject =
      detailGraphSubject?.kind === subject.kind &&
      detailGraphSubject?.key === subject.key;
    if (detailGraphOpen && sameSubject) {
      set({ detailGraphOpen: false, detailGraphSubject: null });
      return;
    }
    set({ detailGraphOpen: true, detailGraphSubject: subject });
  },
  closeDetailGraph: () =>
    set({ detailGraphOpen: false, detailGraphSubject: null }),
  dismissContentPanelLayer: () => {
    const state = get();

    if (state.detailGraphOpen) {
      set({ detailGraphOpen: false, detailGraphSubject: null });
      return true;
    }

    if (state.detailShipKey) {
      const viewport = useViewportStore.getState();
      viewport.clearShipDetailFocus();
      viewport.clearShipSelection();
      set({ detailShipKey: null });
      return true;
    }

    if (state.detailCraneKey) {
      const viewport = useViewportStore.getState();
      viewport.clearCraneDetailFocus();
      viewport.clearCraneSelection();
      set({ detailCraneKey: null });
      return true;
    }

    if (state.detailContainerId) {
      useViewportStore.getState().clearContainerSelection();
      set({ detailContainerId: null });
      return true;
    }

    if (state.activeView) {
      const viewport = useViewportStore.getState();
      viewport.clearShipSelection();
      viewport.clearCraneSelection();
      viewport.clearContainerSelection();
      set({
        activeView: null,
        detailShipKey: null,
        detailCraneKey: null,
        detailContainerId: null,
        detailGraphOpen: false,
        detailGraphSubject: null,
      });
      return true;
    }

    return false;
  },
}));

export const CONTENT_VIEW_NAV: {
  view: ContentView;
  icon: "LayoutTemplate" | "Container" | "Ship" | "Construction";
  label: string;
}[] = [
  { view: "block", icon: "LayoutTemplate", label: "Blocks" },
  { view: "container", icon: "Container", label: "Containers" },
  { view: "ship", icon: "Ship", label: "Ships" },
  { view: "crane", icon: "Construction", label: "Cranes" },
];
