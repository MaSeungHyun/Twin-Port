import { memo, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import WindowedList from "@/components/ui/WindowedList";
import { getBlockSlotGrid } from "@/constants/block";
import { getPortSim } from "@/domain/portSim";
import { computeBlockOccupancies, type BlockOccupancy } from "@/domain/occupancy";
import { usePortSimStore } from "@/stores/usePortSimStore";
import { useContentViewStore } from "@/stores/contentView";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import { cn } from "@/utils/style";
import { FrameSlot } from "@/components/ui/PanelFrames";
import { useDetailSelection } from "../useDetailSelection";

type BlockLevel = "full" | "high" | "mid" | "spare";
type BlockFilter = "all" | "full" | "high" | "spare";

const FILTERS: { id: BlockFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "full", label: "포화" },
  { id: "high", label: "높음" },
  { id: "spare", label: "여유" },
];

const LEVEL_LABEL: Record<BlockLevel, string> = {
  full: "포화",
  high: "높음",
  mid: "보통",
  spare: "여유",
};

const LEVEL_CLASS: Record<BlockLevel, string> = {
  full: "text-[#FF8A8B]",
  high: "text-[#FFC966]",
  mid: "text-[#8CC4FF]",
  spare: "text-[#6FE8C0]",
};

const ZONES = ["A", "B", "C", "D", "E", "F"] as const;

const BlockRow = memo(function BlockRow({
  code,
  line,
  level,
  selected,
  onSelect,
}: {
  code: string;
  line: string;
  level: BlockLevel;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-16 w-full items-center gap-2 rounded-lg px-3 text-left",
        selected ? "bg-dt-info/12 shadow-[inset_0_0_0_1px_#3D9BFF80]" : "hover:bg-white/6",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] text-[#F2F5F8]">{code}</span>
        <span className="block text-[12px] text-[#9AA8B6]">{line}</span>
      </span>
      <span className={cn("shrink-0 text-[12px]", LEVEL_CLASS[level])}>{LEVEL_LABEL[level]}</span>
    </button>
  );
}, (prev, next) => prev.code === next.code && prev.line === next.line && prev.level === next.level && prev.selected === next.selected);

