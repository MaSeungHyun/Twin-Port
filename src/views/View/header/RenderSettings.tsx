import { useState } from "react";
import IconButton from "@/components/IconButton";
import Checkbox from "@/components/Checkbox";
import { DropdownMenu } from "@/components/DropdownMenu";
import { hasWebGPU, switchRenderer, useRendererStore } from "@/stores/renderer";
import {
  useViewportSettingsStore,
  type QualityPreset,
  type RendererPref,
  type ShadowQuality,
} from "@/stores/useViewportSettingsStore";
import { cn } from "@/utils/style";

function Segment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="text-base text-white/70">{label}</span>
      <div className="flex gap-xs">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={o.disabled}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-xs border border-white/20 px-sm py-xs text-base transition-colors",
              "hover:border-primary disabled:cursor-not-allowed disabled:opacity-40",
              value === o.value && "border-primary/60 bg-primary/40",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 헤더 톱니: 그래픽 설정 (품질 프리셋, 그림자, 렌더러, 성능 오버레이) */
export default function RenderSettings() {
  const quality = useViewportSettingsStore((s) => s.quality);
  const setQuality = useViewportSettingsStore((s) => s.setQuality);
  const shadow = useViewportSettingsStore((s) => s.shadowQuality);
  const setShadow = useViewportSettingsStore((s) => s.setShadowQuality);
  const perf = useViewportSettingsStore((s) => s.perfOverlay);
  const setPerf = useViewportSettingsStore((s) => s.setPerfOverlay);
  const pref = useRendererStore((s) => s.pref);
  const active = useRendererStore((s) => s.active);
  const reason = useRendererStore((s) => s.fallbackReason);
  const ok = hasWebGPU();
  const [nextPref, setNextPref] = useState<RendererPref>(pref);

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <IconButton icon="Settings" label="Graphics settings" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content className="min-w-64 p-sm text-lg">
        <div className="flex flex-col gap-md px-xs py-xs text-lg text-white">
          <Segment<QualityPreset>
            label="품질"
            value={quality}
            onChange={setQuality}
            options={[
              { value: "performance", label: "성능" },
              { value: "balanced", label: "균형" },
              { value: "high", label: "고품질" },
            ]}
          />
          <Segment<ShadowQuality>
            label="그림자"
            value={shadow}
            onChange={setShadow}
            options={[
              { value: "off", label: "끄기" },
              { value: "low", label: "낮음" },
              { value: "high", label: "높음" },
            ]}
          />
          <Segment<RendererPref>
            label="렌더러 (적용 시 새로고침)"
            value={nextPref}
            onChange={setNextPref}
            options={[
              { value: "webgpu", label: "WebGPU", disabled: !ok },
              { value: "webgl", label: "WebGL2" },
            ]}
          />
          <div className="flex items-center justify-between gap-sm text-base text-white/70">
            <span title={reason ?? undefined}>
              현재: {active === "webgpu" ? "WebGPU" : active === "webgl2" ? "WebGL2" : "…"}
              {reason ? " (폴백)" : ""}
            </span>
            <button
              type="button"
              disabled={nextPref === pref}
              onClick={() => switchRenderer(nextPref)}
              className="rounded-xs border border-white/20 px-sm py-xs text-white hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              적용
            </button>
          </div>
          {reason && <span className="text-sm text-white/50">{reason}</span>}
          <Checkbox
            id="render-settings-perf"
            label="성능 오버레이 (Shift+P)"
            checked={perf}
            onCheckedChange={(checked) => setPerf(checked === true)}
          />
        </div>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
