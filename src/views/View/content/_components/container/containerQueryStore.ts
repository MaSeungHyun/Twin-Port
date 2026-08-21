import { create } from "zustand";

/** 패널 검색어 — 입력창만 구독하고 목록은 deferred 값만 받도록 분리 */
export const useContainerQueryStore = create<{
  query: string;
  setQuery: (query: string) => void;
}>((set) => ({
  query: "",
  setQuery: (query) => set({ query }),
}));
