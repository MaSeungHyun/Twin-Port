import { useState } from "react";
import Icon from "@/components/Icon";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { hasWebGPU, switchRenderer, useRendererStore } from "@/stores/renderer";
import {
  useViewportSettingsStore,
  type QualityPreset,
  type RendererPref,
  type ShadowQuality,
} from "@/stores/useViewportSettingsStore";
import { cn } from "@/utils/style";

/** 3D 위 우측 그래픽 설정 팝오버. 위치는 HudOverlay가 1536,88에 둔다 */
export default function GraphicsSettingsPanel({ onClose }: { onClose: () => void }) {
  const quality = useViewportSettingsStore((s) => s.quality);
  const setQuality = useViewportSettingsStore((s) => s.setQuality);
  const shadow = useViewportSettingsStore((s) => s.shadowQuality);
  const setShadow = useViewportSettingsStore((s) => s.setShadowQuality);
  const pref = useRendererStore((s) => s.pref);
  const active = useRendererStore((s) => s.active);
  const reason = useRendererStore((s) => s.fallbackReason);
  const ok = hasWebGPU();
  const [nextPref, setNextPref] = useState<RendererPref>(pref);
  const detected = active === "webgpu" ? "WebGPU" : active === "webgl2" ? "WebGL2" : "…";
  const dirty = nextPref !== pref;

  return (
    <aside className="flex max-h-[calc(100dvh-112px-var(--toast-lift,0px))] w-full flex-col overflow-hidden p-6 text-dt-text">
      <header className="flex shrink-0 items-center justify-between">
        <h2 className="text-[16px] font-medium">그래픽 설정</h2>
        <button
          type="button"
          aria-label="그래픽 설정 닫기"
          onClick={onClose}
          className="grid size-6 place-items-center text-dt-text-2 hover:text-dt-text"
        >
          <Icon icon="X" className="size-4" />
        </button>
      </header>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
      <div className="h-px bg-white/8" />

      <div className="mt-4 flex flex-col gap-4">
        <SegmentedControl<QualityPreset>
          label="품질"
          hint="그림자 해상도는 다음 실행부터"
          value={quality}
          onChange={setQuality}
          options={[
            { value: "performance", label: "성능" },
            { value: "balanced", label: "균형" },
            { value: "high", label: "고품질" },
          ]}
        />
        <SegmentedControl<ShadowQuality>
          label="그림자"
          hint="낮음·높음은 다음 실행부터"
          value={shadow}
          onChange={setShadow}
          options={[
            { value: "off", label: "끄기" },
            { value: "low", label: "낮음" },
            { value: "high", label: "높음" },
          ]}
        />
        <SegmentedControl<RendererPref>
          label="렌더러"
          hint="적용 시 새로고침"
          value={nextPref}
          onChange={setNextPref}
          options={[
            { value: "webgpu", label: "WebGPU", disabled: !ok },
            { value: "webgl", label: "WebGL2" },
          ]}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-normal text-dt-text-2" title={reason ?? undefined}>
            현재 {detected}
            {reason ? " · 폴백" : ""}
          </span>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => switchRenderer(nextPref)}
            className={cn(
              "h-8 w-16 rounded-lg text-[12px] font-medium",
              dirty ? "bg-dt-point text-dt-bg" : "bg-white/4 text-dt-text-3",
            )}
          >
            적용
          </button>
        </div>
      </div>
      </div>
    </aside>
  );
}
