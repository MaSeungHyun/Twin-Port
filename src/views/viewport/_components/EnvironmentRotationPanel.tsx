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
    <div className="pointer-events-auto absolute bottom-4 right-5 z-20 w-72 rounded-md border border-white/15 bg-black/75 p-md text-xs text-white backdrop-blur-sm">
      <div className="mb-xs flex items-center justify-between gap-xs">
        <span className="font-medium text-white/90">HDR Rotation (deg)</span>
        <Button
          type="button"
          className="h-7 px-xs text-sm"
          onClick={resetRotationDeg}
        >
          Reset
        </Button>
      </div>

      <div className="flex flex-col gap-xs">
        {AXES.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-xs">
            <span className="w-md shrink-0 text-white/70">{label}</span>
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

      <p className="mt-md break-all rounded bg-white/5 px-xs py-1.5 font-mono text-sm leading-relaxed text-white/70">
        {eulerSnippet}
      </p>
    </div>
  );
}
