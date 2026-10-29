/**
 * 사용자 그래픽/뷰포트 설정 (localStorage 저장, sanitize 적용).
 * 구 키(twin-port.renderer / twin-port.renderScale / tp.sunShadow.v3)는 최초 1회 이관.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RendererPref = "webgpu" | "webgl";
export type QualityPreset = "performance" | "balanced" | "high";
export type ShadowQuality = "off" | "low" | "high";

/** 품질 프리셋 → DPR 상한 */
export const QUALITY_DPR: Record<QualityPreset, number> = {
  performance: 1,
  balanced: 1.25,
  high: 1.5,
};
/** 그림자 품질 → 맵 크기 / 따라가기 최소 반경(m). 맵이 작으면 반경도 줄여 texel 밀도 유지 */
export const SHADOW_PRESET: Record<
  Exclude<ShadowQuality, "off">,
  { mapSize: number; followHalfSize: number }
> = {
  low: { mapSize: 2048, followHalfSize: 600 },
  high: { mapSize: 4096, followHalfSize: 1000 },
};

const STORE_KEY = "twin-port.viewportSettings";
const LEGACY_RENDERER = "twin-port.renderer";
const LEGACY_SCALE = "twin-port.renderScale";
const LEGACY_SUN = "tp.sunShadow.v3";

type Persisted = {
  rendererPref: RendererPref;
  quality: QualityPreset;
  /** 실제 DPR 상한. 프리셋 선택 시 QUALITY_DPR 로 설정, DebugUI(개발)에서 직접 덮어쓰기 가능 */
  renderScale: number;
  shadowQuality: ShadowQuality;
  perfOverlay: boolean;
  perfExpanded: boolean;
};

type State = Persisted & {
  setRendererPref: (p: RendererPref) => void;
  setQuality: (q: QualityPreset) => void;
  setRenderScale: (v: number) => void;
  setShadowQuality: (q: ShadowQuality) => void;
  setPerfOverlay: (v: boolean) => void;
  togglePerfOverlay: () => void;
  togglePerfExpanded: () => void;
};

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const clampScale = (v: number) => Math.min(2, Math.max(0.5, v));
const nearestQuality = (scale: number): QualityPreset =>
  scale <= 1.1 ? "performance" : scale <= 1.35 ? "balanced" : "high";

function legacyDefaults(): Persisted {
  const r = read(LEGACY_RENDERER);
  const raw = read(LEGACY_SCALE);
  const s = Number(raw);
  const hasScale = raw !== null && Number.isFinite(s) && s >= 0.5 && s <= 2;
  let mapSize = 0;
  try {
    mapSize = Number(JSON.parse(read(LEGACY_SUN) ?? "{}").mapSize) || 0;
  } catch {
    /* noop */
  }
  const quality = hasScale ? nearestQuality(s) : "high";
  return {
    rendererPref: r === "webgl" ? "webgl" : "webgpu",
    quality,
    renderScale: hasScale ? s : QUALITY_DPR[quality],
    shadowQuality: mapSize && mapSize < 4096 ? "low" : "high",
    perfOverlay: false,
    perfExpanded: false,
  };
}

const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T =>
  list.includes(v as T) ? (v as T) : d;

/** 저장값 검증: 잘못된 값은 기본값으로 */
export function sanitize(v: Partial<Persisted> | undefined, d: Persisted): Persisted {
  const x = v ?? {};
  const scale = Number(x.renderScale);
  return {
    rendererPref: oneOf(x.rendererPref, ["webgpu", "webgl"] as const, d.rendererPref),
    quality: oneOf(x.quality, ["performance", "balanced", "high"] as const, d.quality),
    renderScale: x.renderScale != null && Number.isFinite(scale) ? clampScale(scale) : d.renderScale,
    shadowQuality: oneOf(x.shadowQuality, ["off", "low", "high"] as const, d.shadowQuality),
    perfOverlay: typeof x.perfOverlay === "boolean" ? x.perfOverlay : d.perfOverlay,
    perfExpanded: typeof x.perfExpanded === "boolean" ? x.perfExpanded : d.perfExpanded,
  };
}

const DEFAULTS = legacyDefaults();

export const useViewportSettingsStore = create<State>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setRendererPref: (rendererPref) => set({ rendererPref }),
      setQuality: (quality) => set({ quality, renderScale: QUALITY_DPR[quality] }),
      setRenderScale: (v) => set({ renderScale: clampScale(v) }),
      setShadowQuality: (shadowQuality) => set({ shadowQuality }),
      setPerfOverlay: (perfOverlay) => set({ perfOverlay }),
      togglePerfOverlay: () => set((s) => ({ perfOverlay: !s.perfOverlay })),
      togglePerfExpanded: () => set((s) => ({ perfExpanded: !s.perfExpanded })),
    }),
    {
      name: STORE_KEY,
      version: 1,
      partialize: (s): Persisted => ({
        rendererPref: s.rendererPref,
        quality: s.quality,
        renderScale: s.renderScale,
        shadowQuality: s.shadowQuality,
        perfOverlay: s.perfOverlay,
        perfExpanded: s.perfExpanded,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...sanitize(persisted as Partial<Persisted>, DEFAULTS),
      }),
    },
  ),
);
