import { create } from "zustand";

export type ContentView = "block" | "container" | "ship" | "crane";

export type DetailGraphSubject = {
  kind: "ship" | "crane";
  key: string;
  index: number;
};

type ContentViewState = {
  activeView: ContentView | null;
  setActiveView: (view: ContentView) => void;
  detailGraphOpen: boolean;
  detailGraphSubject: DetailGraphSubject | null;
  toggleDetailGraph: (subject: DetailGraphSubject) => void;
  closeDetailGraph: () => void;
};

export const useContentViewStore = create<ContentViewState>((set, get) => ({
  activeView: null,
  setActiveView: (view) =>
    set((state) => ({
      activeView: state.activeView === view ? null : view,
      detailGraphOpen: false,
      detailGraphSubject: null,
    })),
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
