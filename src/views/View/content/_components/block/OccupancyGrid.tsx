import { computeBlockOccupancies, occupancyColor } from "@/domain/occupancy";
import { useYardStore } from "@/stores/yard";
import { useMemo } from "react";

function gridShape(count: number) {
  if (count <= 1) return { cols: 1, rows: 1 };
  const root = Math.sqrt(count);
  let bestCols = Math.ceil(root);
  let bestRows = Math.ceil(count / bestCols);
  let bestWaste = bestCols * bestRows - count;
  let bestSpread = Math.abs(bestCols - bestRows);

  const start = Math.max(1, Math.floor(root) - 3);
  const end = Math.min(count, Math.ceil(root) + 3);
  for (let cols = start; cols <= end; cols += 1) {
    const rows = Math.ceil(count / cols);
    const waste = cols * rows - count;
    const spread = Math.abs(cols - rows);
    if (
      waste < bestWaste ||
      (waste === bestWaste &&
        (spread < bestSpread ||
          (spread === bestSpread && cols >= rows && bestCols < bestRows)))
    ) {
      bestCols = cols;
      bestRows = rows;
      bestWaste = waste;
      bestSpread = spread;
    }
  }
  return { cols: bestCols, rows: bestRows };
}

function OccupancyDonut({
  percent,
  color,
  size = 56,
}: {
  percent: number;
  color: string;
  size?: number;
}) {
  const filled = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} ${filled * 3.6}deg, rgba(255,255,255,0.12) 0)`,
        mask: "radial-gradient(farthest-side, transparent 64%, #000 65%)",
        WebkitMask: "radial-gradient(farthest-side, transparent 64%, #000 65%)",
      }}
    />
  );
}

/** Drei Html 카드와 동일한 내용. 3D 좌표가 아니라 DOM 그리드에 0..n 순서 배치 */
export default function OccupancyGrid() {
  const blocks = useYardStore((s) => s.blocks);
  const containers = useYardStore((s) => s.containers);
  const occupancies = useMemo(
    () => computeBlockOccupancies(containers, blocks),
    [blocks, containers],
  );
  const { cols, rows } = gridShape(occupancies.length);

  return (
    <div
      className="grid h-full w-full gap-2 bg-transparent p-3"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {occupancies.map((occupancy, index) => {
        const color = occupancyColor(occupancy.ratio);
        return (
          <div
            key={occupancy.blockCode}
            className="flex min-h-0 min-w-0 items-center justify-center"
          >
            <div className="flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-md border border-white/10 bg-black/45 px-2 py-2 text-center text-white">
              <div className="text-[10px] text-white/45 tabular-nums">
                {index}
              </div>
              <span className="text-base font-semibold tracking-wide">
                {occupancy.blockCode}
              </span>
              <OccupancyDonut percent={occupancy.percent} color={color} />
              <span className="text-base font-bold" style={{ color }}>
                {occupancy.percent}%
              </span>
              <span className="text-sm text-white/80">
                {occupancy.occupied} / {occupancy.capacity}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