function levelOf(percent: number): BlockLevel {
  if (percent >= 93) return "full";
  if (percent >= 80) return "high";
  if (percent >= 50) return "mid";
  return "spare";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const MAP_BAYS = 20;
const MAP_ROWS = 6;
const TIER_ALPHA = [0.06, 0.22, 0.38, 0.56, 0.8];

export default function BlockHud() {
  const blocks = useYardStore((s) => s.blocks);
  const containers = useYardStore((s) => s.containers);
  const selectBlock = useViewportStore((s) => s.selectBlock);
  const storeCode = useViewportStore((s) => s.selectedBlockCode);
  const selection = useDetailSelection(storeCode, () => {
    useViewportStore.getState().clearBlockSelection();
  });
  const setActiveView = useContentViewStore((s) => s.setActiveView);
  const tick = usePortSimStore((s) => (selection.key == null ? 0 : Math.floor(s.elapsedS)));
  const [filter, setFilter] = useState<BlockFilter>("all");
  const [query, setQuery] = useState("");

  const occupancies = useMemo(
    () => computeBlockOccupancies(containers, blocks),
    [containers, blocks],
  );
  const counts = useMemo(() => ({
    all: occupancies.length,
    full: occupancies.filter((item) => levelOf(item.percent) === "full").length,
    high: occupancies.filter((item) => levelOf(item.percent) === "high").length,
    spare: occupancies.filter((item) => levelOf(item.percent) === "spare").length,
  }), [occupancies]);

  const rows = occupancies.filter((item) => {
    const level = levelOf(item.percent);
    if (filter !== "all" && level !== filter) return false;
    const q = query.trim().toLowerCase();
    return !q || item.blockCode.toLowerCase().includes(q);
  });
  const selected = selection.key
    ? occupancies.find((item) => item.blockCode === selection.key) ?? null
    : null;

  const focus = (item: BlockOccupancy) => {
    if (!selection.select(item.blockCode)) return;
    if (useViewportStore.getState().selectedBlockCode !== item.blockCode) selectBlock(item.blockCode);
  };

  const blockIndex = selected ? blocks.findIndex((block) => block.code === selected.blockCode) : -1;
  const grid = selected && blockIndex >= 0 ? getBlockSlotGrid(blocks[blockIndex]!) : null;
  const zone = ZONES[Math.min(ZONES.length - 1, Math.max(0, Math.floor(blockIndex / 4)))] ?? "A";
  const crane = selected && tick >= 0
    ? getPortSim().overheadCranes.find((item) => item.block === selected.blockCode)
    : undefined;
  const inBlock = selected
    ? containers.filter((item) => item.location.block === selected.blockCode).slice(0, 6)
    : [];
  const bayMap = useMemo(() => {
    const height = Array.from({ length: MAP_ROWS }, () => Array<number>(MAP_BAYS).fill(0));
    if (!selected) return height;
    for (const item of containers) {
      if (item.location.block !== selected.blockCode || item.status !== "stored") continue;
      const bay = Number(item.location.slot.bay) - 1;
      const row = Number(item.location.slot.row) - 1;
      if (bay < 0 || bay >= MAP_BAYS || row < 0 || row >= MAP_ROWS) continue;
      height[row]![bay] += 1;
    }
    return height;
  }, [containers, selected]);

  return (
    <>
      <FrameSlot side="left" id="block" size={{ width: 360, height: "fill" }} rank={3}>
      <aside className="flex h-full min-h-0 w-full flex-col text-white">
        <header className="px-6 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-medium text-[#F2F5F8]">블록</h2>
            <span className="text-[10px] text-[#5C6B7A]">{occupancies.length}개</span>
          </div>
          <label className="mt-4 flex h-10 items-center gap-2 rounded-lg bg-black/25 px-3 text-[#5C6B7A]">
            <Icon icon="Search" className="size-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="블록 코드 검색 (예: B26)"
              className="w-full bg-transparent text-[12px] text-[#F2F5F8] outline-none placeholder:text-[#5C6B7A]"
            />
          </label>
          <div className="mt-3 flex gap-4">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "h-7 text-[12px] text-dt-text-2",
                  filter === item.id && "text-dt-point-bright",
                )}
              >
                {item.label} {counts[item.id]}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] text-[#5C6B7A]">
            <span>총 {rows.length}개</span>
            <span className="text-[12px] text-[#9AA8B6]">코드순</span>
          </div>
        </header>
        <WindowedList
          className="mt-2 min-h-0 flex-1 overflow-y-auto px-4 pb-4"
          items={rows}
          rowHeight={64}
          empty={<p className="px-2 py-8 text-center text-[12px] text-[#5C6B7A]">해당하는 블록이 없습니다</p>}
          renderRow={(item) => (
            <BlockRow
              key={item.blockCode}
              code={item.blockCode}
              line={`${item.occupied.toLocaleString()} / ${item.capacity.toLocaleString()} 슬롯 · ${Math.round(item.percent)}%`}
              level={levelOf(item.percent)}
              selected={selected?.blockCode === item.blockCode}
              onSelect={() => focus(item)}
            />
          )}
        />
      </aside>
      </FrameSlot>

      <FrameSlot side="right" id="block-detail" active={selected != null && grid != null && !selection.closing} size={{ width: 360, height: "fill", lift: true }} rank={1}>
      {selected && grid ? (
        <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden px-6 py-6 text-white">
          <div className="flex shrink-0 items-center justify-between">
            <p className="text-[10px] font-medium tracking-[1px] text-dt-text-3">BLOCK · 블록 상세</p>
            <button type="button" aria-label="상세 닫기" onClick={selection.close} className="grid size-6 place-items-center text-dt-text-2 hover:text-dt-text">
              <Icon icon="X" className="size-4" />
            </button>
          </div>
          <div className="mt-2 flex shrink-0 items-center gap-2">
            <h2 className="text-[20px] font-medium text-[#F2F5F8]">{selected.blockCode}</h2>
            <span className={cn(
              "rounded px-1.5 py-0.5 text-[10px]",
              levelOf(selected.percent) === "full" ? "bg-[#F0484A]/15 text-[#F0484A]" : "bg-white/8 text-[#9AA8B6]",
            )}>
              {LEVEL_LABEL[levelOf(selected.percent)]}
            </span>
          </div>
          <p className="mt-1 shrink-0 text-[12px] text-[#9AA8B6]">
            {zone}구역 · {grid.bays} Bay × {grid.rows} Row × {grid.tiers} Tier
          </p>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
            <Stat label="용량" value={String(selected.capacity)} unit="슬롯" />
            <Stat label="적재량" value={selected.occupied.toLocaleString()} unit="개" />
            <Stat label="공슬롯" value={(selected.capacity - selected.occupied).toLocaleString()} unit="개" />
            <Stat
              label="적재율"
              value={String(Math.round(selected.percent))}
              unit="%"
              valueClass={levelOf(selected.percent) === "full" || levelOf(selected.percent) === "high" ? "text-[#FF8A8B]" : "text-[#F2F5F8]"}
            />
          </div>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-[10px] tracking-wide text-[#5C6B7A]">베이별 적재 현황</p>
            <p className="text-[12px] text-[#9AA8B6]">Tier 0–4</p>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {bayMap.map((row, rowIndex) => (
              <div key={rowIndex} className="flex justify-between">
                {row.map((count, bayIndex) => (
                  <span
                    key={bayIndex}
                    title={`BAY ${pad(bayIndex + 1)} · ROW ${pad(rowIndex + 1)} · ${count}`}
                    className="size-3 rounded-[2px] bg-[#3D9BFF]"
                    style={{ opacity: TIER_ALPHA[Math.min(count, TIER_ALPHA.length - 1)] }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[#5C6B7A]">
            <span>BAY 001</span>
            <span>020</span>
          </div>

          <p className="mt-5 text-[10px] tracking-wide text-[#5C6B7A]">담당 장비</p>
          <div className="mt-2 flex items-center justify-between text-[12px]">
            <span className="text-[#9AA8B6]">OHC-{selected.blockCode} · {crane?.name ?? "오버헤드크레인"}</span>
            <span className={crane?.status === "error" ? "text-[#FF8A8B]" : crane?.status === "idle" ? "text-[#9AA8B6]" : "text-[#6FE8C0]"}>
              {crane?.status === "error" ? "고장" : crane?.status === "idle" ? "대기" : "가동"}
            </span>
          </div>
          {crane?.status === "error" && crane.cause ? (
            <div className="mt-2 flex items-center justify-between text-[12px]">
              <span className="text-[#5C6B7A]">고장 원인</span>
              <span className="text-[#FF8A8B]">{crane.cause}</span>
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-between">
            <p className="text-[10px] tracking-wide text-[#5C6B7A]">블록 내 컨테이너</p>
            <p className="text-[12px] text-[#9AA8B6]">{selected.occupied.toLocaleString()}개</p>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_72px_64px] text-[10px] text-[#5C6B7A]">
            <span>컨테이너</span>
            <span>위치</span>
            <span className="text-right">상태</span>
          </div>
          {inBlock.map((item) => {
            const slot = `${item.location.slot.bay}-${item.location.slot.row}-${item.location.slot.tier}`;
            const state = containerState(item.id, item.status);
            return (
              <div key={item.id} className="mt-2 grid grid-cols-[1fr_72px_64px] text-[12px]">
                <span className="truncate text-[#F2F5F8]">{displayNo(item.id, item.company)}</span>
                <span className="text-[#9AA8B6]">{slot}</span>
                <span className={cn("text-right", state.className)}>{state.label}</span>
              </div>
            );
          })}

          <div className="mt-auto flex gap-2 pt-6">
            <button
              type="button"
              onClick={() => setActiveView("container")}
              className="h-10 flex-1 rounded-md border border-white/10 text-[14px] text-[#F2F5F8]"
            >
              컨테이너 목록
            </button>
            <button
              type="button"
              onClick={() => focus(selected)}
              className="h-10 flex-1 rounded-md bg-[#FF6B3D] text-[14px] font-medium text-[#0A1219]"
            >
              3D 강조
            </button>
          </div>
          </div>
        </aside>
      ) : null}
      </FrameSlot>
    </>
  );
}

const CONTAINER_STATES = [
  { label: "선적 대기", className: "text-[#8CC4FF]" },
  { label: "반출 대기", className: "text-[#FFC966]" },
  { label: "적재", className: "text-[#6FE8C0]" },
  { label: "보류", className: "text-[#FF8A8B]" },
] as const;

function hash(value: string) {
  let h = 0;
  for (const char of value) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h;
}

function displayNo(id: string, company: string) {
  const n = Number(id.replace(/\D/g, "")) || hash(id);
  const prefix = (company.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "CNT") + "U";
  const body = String(100000 + (n % 900000)).padStart(6, "0");
  return `${prefix} ${body.slice(0, 6)}-${n % 10}`;
}

function containerState(id: string, status: string) {
  if (status === "moving") return { label: "이송", className: "text-[#8CC4FF]" };
  return CONTAINER_STATES[hash(id) % CONTAINER_STATES.length]!;
}

function Stat({ label, value, unit, valueClass = "text-[#F2F5F8]" }: { label: string; value: string; unit: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-[12px] text-[#9AA8B6]">{label}</p>
      <p className="mt-1 text-[22px] leading-none font-light">
        <span className={valueClass}>{value}</span>
        <span className="ml-1 text-[12px] text-[#5C6B7A]">{unit}</span>
      </p>
    </div>
  );
}
