import { useMemo } from "react";
import { FrameSlot } from "@/components/ui/PanelFrames";
import ProgressBar from "@/components/ui/ProgressBar";
import {
  computeBlockOccupancies,
  occupancyLevel,
  type BlockOccupancy,
  type OccupancyLevel,
} from "@/domain/occupancy";
import { useYardStore } from "@/stores/yard";
import { cn } from "@/utils/style";

const LEVELS: {
  id: OccupancyLevel;
  name: string;
  range: string;
  swatch: string;
  bar: "ok" | "warn" | "danger";
  text: string;
}[] = [
  { id: "danger", name: "위험", range: "80% 이상", swatch: "bg-dt-danger/60", bar: "danger", text: "text-[#FF8A8B]" },
  { id: "warning", name: "주의", range: "60–79%", swatch: "bg-dt-warn/60", bar: "warn", text: "text-[#FFC966]" },
  { id: "safe", name: "여유", range: "60% 미만", swatch: "bg-dt-ok/60", bar: "ok", text: "text-[#6FE8C0]" },
];

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

/** 야드 점유율 모드의 왼쪽 요약과 오른쪽 상위 블록 */
export default function OccupancyPanels() {
  const blocks = useYardStore((s) => s.blocks);
  const containers = useYardStore((s) => s.containers);
  const occupancies = useMemo(
    () => computeBlockOccupancies(containers, blocks),
    [containers, blocks],
  );
  const occupied = occupancies.reduce((sum, item) => sum + item.occupied, 0);
  const capacity = occupancies.reduce((sum, item) => sum + item.capacity, 0);
  const percent = capacity === 0 ? 0 : Math.round((occupied / capacity) * 1000) / 10;
  const counts = {
    danger: occupancies.filter((item) => occupancyLevel(item.ratio) === "danger").length,
    warning: occupancies.filter((item) => occupancyLevel(item.ratio) === "warning").length,
    safe: occupancies.filter((item) => occupancyLevel(item.ratio) === "safe").length,
  };
  const top = [...occupancies].sort((a, b) => b.ratio - a.ratio).slice(0, 8);

  return (
    <>
      <FrameSlot side="left" id="occupancy" size={{ width: 360, height: "auto" }} rank={2}>
      <section className="flex w-full flex-col p-6">
        <header className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-dt-text">야드 점유율</h2>
          <span className="text-[10px] font-medium tracking-[1px] text-dt-text-3">{blocks.length} BLOCKS</span>
        </header>
        <div className="mt-4 flex items-end justify-between gap-3">
          <p className="text-[32px] leading-none font-light tabular-nums text-dt-text">
            {percent.toFixed(1)}
            <span className="ml-1 text-[12px] font-normal text-dt-text-3">%</span>
          </p>
          <p className="pb-1 text-[12px] font-normal tabular-nums text-dt-text-2">
            {formatCount(occupied)} / {formatCount(capacity)} 슬롯
          </p>
        </div>
        <ProgressBar value={percent} tone="warn" className="mt-3 h-1.5" />
        <div className="my-4 h-px bg-white/8" />
        <ul className="flex flex-col gap-2">
          {LEVELS.map((level) => (
            <li key={level.id} className="flex items-center gap-2">
              <span className={cn("size-4 rounded-sm", level.swatch)} />
              <span className="text-[14px] font-normal text-dt-text">{level.name}</span>
              <span className="text-[12px] font-normal text-dt-text-3">{level.range}</span>
              <span className="ml-auto text-[14px] font-medium tabular-nums text-dt-text">{counts[level.id]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[10px] font-medium tracking-[1px] text-dt-text-3">블록 바닥 색 · 라벨로 3D에 표시</p>
      </section>
      </FrameSlot>

      <FrameSlot side="right" id="occupancy-top" size={{ width: 360, height: "auto", lift: true }} rank={2}>
      <section className="flex max-h-[calc(100dvh-112px-var(--toast-lift,0px))] w-full flex-col overflow-hidden p-6">
        <header className="flex shrink-0 items-center justify-between">
          <h2 className="text-[16px] font-medium text-dt-text">적재율 상위 블록</h2>
          <span className="text-[10px] font-medium tracking-[1px] text-dt-text-3">TOP 8</span>
        </header>
        <ol className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {top.map((item, index) => (
            <TopRow key={item.blockCode} rank={index + 1} item={item} />
          ))}
        </ol>
      </section>
      </FrameSlot>
    </>
  );
}

function TopRow({ rank, item }: { rank: number; item: BlockOccupancy }) {
  const level = occupancyLevel(item.ratio);
  const tone = LEVELS.find((entry) => entry.id === level) ?? LEVELS[2]!;
  return (
    <li className="flex h-7 items-center gap-2">
      <span className="w-4 text-[10px] font-medium tracking-[1px] text-dt-text-3">{rank}</span>
      <span className="w-12 truncate text-[14px] font-medium text-dt-text">{item.blockCode}</span>
      <ProgressBar value={item.percent} tone={tone.bar} className="min-w-0 flex-1" />
      <span className={cn("ml-auto text-[12px] font-medium tabular-nums", tone.text)}>{item.percent.toFixed(0)}%</span>
    </li>
  );
}
