import { create } from "zustand";
type State={running:boolean};
export const useSimulationStore=create<State>(()=>({running:false}));
