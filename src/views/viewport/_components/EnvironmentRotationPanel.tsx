import Button from "@/components/Button";
import {
  formatEnvironmentRotationEuler,
  useEnvironmentDebugStore,
  type EnvironmentRotationDeg,
} from "@/stores/environmentDebug";

const AXES: Array<{ key: keyof EnvironmentRotationDeg; label: string }> = [
  { key: "x", label: "X" },
  { key: "y", label: "Y" },
  { key: "z", label: "Z" },
];

export default function EnvironmentRotationPanel() {
  const rotationDeg = useEnvironmentDebugStore((s) => s.rotationDeg);
  const setRotationDeg = useEnvironmentDebugStore((s) => s.setRotationDeg);
  const resetRotationDeg = useEnvironmentDebugStore((s) => s.resetRotationDeg);

  const eulerSnippet = formatEnvironmentRotationEuler(rotationDeg);

  return (
    <div className="pointer-events-auto absolute bottom-4 right-5 z-20 w-72 rounded-md border border-white/15 bg-black/75 p-3 text-xs text-white backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium text-white/90">HDR Rotation (deg)</span>
        <Button
          type="button"
          className="h-7 px-2 text-[11px]"
          onClick={resetRotationDeg}
        >
          Reset
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {AXES.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2">
            <span className="w-3 shrink-0 text-white/70">{label}</span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotationDeg[key]}
              onChange={(event) =>
                setRotationDeg(key, Number(event.target.value))
              }
              className="min-w-0 flex-1 accent-primary"
            />
            <span className="w-10 shrink-0 text-right tabular-nums text-white/80">
              {rotationDeg[key].toFixed(0)}°
            </span>
          </label>
        ))}
      </div>

      <p className="mt-3 break-all rounded bg-white/5 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-white/70">
        {eulerSnippet}
      </p>
    </div>
  );
}
