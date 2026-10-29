/**
 * 렌더러 백엔드 (WebGPU / WebGL2). 둘 다 WebGPURenderer + TSL 노드 머티리얼.
 * 선택값은 useViewportSettingsStore(rendererPref)에 저장. 우선순위: URL ?renderer=webgl|webgpu → 저장값 → webgpu.
 * 브라우저에 WebGPU 가 없거나 어댑터/초기화 실패 시 자동 WebGL2 (fallbackReason 기록).
 * 전환은 페이지 리로드 방식 (GLTF/해안 bake/바다 리소스를 깨끗하게 재생성).
 */
import { create } from "zustand";
import {
  useViewportSettingsStore,
  type RendererPref,
} from "./useViewportSettingsStore";

export type { RendererPref };

function urlPref(): RendererPref | null {
  try {
    const q = new URLSearchParams(window.location.search).get("renderer");
    if (q === "webgl" || q === "webgpu") return q;
  } catch {
    /* noop */
  }
  return null;
}

export const hasWebGPU = () => typeof navigator !== "undefined" && "gpu" in navigator && !!(navigator as { gpu?: unknown }).gpu;

interface RendererState {
  /** 이번 세션의 요청 백엔드 (URL 우선) */
  pref: RendererPref;
  /** 실제 활성 백엔드 (init 후 확정) */
  active: "webgpu" | "webgl2" | null;
  setActive: (a: "webgpu" | "webgl2") => void;
  /** WebGPU 요청이었지만 WebGL2 로 폴백한 이유 */
  fallbackReason: string | null;
  setFallbackReason: (r: string | null) => void;
}
export const useRendererStore = create<RendererState>()((set) => ({
  pref: urlPref() ?? useViewportSettingsStore.getState().rendererPref,
  active: null,
  setActive: (active) => set({ active }),
  fallbackReason: null,
  setFallbackReason: (fallbackReason) => set({ fallbackReason }),
}));

/** 선택 저장 + URL 파라미터 갱신 후 리로드 */
export function switchRenderer(pref: RendererPref) {
  useViewportSettingsStore.getState().setRendererPref(pref);
  const url = new URL(window.location.href);
  url.searchParams.set("renderer", pref);
  window.location.replace(url.toString());
}
