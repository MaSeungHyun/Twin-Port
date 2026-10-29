import { create } from "zustand";
type State={perfOverlay:boolean;perfExpanded:boolean;togglePerfOverlay:()=>void;togglePerfExpanded:()=>void};
export const useViewportSettingsStore=create<State>((set)=>({perfOverlay:false,perfExpanded:false,togglePerfOverlay:()=>set(s=>({perfOverlay:!s.perfOverlay})),togglePerfExpanded:()=>set(s=>({perfExpanded:!s.perfExpanded}))}));
