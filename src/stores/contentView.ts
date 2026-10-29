import { create } from "zustand";
import { resolveCraneIndex } from "@/domain/cameraFocus";
import { resolveOverheadCraneIndex } from "@/domain/overheadCraneTwin";
import { isViewportTracking, useViewportStore } from "@/stores/viewport";

export type ContentView = "block" | "container" | "ship" | "crane";

export type CraneTab = "quay" | "overhead";

export type DetailGraphSubject = {
  kind: "ship" | "crane" | "overheadCrane";
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
  /** 크레인 패널 탭 — 컨테이너(quay) / 오버헤드 */
  craneTab: CraneTab;
  setCraneTab: (tab: CraneTab) => void;
  /** overhead crane 상세 키 (ohc-N) */
  detailOverheadCraneKey: string | null;
  openOverheadCraneDetail: (key: string) => void;
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
      if (next !== "crane" && state.detailOverheadCraneKey) {
        viewport.clearOverheadCraneDetailFocus();
        viewport.clearOverheadCraneSelection();
      }
      if (next !== "container" && state.detailContainerId) {
        viewport.clearContainerSelection();
      }
      if (next == null) {
        viewport.clearShipSelection();
        viewport.clearCraneSelection();
        viewport.clearOverheadCraneSelection();
        viewport.clearContainerSelection();
      }

      return {
        activeView: next,
        detailGraphOpen: false,
        detailGraphSubject: null,
        detailShipKey: next === "ship" ? state.detailShipKey : null,
        detailCraneKey: next === "crane" ? state.detailCraneKey : null,
        detailOverheadCraneKey:
          next === "crane" ? state.detailOverheadCraneKey : null,
        detailContainerId: next === "container" ? state.detailContainerId : null,
      };
    }),
  detailShipKey: null,
  detailCraneKey: null,
  craneTab: "quay",
  setCraneTab: (tab) => {
    const state = get();
    if (state.craneTab === tab) return;
    const viewport = useViewportStore.getState();
    viewport.clearCraneDetailFocus();
    viewport.clearCraneSelection();
    viewport.clearOverheadCraneDetailFocus();
    viewport.clearOverheadCraneSelection();
    set({
      craneTab: tab,
      detailCraneKey: null,
      detailOverheadCraneKey: null,
      detailGraphOpen: false,
      detailGraphSubject: null,
    });
  },
  detailOverheadCraneKey: null,
  openOverheadCraneDetail: (key) => {
    const index = resolveOverheadCraneIndex(key);
    if (index == null) return;

    const viewport = useViewportStore.getState();
    set({
      activeView: "crane",
      craneTab: "overhead",
      detailOverheadCraneKey: key,
      detailCraneKey: null,
      detailShipKey: null,
      detailContainerId: null,
      detailGraphOpen: false,
      detailGraphSubject: null,
    });
    if (isViewportTracking(viewport)) {
      viewport.selectOverheadCrane(index);
    } else {
      viewport.focusOverheadCraneDetail(index);
    }
  },
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
      detailOverheadCraneKey: null,
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
      craneTab: "quay",
      detailCraneKey: key,
      detailOverheadCraneKey: null,
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
    viewport.clearOverheadCraneDetailFocus();
    viewport.clearOverheadCraneSelection();
    viewport.clearContainerSelection();
    set({
      detailShipKey: null,
      detailCraneKey: null,
      detailOverheadCraneKey: null,
      detailContainerId: null,
    });
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

    if (state.detailOverheadCraneKey) {
      const viewport = useViewportStore.getState();
      viewport.clearOverheadCraneDetailFocus();
      viewport.clearOverheadCraneSelection();
      set({ detailOverheadCraneKey: null });
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
      viewport.clearOverheadCraneDetailFocus();
      viewport.clearOverheadCraneSelection();
      viewport.clearContainerSelection();
      set({
        activeView: null,
        detailShipKey: null,
        detailCraneKey: null,
        detailOverheadCraneKey: null,
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
