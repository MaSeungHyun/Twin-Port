import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import WindowedList from "@/components/ui/WindowedList";
import { searchContainers } from "@/domain/containerSearch";
import { usePortSim } from "@/hooks/usePortSim";
import type { Container } from "@/types/container";
import { useContentViewStore } from "@/stores/contentView";
import { useViewportStore } from "@/stores/viewport";
import { useYardStore } from "@/stores/yard";
import { cn } from "@/utils/style";
import { FrameSlot } from "@/components/ui/PanelFrames";
import { useDetailSelection } from "../useDetailSelection";

type ContainerFilter = "all" | "load" | "gate" | "hold";

const FILTERS: { id: ContainerFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "load", label: "선적 대기" },
  { id: "gate", label: "반출 대기" },
  { id: "hold", label: "보류" },
];

const STATES = [
  { id: "load" as const, label: "선적 대기", className: "text-[#8CC4FF]", badge: "bg-[#3D9BFF]/15 text-[#3D9BFF]" },
  { id: "gate" as const, label: "반출 대기", className: "text-[#FFC966]", badge: "bg-[#FFB020]/15 text-[#FFC966]" },
  { id: "stored" as const, label: "적재", className: "text-[#6FE8C0]", badge: "bg-[#14D99B]/15 text-[#6FE8C0]" },
  { id: "hold" as const, label: "보류", className: "text-[#FF8A8B]", badge: "bg-[#F0484A]/15 text-[#F0484A]" },
];

const FLOWS = ["수출", "수입", "환적", "공컨테이너"] as const;

function hash(value: string) {
  let h = 0;
  for (const char of value) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h;
}

function stateOf(item: Container) {
  if (item.status === "moving") {
    return { id: "load" as const, label: "이송", className: "text-[#8CC4FF]", badge: "bg-[#3D9BFF]/15 text-[#3D9BFF]" };
  }
  return STATES[hash(item.id) % STATES.length]!;
}

function displayNo(item: Container) {
  const n = Number(item.id.replace(/\D/g, "")) || hash(item.id);
  const prefix = (item.company.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "CNT") + "U";
  const body = String(100000 + (n % 900000)).padStart(6, "0");
  return `${prefix} ${body.slice(0, 6)}-${n % 10}`;
}

function sizeOf(item: Container) {
  return hash(item.id) % 2 === 0 ? "40ft" : "20ft";
}

function slotLine(item: Container) {
  if (item.status === "moving") return `이송 중 · ${item.destination || "야드"}`;
  const { block, slot } = item.location;
  return `${block}-${slot.bay}-${slot.row}-${slot.tier} · ${sizeOf(item)}`;
}

