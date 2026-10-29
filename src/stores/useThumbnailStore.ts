import { create } from "zustand";
type State={baked:boolean};
/** twin-port has no thumbnail bake gate; expose the SmartFactory-compatible ready flag. */
export const useThumbnailStore=create<State>(()=>({baked:true}));
