/**
 * 렌더러 백엔드 선택 (WebGPU / WebGL2). 둘 다 WebGPURenderer + TSL 노드 머티리얼.
 * 우선순위: URL ?renderer=webgl|webgpu → localStorage → 기본 webgpu. 브라우저에 WebGPU 가 없으면 자동 WebGL2.
 * 전환은 페이지 리로드 방식 (GLTF/해안 bake/바다 리소스를 깨끗하게 재생성).
 */
import { create } from "zustand";

export type RendererPref = "webgpu" | "webgl";
const KEY = "twin-port.renderer";

function readPref(): RendererPref {
  try {
    const q = new URLSearchParams(window.location.search).get("renderer");
    if (q === "webgl" || q === "webgpu") return q;
    const s = localStorage.getItem(KEY);
    if (s === "webgl" || s === "webgpu") return s;
  } catch {
    /* noop */
  }
  return "webgpu";
}

export const hasWebGPU = () => typeof navigator !== "undefined" && "gpu" in navigator && !!(navigator as { gpu?: unknown }).gpu;

interface RendererState {
  pref: RendererPref;
  /** 실제 활성 백엔드 (init 후 확정) */
  active: "webgpu" | "webgl2" | null;
  setActive: (a: "webgpu" | "webgl2") => void;
}
export const useRendererStore = create<RendererState>()((set) => ({
  pref: readPref(),
  active: null,
  setActive: (active) => set({ active }),
}));

/** 선택 저장 + URL 파라미터 갱신 후 리로드 */
export function switchRenderer(pref: RendererPref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* noop */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("renderer", pref);
  window.location.replace(url.toString());
}