export default function ContainerHud() {
  const containers = useYardStore((s) => s.containers);
  const ships = usePortSim().ships;
  const selectContainer = useViewportStore((s) => s.selectContainer);
  const detailId = useContentViewStore((s) => s.detailContainerId);
  const viewportId = useViewportStore((s) => s.selectedContainerId);
  const selection = useDetailSelection(detailId ?? viewportId, () => {
    useContentViewStore.getState().setDetailContainerId(null);
  });
  const [filter, setFilter] = useState<ContainerFilter>("all");
  const [query, setQuery] = useState("");

  const searched = useMemo(
    () => (query.trim() ? searchContainers(containers, query, 40) : containers.slice(0, 24)),
    [containers, query],
  );
  const rows = searched.filter((item) => {
    if (filter === "all") return true;
    return stateOf(item).id === filter;
  });
  const selected = selection.key
    ? containers.find((item) => item.id === selection.key) ?? null
    : null;

  const focus = (item: Container) => {
    if (selection.select(item.id)) selectContainer(item.id);
  };

  const selectedState = selected ? stateOf(selected) : null;
  const weight = selected ? (18 + (hash(selected.id) % 140) / 10).toFixed(1) : "";
  const flow = selected ? FLOWS[hash(selected.company) % FLOWS.length] : "";
  const vessel = selected && ships.length ? ships[hash(selected.id) % ships.length] : null;

  return (
    <>
      <FrameSlot side="left" id="container" size={{ width: 360, height: "fill" }} rank={3}>
      <aside className="flex h-full min-h-0 w-full flex-col text-white">
        <header className="px-6 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-medium text-[#F2F5F8]">컨테이너</h2>
            <span className="text-[10px] text-[#5C6B7A]">{containers.length.toLocaleString()}개</span>
          </div>
          <label className="mt-4 flex h-10 items-center gap-2 rounded-lg bg-black/25 px-3 text-[#5C6B7A]">
            <Icon icon="Search" className="size-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="컨테이너 번호 검색 (예: HMMU 4829153)"
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
                className={cn("h-7 text-[12px] text-dt-text-2", filter === item.id && "text-dt-point-bright")}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[10px] text-[#5C6B7A]">검색 결과 {rows.length}개</span>
            <span className="text-[12px] text-[#9AA8B6]">최신순</span>
          </div>
        </header>
        <WindowedList
          className="mt-2 min-h-0 flex-1 overflow-y-auto px-4 pb-4"
          items={rows}
          rowHeight={64}
          empty={<p className="px-2 py-8 text-center text-[12px] text-[#5C6B7A]">해당하는 컨테이너가 없습니다</p>}
          renderRow={(item) => {
            const state = stateOf(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => focus(item)}
                className={cn(
                  "flex h-16 w-full items-center gap-2 rounded-lg px-3 text-left",
                  selected?.id === item.id ? "bg-dt-info/12 shadow-[inset_0_0_0_1px_#3D9BFF80]" : "hover:bg-white/6",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-[#F2F5F8]">{displayNo(item)}</span>
                  <span className="block truncate text-[12px] text-[#9AA8B6]">{slotLine(item)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={cn("block text-[12px]", state.className)}>{state.label}</span>
                  <span className="block text-[12px] text-[#5C6B7A]">{item.company}</span>
                </span>
              </button>
            );
          }}
        />
      </aside>
      </FrameSlot>

      <FrameSlot side="right" id="container-detail" active={selected != null && selectedState != null && !selection.closing} size={{ width: 360, height: "fill", lift: true }} rank={1}>
      {selected && selectedState ? (
        <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden px-6 py-6 text-white">
          <div className="flex shrink-0 items-center justify-between">
            <p className="text-[10px] font-medium tracking-[1px] text-dt-text-3">CONTAINER · 컨테이너 상세</p>
            <button type="button" aria-label="상세 닫기" onClick={selection.close} className="grid size-6 place-items-center text-dt-text-2 hover:text-dt-text">
              <Icon icon="X" className="size-4" />
            </button>
          </div>
          <div className="mt-2 flex shrink-0 items-start justify-between gap-3">
            <h2 className="text-[20px] leading-tight font-medium text-[#F2F5F8]">{displayNo(selected)}</h2>
            <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px]", selectedState.badge)}>{selectedState.label}</span>
          </div>
          <p className="mt-1 shrink-0 text-[12px] text-[#9AA8B6]">{sizeOf(selected)} Dry · 총중량 {weight}t · {flow}</p>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <p className="mt-5 text-[10px] tracking-wide text-[#5C6B7A]">현재 위치</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <SlotStat label="BLOCK" value={selected.location.block} />
            <SlotStat label="BAY" value={selected.location.slot.bay} />
            <SlotStat label="ROW" value={selected.location.slot.row} />
            <SlotStat label="TIER" value={selected.location.slot.tier} />
          </div>
          <p className="mt-3 text-[10px] text-[#5C6B7A]">야드 적재 이후 이동 없음</p>

          <p className="mt-5 text-[10px] tracking-wide text-[#5C6B7A]">기본 정보</p>
          <dl className="mt-2 flex flex-col gap-2 text-[12px]">
            <Info label="컨테이너 번호" value={displayNo(selected)} />
            <Info label="규격 · 종류" value={`${sizeOf(selected)} · Dry`} />
            <Info label="소유사" value={selected.company} />
            <Info label="연결 선박" value={vessel?.name ?? "—"} valueClass="text-[#8CC4FF]" />
            <Info label="기항" value={vessel?.callId ?? "—"} valueClass="text-[#8CC4FF]" />
          </dl>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-[10px] tracking-wide text-[#5C6B7A]">처리 이력</p>
            <p className="text-[12px] text-[#9AA8B6]">4건</p>
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            <History label="반입 (Gate-in)" time="11/03 14:22" />
            <History label={`야드 적재 · ${selected.location.block}`} time="11/03 14:40" />
            <History label={selectedState.label} time="11/05 08:00" />
            <History label="선적 예정 · 선석" time="11/05 15:00" muted />
          </ul>

          <div className="mt-auto flex gap-2 pt-6">
            <button type="button" className="h-10 flex-1 rounded-md border border-white/10 text-[14px] text-[#F2F5F8]">
              이력 전체
            </button>
            <button
              type="button"
              onClick={() => focus(selected)}
              className="h-10 flex-1 rounded-md bg-[#FF6B3D] text-[14px] font-medium text-[#0A1219]"
            >
              3D 위치
            </button>
          </div>
          </div>
        </aside>
      ) : null}
      </FrameSlot>
    </>
  );
}

function SlotStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-[#5C6B7A]">{label}</p>
      <p className="mt-1 text-[22px] leading-none font-light text-[#F2F5F8]">{value}</p>
    </div>
  );
}

function Info({ label, value, valueClass = "text-[#F2F5F8]" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[#5C6B7A]">{label}</dt>
      <dd className={cn("truncate", valueClass)}>{value}</dd>
    </div>
  );
}

function History({ label, time, muted = false }: { label: string; time: string; muted?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 text-[12px]">
      <span className={muted ? "text-[#9AA8B6]" : "text-[#F2F5F8]"}>{label}</span>
      <span className="text-[#5C6B7A]">{time}</span>
    </li>
  );
}
