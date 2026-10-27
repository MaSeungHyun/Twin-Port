/**
 * 환경 HDRI 교체 상태 (디자이너 룩 리뷰용). 기본은 port_hdr.hdr.
 * 번들 HDRI 는 src/assets 아래 .hdr/.exr 를 자동 수집, 로컬 파일은 object URL 로 로드.
 */
import { create } from "zustand";

export type HdriExt = "hdr" | "exr";
export interface HdriEntry { name: string; url: string; ext: HdriExt; local?: boolean }

const globbed = import.meta.glob("/src/assets/**/*.{hdr,exr,HDR,EXR}", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const BUNDLED_HDRIS: HdriEntry[] = Object.entries(globbed)
  .map(([path, url]) => {
    const name = path.split("/").pop()!;
    return { name, url, ext: (name.toLowerCase().endsWith(".exr") ? "exr" : "hdr") as HdriExt };
  })
  .sort((a, b) => (a.name === "port_hdr.hdr" ? -1 : b.name === "port_hdr.hdr" ? 1 : a.name.localeCompare(b.name)));

export const DEFAULT_HDRI: HdriEntry =
  BUNDLED_HDRIS.find((h) => h.name === "port_hdr.hdr") ?? BUNDLED_HDRIS[0]!;

interface HdriState {
  current: HdriEntry;
  status: "loading" | "ready" | "error";
  error?: string;
  select: (h: HdriEntry) => void;
  loadLocalFile: (file: File) => boolean;
  reset: () => void;
  setStatus: (status: HdriState["status"], error?: string) => void;
}

export const isHdriFile = (name: string) => /\.(hdr|exr)$/i.test(name);

export const useHdriStore = create<HdriState>()((set, get) => {
  const swap = (h: HdriEntry) => {
    const prev = get().current;
    if (prev.local && prev.url !== h.url) URL.revokeObjectURL(prev.url);
    set({ current: h, status: "loading", error: undefined });
  };
  return {
    current: DEFAULT_HDRI,
    status: "loading",
    select: swap,
    loadLocalFile: (file) => {
      if (!isHdriFile(file.name)) return false;
      swap({
        name: file.name,
        url: URL.createObjectURL(file),
        ext: file.name.toLowerCase().endsWith(".exr") ? "exr" : "hdr",
        local: true,
      });
      return true;
    },
    reset: () => swap(DEFAULT_HDRI),
    setStatus: (status, error) => set({ status, error }),
  };
});
