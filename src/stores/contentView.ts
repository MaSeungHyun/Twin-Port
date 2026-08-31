import { create } from "zustand";

export type ContentView = "block" | "container" | "ship" | "crane";

type ContentViewState = {
  activeView: ContentView | null;
  setActiveView: (view: ContentView) => void;
};

export const useContentViewStore = create<ContentViewState>((set) => ({
  activeView: "block",
  setActiveView: (view) =>
    set((state) => ({
      activeView: state.activeView === view ? null : view,
    })),
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
